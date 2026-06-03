/**
 * POST /api/scenario
 *
 * Takes a natural-language life question and the user's financial baseline,
 * returns a structured list of ScenarioEvents + a narrative interpretation.
 *
 * The LLM's ONLY jobs:
 *   1. Parse the question into ScenarioEvent[]
 *   2. Mark unknown values (delta = -1) so the UI can ask for them
 *   3. Narrate the results once the engine has run the numbers
 *
 * The LLM never does arithmetic. All math runs in lib/scenario.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { ScenarioEvent } from "@/lib/scenario";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a financial scenario parser for Pacioli, a household financial planning tool.

Your job is to convert a natural-language life question into a structured list of financial events, then narrate the results once the projection engine has run.

## Rules

1. Output ONLY valid JSON — no markdown, no prose outside the JSON structure.
2. Never do arithmetic yourself. The projection engine handles all math.
3. For uncertain amounts, ALWAYS provide a bracket (pessimistic/base/optimistic) rather than asking the user to supply a number. Use real-world context to estimate plausible ranges. Set delta = bracket.base.
4. Only set readyToProject: false if you are missing structural information (e.g. which month something starts, whether it's recurring) that a bracket cannot substitute for. Never block on uncertain dollar amounts.
5. If the user asks a follow-up after results are shown, update your events list or answer the question directly.

## Output schema

\`\`\`json
{
  "events": [
    {
      "id": "unique-string",
      "label": "Human-readable label",
      "type": "income" | "expense" | "savings",
      "startMonth": "YYYY-MM",
      "endMonth": "YYYY-MM or null",
      "delta": number (= bracket.base if bracket present, else the known amount),
      "recurring": boolean,
      "bracket": {
        "pessimistic": number,
        "base": number,
        "optimistic": number
      } | null
    }
  ],
  "clarifyingQuestion": "Only if structural info is missing (not dollar amounts). Otherwise null.",
  "readyToProject": boolean,
  "bracketSummary": "One sentence explaining the range, e.g. 'Bookstore income modelled as $1k–$4k/mo based on typical indie retail.' Or null if no brackets."
}
\`\`\`

## Event type semantics
- "income": delta = monthly income amount (positive = more money in)
- "expense": delta = cost (always subtracted from cash flow)
- "savings": delta = extra monthly savings added on top

## Bracket guidance — use real-world context
- Quitting a job: salary is unknown → use the user's avgIncome as a reference for the income loss bracket
- Starting a business: bracket based on sector (bookstore: $1k–$4k/mo; SaaS: $0–$10k/mo; freelance: $2k–$8k/mo)
- Home purchase: use regional medians; bracket the mortgage payment
- Remodel / big expense: contractor ranges are typically 0.7×–1.4× estimate

## Examples

User: "Can I afford to quit my job and open a bookstore?"
→ Two events: (1) job income loss — bracket pessimistic = avgIncome (full loss), base = avgIncome * 0.9, optimistic = 0 (kept part-time). (2) bookstore income — bracket pessimistic = 500, base = 2000, optimistic = 5000. readyToProject = true.

User: "What if I save an extra $500 a month?"
→ One savings event, delta = 500, no bracket needed, readyToProject = true.

User: "What if I spend $40,000 on a kitchen remodel next March?"
→ One expense event, startMonth = next March, delta = 40000, bracket pessimistic = 56000 (1.4×), base = 40000, optimistic = 28000 (0.7×), readyToProject = true.

Today's date is provided in each request. Use it to interpret relative dates like "next year", "in 6 months", "this fall".`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedScenario {
  events: ScenarioEvent[];
  clarifyingQuestion: string | null;
  readyToProject: boolean;
  bracketSummary: string | null;
}

interface BracketSummaryInput {
  pessimistic: { endScenario: number; gainScenario: number };
  base:        { endScenario: number; gainScenario: number };
  optimistic:  { endScenario: number; gainScenario: number };
}

interface RequestBody {
  question: string;
  baseline: {
    startingNW: number;
    monthlyCashFlow: number;
    avgIncome: number;
    avgSpend: number;
    currentMonth: string;
  };
  /** Projection results to narrate (sent after engine runs) */
  projectionSummary?: {
    endBase: number;
    endScenario: number;
    gainBase: number;
    gainScenario: number;
    goesNegative: boolean;
    runwayMonths?: number;
    bracket?: BracketSummaryInput;
  };
  /** Previously parsed events (for follow-up turns) */
  existingEvents?: ScenarioEvent[];
  mode: "parse" | "narrate";
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY not configured on the server." },
      { status: 500 },
    );
  }

  const body: RequestBody = await req.json();
  const { question, baseline, projectionSummary, existingEvents, mode } = body;

  // ── Mode: parse NL → events ────────────────────────────────────────────────
  if (mode === "parse") {
    const userMessage = `Today is ${baseline.currentMonth}.

The user's financial baseline:
- Current net worth: $${baseline.startingNW.toLocaleString()}
- Monthly cash flow (income − spend): $${baseline.monthlyCashFlow.toLocaleString()}/mo
- Average monthly income: $${baseline.avgIncome.toLocaleString()}/mo
- Average monthly spend: $${baseline.avgSpend.toLocaleString()}/mo

${existingEvents?.length ? `Previously parsed events: ${JSON.stringify(existingEvents, null, 2)}\n` : ""}
User's question: "${question}"

Parse this into structured scenario events. Follow the output schema exactly.`;

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";

    let parsed: ParsedScenario;
    try {
      // Strip any accidental markdown fences
      const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse LLM response", raw },
        { status: 502 },
      );
    }

    return NextResponse.json(parsed);
  }

  // ── Mode: narrate results ──────────────────────────────────────────────────
  if (mode === "narrate" && projectionSummary) {
    const { endBase, endScenario, gainBase, gainScenario, goesNegative, runwayMonths, bracket } =
      projectionSummary;

    const bracketSection = bracket
      ? `\nRange (pessimistic → base → optimistic):
- Pessimistic: NW ${bracket.pessimistic.gainScenario >= 0 ? "+" : ""}$${bracket.pessimistic.gainScenario.toLocaleString()} → $${bracket.pessimistic.endScenario.toLocaleString()}
- Base:        NW ${bracket.base.gainScenario >= 0 ? "+" : ""}$${bracket.base.gainScenario.toLocaleString()} → $${bracket.base.endScenario.toLocaleString()}
- Optimistic:  NW ${bracket.optimistic.gainScenario >= 0 ? "+" : ""}$${bracket.optimistic.gainScenario.toLocaleString()} → $${bracket.optimistic.endScenario.toLocaleString()}`
      : "";

    const narrateMessage = `Today is ${baseline.currentMonth}.

The user asked: "${question}"

Projection results:
- Base trajectory (no changes): net worth ${gainBase >= 0 ? "+" : ""}$${gainBase.toLocaleString()} → $${endBase.toLocaleString()}
- Scenario (base case): net worth ${gainScenario >= 0 ? "+" : ""}$${gainScenario.toLocaleString()} → $${endScenario.toLocaleString()}
- Does scenario go negative: ${goesNegative}${runwayMonths != null ? `\n- Runway: ${runwayMonths} months` : ""}${bracketSection}

Scenario events:
${JSON.stringify(existingEvents, null, 2)}

Write 2–3 sentences in plain English. ${bracket ? "Lead with the range: best case vs worst case, then give the base-case number. Be honest about uncertainty." : "Use the actual numbers. Be honest about uncertainty."} No JSON, no markdown.`;

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 256,
      messages: [
        { role: "system", content: "You are a concise, honest financial narrator. Use the exact numbers provided. Never add caveats not supported by the data. Plain prose only — no JSON, no markdown headers." },
        { role: "user", content: narrateMessage },
      ],
    });

    const narration = response.choices[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ narration });
  }

  return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
}

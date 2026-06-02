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
2. Never invent numbers the user hasn't provided or clearly implied. If a number is unknown, set delta to -1 and mark it in the "unknowns" array.
3. Never do arithmetic yourself. The projection engine handles all math.
4. If the user asks a follow-up after results are shown, update your events list or answer the question directly.

## Output schema

\`\`\`json
{
  "events": [
    {
      "id": "unique-string",
      "label": "Human-readable label for this event",
      "type": "income" | "expense" | "savings",
      "startMonth": "YYYY-MM",
      "endMonth": "YYYY-MM or null",
      "delta": number (positive magnitude, -1 if unknown),
      "recurring": boolean
    }
  ],
  "unknowns": [
    {
      "eventId": "id of the event with unknown delta",
      "question": "Single clarifying question to ask the user"
    }
  ],
  "clarifyingQuestion": "If there are unknowns, ask ONE question here. Otherwise null.",
  "readyToProject": boolean
}
\`\`\`

## Event type semantics
- "income": positive delta = more income; negative delta handled by sign convention — always use positive magnitude
- "expense": always reduces cash flow by delta amount
- "savings": adds delta to monthly savings (increases effective cash flow)

## Examples

User: "Can I afford to quit my job in September and open a bookstore?"
→ Two events: (1) income event ending in August — but delta is their salary which is unknown. (2) bookstore income starting some month — delta unknown. Ask about salary first.

User: "What if I save an extra $500 a month?"
→ One savings event, startMonth = current month, delta = 500, recurring = true, readyToProject = true.

User: "What if I spend $40,000 on a kitchen remodel next March?"
→ One expense event, startMonth = next March, delta = 40000, recurring = false, readyToProject = true.

Today's date is provided in each request. Use it to interpret relative dates like "next year", "in 6 months", "this fall".`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedScenario {
  events: ScenarioEvent[];
  unknowns: { eventId: string; question: string }[];
  clarifyingQuestion: string | null;
  readyToProject: boolean;
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
    const { endBase, endScenario, gainBase, gainScenario, goesNegative, runwayMonths } =
      projectionSummary;

    const narrateMessage = `Today is ${baseline.currentMonth}.

The user asked: "${question}"

Projection results (12 months):
- Base trajectory (no changes): net worth grows by $${gainBase.toLocaleString()} to $${endBase.toLocaleString()}
- Scenario trajectory: net worth grows by $${gainScenario.toLocaleString()} to $${endScenario.toLocaleString()}
- Does scenario go negative: ${goesNegative}${runwayMonths != null ? `\n- Runway at scenario cash flow: ${runwayMonths} months` : ""}

Scenario events applied:
${JSON.stringify(existingEvents, null, 2)}

Write a 2–3 sentence plain-English summary of what this means for the user. Be honest about uncertainty. Use the actual numbers from the projection. Do NOT use JSON — just prose.`;

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

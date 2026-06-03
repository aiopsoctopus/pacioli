"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  fetchJSON, formatCurrency,
  AccountData, MonthIncome, getNetWorth, getMonthlySpend,
  avgMonthlyIncome, useTransactions, getNormalizedMonthlyCategorySpend, classifyMerchants,
} from "@/lib/data";
import { runProjection, runBracketProjection, ScenarioEvent, ProjectionSummary } from "@/lib/scenario";
import { useDemo } from "@/components/demo-provider";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Legend,
} from "recharts";
import { Send, Loader2, Sparkles, RotateCcw, Plus } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const WINDOW_MONTHS = 6;
const HORIZON_OPTIONS = [
  { label: "1 yr",  months: 12  },
  { label: "3 yr",  months: 36  },
  { label: "5 yr",  months: 60  },
  { label: "10 yr", months: 120 },
] as const;
const SCENARIO_STORAGE_KEY = "pacioli-scenario-events";
const SCENARIO_DELTA_KEY   = "pacioli-scenario-delta";

// ─── Component ────────────────────────────────────────────────────────────────
export default function ForecastView() {
  const { isDemo } = useDemo();
  const ns = isDemo ? "demo" : "";
  const [accounts, setAccounts] = useState<AccountData | null>(null);
  const [income, setIncome] = useState<MonthIncome[] | null>(null);
  const [projectionMonths, setProjectionMonths] = useState(12);
  const [scenarioDelta, setScenarioDelta] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem(SCENARIO_DELTA_KEY) ?? 0);
  });

  // ── Scenario chat state ──────────────────────────────────────────────────────
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatNarration, setChatNarration] = useState<string | null>(null);
  const [clarifyingQuestion, setClarifyingQuestion] = useState<string | null>(null);
  const [scenarioEvents, setScenarioEvents] = useState<ScenarioEvent[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(SCENARIO_STORAGE_KEY) ?? "[]"); }
    catch { return []; }
  });
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const transactions = useTransactions(ns);

  useEffect(() => {
    if (!isDemo) return;
    fetchJSON<AccountData>("accounts.json").then(setAccounts);
    fetchJSON<MonthIncome[]>("income.json").then(setIncome);
  }, [isDemo]);

  // Persist scenario state across navigation
  useEffect(() => {
    localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(scenarioEvents));
  }, [scenarioEvents]);
  useEffect(() => {
    localStorage.setItem(SCENARIO_DELTA_KEY, String(scenarioDelta));
  }, [scenarioDelta]);

  function addEvent(type: ScenarioEvent["type"]) {
    const todayMonth = new Date().toISOString().slice(0, 7);
    const newEvent: ScenarioEvent = {
      id: `manual_${Date.now()}`,
      label: type === "income" ? "New income" : type === "expense" ? "New expense" : "Extra savings",
      type,
      startMonth: todayMonth,
      delta: type === "savings" ? 200 : type === "income" ? 1000 : 500,
      recurring: true,
    };
    setScenarioEvents((evs) => [...evs, newEvent]);
  }

  const derived = useMemo(() => {
    if (transactions.length === 0) return null;

    // All transaction months (sorted)
    const txMonths = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort();

    // Current month: latest income month if available, else latest tx month
    const sortedIncomeMonths = income ? income.map((i) => i.month).sort() : [];
    const currentMonth = sortedIncomeMonths.length > 0
      ? sortedIncomeMonths[sortedIncomeMonths.length - 1]
      : txMonths[txMonths.length - 1];

    // Starting NW: cap to today's month so forward-dated balances don't inflate
    let startingNW = 0;
    if (accounts) {
      const todayMonth = new Date().toISOString().slice(0, 7);
      const balanceMonths = [
        ...accounts.assets.flatMap((a) => Object.keys(a.balances)),
      ].sort().filter((m) => m <= todayMonth);
      const latestAccountMonth = balanceMonths.at(-1) ?? currentMonth;
      startingNW = getNetWorth(accounts, latestAccountMonth);
    }

    // Last N completed months before currentMonth (used for income window)
    const completedMonths = txMonths.filter((m) => m < currentMonth).slice(-WINDOW_MONTHS);

    // Average monthly income (0 if no income data)
    const avgIncome = income ? avgMonthlyIncome(income, currentMonth, WINDOW_MONTHS) : 0;

    // Normalized monthly spend using frequency classifier (amortizes annual costs correctly)
    const normalizedCatSpend = getNormalizedMonthlyCategorySpend(
      transactions.filter((t) => t.date.slice(0, 7) < currentMonth)
    );
    const avgSpend = Math.round(Object.values(normalizedCatSpend).reduce((s, v) => s + v, 0));

    // Fixed vs variable split for UI display — derived from frequency classifier.
    // "monthly" frequency (consistent recurring amount) → fixed; everything else → variable.
    const merchantClassifications = classifyMerchants(
      transactions.filter((t) => t.date.slice(0, 7) < currentMonth)
    );
    const fixedCats = new Set<string>();
    for (const c of merchantClassifications) {
      if (c.frequency === "monthly") fixedCats.add(c.category);
    }
    // A category is fixed only if ALL its merchants are monthly-classified
    const variableCats = new Set(
      merchantClassifications
        .filter((c) => c.frequency !== "monthly")
        .map((c) => c.category)
    );
    let avgFixed = 0, avgVariable = 0;
    for (const [cat, amt] of Object.entries(normalizedCatSpend)) {
      // If a category has any variable/annual merchants, treat the whole category as variable
      if (fixedCats.has(cat) && !variableCats.has(cat)) avgFixed += amt;
      else avgVariable += amt;
    }
    avgFixed = Math.round(avgFixed);
    avgVariable = Math.round(avgVariable);

    const monthlyCashFlow = avgIncome - avgSpend;
    const savingsRate = avgIncome > 0 ? Math.round((monthlyCashFlow / avgIncome) * 100) : 0;

    // Merge slider delta + chat scenario events
    const allEvents: ScenarioEvent[] = [...scenarioEvents];
    if (scenarioDelta !== 0) {
      allEvents.push({
        id: "slider",
        label: scenarioDelta > 0 ? `Save $${scenarioDelta.toLocaleString()}/mo more` : `Spend $${Math.abs(scenarioDelta).toLocaleString()}/mo more`,
        type: scenarioDelta > 0 ? "savings" : "expense",
        startMonth: currentMonth,
        delta: Math.abs(scenarioDelta),
        recurring: true,
      });
    }

    // Run projection — use bracket engine if any event has bracket data
    const hasBracket = allEvents.some((e) => e.bracket != null);
    const baselineArgs = { startingNW, monthlyCashFlow, startMonth: currentMonth, projectionMonths };

    const { rows: projRows, summary } = runProjection(baselineArgs, allEvents);
    const bracketResult = hasBracket ? runBracketProjection(baselineArgs, allEvents) : null;

    return {
      startingNW,
      avgIncome,
      avgFixed,
      avgVariable,
      avgSpend,
      monthlyCashFlow,
      savingsRate,
      currentMonth,
      endBase: summary.endBase,
      endScenario: summary.endScenario,
      gainBase: summary.gainBase,
      gainScenario: summary.gainScenario,
      summary,
      chartRows: projRows,
      bracketRows: bracketResult?.rows ?? null,
      bracketSummaries: bracketResult ? {
        pessimistic: bracketResult.summaryPessimistic,
        base:        bracketResult.summaryBase,
        optimistic:  bracketResult.summaryOptimistic,
      } : null,
      hasBracket,
      windowMonths: completedMonths.length,
    };
  }, [accounts, income, transactions, scenarioDelta, scenarioEvents, projectionMonths]);

  // ── Chat handler ─────────────────────────────────────────────────────────────
  async function handleChat(question: string) {
    if (!derived || !question.trim()) return;
    setChatLoading(true);
    setChatError(null);
    setChatNarration(null);
    setLastQuestion(question);

    try {
      // Step 1: parse NL → events
      const parseRes = await fetch("/api/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "parse",
          question,
          baseline: {
            startingNW: derived.startingNW,
            monthlyCashFlow: derived.monthlyCashFlow,
            avgIncome: derived.avgIncome,
            avgSpend: derived.avgSpend,
            currentMonth: derived.currentMonth,
          },
          existingEvents: scenarioEvents,
        }),
      });

      const parsed = await parseRes.json();
      if (!parseRes.ok) throw new Error(parsed.error ?? "Parse failed");

      // If clarifying question needed, surface it and stop
      if (!parsed.readyToProject && parsed.clarifyingQuestion) {
        setClarifyingQuestion(parsed.clarifyingQuestion);
        // Store partial events so next turn can build on them
        if (parsed.events?.length) setScenarioEvents(parsed.events.filter((e: ScenarioEvent) => e.delta !== -1));
        setChatLoading(false);
        return;
      }

      setClarifyingQuestion(null);
      const newEvents: ScenarioEvent[] = parsed.events ?? [];
      setScenarioEvents(newEvents);

      // Step 2: run projection (via the engine already in derived — trigger rerender)
      // The projection runs automatically via useMemo when scenarioEvents changes.
      // We need the summary *after* state update — compute it inline here.
      const baselineArgs2 = { startingNW: derived.startingNW, monthlyCashFlow: derived.monthlyCashFlow, startMonth: derived.currentMonth, projectionMonths };
      const { summary: projSummary } = runProjection(baselineArgs2, newEvents);
      const hasBracketNarrate = newEvents.some((e) => e.bracket != null);
      const bracketResult2 = hasBracketNarrate ? runBracketProjection(baselineArgs2, newEvents) : null;

      // Step 3: narrate
      const narrateRes = await fetch("/api/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "narrate",
          question,
          baseline: {
            startingNW: derived.startingNW,
            monthlyCashFlow: derived.monthlyCashFlow,
            avgIncome: derived.avgIncome,
            avgSpend: derived.avgSpend,
            currentMonth: derived.currentMonth,
          },
          projectionSummary: {
            ...projSummary,
            bracket: bracketResult2 ? {
              pessimistic: { endScenario: bracketResult2.summaryPessimistic.endScenario, gainScenario: bracketResult2.summaryPessimistic.gainScenario },
              base:        { endScenario: bracketResult2.summaryBase.endScenario,        gainScenario: bracketResult2.summaryBase.gainScenario },
              optimistic:  { endScenario: bracketResult2.summaryOptimistic.endScenario,  gainScenario: bracketResult2.summaryOptimistic.gainScenario },
            } : undefined,
          },
          existingEvents: newEvents,
        }),
      });

      const narrateData = await narrateRes.json();
      if (!narrateRes.ok) throw new Error(narrateData.error ?? "Narration failed");
      setChatNarration(narrateData.narration);
    } catch (e: unknown) {
      setChatError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setChatLoading(false);
    }
  }

  function resetScenario() {
    setScenarioEvents([]);
    setScenarioDelta(0);
    setChatNarration(null);
    setClarifyingQuestion(null);
    setChatError(null);
    setLastQuestion(null);
    setChatInput("");
    localStorage.removeItem(SCENARIO_STORAGE_KEY);
    localStorage.removeItem(SCENARIO_DELTA_KEY);
  }

  if (!isDemo && transactions.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <p className="pacioli-text-muted text-sm mb-1">Based on your actual data, projected forward.</p>
      <h2 className="text-3xl font-bold pacioli-text-primary mt-1 mb-6">What the Future Looks Like</h2>
      <p className="pacioli-text-muted mb-8 max-w-sm">No data yet. Import your accounts and transactions to see your 12-month net worth projection.</p>
      <a href="/connect" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"#0d6e6e", color:"#fff", padding:"12px 24px", borderRadius:10, fontWeight:600, textDecoration:"none" }}>
        Connect data
      </a>
    </div>
  );

  if (!derived) {
    return <div className="pacioli-text-muted animate-pulse">Calculating forecast from your data...</div>;
  }

  const {
    startingNW, avgIncome, avgFixed, avgVariable, avgSpend,
    monthlyCashFlow, savingsRate, endBase, endScenario,
    gainBase, gainScenario, chartRows, bracketRows, bracketSummaries, hasBracket, windowMonths,
  } = derived;

  const showScenario = scenarioEvents.length > 0 || scenarioDelta !== 0;
  const EXAMPLE_PROMPTS = [
    "Can I afford to quit my job?",
    "What if we buy a house next year?",
    "What if I start a side business?",
    "Can I retire in 10 years?",
  ];

  return (
    <div className="space-y-6">

      {/* ── Page header ───────────────────────────────────────────────────────── */}
      <div>
        <p className="pacioli-text-muted text-sm">Model a life change and see the numbers.</p>
        <h2 className="text-3xl font-bold pacioli-text-primary mt-1">Scenario Planner</h2>
      </div>

      {/* ── Hero: What if? input ──────────────────────────────────────────────── */}
      <div className="pacioli-bg-surface rounded-2xl border overflow-hidden">
        {/* Input area */}
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-400" />
              <span className="text-base font-semibold pacioli-text-primary">Ask a "What if?" question</span>
            </div>
            {(scenarioEvents.length > 0 || chatNarration || scenarioDelta !== 0) && (
              <button
                onClick={resetScenario}
                className="flex items-center gap-1.5 text-xs pacioli-text-muted hover:pacioli-text-secondary transition-colors"
              >
                <RotateCcw size={11} /> Reset scenario
              </button>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); handleChat(chatInput); setChatInput(""); }}
            className="flex gap-2"
          >
            <input
              ref={chatInputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={clarifyingQuestion ? `↳ ${clarifyingQuestion}` : "e.g. Can I afford to quit my job and start a business?"}
              disabled={chatLoading}
              className="flex-1 text-sm px-4 py-3 rounded-xl pacioli-bg-surface-2 border pacioli-text-primary placeholder:pacioli-text-muted focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="px-4 py-3 rounded-xl bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition-colors font-medium text-sm flex items-center gap-2"
            >
              {chatLoading ? <Loader2 size={15} className="animate-spin" /> : <><Send size={14} /> Ask</>}
            </button>
          </form>

          {/* Example prompt chips — shown when idle */}
          {!chatNarration && !clarifyingQuestion && !chatLoading && scenarioEvents.length === 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => { handleChat(p); }}
                  className="text-xs px-3 py-1.5 rounded-full pacioli-bg-surface-2 border pacioli-text-muted hover:pacioli-text-secondary hover:border-indigo-500/40 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Clarifying question callout */}
          {clarifyingQuestion && !chatLoading && (
            <div className="mt-3 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-indigo-950/40 border border-indigo-500/25">
              <Sparkles size={13} className="text-indigo-400 mt-0.5 shrink-0" />
              <p className="text-sm text-indigo-300 leading-relaxed">
                <span className="font-semibold">One question: </span>{clarifyingQuestion}
              </p>
            </div>
          )}

          {/* Narration */}
          {chatNarration && (
            <div className="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl pacioli-bg-surface-2 border">
              <Sparkles size={13} className="text-indigo-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm pacioli-text-secondary leading-relaxed">{chatNarration}</p>
                {lastQuestion && (
                  <p className="text-xs pacioli-text-muted mt-1.5 italic">"{lastQuestion}"</p>
                )}
              </div>
            </div>
          )}

          {chatError && (
            <p className="mt-3 text-xs text-red-400">{chatError}</p>
          )}
        </div>

        {/* Divider + manual event controls */}
        <div className="border-t px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium pacioli-text-muted uppercase tracking-wide">
              {scenarioEvents.length > 0 ? `${scenarioEvents.length} scenario event${scenarioEvents.length > 1 ? "s" : ""}` : "Or build manually"}
            </p>
            <div className="flex gap-2">
              {(["income", "expense", "savings"] as const).map((type) => {
                const cfg = EVENT_TYPE_CONFIG[type];
                return (
                  <button
                    key={type}
                    onClick={() => addEvent(type)}
                    style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border, borderWidth: 1, borderStyle: "solid" }}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 font-medium"
                  >
                    <Plus size={11} /> {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {scenarioEvents.length > 0 && (
            <div className="space-y-3">
              {scenarioEvents.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  onChange={(updated) =>
                    setScenarioEvents((evs) => evs.map((e) => (e.id === ev.id ? updated : e)))
                  }
                  onRemove={() =>
                    setScenarioEvents((evs) => evs.filter((e) => e.id !== ev.id))
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Chart: responds to scenario ───────────────────────────────────────── */}
      <div className="pacioli-bg-surface rounded-2xl p-6 border">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-sm font-semibold pacioli-text-secondary">Net Worth Projection</h3>
            <p className="text-xs pacioli-text-muted mt-0.5">
              {windowMonths}-mo avg · {formatCurrency(avgIncome)}/mo in · {formatCurrency(avgSpend)}/mo out · 6.6% annual return
            </p>
          </div>
          <div className="flex gap-1">
            {HORIZON_OPTIONS.map((opt) => (
              <button
                key={opt.months}
                onClick={() => setProjectionMonths(opt.months)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  projectionMonths === opt.months
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "pacioli-bg-surface-2 border-transparent pacioli-text-muted hover:pacioli-text-secondary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartRows} style={{ marginTop: 16 }}>
            <defs>
              <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="scenGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, #27272a)" />
            <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false} tickLine={false} width={60}
            />
            <Tooltip
              formatter={(v: unknown, name: unknown) => {
                const labels: Record<string, string> = {
                  base: hasBracket ? "Base case" : showScenario ? "With scenario" : "Base trajectory",
                  scenario: "With scenario",
                  pessimistic: "Pessimistic",
                  optimistic: "Optimistic",
                };
                return [formatCurrency(Number(v)), labels[name as string] ?? String(name)];
              }}
              contentStyle={{ background: "var(--bg-surface, #18181b)", border: "1px solid var(--border-subtle, #3f3f46)", borderRadius: 8 }}
              labelStyle={{ color: "var(--text-secondary, #a1a1aa)" }}
            />
            {(showScenario || hasBracket) && (
              <Legend formatter={(v) => ({
                base: hasBracket ? "Base case" : "With scenario",
                scenario: "With scenario",
                pessimistic: "Pessimistic",
                optimistic: "Optimistic",
              }[v as string] ?? v)} />
            )}
            <ReferenceLine x="Now" stroke="#6366f1" strokeDasharray="4 4" label={{ value: "Today", fill: "#6366f1", fontSize: 11 }} />

            {/* Base / no-scenario line */}
            {!showScenario && !hasBracket && (
              <Area type="monotone" dataKey="base" data={chartRows} stroke="#10b981" strokeWidth={2} fill="url(#baseGrad)" dot={false} />
            )}

            {/* Normal scenario (no bracket) */}
            {showScenario && !hasBracket && (
              <>
                <Area type="monotone" dataKey="base" data={chartRows} stroke="#10b981" strokeWidth={2} fill="url(#baseGrad)" dot={false} />
                <Area type="monotone" dataKey="scenario" data={chartRows} stroke="#6366f1" strokeWidth={2.5} fill="url(#scenGrad)" dot={false} />
              </>
            )}

            {/* Bracket mode: pessimistic band + base + optimistic */}
            {hasBracket && bracketRows && (
              <>
                {/* Shaded band between pessimistic and optimistic */}
                <Area type="monotone" dataKey="optimistic" data={bracketRows} stroke="none" fill="#6366f1" fillOpacity={0.12} dot={false} legendType="none" />
                <Area type="monotone" dataKey="pessimistic" data={bracketRows} stroke="none" fill="var(--bg-surface, #18181b)" fillOpacity={1} dot={false} legendType="none" />
                {/* Three lines */}
                <Area type="monotone" dataKey="pessimistic" data={bracketRows} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" fill="none" dot={false} />
                <Area type="monotone" dataKey="base"        data={bracketRows} stroke="#6366f1" strokeWidth={2.5} fill="url(#scenGrad)" dot={false} />
                <Area type="monotone" dataKey="optimistic"  data={bracketRows} stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 3" fill="none" dot={false} />
                {/* Base no-scenario ghost */}
                <Area type="monotone" dataKey="base" data={chartRows} stroke="#71717a" strokeWidth={1} strokeDasharray="2 4" fill="none" dot={false} name="base" />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>

        {/* Bracket legend annotation */}
        {hasBracket && (
          <div className="flex items-center gap-4 mt-3 text-xs pacioli-text-muted flex-wrap">
            <span className="flex items-center gap-1.5"><span style={{ display:"inline-block", width:20, height:2, background:"#10b981", borderTop:"2px dashed #10b981" }} /> Optimistic</span>
            <span className="flex items-center gap-1.5"><span style={{ display:"inline-block", width:20, height:2, background:"#6366f1" }} /> Base case</span>
            <span className="flex items-center gap-1.5"><span style={{ display:"inline-block", width:20, height:2, borderTop:"2px dashed #f59e0b" }} /> Pessimistic</span>
            <span className="flex items-center gap-1.5"><span style={{ display:"inline-block", width:20, height:2, borderTop:"2px dashed #71717a" }} /> No change</span>
          </div>
        )}
      </div>

      {/* ── KPI summary ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Today's Net Worth"
          value={formatCurrency(startingNW)}
          sub="current baseline"
        />
        <MetricCard
          label="Base trajectory"
          value={formatCurrency(endBase)}
          sub={`${gainBase >= 0 ? "+" : ""}${formatCurrency(gainBase)} over ${projectionMonths / 12}yr`}
          highlight="pacioli-text-success"
        />
        {hasBracket && bracketSummaries ? (
          <MetricCard
            label="Range (pessimistic → optimistic)"
            value={`${formatCurrency(bracketSummaries.pessimistic.endScenario, true)} – ${formatCurrency(bracketSummaries.optimistic.endScenario, true)}`}
            sub={`Base: ${formatCurrency(bracketSummaries.base.endScenario, true)}`}
            highlight="pacioli-text-secondary"
          />
        ) : (
          <MetricCard
            label={showScenario ? "With scenario" : "Monthly cash flow"}
            value={showScenario ? formatCurrency(endScenario) : formatCurrency(monthlyCashFlow)}
            sub={showScenario ? `${gainScenario >= gainBase ? "+" : ""}${formatCurrency(gainScenario - gainBase)} vs base` : "after all expenses"}
            highlight={showScenario ? (gainScenario >= gainBase ? "pacioli-text-success" : "pacioli-text-danger") : (monthlyCashFlow >= 0 ? "pacioli-text-success" : "pacioli-text-danger")}
          />
        )}
        <MetricCard
          label="Savings rate"
          value={`${savingsRate}%`}
          sub="of gross income"
          highlight={savingsRate >= 20 ? "pacioli-text-success" : "pacioli-text-warning"}
        />
      </div>

      {/* ── Assumptions (secondary) ───────────────────────────────────────────── */}
      <details className="pacioli-bg-surface rounded-2xl border group">
        <summary className="flex items-center justify-between p-5 cursor-pointer list-none pacioli-text-muted text-sm hover:pacioli-text-secondary transition-colors">
          <span className="font-medium">Projection assumptions</span>
          <span className="text-xs group-open:rotate-180 transition-transform inline-block">▾</span>
        </summary>
        <div className="px-5 pb-5 space-y-3 border-t pt-4">
          {[
            { label: "Average monthly income", value: avgIncome, color: "pacioli-text-success" },
            { label: "Fixed expenses", value: -avgFixed, color: "pacioli-text-danger" },
            { label: "Variable expenses", value: -avgVariable, color: "pacioli-text-warning" },
            { label: "Net monthly cash flow", value: monthlyCashFlow, color: monthlyCashFlow >= 0 ? "pacioli-text-success" : "pacioli-text-danger" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between items-center py-1.5 border-b pacioli-border-subtle last:border-0">
              <span className="text-sm pacioli-text-secondary">{label}</span>
              <span className={`text-sm font-semibold ${color}`}>
                {value >= 0 ? "" : "−"}{formatCurrency(Math.abs(value))}
              </span>
            </div>
          ))}
          <p className="text-xs pacioli-text-muted pt-1">
            Derived from your last {windowMonths} completed months. Investment accounts grow at 6.6%/yr (~0.55%/mo).
          </p>
        </div>
      </details>

    </div>
  );
}

function MetricCard({ label, value, sub, highlight }: {
  label: string; value: string; sub: string; highlight?: string;
}) {
  return (
    <div className="pacioli-bg-surface rounded-2xl p-5 border">
      <p className="text-xs pacioli-text-muted uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-bold ${highlight ?? "pacioli-text-primary"}`}>{value}</p>
      <p className="text-xs pacioli-text-faint mt-1">{sub}</p>
    </div>
  );
}

// ─── Event type config ────────────────────────────────────────────────────────

const EVENT_TYPE_CONFIG = {
  income:  { label: "Income",  color: "#059669", border: "#10b981", bg: "rgba(16,185,129,0.12)",  maxDelta: 20000, step: 100 },
  expense: { label: "Expense", color: "#dc2626", border: "#ef4444", bg: "rgba(239,68,68,0.10)",   maxDelta: 50000, step: 500 },
  savings: { label: "Savings", color: "#4338ca", border: "#6366f1", bg: "rgba(99,102,241,0.10)",  maxDelta: 5000,  step: 50  },
} as const;

// ─── EventCard ────────────────────────────────────────────────────────────────

function EventCard({
  event,
  onChange,
  onRemove,
}: {
  event: ScenarioEvent;
  onChange: (updated: ScenarioEvent) => void;
  onRemove: () => void;
}) {
  const cfg = EVENT_TYPE_CONFIG[event.type];
  const [deltaInput, setDeltaInput] = useState(String(event.delta));
  const [editingLabel, setEditingLabel] = useState(false);

  function update(patch: Partial<ScenarioEvent>) {
    onChange({ ...event, ...patch });
  }

  function commitDeltaInput() {
    const val = parseFloat(deltaInput);
    if (!isNaN(val) && val >= 0) {
      update({ delta: Math.round(val) });
      setDeltaInput(String(Math.round(val)));
    } else {
      setDeltaInput(String(event.delta));
    }
  }

  const recurringLabel = event.recurring
    ? (event.type === "expense" ? "/mo" : "/mo")
    : "one-time";

  return (
    <div className="rounded-xl p-4" style={{ background: cfg.bg, borderColor: cfg.border, borderWidth: 1, borderStyle: "solid" }}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wide shrink-0" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          {editingLabel ? (
            <input
              autoFocus
              type="text"
              defaultValue={event.label}
              onBlur={(e) => { update({ label: e.target.value || event.label }); setEditingLabel(false); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }}
              className="text-sm px-1.5 py-0.5 rounded pacioli-bg-surface border pacioli-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 min-w-0"
            />
          ) : (
            <button
              onClick={() => setEditingLabel(true)}
              className="text-sm pacioli-text-primary font-medium truncate hover:pacioli-text-secondary text-left"
              title="Click to rename"
            >
              {event.label}
            </button>
          )}
        </div>
        <button
          onClick={onRemove}
          className="text-xs pacioli-text-muted hover:text-red-400 transition-colors shrink-0"
          title="Remove event"
        >
          ✕
        </button>
      </div>

      {/* Delta slider + input */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs pacioli-text-muted">
            Amount {recurringLabel}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-xs pacioli-text-muted">$</span>
            <input
              type="number"
              value={deltaInput}
              min={0}
              max={cfg.maxDelta}
              step={cfg.step}
              onChange={(e) => setDeltaInput(e.target.value)}
              onBlur={commitDeltaInput}
              onKeyDown={(e) => e.key === "Enter" && commitDeltaInput()}
              className="w-24 text-xs text-right px-2 py-1 rounded pacioli-bg-surface border pacioli-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={cfg.maxDelta}
          step={cfg.step}
          value={event.delta}
          onChange={(e) => {
            const v = Number(e.target.value);
            update({ delta: v });
            setDeltaInput(String(v));
          }}
          className="w-full accent-indigo-500"
        />
      </div>

      {/* Month range + recurring */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5">
          <label className="text-xs pacioli-text-muted">From</label>
          <input
            type="month"
            value={event.startMonth}
            onChange={(e) => update({ startMonth: e.target.value })}
            className="text-xs px-2 py-1 rounded pacioli-bg-surface border pacioli-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        {event.recurring && (
          <div className="flex items-center gap-1.5">
            <label className="text-xs pacioli-text-muted">Until</label>
            <input
              type="month"
              value={event.endMonth ?? ""}
              placeholder="forever"
              onChange={(e) => update({ endMonth: e.target.value || undefined })}
              className="text-xs px-2 py-1 rounded pacioli-bg-surface border pacioli-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}
        <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={event.recurring}
            onChange={(e) => update({ recurring: e.target.checked })}
            className="accent-indigo-500"
          />
          <span className="text-xs pacioli-text-muted">Recurring</span>
        </label>
      </div>
    </div>
  );
}

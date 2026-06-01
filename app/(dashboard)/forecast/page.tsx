"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  fetchJSON, formatCurrency,
  AccountData, MonthIncome, getNetWorth, getMonthlySpend,
  avgMonthlyIncome, useTransactions, getNormalizedMonthlyCategorySpend,
} from "@/lib/data";
import { runProjection, ScenarioEvent, ProjectionSummary } from "@/lib/scenario";
import { useDemo } from "@/components/demo-provider";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Legend,
} from "recharts";
import { Send, Loader2, Sparkles, RotateCcw } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const WINDOW_MONTHS = 6;

// ─── Component ────────────────────────────────────────────────────────────────
export default function ForecastView() {
  const { isDemo } = useDemo();
  const ns = isDemo ? "demo" : "";
  const [accounts, setAccounts] = useState<AccountData | null>(null);
  const [income, setIncome] = useState<MonthIncome[] | null>(null);
  const [scenarioDelta, setScenarioDelta] = useState(0); // extra $ saved per month

  // ── Scenario chat state ──────────────────────────────────────────────────────
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatNarration, setChatNarration] = useState<string | null>(null);
  const [clarifyingQuestion, setClarifyingQuestion] = useState<string | null>(null);
  const [scenarioEvents, setScenarioEvents] = useState<ScenarioEvent[]>([]);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const transactions = useTransactions(ns);

  useEffect(() => {
    if (!isDemo) return;
    fetchJSON<AccountData>("accounts.json").then(setAccounts);
    fetchJSON<MonthIncome[]>("income.json").then(setIncome);
  }, [isDemo]);

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

    // Fixed vs variable split for UI display (category heuristic on normalized amounts)
    const FIXED_CATEGORIES = new Set([
      "Housing", "Mortgage", "Rent", "Utilities", "Insurance",
      "Subscriptions", "Loan Payment", "Phone", "Internet",
    ]);
    let avgFixed = 0, avgVariable = 0;
    for (const [cat, amt] of Object.entries(normalizedCatSpend)) {
      if (FIXED_CATEGORIES.has(cat)) avgFixed += amt; else avgVariable += amt;
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

    // Run projection via the engine
    const { rows: projRows, summary } = runProjection(
      { startingNW, monthlyCashFlow, startMonth: currentMonth },
      allEvents,
    );

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
      windowMonths: completedMonths.length,
    };
  }, [accounts, income, transactions, scenarioDelta, scenarioEvents]);

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
      const { summary: projSummary } = runProjection(
        { startingNW: derived.startingNW, monthlyCashFlow: derived.monthlyCashFlow, startMonth: derived.currentMonth },
        newEvents,
      );

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
          projectionSummary: projSummary,
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
    gainBase, gainScenario, chartRows, windowMonths,
  } = derived;

  const showScenario = scenarioDelta !== 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="pacioli-text-muted text-sm">Based on your last {windowMonths} months of actual data</p>
        <h2 className="text-3xl font-bold pacioli-text-primary mt-1">What the Future Looks Like</h2>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Today's Net Worth"
          value={formatCurrency(startingNW)}
          sub="current baseline"
        />
        <MetricCard
          label={showScenario ? "Base (12 mo)" : "In 12 Months"}
          value={formatCurrency(endBase)}
          sub={`+${formatCurrency(gainBase)} projected`}
          highlight="pacioli-text-success"
        />
        {showScenario ? (
          <MetricCard
            label="With Scenario (12 mo)"
            value={formatCurrency(endScenario)}
            sub={`+${formatCurrency(gainScenario)} projected`}
            highlight="pacioli-text-success"
          />
        ) : (
          <MetricCard
            label="Monthly Cash Flow"
            value={formatCurrency(monthlyCashFlow)}
            sub="after all expenses"
            highlight={monthlyCashFlow >= 0 ? "pacioli-text-success" : "pacioli-text-danger"}
          />
        )}
        <MetricCard
          label="Savings Rate"
          value={`${savingsRate}%`}
          sub="of gross income"
          highlight={savingsRate >= 20 ? "pacioli-text-success" : "pacioli-text-warning"}
        />
      </div>

      {/* Scenario toggle */}
      <div className="pacioli-bg-surface rounded-2xl p-5 border">
        <h3 className="text-sm font-semibold pacioli-text-secondary mb-1">Scenario: What if I save more?</h3>
        <p className="text-xs pacioli-text-muted mb-4">
          Drag to add extra monthly savings on top of your current cash flow and see how it changes your 12-month projection.
        </p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={1000}
            step={50}
            value={scenarioDelta}
            onChange={(e) => setScenarioDelta(Number(e.target.value))}
            className="flex-1 accent-indigo-500"
          />
          <span className="text-sm font-semibold pacioli-text-primary w-24 text-right">
            {scenarioDelta === 0 ? "Off" : `+${formatCurrency(scenarioDelta)}/mo`}
          </span>
        </div>
        {showScenario && (
          <p className="text-xs pacioli-text-success mt-3">
            Saving an extra {formatCurrency(scenarioDelta)}/mo adds{" "}
            <span className="font-semibold">{formatCurrency(gainScenario - gainBase)}</span> over 12 months.
          </p>
        )}
      </div>

      {/* What if? chat panel */}
      <div className="pacioli-bg-surface rounded-2xl p-5 border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-indigo-400" />
            <h3 className="text-sm font-semibold pacioli-text-secondary">Ask a "What if?" question</h3>
          </div>
          {(scenarioEvents.length > 0 || chatNarration) && (
            <button
              onClick={resetScenario}
              className="flex items-center gap-1 text-xs pacioli-text-muted hover:pacioli-text-secondary transition-colors"
            >
              <RotateCcw size={11} /> Reset
            </button>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleChat(chatInput); setChatInput(""); }}
          className="flex gap-2"
        >
          <input
            ref={chatInputRef}
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={clarifyingQuestion ?? "e.g. Can I afford to quit and open a bookstore?"}
            disabled={chatLoading}
            className="flex-1 text-sm px-3 py-2 rounded-lg pacioli-bg-surface-2 border pacioli-text-primary placeholder:pacioli-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={chatLoading || !chatInput.trim()}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition-colors"
          >
            {chatLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </form>

        {/* Clarifying question */}
        {clarifyingQuestion && !chatLoading && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-indigo-950/30 border border-indigo-500/20">
            <p className="text-xs text-indigo-300">
              <span className="font-semibold">One question: </span>{clarifyingQuestion}
            </p>
          </div>
        )}

        {/* Editable event cards */}
        {scenarioEvents.length > 0 && (
          <div className="mt-4 space-y-3">
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

        {/* Narration */}
        {chatNarration && (
          <div className="mt-3 px-3 py-2 rounded-lg pacioli-bg-surface-2 border">
            <p className="text-sm pacioli-text-secondary leading-relaxed">{chatNarration}</p>
            {lastQuestion && (
              <p className="text-xs pacioli-text-muted mt-2 italic">"{lastQuestion}"</p>
            )}
          </div>
        )}

        {/* Error */}
        {chatError && (
          <p className="mt-3 text-xs text-red-400">{chatError}</p>
        )}

        {!chatNarration && !clarifyingQuestion && !chatLoading && scenarioEvents.length === 0 && (
          <p className="text-xs pacioli-text-muted mt-2">
            Describe a life change — quitting a job, a big purchase, starting a side income — and see how it affects your 12-month projection.
          </p>
        )}
      </div>

      {/* Forecast chart */}
      <div className="pacioli-bg-surface rounded-2xl p-6 border">
        <h3 className="text-sm font-semibold pacioli-text-secondary mb-1">Projected Net Worth</h3>
        <p className="text-xs pacioli-text-muted mb-4">
          Calculated from your {windowMonths}-month average income ({formatCurrency(avgIncome)}/mo) and spending ({formatCurrency(avgSpend)}/mo), with ~6.6% annualized investment return
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartRows}>
            <defs>
              <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="scenGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, #27272a)" />
            <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false} tickLine={false} width={60}
            />
            <Tooltip
              formatter={(v: unknown, name: unknown) => [
                formatCurrency(Number(v)),
                name === "base" ? "Base projection" : "With scenario",
              ]}
              contentStyle={{
                background: "var(--bg-surface, #18181b)",
                border: "1px solid var(--border-subtle, #3f3f46)",
                borderRadius: 8,
              }}
              labelStyle={{ color: "var(--text-secondary, #a1a1aa)" }}
            />
            {showScenario && <Legend formatter={(v) => v === "base" ? "Base" : "Scenario"} />}
            <ReferenceLine x="Now" stroke="#6366f1" strokeDasharray="4 4" label={{ value: "Today", fill: "#6366f1", fontSize: 11 }} />
            <Area type="monotone" dataKey="base" stroke="#10b981" strokeWidth={2} fill="url(#baseGrad)" dot={false} />
            {showScenario && (
              <Area type="monotone" dataKey="scenario" stroke="#6366f1" strokeWidth={2} fill="url(#scenGrad)" dot={false} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly assumptions */}
      <div className="pacioli-bg-surface rounded-2xl p-6 border">
        <h3 className="text-sm font-semibold pacioli-text-secondary mb-1">Monthly Averages</h3>
        <p className="text-xs pacioli-text-muted mb-4">Derived from your last {windowMonths} completed months of actual transactions</p>
        <div className="space-y-3">
          {[
            { label: "Average Monthly Income", value: avgIncome, color: "pacioli-text-success" },
            { label: "Fixed Expenses (housing, utilities, insurance, subscriptions)", value: -avgFixed, color: "pacioli-text-danger" },
            { label: "Variable Expenses (groceries, dining, shopping, etc.)", value: -avgVariable, color: "pacioli-text-warning" },
            {
              label: "Net Monthly Cash Flow",
              value: monthlyCashFlow,
              color: monthlyCashFlow >= 0 ? "pacioli-text-success" : "pacioli-text-danger",
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between items-center py-2 border-b pacioli-border-subtle last:border-0">
              <span className="text-sm pacioli-text-secondary">{label}</span>
              <span className={`text-sm font-semibold ${color}`}>
                {value >= 0 ? "" : "−"}{formatCurrency(Math.abs(value))}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs pacioli-text-muted mt-4">
          * Investment accounts grow at an assumed 6.6% annual return (~0.55%/mo). Import more months of transactions to improve accuracy.
        </p>
      </div>
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
  income:  { label: "Income",  color: "text-emerald-400", bg: "bg-emerald-950/30 border-emerald-500/20", maxDelta: 20000, step: 100 },
  expense: { label: "Expense", color: "text-red-400",     bg: "bg-red-950/30 border-red-500/20",         maxDelta: 50000, step: 500 },
  savings: { label: "Savings", color: "text-indigo-400",  bg: "bg-indigo-950/30 border-indigo-500/20",   maxDelta: 5000,  step: 50  },
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
    <div className={`rounded-xl border p-4 ${cfg.bg}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.color} shrink-0`}>
            {cfg.label}
          </span>
          <span className="text-sm pacioli-text-primary font-medium truncate">{event.label}</span>
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

"use client";
import { useEffect, useState, useMemo } from "react";
import {
  fetchJSON, formatCurrency, formatMonth, getMonthlySpend, analyseCategorySpend,
  loadBudgetEnvelopes, saveBudgetEnvelopes, monthProgressFraction, avgMonthlyIncome,
  useTransactions,
  MonthIncome, BudgetAnalysis, BudgetEnvelope,
} from "@/lib/data";
import { useDemo } from "@/components/demo-provider";
import { Sparkles, ChevronRight, Check, Pencil, X, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  Housing: "#6366f1", Groceries: "#10b981", "Dining Out": "#f59e0b",
  Transport: "#ef4444", Subscriptions: "#ec4899", Health: "#3b82f6",
  Shopping: "#8b5cf6", Travel: "#14b8a6", Entertainment: "#f97316", Other: "#71717a",
};

// ── Setup flow ────────────────────────────────────────────────────────────────

function SetupFlow({
  analyses,
  onComplete,
  ns = "",
}: {
  analyses: BudgetAnalysis[];
  onComplete: (envelopes: Record<string, BudgetEnvelope>) => void;
  ns?: string;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Record<string, number>>(() =>
    Object.fromEntries(analyses.map((a) => [a.category, a.suggestedBudget]))
  );

  const current = analyses[step];
  const progress = ((step) / analyses.length) * 100;

  function handleNext() {
    if (step < analyses.length - 1) {
      setStep((s) => s + 1);
    } else {
      const envelopes: Record<string, BudgetEnvelope> = {};
      for (const a of analyses) {
        envelopes[a.category] = {
          category: a.category,
          budgetAmount: draft[a.category] ?? a.suggestedBudget,
          suggestedAmount: a.suggestedBudget,
        };
      }
      saveBudgetEnvelopes(envelopes, ns);
      onComplete(envelopes);
    }
  }

  function handleAccept() {
    setDraft((d) => ({ ...d, [current.category]: current.suggestedBudget }));
    handleNext();
  }

  if (!current) return null;

  const TrendIcon = current.trend === "rising" ? TrendingUp : current.trend === "falling" ? TrendingDown : Minus;
  const trendColor = current.trend === "rising" ? "vela-text-warning" : current.trend === "falling" ? "vela-text-success" : "vela-text-muted";
  const color = CATEGORY_COLORS[current.category] ?? "#6366f1";

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-indigo-400" />
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">AI Budget Setup</p>
        </div>
        <h2 className="text-3xl font-bold vela-text-primary">Set Your Budget</h2>
        <p className="vela-text-muted text-sm mt-1">
          Review each category — AI has analysed your last 6 months and suggested a target. Accept or adjust.
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs vela-text-muted">
          <span>{step + 1} of {analyses.length} categories</span>
          <span>{Math.round(progress)}% done</span>
        </div>
        <div className="w-full h-1.5 vela-bar-track rounded-full">
          <div className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Category card */}
      <div className="vela-bg-surface rounded-2xl p-6 border space-y-5">
        {/* Category name + trend */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full" style={{ background: color }} />
            <h3 className="text-xl font-bold vela-text-primary">{current.category}</h3>
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-medium ${trendColor}`}>
            <TrendIcon size={14} />
            {current.trend === "stable" ? "Stable" : `${current.trend === "rising" ? "+" : ""}${current.trendPct}%`}
          </div>
        </div>

        {/* Mini sparkline of monthly amounts */}
        <MiniSparkline amounts={current.monthlyAmounts} color={color} />

        {/* AI rationale */}
        {/* LLM_HOOK: replace this static rationale with a streaming LLM response.
            Prompt context: { category, avg, trend, trendPct, peakMonth, peakAmount,
            isSeasonal, suggestedBudget, recentMerchants[] }
            Display as a typing animation while streaming. */}
        <div className="flex gap-2.5 p-3.5 bg-indigo-950/30 border border-indigo-800/30 rounded-xl">
          <Sparkles size={14} className="text-indigo-400 mt-0.5 shrink-0" />
          <p className="text-sm vela-text-secondary leading-relaxed">{current.rationale}</p>
        </div>

        {current.isSeasonal && (
          <div className="flex gap-2 p-3 vela-alert-warning border rounded-xl">
            <AlertTriangle size={13} className="vela-text-warning mt-0.5 shrink-0" />
            <p className="text-xs vela-text-warning">
              Seasonal spike detected in {formatMonth(current.peakMonth)} ({formatCurrency(current.peakAmount)}).
              Consider a sinking fund for one-off costs in this category.
            </p>
          </div>
        )}

        {/* Amount input */}
        <div>
          <label className="text-xs vela-text-muted mb-2 block">Monthly budget target</label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 vela-text-muted text-sm">$</span>
              <input
                type="number"
                className="w-full vela-bg-input border rounded-xl pl-7 pr-4 py-3 text-lg font-bold focus:outline-none focus:border-indigo-500 vela-text-primary"
                value={draft[current.category] ?? current.suggestedBudget}
                onChange={(e) => setDraft((d) => ({ ...d, [current.category]: Number(e.target.value) }))}
              />
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs vela-text-muted">AI suggested</p>
              <p className="text-sm font-semibold text-indigo-400">{formatCurrency(current.suggestedBudget)}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleAccept}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Check size={15} />
            Accept {formatCurrency(current.suggestedBudget)}
          </button>
          <button
            onClick={handleNext}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 vela-bg-surface-2 vela-text-primary text-sm font-medium rounded-xl border transition-colors hover:border-indigo-500/50"
          >
            Use {formatCurrency(draft[current.category] ?? current.suggestedBudget)}
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Skip all */}
      <p className="text-center text-xs vela-text-faint">
        <button
          onClick={() => {
            const envelopes: Record<string, BudgetEnvelope> = {};
            for (const a of analyses) {
              envelopes[a.category] = {
                category: a.category,
                budgetAmount: draft[a.category] ?? a.suggestedBudget,
                suggestedAmount: a.suggestedBudget,
              };
            }
            saveBudgetEnvelopes(envelopes, ns);
            onComplete(envelopes);
          }}
          className="hover:vela-text-muted transition-colors underline underline-offset-2"
        >
          Accept all AI suggestions and finish
        </button>
      </p>
    </div>
  );
}

// ── Mini sparkline ────────────────────────────────────────────────────────────

function MiniSparkline({ amounts, color }: { amounts: number[]; color: string }) {
  if (amounts.length < 2) return null;
  const max = Math.max(...amounts);
  const min = Math.min(...amounts);
  const range = max - min || 1;
  const h = 40;
  const w = 200;
  const step = w / (amounts.length - 1);
  const points = amounts
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(" ");

  return (
    <div>
      <p className="text-xs vela-text-muted mb-1">Last {amounts.length} months</p>
      <svg viewBox={`0 0 ${w} ${h + 4}`} className="w-full h-10">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.8"
        />
        {amounts.map((v, i) => (
          <circle key={i} cx={i * step} cy={h - ((v - min) / range) * h} r="3" fill={color} opacity="0.9" />
        ))}
      </svg>
    </div>
  );
}

// ── Envelope row ──────────────────────────────────────────────────────────────

function EnvelopeRow({
  envelope,
  analysis,
  spent,
  onUpdate,
}: {
  envelope: BudgetEnvelope;
  analysis?: BudgetAnalysis;
  spent: number;
  onUpdate: (cat: string, amount: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(envelope.budgetAmount);
  const color = CATEGORY_COLORS[envelope.category] ?? "#6366f1";
  const pct = envelope.budgetAmount > 0 ? (spent / envelope.budgetAmount) * 100 : 0;
  const remaining = envelope.budgetAmount - spent;
  const isOver = spent > envelope.budgetAmount;
  const isWarning = pct >= 80 && !isOver;

  const barColor = isOver ? "var(--text-danger)" : isWarning ? "var(--text-warning)" : color;

  function commit() {
    onUpdate(envelope.category, draft);
    setEditing(false);
  }

  return (
    <div className="py-3 border-b vela-border-subtle last:border-0">
      <div className="flex items-center gap-3 mb-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="flex-1 text-sm font-medium vela-text-primary">{envelope.category}</span>

        {editing ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs vela-text-muted">$</span>
            <input
              type="number"
              autoFocus
              className="w-24 vela-bg-input border rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:border-indigo-500"
              value={draft}
              onChange={(e) => setDraft(Number(e.target.value))}
              onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            />
            <button onClick={commit} className="p-1 vela-text-success hover:opacity-80"><Check size={13} /></button>
            <button onClick={() => setEditing(false)} className="p-1 vela-text-muted hover:vela-text-primary"><X size={13} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className={`font-medium ${isOver ? "vela-text-danger" : isWarning ? "vela-text-warning" : "vela-text-primary"}`}>
              {formatCurrency(spent)}
            </span>
            <span className="vela-text-muted">/</span>
            <button
              onClick={() => { setDraft(envelope.budgetAmount); setEditing(true); }}
              className="flex items-center gap-1 vela-text-muted hover:vela-text-primary transition-colors group"
            >
              <span>{formatCurrency(envelope.budgetAmount)}</span>
              <Pencil size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 vela-bar-track rounded-full overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, pct)}%`, background: barColor }}
        />
      </div>

      <div className="flex justify-between mt-1.5 text-xs">
        <span className={isOver ? "vela-text-danger font-medium" : isWarning ? "vela-text-warning" : "vela-text-muted"}>
          {isOver
            ? `${formatCurrency(Math.abs(remaining))} over budget`
            : `${formatCurrency(remaining)} remaining`}
        </span>
        <span className="vela-text-faint">{Math.round(pct)}%</span>
      </div>

      {/* Inline AI suggestion if different from current budget */}
      {/* LLM_HOOK: show a real-time LLM insight here when the user hovers/expands.
          E.g. "You're on pace to finish $120 over — most of it is from 3 Target runs
          this month. Consider splitting grocery vs. general shopping." */}
      {analysis && envelope.budgetAmount !== analysis.suggestedBudget && !editing && (
        <p className="text-xs text-indigo-400/70 mt-1.5 flex items-center gap-1">
          <Sparkles size={10} />
          AI suggested {formatCurrency(analysis.suggestedBudget)} · {analysis.rationale.split(".")[0]}.
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const { isDemo } = useDemo();
  const ns = isDemo ? "demo" : "";
  const [income, setIncome] = useState<MonthIncome[]>([]);
  const [envelopes, setEnvelopes] = useState<Record<string, BudgetEnvelope> | null>(
    () => loadBudgetEnvelopes()
  );
  const [showSetup, setShowSetup] = useState(false);

  const transactions = useTransactions(ns);

  useEffect(() => {
    // Re-read envelopes from localStorage when ns (demo mode) changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnvelopes(loadBudgetEnvelopes(ns));
    fetchJSON<MonthIncome[]>("income.json").then(setIncome);
  }, [ns]);

  const allMonths = useMemo(() => {
    if (!transactions.length) return [];
    return [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort();
  }, [transactions]);

  const incomeMonths = useMemo(() => income.map((i) => i.month).sort(), [income]);
  const currentMonth = incomeMonths[incomeMonths.length - 1] ?? allMonths[allMonths.length - 1] ?? "";

  const analyses = useMemo(() =>
    transactions.length ? analyseCategorySpend(transactions, allMonths, currentMonth, 6) : [],
    [transactions, allMonths, currentMonth]
  );

  const currentSpend = useMemo(() =>
    transactions.length ? getMonthlySpend(transactions, currentMonth) : {},
    [transactions, currentMonth]
  );

  const monthProgress = monthProgressFraction();
  const avgIncome = avgMonthlyIncome(income, currentMonth, 6);
  const thisMonthIncome = income.find((i) => i.month === currentMonth);
  const mtdIncome = thisMonthIncome?.sources.reduce((s, src) => s + src.amount, 0) ?? 0;

  // Total budget vs total spent
  const totalBudget = envelopes
    ? Object.values(envelopes).reduce((s, e) => s + e.budgetAmount, 0)
    : 0;
  const totalSpent = Object.values(currentSpend).reduce((s, v) => s + v, 0);
  const totalRemaining = totalBudget - totalSpent;
  const budgetPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const monthPct = monthProgress * 100;
  const isAheadOfPace = budgetPct < monthPct - 5;
  const isBehindPace = budgetPct > monthPct + 5;

  function handleSetupComplete(e: Record<string, BudgetEnvelope>) {
    setEnvelopes(e);
    setShowSetup(false);
  }

  function updateEnvelope(cat: string, amount: number) {
    const updated = {
      ...envelopes,
      [cat]: { category: cat, budgetAmount: amount, suggestedAmount: envelopes?.[cat]?.suggestedAmount ?? amount },
    };
    setEnvelopes(updated);
    saveBudgetEnvelopes(updated, ns);
  }

  if (!transactions.length || !income.length) {
    return <div className="vela-text-muted animate-pulse">Loading budget data...</div>;
  }

  // First visit — no envelopes set yet
  if (showSetup || (envelopes && Object.keys(envelopes).length === 0)) {
    return <SetupFlow analyses={analyses} onComplete={handleSetupComplete} ns={ns} />;
  }

  // First ever visit
  if (!envelopes) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 pt-12">
        <div className="w-16 h-16 bg-indigo-900/30 border border-indigo-700/30 rounded-2xl flex items-center justify-center mx-auto">
          <Sparkles size={28} className="text-indigo-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold vela-text-primary">Set Up Your Budget</h2>
          <p className="vela-text-muted text-sm mt-2 leading-relaxed">
            I'll analyse your last 6 months of spending and recommend a monthly target for each category.
            You can accept, adjust, or skip any suggestion.
          </p>
        </div>
        <button
          onClick={() => setShowSetup(true)}
          className="flex items-center gap-2 mx-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors"
        >
          <Sparkles size={16} />
          Analyse My Spending
        </button>
      </div>
    );
  }

  // ── Main budget dashboard ──
  const analysisMap = Object.fromEntries(analyses.map((a) => [a.category, a]));
  const sortedEnvelopes = Object.values(envelopes).sort(
    (a, b) => (currentSpend[b.category] ?? 0) - (currentSpend[a.category] ?? 0)
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <p className="vela-text-muted text-sm">How you're tracking against your plan.</p>
          <h2 className="text-3xl font-bold vela-text-primary mt-1">My Monthly Budget</h2>
        </div>
        <button
          onClick={() => setShowSetup(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <Sparkles size={13} />
          Re-run AI setup
        </button>
      </div>

      {/* Top summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="vela-bg-surface rounded-2xl p-5 border">
          <p className="text-xs vela-text-muted uppercase tracking-wide mb-2">MTD Income</p>
          <p className="text-2xl font-bold vela-text-primary">{formatCurrency(mtdIncome)}</p>
          <p className="text-xs vela-text-muted mt-1">
            {avgIncome > 0 ? `${Math.round((mtdIncome / avgIncome) * 100)}% of typical ${formatCurrency(avgIncome)}/mo` : ""}
          </p>
        </div>
        <div className="vela-bg-surface rounded-2xl p-5 border">
          <p className="text-xs vela-text-muted uppercase tracking-wide mb-2">Spent This Month</p>
          <p className="text-2xl font-bold vela-text-primary">{formatCurrency(totalSpent)}</p>
          <p className="text-xs vela-text-muted mt-1">of {formatCurrency(totalBudget)} budget</p>
        </div>
        <div className="vela-bg-surface rounded-2xl p-5 border">
          <p className="text-xs vela-text-muted uppercase tracking-wide mb-2">Remaining</p>
          <p className={`text-2xl font-bold ${totalRemaining >= 0 ? "vela-text-success" : "vela-text-danger"}`}>
            {formatCurrency(Math.abs(totalRemaining))}
          </p>
          <p className="text-xs vela-text-muted mt-1">{totalRemaining >= 0 ? "left to spend" : "over budget"}</p>
        </div>
        <div className="vela-bg-surface rounded-2xl p-5 border">
          <p className="text-xs vela-text-muted uppercase tracking-wide mb-2">Budget Pace</p>
          <p className={`text-2xl font-bold ${isAheadOfPace ? "vela-text-success" : isBehindPace ? "vela-text-danger" : "vela-text-warning"}`}>
            {isAheadOfPace ? "Ahead" : isBehindPace ? "Behind" : "On pace"}
          </p>
          <p className="text-xs vela-text-muted mt-1">
            {Math.round(budgetPct)}% spent · {Math.round(monthPct)}% through {formatMonth(currentMonth)}
          </p>
        </div>
      </div>

      {/* LLM_HOOK: Monthly narrative card ─────────────────────────────────────
          Call LLM once per month (cache result in localStorage with month key).
          Prompt: pass totalSpent, totalBudget, per-category actuals vs budgets,
          top over-budget categories, income vs avg, sinking fund statuses.
          Render as a 2-3 sentence "CFO memo" with a subtle AI badge.
          ───────────────────────────────────────────────────────────────────── */}

      {/* Two-column layout: envelopes + mini chart */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Envelope list */}
        <div className="xl:col-span-2 vela-bg-surface rounded-2xl p-6 border">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-sm font-semibold vela-text-secondary">Category Envelopes</h3>
            <p className="text-xs vela-text-muted">Click any budget amount to edit</p>
          </div>

          {/* Overall progress bar */}
          <div className="mb-5 mt-3">
            <div className="w-full h-2.5 vela-bar-track rounded-full overflow-hidden relative">
              {/* Month progress ghost */}
              <div
                className="absolute top-0 left-0 h-2.5 rounded-full opacity-20 bg-zinc-400"
                style={{ width: `${monthPct}%` }}
              />
              {/* Actual spend */}
              <div
                className="h-2.5 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, budgetPct)}%`,
                  background: isBehindPace ? "var(--text-danger)" : isAheadOfPace ? "var(--text-success)" : "#6366f1",
                }}
              />
            </div>
            <div className="flex justify-between text-xs vela-text-muted mt-1">
              <span>{Math.round(budgetPct)}% of budget used</span>
              <span>{Math.round(monthPct)}% through month</span>
            </div>
          </div>

          <div>
            {sortedEnvelopes.map((env) => (
              <EnvelopeRow
                key={env.category}
                envelope={env}
                analysis={analysisMap[env.category]}
                spent={currentSpend[env.category] ?? 0}
                onUpdate={updateEnvelope}
              />
            ))}
          </div>
        </div>

        {/* Right column: anomaly alerts + AI insights */}
        <div className="space-y-4">
          {/* Over-budget alerts */}
          {(() => {
            const overBudget = sortedEnvelopes.filter(
              (e) => (currentSpend[e.category] ?? 0) > e.budgetAmount
            );
            const nearBudget = sortedEnvelopes.filter((e) => {
              const pct = e.budgetAmount > 0 ? ((currentSpend[e.category] ?? 0) / e.budgetAmount) * 100 : 0;
              return pct >= 80 && pct < 100;
            });
            if (overBudget.length === 0 && nearBudget.length === 0) return (
              <div className="vela-bg-surface rounded-2xl p-5 border">
                <p className="text-xs font-semibold vela-text-secondary mb-1">Budget Status</p>
                <p className="text-sm vela-text-success font-medium mt-2">✓ All categories on track</p>
                <p className="text-xs vela-text-muted mt-1">
                  You're {Math.round(monthPct)}% through {formatMonth(currentMonth)} with no categories over budget.
                </p>
              </div>
            );
            return (
              <div className="vela-bg-surface rounded-2xl p-5 border space-y-3">
                <p className="text-xs font-semibold vela-text-secondary">Alerts</p>
                {overBudget.map((e) => {
                  const over = (currentSpend[e.category] ?? 0) - e.budgetAmount;
                  return (
                    <div key={e.category} className="flex gap-2.5 p-3 vela-alert-danger border rounded-xl">
                      <AlertTriangle size={13} className="vela-text-danger mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium vela-text-danger">{e.category} over by {formatCurrency(over)}</p>
                        {/* LLM_HOOK: anomaly explanation — look at merchant names for this
                            category this month and explain what drove the overage in 1 sentence. */}
                        <p className="text-xs vela-text-muted mt-0.5">
                          {Math.round(monthPct)}% through month · {formatCurrency(currentSpend[e.category] ?? 0)} spent
                        </p>
                      </div>
                    </div>
                  );
                })}
                {nearBudget.map((e) => {
                  const pct = Math.round(((currentSpend[e.category] ?? 0) / e.budgetAmount) * 100);
                  return (
                    <div key={e.category} className="flex gap-2.5 p-3 vela-alert-warning border rounded-xl">
                      <AlertTriangle size={13} className="vela-text-warning mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium vela-text-warning">{e.category} at {pct}%</p>
                        <p className="text-xs vela-text-muted mt-0.5">
                          {formatCurrency(e.budgetAmount - (currentSpend[e.category] ?? 0))} remaining
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Projection card */}
          <div className="vela-bg-surface rounded-2xl p-5 border">
            <p className="text-xs font-semibold vela-text-secondary mb-3">Month-End Projection</p>
            {monthProgress > 0 && (
              (() => {
                const projectedSpend = monthProgress > 0 ? Math.round(totalSpent / monthProgress) : totalSpent;
                const projectedOver = projectedSpend - totalBudget;
                const projectedSavings = mtdIncome > 0
                  ? (mtdIncome / monthProgress) - projectedSpend
                  : 0;
                return (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs vela-text-muted">Projected total spend</p>
                      <p className={`text-lg font-bold ${projectedOver > 0 ? "vela-text-danger" : "vela-text-success"}`}>
                        {formatCurrency(projectedSpend)}
                      </p>
                      <p className="text-xs vela-text-muted">
                        {projectedOver > 0
                          ? `${formatCurrency(projectedOver)} over budget`
                          : `${formatCurrency(Math.abs(projectedOver))} under budget`}
                      </p>
                    </div>
                    {projectedSavings > 0 && (
                      <div>
                        <p className="text-xs vela-text-muted">Projected savings</p>
                        <p className="text-lg font-bold vela-text-success">{formatCurrency(Math.round(projectedSavings))}</p>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>

          {/* AI insight teaser */}
          <div className="vela-bg-surface rounded-2xl p-5 border border-indigo-800/20 bg-indigo-950/10">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={13} className="text-indigo-400" />
              <p className="text-xs font-semibold text-indigo-400">AI Insight</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-700/30">Soon</span>
            </div>
            {/* LLM_HOOK: monthly narrative — the CFO memo.
                Generate once per month, cache in localStorage["vela-narrative-YYYY-MM"].
                Prompt includes: category actuals vs budgets, income vs avg, net savings,
                top merchant changes, sinking fund progress.
                Example output: "May is shaping up as a lean month — spending is tracking
                18% below pace despite the grocery bump. Your $10k surplus could accelerate
                the Emergency Fund by 2 months if directed there." */}
            <p className="text-xs vela-text-muted leading-relaxed">
              Your monthly CFO memo — a plain-English summary of where you stand, what changed, and what to watch. Coming once LLM integration is wired up.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

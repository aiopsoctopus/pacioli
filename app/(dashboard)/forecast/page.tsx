"use client";
import { useEffect, useState, useMemo } from "react";
import {
  fetchJSON, formatCurrency, formatMonth,
  AccountData, MonthIncome, getNetWorth, getMonthlySpend,
  avgMonthlyIncome, useTransactions,
} from "@/lib/data";
import { useDemo } from "@/components/demo-provider";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Legend,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────
const WINDOW_MONTHS = 6;
const INVESTMENT_ANNUAL_RETURN = 0.066; // 6.6% per year
const MONTHLY_RETURN = INVESTMENT_ANNUAL_RETURN / 12;
const PROJECTION_MONTHS = 12;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nextMonthKey(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const d = new Date(y, m); // month is 0-based, so this is already next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function projectNetWorth(
  startingNW: number,
  monthlyCashFlow: number,
  months: number,
  scenarioDelta = 0,
): { month: string; base: number; scenario: number }[] {
  const today = new Date();
  const startMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const rows: { month: string; base: number; scenario: number }[] = [];
  let baseNW = startingNW;
  let scenarioNW = startingNW;
  let current = startMonthStr;

  for (let i = 0; i < months; i++) {
    current = nextMonthKey(current);
    baseNW = baseNW * (1 + MONTHLY_RETURN) + monthlyCashFlow;
    scenarioNW = scenarioNW * (1 + MONTHLY_RETURN) + monthlyCashFlow + scenarioDelta;
    rows.push({
      month: formatMonth(current),
      base: Math.round(baseNW),
      scenario: Math.round(scenarioNW),
    });
  }
  return rows;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ForecastView() {
  const { isDemo } = useDemo();
  const ns = isDemo ? "demo" : "";
  const [accounts, setAccounts] = useState<AccountData | null>(null);
  const [income, setIncome] = useState<MonthIncome[] | null>(null);
  const [scenarioDelta, setScenarioDelta] = useState(0); // extra $ saved per month
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

    // Starting net worth = latest account balance month (0 if no accounts data)
    let startingNW = 0;
    if (accounts) {
      const allAccountMonths = [
        ...accounts.assets.flatMap((a) => Object.keys(a.balances)),
        ...accounts.liabilities.flatMap((l) => Object.keys(l.balances)),
      ].sort();
      const latestAccountMonth = allAccountMonths[allAccountMonths.length - 1];
      startingNW = getNetWorth(accounts, latestAccountMonth);
    }

    // Last N completed months before currentMonth
    const completedMonths = txMonths.filter((m) => m < currentMonth).slice(-WINDOW_MONTHS);

    // Average monthly income (0 if no income data)
    const avgIncome = income ? avgMonthlyIncome(income, currentMonth, WINDOW_MONTHS) : 0;

    // Average monthly spend per completed month (exclude Savings category)
    let totalSpend = 0;
    let monthsWithData = 0;
    for (const m of completedMonths) {
      const spend = getMonthlySpend(transactions, m);
      const monthTotal = Object.values(spend).reduce((s, v) => s + v, 0);
      if (monthTotal > 0) {
        totalSpend += monthTotal;
        monthsWithData++;
      }
    }
    const avgSpend = monthsWithData > 0 ? Math.round(totalSpend / monthsWithData) : 0;

    // Try to split fixed vs variable from category averages
    // "Fixed" heuristics: Housing, Utilities, Insurance, Subscriptions, Loan Payment, Savings
    const FIXED_CATEGORIES = new Set([
      "Housing", "Mortgage", "Rent", "Utilities", "Insurance",
      "Subscriptions", "Loan Payment", "Phone", "Internet",
    ]);
    let totalFixed = 0;
    let totalVariable = 0;
    for (const m of completedMonths) {
      const spend = getMonthlySpend(transactions, m);
      for (const [cat, amt] of Object.entries(spend)) {
        if (FIXED_CATEGORIES.has(cat)) totalFixed += amt;
        else totalVariable += amt;
      }
    }
    const avgFixed = monthsWithData > 0 ? Math.round(totalFixed / monthsWithData) : 0;
    const avgVariable = monthsWithData > 0 ? Math.round(totalVariable / monthsWithData) : 0;

    const monthlyCashFlow = avgIncome - avgSpend;
    const savingsRate = avgIncome > 0 ? Math.round((monthlyCashFlow / avgIncome) * 100) : 0;

    // Build projection
    const chartRows = [
      { month: "Now", base: startingNW, scenario: startingNW },
      ...projectNetWorth(startingNW, monthlyCashFlow, PROJECTION_MONTHS, scenarioDelta),
    ];

    const endBase = chartRows[chartRows.length - 1].base;
    const endScenario = chartRows[chartRows.length - 1].scenario;
    const gainBase = endBase - startingNW;
    const gainScenario = endScenario - startingNW;

    return {
      startingNW,
      avgIncome,
      avgFixed,
      avgVariable,
      avgSpend,
      monthlyCashFlow,
      savingsRate,
      endBase,
      endScenario,
      gainBase,
      gainScenario,
      chartRows,
      windowMonths: completedMonths.length,
    };
  }, [accounts, income, transactions, scenarioDelta]);

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

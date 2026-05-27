"use client";
import { useEffect, useState } from "react";
import {
  fetchJSON, formatCurrency, formatMonth, getNetWorth, getMonthlySpend,
  loadBudgetEnvelopes, monthProgressFraction, useTransactions,
  AccountData, SinkingFund, MonthIncome,
} from "@/lib/data";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Target, Wallet } from "lucide-react";
import { useDemo } from "@/components/demo-provider";

const COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#ec4899","#3b82f6","#8b5cf6","#14b8a6"];

export default function ZoomOut() {
  const { isDemo } = useDemo();
  const ns = isDemo ? "demo" : "";

  const [accounts, setAccounts] = useState<AccountData | null>(null);
  const [sinkingFunds, setSinkingFunds] = useState<SinkingFund[]>([]);
  const [income, setIncome] = useState<MonthIncome[]>([]);

  const transactions = useTransactions(ns);

  useEffect(() => {
    fetchJSON<AccountData>("accounts.json").then(setAccounts).catch((e) => console.error("[Pacioli] accounts.json failed:", e));
    fetchJSON<SinkingFund[]>("sinking_funds.json").then(setSinkingFunds).catch((e) => console.error("[Pacioli] sinking_funds.json failed:", e));
    fetchJSON<MonthIncome[]>("income.json").then(setIncome).catch((e) => console.error("[Pacioli] income.json failed:", e));
  }, []);

  if (!accounts || !transactions.length || !income.length || !sinkingFunds.length) {
    return <div className="pacioli-text-muted animate-pulse">Loading your financial picture...</div>;
  }

  // Net worth over time (last 12 months)
  const months = Object.keys(accounts.assets[0].balances).sort();
  const nwHistory = months.map((m) => ({
    month: formatMonth(m),
    netWorth: getNetWorth(accounts, m),
  }));

  // Use the latest month that has BOTH income and transaction data.
  // Account balance months can run ahead (e.g. 2026-06 balance but no June txns yet).
  const txMonths = new Set(transactions.map((t) => t.date.slice(0, 7)));
  const incomeMonths = income.map((i) => i.month).filter((m) => txMonths.has(m)).sort();
  const currentMonth = incomeMonths.length > 0
    ? incomeMonths[incomeMonths.length - 1]
    : months[months.length - 1];
  const prevMonth = incomeMonths.length > 1
    ? incomeMonths[incomeMonths.length - 2]
    : months[months.length - 2];
  const currentNW = getNetWorth(accounts, currentMonth);
  const prevNW = getNetWorth(accounts, prevMonth);
  const nwChange = currentNW - prevNW;

  // This month spending by category
  const spendByCat = getMonthlySpend(transactions, currentMonth);
  const pieData = Object.entries(spendByCat)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);

  // This month income
  const thisMonthIncome = income.find((i) => i.month === currentMonth);
  const totalIncome = thisMonthIncome?.sources.reduce((s, src) => s + src.amount, 0) ?? 0;
  const totalSpend = Object.values(spendByCat).reduce((s, v) => s + v, 0);
  const cashFlowNet = totalIncome - totalSpend;

  // Sinking fund summary
  const sfTotal = sinkingFunds.reduce((s, f) => s + f.saved, 0);
  const sfTarget = sinkingFunds.reduce((s, f) => s + f.target, 0);

  // Budget health
  const budgetEnvelopes = loadBudgetEnvelopes(ns);
  const hasBudget = Object.keys(budgetEnvelopes).length > 0;
  const totalBudget = Object.values(budgetEnvelopes).reduce((s, e) => s + e.budgetAmount, 0);
  const budgetRemaining = totalBudget - totalSpend;
  const budgetPct = totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) : 0;
  const monthPct = Math.round(monthProgressFraction() * 100);
  const budgetPace = budgetPct < monthPct - 5 ? "ahead" : budgetPct > monthPct + 5 ? "behind" : "on pace";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="pacioli-text-muted text-sm">Good morning — here's where things stand.</p>
        <h2 className="text-3xl font-bold pacioli-text-primary mt-1">Zoom Out</h2>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Net Worth"
          value={formatCurrency(currentNW)}
          sub={`${nwChange >= 0 ? "+" : ""}${formatCurrency(nwChange)} vs last month`}
          positive={nwChange >= 0}
          icon={<DollarSign size={18} />}
        />
        {hasBudget ? (
          <KpiCard
            label="Budget Remaining"
            value={formatCurrency(Math.abs(budgetRemaining))}
            sub={`${budgetPct}% spent · ${monthPct}% through month · ${budgetPace}`}
            positive={budgetRemaining >= 0}
            icon={<Wallet size={18} />}
            href="/budget"
          />
        ) : (
          <KpiCard
            label="Monthly Income"
            value={formatCurrency(totalIncome)}
            sub={`${formatMonth(currentMonth)} MTD`}
            positive={true}
            icon={<TrendingUp size={18} />}
            href="/budget"
          />
        )}
        <KpiCard
          label="Monthly Spend"
          value={formatCurrency(totalSpend)}
          sub={`${formatCurrency(cashFlowNet)} ${cashFlowNet >= 0 ? "saved" : "over"}`}
          positive={cashFlowNet >= 0}
          icon={<TrendingDown size={18} />}
        />
        <KpiCard
          label="Goals Progress"
          value={`${Math.round((sfTotal / sfTarget) * 100)}%`}
          sub={`${formatCurrency(sfTotal)} of ${formatCurrency(sfTarget, true)} saved`}
          positive={true}
          icon={<Target size={18} />}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Net worth trend */}
        <div className="pacioli-bg-surface rounded-2xl p-6 border">
          <h3 className="text-sm font-semibold pacioli-text-secondary mb-4">Net Worth Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={nwHistory}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
              <Tooltip
                formatter={(v: any) => [formatCurrency(Number(v)), "Net Worth"]}
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <Area type="monotone" dataKey="netWorth" stroke="#6366f1" strokeWidth={2} fill="url(#nwGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Spending breakdown */}
        <div className="pacioli-bg-surface rounded-2xl p-6 border">
          <h3 className="text-sm font-semibold pacioli-text-secondary mb-4">Spending This Month</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="40%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend
                layout="vertical" align="right" verticalAlign="middle"
                formatter={(v, entry: any) => (
                  <span style={{ color: "#a1a1aa", fontSize: 12 }}>
                    {v} <span style={{ color: "#fff" }}>{formatCurrency(entry.payload.value)}</span>
                  </span>
                )}
              />
              <Tooltip
                formatter={(v: any) => [formatCurrency(Number(v))]}
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sinking Funds mini-overview */}
      <div className="pacioli-bg-surface rounded-2xl p-6 border">
        <h3 className="text-sm font-semibold pacioli-text-secondary mb-4">Goals at a Glance</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sinkingFunds.map((f) => {
            const pct = Math.min(100, Math.round((f.saved / f.target) * 100));
            return (
              <div key={f.id} className="pacioli-bg-surface-2 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium pacioli-text-primary">{f.emoji} {f.name}</span>
                  <span className="text-xs pacioli-text-muted">{pct}%</span>
                </div>
                <div className="w-full h-1.5 pacioli-bar-track rounded-full">
                  <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: f.color }} />
                </div>
                <div className="flex justify-between mt-2 text-xs pacioli-text-muted">
                  <span>{formatCurrency(f.saved)}</span>
                  <span>{formatCurrency(f.target)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, positive, icon, href }: {
  label: string; value: string; sub: string; positive: boolean; icon: React.ReactNode; href?: string;
}) {
  const inner = (
    <>
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs font-medium pacioli-text-muted uppercase tracking-wide">{label}</p>
        <span className="pacioli-text-faint">{icon}</span>
      </div>
      <p className="text-2xl font-bold pacioli-text-primary">{value}</p>
      <p className={`text-xs mt-1 ${positive ? "pacioli-text-success" : "pacioli-text-danger"}`}>{sub}</p>
    </>
  );
  if (href) {
    return (
      <a href={href} className="pacioli-bg-surface rounded-2xl p-5 border block hover:border-indigo-500/40 transition-colors">
        {inner}
      </a>
    );
  }
  return <div className="pacioli-bg-surface rounded-2xl p-5 border">{inner}</div>;
}

"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  fetchJSON, formatCurrency, formatMonth, getNetWorth, getMonthlySpend,
  loadBudgetEnvelopes, monthProgressFraction, useTransactions,
  AccountData, SinkingFund, MonthIncome,
} from "@/lib/data";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Target, Wallet, Upload, Layers } from "lucide-react";
import { useDemo } from "@/components/demo-provider";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@clerk/nextjs";

const COLORS = ["#5dcaa5","#10b981","#f59e0b","#ef4444","#ec4899","#3b82f6","#8b5cf6","#14b8a6"];

export default function ZoomOut() {
  // ── ALL hooks must be declared before any early returns (Rules of Hooks) ──────
  const { isSignedIn } = useAuth();
  const { isDemo } = useDemo();
  const ns = isDemo ? "demo" : "";
  const { theme } = useTheme();
  const [accounts, setAccounts] = useState<AccountData | null>(null);
  const [sinkingFunds, setSinkingFunds] = useState<SinkingFund[]>([]);
  const [income, setIncome] = useState<MonthIncome[]>([]);
  const transactions = useTransactions(ns);

  const chartTheme = useMemo(() => {
    if (typeof window === "undefined") return {
      tooltipBg: "#18181b", tooltipBorder: "rgba(63,63,70,0.5)",
      textMuted: "#71717a", textPrimary: "#ffffff", textSecondary: "#d4d4d8",
    };
    const s = getComputedStyle(document.documentElement);
    return {
      tooltipBg:     s.getPropertyValue("--bg-surface").trim()    || "#18181b",
      tooltipBorder: s.getPropertyValue("--border").trim()         || "rgba(63,63,70,0.5)",
      textMuted:     s.getPropertyValue("--text-muted").trim()     || "#71717a",
      textPrimary:   s.getPropertyValue("--text-primary").trim()   || "#ffffff",
      textSecondary: s.getPropertyValue("--text-secondary").trim() || "#d4d4d8",
    };
  }, [theme]);

  // Only fetch static JSON in demo mode — real data users start blank
  useEffect(() => {
    if (!isDemo) return;
    fetchJSON<AccountData>("accounts.json").then(setAccounts).catch((e) => console.error("[Pacioli] accounts.json failed:", e));
    fetchJSON<SinkingFund[]>("sinking_funds.json").then(setSinkingFunds).catch((e) => console.error("[Pacioli] sinking_funds.json failed:", e));
    fetchJSON<MonthIncome[]>("income.json").then(setIncome).catch((e) => console.error("[Pacioli] income.json failed:", e));
  }, [isDemo]);

  // ── Early returns AFTER all hooks ───────────────────────────────────────────
  // Signed-in real users who haven't imported data yet → empty state with CTA
  // Demo mode → full dashboard with sample data
  // Unauthenticated → loading spinner (Clerk is still resolving)
  if (isSignedIn && !isDemo) return <EmptyState />;
  if (!isDemo) return <div className="pacioli-text-muted animate-pulse">Loading your financial picture...</div>;
  if (!accounts || !transactions.length || !income.length || !sinkingFunds.length) {
    return <div className="pacioli-text-muted animate-pulse">Loading your financial picture...</div>;
  }

  // Net worth over time (last 12 months)
  const months = Object.keys(accounts.assets[0].balances).sort();
  const nwHistory = months.map((m) => ({
    month: formatMonth(m),
    netWorth: getNetWorth(accounts, m),
  }));

  // Y-axis floor: round down to nearest $100k below min so chart isn't mostly empty.
  const nwMin = Math.min(...nwHistory.map(d => d.netWorth));
  const nwYFloor = Math.floor(nwMin / 100_000) * 100_000;

  // NW headline: cap to today so future-dated balance entries don't inflate the figure.
  // Matches the same logic used on /net-worth so both pages show the same number.
  const todayMonth = new Date().toISOString().slice(0, 7);
  const nwMonth = months.filter((m) => m <= todayMonth).at(-1) ?? months[months.length - 1];
  const prevNwMonth = months.filter((m) => m < nwMonth).at(-1) ?? months[months.length - 2];
  const currentNW = getNetWorth(accounts, nwMonth);
  const prevNW = getNetWorth(accounts, prevNwMonth);
  const nwChange = currentNW - prevNW;

  // Spend/income headline: use the latest month that has actual transaction data.
  // This matches what /cash-flow shows by default and avoids showing $0 spend for
  // a month where balances exist but transactions haven't come in yet.
  const txMonths = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort();
  const currentMonth = txMonths.at(-1) ?? nwMonth;

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

  // ── Recommended action callout ─────────────────────────────────────────────
  // Pick the single highest-priority insight to surface on the dashboard.
  type ActionInsight = { label: string; body: string; cta: string; href: string; urgent: boolean };

  function pickInsight(): ActionInsight | null {
    // 1. Emergency fund shortfall (most important)
    const emergencyFund = sinkingFunds.find((f) =>
      /emergency/i.test(f.name)
    );
    if (emergencyFund && emergencyFund.saved < emergencyFund.target) {
      const shortfall = emergencyFund.target - emergencyFund.saved;
      const mLeft = Math.max(
        1,
        emergencyFund.target_date
          ? (() => {
              const t = new Date(emergencyFund.target_date);
              const now = new Date();
              return (t.getFullYear() - now.getFullYear()) * 12 + (t.getMonth() - now.getMonth());
            })()
          : 12
      );
      const needPerMonth = Math.ceil(shortfall / mLeft);
      return {
        label: "Emergency Fund",
        body: `${formatCurrency(shortfall)} short of your ${formatCurrency(emergencyFund.target)} target — needs ${formatCurrency(needPerMonth)}/mo to reach it in ${mLeft} month${mLeft !== 1 ? "s" : ""}.`,
        cta: "Review goals →",
        href: "/sinking-funds",
        urgent: shortfall > 10_000,
      };
    }

    // 2. RSU vest this month (income spike — check tax reserve sinking fund)
    const rsuVestMonths = ["03","06","09","12"]; // quarterly vests Sep/Dec/Mar/Jun
    const thisMonthStr = new Date().toISOString().slice(5, 7);
    const isRsuMonth = rsuVestMonths.includes(thisMonthStr);
    const taxReserve = sinkingFunds.find((f) => /tax|rsu/i.test(f.name));
    if (isRsuMonth && taxReserve && taxReserve.saved < taxReserve.target * 0.7) {
      return {
        label: "RSU Vest Month",
        body: `RSU vest expected this month — your Tax Reserve is at ${Math.round((taxReserve.saved / taxReserve.target) * 100)}% (${formatCurrency(taxReserve.saved)}). Consider topping it up before the vest hits.`,
        cta: "Review tax reserve →",
        href: "/sinking-funds",
        urgent: true,
      };
    }

    // 3. Negative cash flow this month
    if (cashFlowNet < -500) {
      return {
        label: "Spending Alert",
        body: `Spending is ${formatCurrency(Math.abs(cashFlowNet))} ahead of income in ${formatMonth(currentMonth)}. Check your budget to find where to trim.`,
        cta: "View budget →",
        href: "/budget",
        urgent: true,
      };
    }

    // 4. Any sinking fund behind with < 6 months to go
    const urgentFund = sinkingFunds.find((f) => {
      if (f.saved >= f.target) return false;
      const t = new Date(f.target_date);
      const now = new Date();
      const mLeft = (t.getFullYear() - now.getFullYear()) * 12 + (t.getMonth() - now.getMonth());
      const needed = mLeft > 0 ? Math.ceil((f.target - f.saved) / mLeft) : Infinity;
      return mLeft > 0 && mLeft <= 6 && needed > f.monthly_contribution * 1.2;
    });
    if (urgentFund) {
      const t = new Date(urgentFund.target_date);
      const now = new Date();
      const mLeft = (t.getFullYear() - now.getFullYear()) * 12 + (t.getMonth() - now.getMonth());
      const needed = Math.ceil((urgentFund.target - urgentFund.saved) / mLeft);
      return {
        label: urgentFund.emoji + " " + urgentFund.name,
        body: `${mLeft} months left and ${formatCurrency(urgentFund.target - urgentFund.saved)} to go — needs ${formatCurrency(needed)}/mo but you're only contributing ${formatCurrency(urgentFund.monthly_contribution)}/mo.`,
        cta: "Update goal →",
        href: "/sinking-funds",
        urgent: false,
      };
    }

    // 5. Strong cash flow — positive reinforcement
    if (cashFlowNet > 1000) {
      return {
        label: "Surplus Month",
        body: `You're on track to save ${formatCurrency(cashFlowNet)} in ${formatMonth(currentMonth)}. Routing surplus to a goal or investment keeps the momentum.`,
        cta: "View budget →",
        href: "/budget",
        urgent: false,
      };
    }

    return null;
  }

  const insight = pickInsight();

  // 12-month savings rate trend (plain derivation — after null guards, so no useMemo needed)
  const savingsRateHistory = months.slice(-12).map((m) => {
    const monthIncome = income.find((i) => i.month === m);
    const totalInc = monthIncome?.sources.reduce((s, src) => s + src.amount, 0) ?? 0;
    const totalSp = Object.values(getMonthlySpend(transactions, m)).reduce((s, v) => s + v, 0);
    const rate = totalInc > 0 ? Math.round(((totalInc - totalSp) / totalInc) * 100) : 0;
    return { month: formatMonth(m), rate };
  });

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
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
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

      {/* Recommended action callout */}
      {insight && (
        <div className={`rounded-2xl px-5 py-4 border flex items-start justify-between gap-4 ${insight.urgent ? "pacioli-alert-warning" : "pacioli-bg-surface"}`}>
          <div className="min-w-0">
            <p className="text-xs font-semibold pacioli-text-secondary mb-0.5">{insight.label}</p>
            <p className="text-sm pacioli-text-primary leading-relaxed">{insight.body}</p>
          </div>
          <Link
            href={insight.href}
            className="shrink-0 text-xs font-semibold pacioli-text-success hover:underline whitespace-nowrap"
          >
            {insight.cta}
          </Link>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Net worth trend */}
        <div className="pacioli-bg-surface rounded-2xl p-6 border">
          <h3 className="text-sm font-semibold pacioli-text-secondary mb-4">Net Worth Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={nwHistory}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5dcaa5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#5dcaa5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: chartTheme.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fill: chartTheme.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={50} domain={[nwYFloor, 'auto']} />
              <Tooltip
                formatter={(v: unknown) => [formatCurrency(Number(v)), "Net Worth"]}
                contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 8 }}
                labelStyle={{ color: chartTheme.textMuted }}
              />
              <Area type="monotone" dataKey="netWorth" stroke="#5dcaa5" strokeWidth={2} fill="url(#nwGrad)" />
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
                  <span style={{ color: chartTheme.textMuted, fontSize: 12 }}>
                    {v} <span style={{ color: chartTheme.textPrimary }}>{formatCurrency(entry.payload.value)}</span>
                  </span>
                )}
              />
              <Tooltip
                formatter={(v: unknown) => [formatCurrency(Number(v))]}
                contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 8 }}
                labelStyle={{ color: chartTheme.textMuted }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 12-month savings rate trend */}
      <div className="pacioli-bg-surface rounded-2xl p-6 border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold pacioli-text-secondary">Savings Rate — Last 12 Months</h3>
          <span className="text-xs pacioli-text-muted">
            Avg {Math.round(savingsRateHistory.reduce((s, d) => s + d.rate, 0) / savingsRateHistory.length)}%
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={savingsRateHistory} barSize={18}>
            <XAxis dataKey="month" tick={{ fill: chartTheme.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: chartTheme.textMuted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={38}
              domain={['auto', 'auto']}
            />
            <ReferenceLine y={0} stroke={chartTheme.tooltipBorder} strokeDasharray="3 3" />
            <Tooltip
              formatter={(v: unknown) => [`${v}%`, "Savings rate"]}
              contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 8 }}
              labelStyle={{ color: chartTheme.textMuted }}
            />
            <Bar
              dataKey="rate"
              radius={[4, 4, 0, 0]}
              fill="#5dcaa5"
              label={false}
              // colour bars red when rate is negative
              isAnimationActive={true}
            >
              {savingsRateHistory.map((entry, i) => (
                <Cell key={i} fill={entry.rate < 0 ? "#ef4444" : entry.rate < 10 ? "#f59e0b" : "#5dcaa5"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs pacioli-text-muted mt-2">Green = healthy (≥10%) · Amber = tight · Red = spending exceeded income</p>
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

// ── Empty state component ─────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div style={{
        width: 72, height: 72, borderRadius: "18px",
        background: "rgba(83,74,183,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: "28px",
        color: "#7f77dd",
      }}>
        <DollarSign size={32} />
      </div>
      <h1 className="text-3xl font-bold pacioli-text-primary mb-3">
        Your dashboard is ready
      </h1>
      <p className="pacioli-text-muted text-base max-w-md mb-10 leading-relaxed">
        No data yet — add your numbers and everything will populate automatically.
        Or explore with sandbox data to see what Pacioli looks like with real content.
      </p>

      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/connect"
          style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "#0d6e6e",
            color: "#fff",
            padding: "13px 24px",
            borderRadius: "12px",
            fontWeight: 700,
            fontSize: "15px",
            textDecoration: "none",
          }}
        >
          <Upload size={16} /> Connect my data
        </Link>
        <Link
          href="/connect"
          style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "rgba(83,74,183,0.12)",
            border: "1px solid rgba(175,169,236,0.2)",
            color: "#c8c4f0",
            padding: "13px 24px",
            borderRadius: "12px",
            fontWeight: 600,
            fontSize: "15px",
            textDecoration: "none",
          }}
        >
          <Layers size={16} /> Explore sandbox
        </Link>
      </div>

      {/* Ghost KPI cards to show what's coming */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "12px",
        marginTop: "60px",
        width: "100%",
        maxWidth: "800px",
        opacity: 0.25,
        pointerEvents: "none",
      }}>
        {["Net Worth", "Monthly Income", "Monthly Spend", "Goals Progress"].map((label) => (
          <div key={label} className="pacioli-bg-surface rounded-2xl p-5 border">
            <p className="text-xs pacioli-text-muted uppercase tracking-wide mb-3">{label}</p>
            <div style={{ height: "28px", background: "var(--bg-surface-2)", borderRadius: "6px", marginBottom: "8px" }} />
            <div style={{ height: "12px", background: "var(--bg-surface-2)", borderRadius: "4px", width: "60%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, positive, icon, href }: {
  label: string; value: string; sub: string; positive: boolean; icon: React.ReactNode; href?: string;
}) {
  const inner = (
    <>
      <div className="flex justify-between items-start mb-3 min-w-0">
        <p className="text-[11px] sm:text-xs font-medium pacioli-text-muted uppercase tracking-wide leading-tight pr-1">{label}</p>
        <span className="pacioli-text-faint shrink-0">{icon}</span>
      </div>
      <p className="text-xl sm:text-2xl font-bold pacioli-text-primary truncate">{value}</p>
      <p className={`text-[11px] sm:text-xs mt-1 truncate ${positive ? "pacioli-text-success" : "pacioli-text-danger"}`}>{sub}</p>
    </>
  );
  if (href) {
    return (
      <a href={href} className="pacioli-bg-surface rounded-2xl p-4 sm:p-5 border block hover:border-teal-600/40 transition-colors min-w-0">
        {inner}
      </a>
    );
  }
  return <div className="pacioli-bg-surface rounded-2xl p-4 sm:p-5 border min-w-0">{inner}</div>;
}

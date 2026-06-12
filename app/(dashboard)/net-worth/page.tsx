"use client";
import Link from "next/link";
import { formatCurrency, formatMonth, getNetWorth, AccountData, useAccounts, saveManualAccounts } from "@/lib/data";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useDemo } from "@/components/demo-provider";
import AccountEditor from "@/components/account-editor";
import RentalPL from "@/components/rental-pl";
import { Upload } from "lucide-react";

// Asset type groupings for composition view
const TYPE_GROUPS: Record<string, { label: string; liquid: boolean; color: string }> = {
  checking:    { label: "Cash & Checking", liquid: true,  color: "#06b6d4" },
  savings:     { label: "Savings",          liquid: true,  color: "#10b981" },
  investment:  { label: "Investments",      liquid: false, color: "#6366f1" },
  property:    { label: "Real Estate",      liquid: false, color: "#f59e0b" },
  vehicle:     { label: "Vehicles",         liquid: false, color: "#8b5cf6" },
};

const ACCOUNT_GROUP_ORDER = ["checking", "savings", "investment", "property", "vehicle"];

export default function NetWorth() {
  const { isDemo } = useDemo();
  const ns = isDemo ? "demo" : "";
  const [accounts, setAccounts] = useAccounts(ns);

  function handleAccountsChange(updated: AccountData) {
    // Persist full account data to localStorage and trigger re-render
    saveManualAccounts({ assets: updated.assets, liabilities: updated.liabilities }, ns);
    setAccounts(updated);
  }

  // Real user with no accounts yet — show empty state + editor to add first account
  if (!isDemo && !accounts) return (
    <div className="space-y-8">
      <div>
        <p className="pacioli-text-muted text-sm">Assets minus what you owe.</p>
        <h2 className="text-3xl font-bold pacioli-text-primary mt-1">My Net Worth</h2>
      </div>
      <div className="flex flex-col items-center text-center px-4 py-12">
        <Upload size={28} className="pacioli-text-muted mb-4" />
        <p className="pacioli-text-muted mb-2 max-w-sm">No accounts yet. Add them manually below, or import a CSV.</p>
        <Link href="/connect" style={{ display:"inline-flex", alignItems:"center", gap:8, color:"#5dcaa5", textDecoration:"underline", fontSize:14 }}>
          Import via CSV instead →
        </Link>
      </div>
      <AccountEditor
        accounts={{ assets: [], liabilities: [] }}
        onChange={handleAccountsChange}
      />
    </div>
  );

  if (!accounts) return <div className="pacioli-text-muted animate-pulse">Loading balance sheet...</div>;

  const months = Object.keys(accounts.assets[0].balances).sort();
  const todayMonth = new Date().toISOString().slice(0, 7);
  const currentMonth = months.filter((m) => m <= todayMonth).at(-1) ?? months[months.length - 1];
  const priorYearMonth = months.filter((m) => m <= todayMonth).at(-13) ?? months[0];

  const nwHistory = months.map((m) => ({
    month: formatMonth(m),
    netWorth: Math.round(getNetWorth(accounts, m)),
  }));

  // Y-axis floor: round down to the nearest $100k below the minimum value
  // so the chart doesn't waste 90% of its space on empty baseline.
  const nwMin = Math.min(...nwHistory.map(d => d.netWorth));
  const nwYFloor = Math.floor(nwMin / 100_000) * 100_000;

  const currentNW = getNetWorth(accounts, currentMonth);
  const priorYearNW = getNetWorth(accounts, priorYearMonth);
  const yoyChange = currentNW - priorYearNW;
  const totalAssets = accounts.assets.reduce((s, a) => s + (a.balances[currentMonth] ?? 0), 0);
  const totalLiabilities = accounts.liabilities.reduce((s, l) => s + (l.balances[currentMonth] ?? 0), 0);

  // Composition buckets
  const liquidTypes = new Set(["checking", "savings"]);
  const liquidAssets = accounts.assets
    .filter(a => liquidTypes.has(a.type))
    .reduce((s, a) => s + (a.balances[currentMonth] ?? 0), 0);
  const investedAssets = accounts.assets
    .filter(a => a.type === "investment")
    .reduce((s, a) => s + (a.balances[currentMonth] ?? 0), 0);
  const illiquidAssets = accounts.assets
    .filter(a => !liquidTypes.has(a.type) && a.type !== "investment")
    .reduce((s, a) => s + (a.balances[currentMonth] ?? 0), 0);

  // Group assets by type
  const assetsByType: Record<string, typeof accounts.assets> = {};
  for (const type of ACCOUNT_GROUP_ORDER) {
    const group = accounts.assets.filter(a => a.type === type);
    if (group.length) assetsByType[type] = group;
  }

  // Composition bar segments (% of total assets)
  const compositionSegments = ACCOUNT_GROUP_ORDER
    .filter(t => assetsByType[t])
    .map(t => ({
      type: t,
      label: TYPE_GROUPS[t]?.label ?? t,
      color: TYPE_GROUPS[t]?.color ?? "#71717a",
      value: assetsByType[t].reduce((s, a) => s + (a.balances[currentMonth] ?? 0), 0),
    }))
    .filter(s => s.value > 0);

  return (
    <div className="space-y-8">
      <div>
        <p className="pacioli-text-muted text-sm">Assets minus what you owe.</p>
        <h2 className="text-3xl font-bold pacioli-text-primary mt-1">My Net Worth</h2>
      </div>

      {/* Big number + composition summary */}
      <div className="pacioli-bg-surface rounded-2xl p-8 border">
        <div className="flex flex-wrap gap-8 items-start">
          {/* Left: headline */}
          <div className="min-w-[200px]">
            <p className="pacioli-text-muted text-sm mb-1">Total Net Worth</p>
            <p className="text-5xl font-bold pacioli-text-primary">{formatCurrency(currentNW)}</p>
            <p className={`text-sm mt-2 font-medium ${yoyChange >= 0 ? "pacioli-text-success" : "pacioli-text-danger"}`}>
              {yoyChange >= 0 ? "+" : ""}{formatCurrency(yoyChange)} vs. a year ago
            </p>
          </div>

          {/* Right: 3-bucket breakdown */}
          <div className="flex gap-8 flex-wrap pt-1">
            <div>
              <p className="text-xs pacioli-text-muted mb-1">Liquid</p>
              <p className="text-2xl font-bold text-cyan-400">{formatCurrency(liquidAssets)}</p>
              <p className="text-xs pacioli-text-muted mt-0.5">Cash &amp; savings</p>
            </div>
            <div>
              <p className="text-xs pacioli-text-muted mb-1">Invested</p>
              <p className="text-2xl font-bold text-indigo-400">{formatCurrency(investedAssets)}</p>
              <p className="text-xs pacioli-text-muted mt-0.5">401k, IRA, brokerage, RSUs</p>
            </div>
            <div>
              <p className="text-xs pacioli-text-muted mb-1">Illiquid</p>
              <p className="text-2xl font-bold text-amber-400">{formatCurrency(illiquidAssets)}</p>
              <p className="text-xs pacioli-text-muted mt-0.5">Property &amp; vehicles</p>
            </div>
          </div>
        </div>

        {/* Composition bar */}
        <div className="mt-6">
          <div className="w-full h-3 rounded-full overflow-hidden flex gap-0.5">
            {compositionSegments.map((seg, i) => (
              <div
                key={seg.type}
                className={`h-3 transition-all duration-500 ${i === 0 ? "rounded-l-full" : ""} ${i === compositionSegments.length - 1 ? "rounded-r-full" : ""}`}
                style={{ width: `${(seg.value / totalAssets) * 100}%`, background: seg.color }}
                title={`${seg.label}: ${formatCurrency(seg.value)}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {compositionSegments.map(seg => (
              <span key={seg.type} className="flex items-center gap-1.5 text-xs pacioli-text-muted">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: seg.color }} />
                {seg.label} · {Math.round((seg.value / totalAssets) * 100)}%
              </span>
            ))}
          </div>
        </div>

        {/* Assets vs liabilities footer */}
        <div className="flex gap-6 mt-5 pt-5 border-t pacioli-border-subtle text-sm">
          <div>
            <p className="pacioli-text-muted text-xs">Total Assets</p>
            <p className="pacioli-text-success font-semibold">{formatCurrency(totalAssets)}</p>
          </div>
          <div>
            <p className="pacioli-text-muted text-xs">Total Liabilities</p>
            <p className="pacioli-text-danger font-semibold">−{formatCurrency(totalLiabilities)}</p>
          </div>
          <div>
            <p className="pacioli-text-muted text-xs">Debt-to-Asset</p>
            <p className="pacioli-text-primary font-semibold">{Math.round((totalLiabilities / totalAssets) * 100)}%</p>
          </div>
        </div>
      </div>

      {/* Trend chart */}
      <div className="pacioli-bg-surface rounded-2xl p-6 border">
        <h3 className="text-sm font-semibold pacioli-text-secondary mb-4">Net Worth Over Time</h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={nwHistory}>
            <defs>
              <linearGradient id="nwGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#5dcaa5" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#5dcaa5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={55} domain={[nwYFloor, 'auto']} />
            <Tooltip
              formatter={(v: any) => [formatCurrency(Number(v)), "Net Worth"]}
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
              labelStyle={{ color: "#a1a1aa" }}
            />
            <Area type="monotone" dataKey="netWorth" stroke="#5dcaa5" strokeWidth={2} fill="url(#nwGrad2)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Assets grouped by type */}
      <div>
        <h3 className="text-sm font-semibold pacioli-text-secondary mb-3">Assets by Type</h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {ACCOUNT_GROUP_ORDER.filter(t => assetsByType[t]).map(type => {
            const group = assetsByType[type];
            const groupTotal = group.reduce((s, a) => s + (a.balances[currentMonth] ?? 0), 0);
            const meta = TYPE_GROUPS[type];
            return (
              <div key={type} className="pacioli-bg-surface rounded-2xl p-5 border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />
                    <span className="text-sm font-semibold pacioli-text-secondary">{meta.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${meta.liquid ? "bg-cyan-900/30 text-cyan-400" : "bg-zinc-800 pacioli-text-muted"}`}>
                      {meta.liquid ? "liquid" : "illiquid"}
                    </span>
                  </div>
                  <span className="font-bold pacioli-text-primary text-sm">{formatCurrency(groupTotal)}</span>
                </div>
                <div className="space-y-2.5">
                  {group.map(a => {
                    const bal = a.balances[currentMonth] ?? 0;
                    const pct = groupTotal > 0 ? (bal / groupTotal) * 100 : 0;
                    return (
                      <div key={a.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="pacioli-text-secondary">{a.name}</span>
                          <span className="pacioli-text-primary font-medium tabular-nums">{formatCurrency(bal)}</span>
                        </div>
                        {/* Within-group proportion bar — meaningful because same asset type */}
                        <div className="w-full h-1 pacioli-bar-track rounded-full">
                          <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: meta.color, opacity: 0.7 }} />
                        </div>
                        {a.institution && <p className="text-xs pacioli-text-muted mt-0.5">{a.institution}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Liabilities */}
      <div>
        <h3 className="text-sm font-semibold pacioli-text-secondary mb-3">Liabilities</h3>
        <div className="pacioli-bg-surface rounded-2xl p-5 border">
          <div className="space-y-2.5">
            {accounts.liabilities.map(l => {
              const bal = l.balances[currentMonth] ?? 0;
              const pct = totalLiabilities > 0 ? (bal / totalLiabilities) * 100 : 0;
              return (
                <div key={l.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="pacioli-text-secondary">{l.name}</span>
                    <span className="pacioli-text-danger font-medium tabular-nums">−{formatCurrency(bal)}</span>
                  </div>
                  <div className="w-full h-1 pacioli-bar-track rounded-full">
                    <div className="h-1 rounded-full bg-red-500/60" style={{ width: `${pct}%` }} />
                  </div>
                  {l.institution && <p className="text-xs pacioli-text-muted mt-0.5">{l.institution}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rental property P&L */}
      <RentalPL />

      {/* Account editor */}
      <AccountEditor accounts={accounts} onChange={handleAccountsChange} />
    </div>
  );
}

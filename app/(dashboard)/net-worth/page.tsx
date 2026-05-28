"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchJSON, formatCurrency, formatMonth, getNetWorth, AccountData } from "@/lib/data";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { useDemo } from "@/components/demo-provider";
import { Upload } from "lucide-react";

export default function NetWorth() {
  const { isDemo } = useDemo();
  const [accounts, setAccounts] = useState<AccountData | null>(null);

  useEffect(() => {
    if (!isDemo) return;
    fetchJSON<AccountData>("accounts.json").then(setAccounts);
  }, [isDemo]);

  if (!isDemo) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <p className="pacioli-text-muted text-sm mb-1">Assets minus what you owe.</p>
      <h2 className="text-3xl font-bold pacioli-text-primary mt-1 mb-6">My Net Worth</h2>
      <p className="pacioli-text-muted mb-8 max-w-sm">No account data yet. Import a CSV to see your balance sheet.</p>
      <Link href="/connect" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"#534AB7", color:"#fff", padding:"12px 24px", borderRadius:10, fontWeight:600, textDecoration:"none" }}>
        <Upload size={15} /> Connect data
      </Link>
    </div>
  );

  if (!accounts) return <div className="pacioli-text-muted animate-pulse">Loading balance sheet...</div>;

  const months = Object.keys(accounts.assets[0].balances).sort();
  const currentMonth = months[months.length - 1];

  const nwHistory = months.map((m) => ({
    month: formatMonth(m),
    assets: Math.round(accounts.assets.reduce((s, a) => s + (a.balances[m] ?? 0), 0)),
    liabilities: Math.round(accounts.liabilities.reduce((s, l) => s + (l.balances[m] ?? 0), 0)),
    netWorth: Math.round(getNetWorth(accounts, m)),
  }));

  const currentNW = getNetWorth(accounts, currentMonth);
  const totalAssets = accounts.assets.reduce((s, a) => s + (a.balances[currentMonth] ?? 0), 0);
  const totalLiabilities = accounts.liabilities.reduce((s, l) => s + (l.balances[currentMonth] ?? 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <p className="pacioli-text-muted text-sm">Assets minus what you owe.</p>
        <h2 className="text-3xl font-bold pacioli-text-primary mt-1">My Net Worth</h2>
      </div>

      {/* Big number */}
      <div className="bg-gradient-to-br from-indigo-900/40 to-zinc-800/60 rounded-2xl p-8 border border-indigo-700/30">
        <p className="pacioli-text-muted text-sm mb-1">Total Net Worth</p>
        <p className="text-5xl font-bold pacioli-text-primary">{formatCurrency(currentNW)}</p>
        <div className="flex gap-6 mt-4 text-sm">
          <div>
            <p className="pacioli-text-muted">Total Assets</p>
            <p className="pacioli-text-success font-semibold">{formatCurrency(totalAssets)}</p>
          </div>
          <div>
            <p className="pacioli-text-muted">Total Liabilities</p>
            <p className="pacioli-text-danger font-semibold">−{formatCurrency(totalLiabilities)}</p>
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
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
            <Tooltip
              formatter={(v: any, name: any) => [formatCurrency(Number(v)), name === "netWorth" ? "Net Worth" : name === "assets" ? "Assets" : "Liabilities"]}
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
              labelStyle={{ color: "#a1a1aa" }}
            />
            <Area type="monotone" dataKey="netWorth" stroke="#6366f1" strokeWidth={2} fill="url(#nwGrad2)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Assets & Liabilities side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AccountTable title="Assets" accounts={accounts.assets} month={currentMonth} color="pacioli-text-success" />
        <AccountTable title="Liabilities" accounts={accounts.liabilities} month={currentMonth} color="pacioli-text-danger" negative />
      </div>
    </div>
  );
}

function AccountTable({ title, accounts, month, color, negative = false }: {
  title: string; accounts: any[]; month: string; color: string; negative?: boolean;
}) {
  const total = accounts.reduce((s, a) => s + (a.balances[month] ?? 0), 0);
  return (
    <div className="pacioli-bg-surface rounded-2xl p-6 border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold pacioli-text-secondary">{title}</h3>
        <span className={`font-bold ${color}`}>{negative ? "−" : ""}{formatCurrency(total)}</span>
      </div>
      <div className="space-y-3">
        {accounts.map((a) => {
          const bal = a.balances[month] ?? 0;
          const pct = (bal / total) * 100;
          return (
            <div key={a.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className="pacioli-text-secondary">{a.name}</span>
                <span className="pacioli-text-primary font-medium">{formatCurrency(bal)}</span>
              </div>
              <div className="w-full h-1 pacioli-bar-track rounded-full">
                <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: negative ? "#f87171" : "#34d399" }} />
              </div>
              {a.institution && <p className="text-xs pacioli-text-muted mt-0.5">{a.institution}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

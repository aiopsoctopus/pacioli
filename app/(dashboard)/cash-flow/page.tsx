"use client";
import { useEffect, useState, useMemo } from "react";
import {
  fetchJSON, formatCurrency, formatMonth, getMonthlySpend,
  Transaction, MonthIncome,
} from "@/lib/data";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { ChevronLeft, Tag, BookOpen, Trash2, CheckCircle2 } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  Housing: "#6366f1", Groceries: "#10b981", "Dining Out": "#f59e0b",
  Transport: "#ef4444", Subscriptions: "#ec4899", Health: "#3b82f6",
  Shopping: "#8b5cf6", Travel: "#14b8a6", Entertainment: "#f97316", Savings: "#71717a",
};

const ALL_CATEGORIES = [
  "Housing", "Groceries", "Dining Out", "Transport", "Subscriptions",
  "Health", "Shopping", "Travel", "Entertainment", "Savings", "Other",
];

const RULES_KEY = "vela-category-rules"; // { [merchant]: category }
const OVERRIDE_KEY = "vela-tx-overrides"; // { [txId]: category }

function loadRules(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(RULES_KEY) ?? "{}"); } catch { return {}; }
}
function saveRules(rules: Record<string, string>) {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}
function loadOverrides(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY) ?? "{}"); } catch { return {}; }
}
function saveOverrides(overrides: Record<string, string>) {
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
}

function applyRulesAndOverrides(txs: Transaction[], rules: Record<string, string>, overrides: Record<string, string>): Transaction[] {
  return txs.map((tx) => {
    if (overrides[tx.id]) return { ...tx, category: overrides[tx.id] };
    const merchant = tx.merchant.toLowerCase().trim();
    for (const [pattern, cat] of Object.entries(rules)) {
      if (merchant.includes(pattern.toLowerCase())) return { ...tx, category: cat };
    }
    return tx;
  });
}

export default function CashFlow() {
  const [rawTransactions, setRawTransactions] = useState<Transaction[]>([]);
  const [income, setIncome] = useState<MonthIncome[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [rules, setRules] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [showRules, setShowRules] = useState(false);
  const [rulePrompt, setRulePrompt] = useState<{ txId: string; merchant: string; category: string } | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);

  useEffect(() => {
    setRules(loadRules());
    setOverrides(loadOverrides());
    fetchJSON<Transaction[]>("transactions.json").then((txs) => {
      setRawTransactions(txs);
      const months = [...new Set(txs.map((t) => t.date.slice(0, 7)))].sort();
      setSelectedMonth(months[months.length - 1]);
    });
    fetchJSON<MonthIncome[]>("income.json").then(setIncome);
  }, []);

  // Apply rules + overrides on top of raw data
  const transactions = useMemo(
    () => applyRulesAndOverrides(rawTransactions, rules, overrides),
    [rawTransactions, rules, overrides]
  );

  if (!transactions.length || !selectedMonth) return <div className="vela-text-muted animate-pulse">Loading cash flow...</div>;

  const months = [...new Set(rawTransactions.map((t) => t.date.slice(0, 7)))].sort();

  // Monthly summary for bar chart
  const monthlyData = months.map((m) => {
    const inc = income.find((i) => i.month === m);
    const totalIncome = inc ? inc.sources.reduce((s, src) => s + src.amount, 0) : 0;
    const spend = getMonthlySpend(transactions, m);
    const totalSpend = Object.values(spend).reduce((s, v) => s + v, 0);
    return {
      month: formatMonth(m),
      Income: Math.round(totalIncome),
      Spending: Math.round(totalSpend),
    };
  });

  // Selected month breakdown
  const spendByCat = getMonthlySpend(transactions, selectedMonth);
  const catBreakdown = Object.entries(spendByCat)
    .map(([cat, amount]) => ({ cat, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount);

  const thisIncome = income.find((i) => i.month === selectedMonth);
  const totalIncome = thisIncome?.sources.reduce((s, src) => s + src.amount, 0) ?? 0;
  const totalSpend = Object.values(spendByCat).reduce((s, v) => s + v, 0);
  const net = totalIncome - totalSpend;

  // Drill-down: all transactions for the selected category + month
  const drillTxs = drillCategory
    ? transactions
        .filter((t) => t.date.startsWith(selectedMonth) && t.category === drillCategory)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  // Recent transactions (no drill)
  const recentTx = transactions
    .filter((t) => t.date.startsWith(selectedMonth))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 15);

  function recategorize(tx: Transaction, newCat: string) {
    const newOverrides = { ...overrides, [tx.id]: newCat };
    setOverrides(newOverrides);
    saveOverrides(newOverrides);
    // Offer to make a rule if this is a fresh override
    if (!overrides[tx.id]) {
      setRulePrompt({ txId: tx.id, merchant: tx.merchant, category: newCat });
    }
    // Flash confirmation
    setJustSaved(tx.id);
    setTimeout(() => setJustSaved(null), 1500);
  }

  function addRule(merchant: string, category: string) {
    const key = merchant.toLowerCase().trim();
    const newRules = { ...rules, [key]: category };
    setRules(newRules);
    saveRules(newRules);
    setRulePrompt(null);
  }

  function deleteRule(key: string) {
    const newRules = { ...rules };
    delete newRules[key];
    setRules(newRules);
    saveRules(newRules);
  }

  // ── Rules manager modal ──
  if (showRules) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowRules(false)} className="p-1.5 vela-text-muted hover:vela-text-primary rounded-lg transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p className="vela-text-muted text-sm">Merchant → Category mappings</p>
            <h2 className="text-2xl font-bold vela-text-primary">Auto-Categorization Rules</h2>
          </div>
        </div>
        <div className="vela-bg-surface rounded-2xl p-6 border">
          <p className="text-sm vela-text-muted mb-4">
            When a transaction's merchant name contains any of these patterns, it's automatically placed in that category.
            Rules apply to new CSV imports and future Plaid transactions.
          </p>
          {Object.keys(rules).length === 0 ? (
            <p className="text-sm vela-text-faint italic">No rules yet. Re-categorize a transaction and choose "Always" to create your first rule.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(rules).map(([pattern, cat]) => (
                <div key={pattern} className="flex items-center justify-between py-2.5 px-4 vela-bg-surface-2 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono vela-text-secondary bg-zinc-700/40 px-2 py-0.5 rounded">{pattern}</span>
                    <span className="text-xs vela-text-muted">→</span>
                    <span className="text-xs font-medium" style={{ color: CATEGORY_COLORS[cat] ?? "#6366f1" }}>{cat}</span>
                  </div>
                  <button onClick={() => deleteRule(pattern)} className="p-1 vela-text-faint hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Category drill-down ──
  if (drillCategory) {
    const catColor = CATEGORY_COLORS[drillCategory] ?? "#6366f1";
    const catTotal = drillTxs.reduce((s, t) => s + t.amount, 0);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setDrillCategory(null)} className="p-1.5 vela-text-muted hover:vela-text-primary rounded-lg transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p className="vela-text-muted text-sm">{formatMonth(selectedMonth)} · {drillTxs.length} transactions</p>
            <h2 className="text-2xl font-bold vela-text-primary" style={{ color: catColor }}>{drillCategory}</h2>
          </div>
          <span className="ml-auto text-2xl font-bold vela-text-primary">{formatCurrency(catTotal)}</span>
        </div>

        {/* Rule prompt banner */}
        {rulePrompt && (
          <div className="p-4 bg-indigo-900/20 border border-indigo-700/40 rounded-xl flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium vela-text-primary">Always categorize "{rulePrompt.merchant}" as {rulePrompt.category}?</p>
              <p className="text-xs vela-text-muted mt-0.5">This creates a rule that applies to future imports too.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => addRule(rulePrompt.merchant, rulePrompt.category)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors">
                Always
              </button>
              <button onClick={() => setRulePrompt(null)}
                className="px-3 py-1.5 vela-bg-surface-2 vela-text-secondary text-xs font-medium rounded-lg transition-colors">
                Just this once
              </button>
            </div>
          </div>
        )}

        <div className="vela-bg-surface rounded-2xl p-6 border">
          <div className="space-y-1">
            {drillTxs.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                allCategories={ALL_CATEGORIES}
                onRecategorize={recategorize}
                justSaved={justSaved === tx.id}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Main cash flow view ──
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <p className="vela-text-muted text-sm">Where it comes from, where it goes.</p>
          <h2 className="text-3xl font-bold vela-text-primary mt-1">How My Money Moves</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRules(true)}
            className="flex items-center gap-1.5 text-xs font-medium vela-text-muted hover:vela-text-primary transition-colors"
          >
            <BookOpen size={13} />
            {Object.keys(rules).length > 0 ? `${Object.keys(rules).length} rules` : "Rules"}
          </button>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="vela-bg-input border rounded-lg px-3 py-2 text-sm"
          >
            {months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Income", value: totalIncome, color: "text-emerald-400" },
          { label: "Spending", value: totalSpend, color: "text-red-400" },
          { label: "Net Cash Flow", value: net, color: net >= 0 ? "text-emerald-400" : "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="vela-bg-surface rounded-2xl p-5 border">
            <p className="text-xs vela-text-muted uppercase tracking-wide mb-2">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value >= 0 ? "" : "−"}{formatCurrency(Math.abs(value))}</p>
          </div>
        ))}
      </div>

      {/* Income vs Spending bar chart */}
      <div className="vela-bg-surface rounded-2xl p-6 border">
        <h3 className="text-sm font-semibold vela-text-secondary mb-4">Income vs. Spending — 12 Months</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyData} barGap={4}>
            <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
            <Tooltip
              formatter={(v: any, name: any) => [formatCurrency(Number(v)), name]}
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ color: "#a1a1aa", fontSize: 12 }} />
            <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Spending" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category breakdown + recent transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="vela-bg-surface rounded-2xl p-6 border">
          <h3 className="text-sm font-semibold vela-text-secondary mb-1">Spending by Category</h3>
          <p className="text-xs vela-text-muted mb-4">Click any category to drill in and re-categorize.</p>
          <div className="space-y-3">
            {catBreakdown.map(({ cat, amount }) => {
              const pct = (amount / totalSpend) * 100;
              const color = CATEGORY_COLORS[cat] ?? "#6366f1";
              return (
                <button
                  key={cat}
                  onClick={() => setDrillCategory(cat)}
                  className="w-full text-left group"
                >
                  <div className="flex justify-between text-sm mb-1">
                    <span className="vela-text-secondary group-hover:vela-text-primary transition-colors flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                      {cat}
                    </span>
                    <span className="vela-text-primary font-medium">{formatCurrency(amount)}</span>
                  </div>
                  <div className="w-full h-1.5 vela-bar-track rounded-full">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="vela-bg-surface rounded-2xl p-6 border">
          <h3 className="text-sm font-semibold vela-text-secondary mb-4">Recent Transactions</h3>
          <div className="space-y-1">
            {recentTx.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                allCategories={ALL_CATEGORIES}
                onRecategorize={recategorize}
                justSaved={justSaved === tx.id}
                compact
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Transaction row with inline re-categorize dropdown ── */
function TransactionRow({
  tx,
  allCategories,
  onRecategorize,
  justSaved,
  compact = false,
}: {
  tx: Transaction;
  allCategories: string[];
  onRecategorize: (tx: Transaction, cat: string) => void;
  justSaved: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const color = CATEGORY_COLORS[tx.category] ?? "#6366f1";

  return (
    <div className={`flex items-center gap-3 py-2 border-b vela-border-subtle last:border-0 group relative ${compact ? "" : "py-2.5"}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm vela-text-primary truncate">{tx.merchant}</p>
        <p className="text-xs vela-text-muted">{tx.date}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* Category badge — click to change */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-all hover:opacity-80"
          style={{ background: color + "20", color }}
          title="Change category"
        >
          <Tag size={10} />
          {tx.category}
        </button>
        {justSaved && <CheckCircle2 size={13} className="text-emerald-400" />}
        <span className="text-sm font-medium vela-text-primary">{formatCurrency(tx.amount)}</span>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 vela-bg-nav border vela-border rounded-xl shadow-xl p-1.5 min-w-44">
          <p className="text-[10px] vela-text-faint px-2 py-1 uppercase tracking-wide">Move to category</p>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => { onRecategorize(tx, cat); setOpen(false); }}
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors hover:bg-zinc-700/30 ${cat === tx.category ? "vela-text-primary font-semibold" : "vela-text-secondary"}`}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[cat] ?? "#6366f1" }} />
              {cat}
              {cat === tx.category && <span className="ml-auto vela-text-faint">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState, useMemo } from "react";
import {
  fetchJSON, formatCurrency, formatMonth, getMonthlySpend,
  loadRules, saveRules, loadOverrides, saveOverrides,
  useTransactions,
  Transaction, MonthIncome,
} from "@/lib/data";
import { useDemo } from "@/components/demo-provider";
import { ChevronLeft, Tag, BookOpen, Trash2, CheckCircle2 } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  Housing: "#6366f1", Groceries: "#10b981", "Dining Out": "#f59e0b",
  Transport: "#ef4444", Subscriptions: "#ec4899", Health: "#3b82f6",
  Shopping: "#8b5cf6", Travel: "#14b8a6", Entertainment: "#f97316", Savings: "#71717a",
};

const ALL_CATEGORIES = [
  "Housing", "Groceries", "Dining Out", "Transport", "Subscriptions",
  "Health", "Shopping", "Travel", "Entertainment", "Childcare", "Kids Activities", "Savings", "Other",
];

// Fixed-cost categories for waterfall grouping
const FIXED_CATEGORIES = new Set(["Housing", "Subscriptions", "Childcare"]);
const VARIABLE_CATEGORIES = new Set(["Groceries", "Dining Out", "Transport", "Health", "Shopping", "Travel", "Entertainment", "Kids Activities", "Other"]);


export default function CashFlow() {
  const { isDemo } = useDemo();
  const ns = isDemo ? "demo" : "";
  const [income, setIncome] = useState<MonthIncome[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  // rules/overrides kept in local state so the UI reacts immediately when the
  // user edits them; the hook re-reads from localStorage on its next render.
  const [rules, setRules] = useState<Record<string, string>>(() => loadRules(ns));
  const [overrides, setOverrides] = useState<Record<string, string>>(() => loadOverrides(ns));
  const [showRules, setShowRules] = useState(false);
  const [rulePrompt, setRulePrompt] = useState<{ txId: string; merchant: string; category: string } | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  // true when the user arrived from the import flow — shows an uncategorized banner
  const [reviewMode, setReviewMode] = useState(false);

  // Pass our own rules/overrides into the hook so edits apply immediately
  // without waiting for a localStorage round-trip inside the hook.
  const transactions = useTransactions(ns, rules, overrides);

  useEffect(() => {
    if (isDemo) {
      fetchJSON<MonthIncome[]>("income.json")
        .then(setIncome)
        .catch((e) => console.error("[Pacioli] cash-flow fetch failed:", e));
    }
    // Check if we were sent here from an import to review uncategorized items
    if (sessionStorage.getItem("pacioli-review-uncategorized")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReviewMode(true);
      sessionStorage.removeItem("pacioli-review-uncategorized");
    }
  }, [ns, isDemo]);

  // Derive available months from transactions; let user override via selectedMonth
  const allTxMonths = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort();
  const activeMonth = selectedMonth || allTxMonths[allTxMonths.length - 1] || "";

  if (!isDemo && transactions.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <p className="pacioli-text-muted text-sm mb-1">Where it comes from, where it goes.</p>
      <h2 className="text-3xl font-bold pacioli-text-primary mt-1 mb-6">How My Money Moves</h2>
      <p className="pacioli-text-muted mb-8 max-w-sm">No transaction data yet. Import a CSV to see your cash flow breakdown.</p>
      <a href="/connect" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"#0d6e6e", color:"#fff", padding:"12px 24px", borderRadius:10, fontWeight:600, textDecoration:"none" }}>
        Connect data
      </a>
    </div>
  );

  if (!transactions.length || !activeMonth) return <div className="pacioli-text-muted animate-pulse">Loading cash flow...</div>;

  const months = allTxMonths;

  // Selected month breakdown
  const spendByCat = getMonthlySpend(transactions, activeMonth);
  const catBreakdown = Object.entries(spendByCat)
    .map(([cat, amount]) => ({ cat, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount);

  const thisIncome = income.find((i) => i.month === activeMonth);
  const totalIncome = thisIncome?.sources.reduce((s, src) => s + src.amount, 0) ?? 0;
  const totalSpend = Object.values(spendByCat).reduce((s, v) => s + v, 0);
  const net = totalIncome - totalSpend;

  // Drill-down: all transactions for the selected category + month
  const drillTxs = drillCategory
    ? transactions
        .filter((t) => t.date.startsWith(activeMonth) && t.category === drillCategory)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  // Uncategorized across all months (for review mode)
  const uncategorizedTxs = transactions
    .filter((t) => t.category === "Uncategorized")
    .sort((a, b) => b.date.localeCompare(a.date));

  // Recent transactions (no drill) — in review mode, show uncategorized only
  const recentTx = reviewMode
    ? uncategorizedTxs.slice(0, 50)
    : transactions
        .filter((t) => t.date.startsWith(activeMonth))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 15);

  function recategorize(tx: Transaction, newCat: string) {
    const newOverrides = { ...overrides, [tx.id]: newCat };
    setOverrides(newOverrides);
    saveOverrides(newOverrides, ns);
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
    saveRules(newRules, ns);
    setRulePrompt(null);
  }

  function deleteRule(key: string) {
    const newRules = { ...rules };
    delete newRules[key];
    setRules(newRules);
    saveRules(newRules, ns);
  }

  // ── Rules manager modal ──
  if (showRules) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowRules(false)} className="p-1.5 pacioli-text-muted hover:pacioli-text-primary rounded-lg transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p className="pacioli-text-muted text-sm">Merchant → Category mappings</p>
            <h2 className="text-2xl font-bold pacioli-text-primary">Auto-Categorization Rules</h2>
          </div>
        </div>
        <div className="pacioli-bg-surface rounded-2xl p-6 border">
          <p className="text-sm pacioli-text-muted mb-4">
            When a transaction's merchant name contains any of these patterns, it's automatically placed in that category.
            Rules apply to new CSV imports and future Plaid transactions.
          </p>
          {Object.keys(rules).length === 0 ? (
            <p className="text-sm pacioli-text-faint italic">No rules yet. Re-categorize a transaction and choose "Always" to create your first rule.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(rules).map(([pattern, cat]) => (
                <div key={pattern} className="flex items-center justify-between py-2.5 px-4 pacioli-bg-surface-2 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono pacioli-text-secondary pacioli-bg-chip px-2 py-0.5 rounded">{pattern}</span>
                    <span className="text-xs pacioli-text-muted">→</span>
                    <span className="text-xs font-medium" style={{ color: CATEGORY_COLORS[cat] ?? "#6366f1" }}>{cat}</span>
                  </div>
                  <button onClick={() => deleteRule(pattern)} className="p-1 pacioli-text-faint hover:pacioli-text-danger transition-colors">
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
          <button onClick={() => setDrillCategory(null)} className="p-1.5 pacioli-text-muted hover:pacioli-text-primary rounded-lg transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p className="pacioli-text-muted text-sm">{formatMonth(activeMonth)} · {drillTxs.length} transactions</p>
            <h2 className="text-2xl font-bold pacioli-text-primary" style={{ color: catColor }}>{drillCategory}</h2>
          </div>
          <span className="ml-auto text-2xl font-bold pacioli-text-primary">{formatCurrency(catTotal)}</span>
        </div>

        {/* Rule prompt banner */}
        {rulePrompt && (
          <div className="p-4 pacioli-bg-surface border pacioli-border rounded-xl flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium pacioli-text-primary">Always categorize "{rulePrompt.merchant}" as {rulePrompt.category}?</p>
              <p className="text-xs pacioli-text-muted mt-0.5">This creates a rule that applies to future imports too.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => addRule(rulePrompt.merchant, rulePrompt.category)}
                className="px-3 py-1.5 bg-teal-700 hover:bg-teal-600 text-white text-xs font-medium rounded-lg transition-colors">
                Always
              </button>
              <button onClick={() => setRulePrompt(null)}
                className="px-3 py-1.5 pacioli-bg-surface-2 pacioli-text-secondary text-xs font-medium rounded-lg transition-colors">
                Just this once
              </button>
            </div>
          </div>
        )}

        <div className="pacioli-bg-surface rounded-2xl p-6 border">
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

  // ── Waterfall data ──
  const fixedSpend = catBreakdown.filter(c => FIXED_CATEGORIES.has(c.cat)).reduce((s, c) => s + c.amount, 0);
  const variableSpend = catBreakdown.filter(c => VARIABLE_CATEGORIES.has(c.cat)).reduce((s, c) => s + c.amount, 0);
  const surplus = totalIncome - totalSpend;
  const savingsRate = totalIncome > 0 ? Math.round((surplus / totalIncome) * 100) : 0;

  // Waterfall bar widths as % of income
  const fixedPct   = totalIncome > 0 ? (fixedSpend / totalIncome) * 100 : 0;
  const varPct     = totalIncome > 0 ? (variableSpend / totalIncome) * 100 : 0;
  const surplusPct = totalIncome > 0 ? Math.max(0, (surplus / totalIncome) * 100) : 0;

  // Income sources for the month
  const incomeSources = thisIncome?.sources ?? [];

  // ── Main cash flow view ──
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <p className="pacioli-text-muted text-sm">Where it comes from, where it goes.</p>
          <h2 className="text-3xl font-bold pacioli-text-primary mt-1">How My Money Moves</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRules(true)}
            className="flex items-center gap-1.5 text-xs font-medium pacioli-text-muted hover:pacioli-text-primary transition-colors"
          >
            <BookOpen size={13} />
            {Object.keys(rules).length > 0 ? `${Object.keys(rules).length} rules` : "Rules"}
          </button>
          <select
            value={activeMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="pacioli-bg-input border rounded-lg px-3 py-2 text-sm"
          >
            {months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
          </select>
        </div>
      </div>

      {/* ── Cash Waterfall ── */}
      <div className="pacioli-bg-surface rounded-2xl p-6 border">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-sm font-semibold pacioli-text-secondary">Cash Flow — {formatMonth(activeMonth)}</h3>
            <p className="text-xs pacioli-text-muted mt-0.5">Where every dollar of income goes</p>
          </div>
          <div className="text-right">
            <p className="text-xs pacioli-text-muted">Savings rate</p>
            <p className={`text-2xl font-bold ${savingsRate >= 20 ? "pacioli-text-success" : "pacioli-text-warning"}`}>{savingsRate}%</p>
          </div>
        </div>

        {/* Waterfall bar */}
        <div className="w-full h-10 rounded-xl overflow-hidden flex gap-0.5 mb-4">
          <div className="h-10 bg-emerald-500/80 flex items-center justify-center transition-all duration-500"
            style={{ width: `${fixedPct}%` }} title={`Fixed costs: ${formatCurrency(fixedSpend)}`}>
            {fixedPct > 8 && <span className="text-[10px] font-semibold text-white truncate px-1">Fixed</span>}
          </div>
          <div className="h-10 bg-indigo-500/80 flex items-center justify-center transition-all duration-500"
            style={{ width: `${varPct}%` }} title={`Variable: ${formatCurrency(variableSpend)}`}>
            {varPct > 8 && <span className="text-[10px] font-semibold text-white truncate px-1">Variable</span>}
          </div>
          <div className="h-10 bg-teal-600/40 border border-teal-600/30 flex items-center justify-center rounded-r-xl transition-all duration-500"
            style={{ width: `${surplusPct}%` }} title={`Surplus: ${formatCurrency(surplus)}`}>
            {surplusPct > 8 && <span className="text-[10px] font-semibold text-teal-300 truncate px-1">Saved</span>}
          </div>
        </div>

        {/* Three columns */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <p className="text-xs font-medium text-emerald-400">Fixed Costs</p>
            </div>
            <p className="text-xl font-bold pacioli-text-primary">{formatCurrency(fixedSpend)}</p>
            <p className="text-xs pacioli-text-muted mt-0.5">{Math.round(fixedPct)}% of income</p>
            <p className="text-xs pacioli-text-muted mt-2 leading-relaxed">Housing, childcare, subscriptions</p>
          </div>
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <p className="text-xs font-medium text-indigo-400">Variable Spending</p>
            </div>
            <p className="text-xl font-bold pacioli-text-primary">{formatCurrency(variableSpend)}</p>
            <p className="text-xs pacioli-text-muted mt-0.5">{Math.round(varPct)}% of income</p>
            <p className="text-xs pacioli-text-muted mt-2 leading-relaxed">Groceries, dining, travel, etc.</p>
          </div>
          <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/20">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              <p className="text-xs font-medium text-teal-400">Net Surplus</p>
            </div>
            <p className={`text-xl font-bold ${surplus >= 0 ? "pacioli-text-success" : "pacioli-text-danger"}`}>{formatCurrency(Math.abs(surplus))}</p>
            <p className="text-xs pacioli-text-muted mt-0.5">{savingsRate}% savings rate</p>
            <p className="text-xs pacioli-text-muted mt-2 leading-relaxed">Available to save or invest</p>
          </div>
        </div>

        {/* Income sources */}
        {incomeSources.length > 0 && (
          <div className="border-t pacioli-border-subtle pt-4">
            <p className="text-xs font-semibold pacioli-text-secondary mb-3">Income Sources — {formatMonth(activeMonth)}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {incomeSources.map((src) => (
                <div key={src.label} className="p-3 pacioli-bg-surface-2 rounded-xl">
                  <p className="text-xs pacioli-text-muted truncate mb-1">{src.label}</p>
                  <p className="text-sm font-bold pacioli-text-primary">{formatCurrency(src.amount)}</p>
                  <p className="text-[10px] pacioli-text-faint mt-0.5 capitalize">{src.type}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Category breakdown + recent transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="pacioli-bg-surface rounded-2xl p-6 border">
          <h3 className="text-sm font-semibold pacioli-text-secondary mb-1">Spending by Category</h3>
          <p className="text-xs pacioli-text-muted mb-4">Click any category to drill in and re-categorize.</p>
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
                    <span className="pacioli-text-secondary group-hover:pacioli-text-primary transition-colors flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                      {cat}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs pacioli-text-muted">{Math.round(pct)}%</span>
                      <span className="pacioli-text-primary font-medium">{formatCurrency(amount)}</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 pacioli-bar-track rounded-full">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pacioli-bg-surface rounded-2xl p-6 border">
          {reviewMode && (
            <div className="flex items-center justify-between gap-3 mb-4 px-3 py-2.5 pacioli-alert-warning border rounded-xl">
              <div className="flex items-center gap-2">
                <Tag size={13} className="pacioli-text-warning shrink-0" />
                <p className="text-xs pacioli-text-warning">
                  {uncategorizedTxs.length > 0
                    ? <><span className="font-semibold">{uncategorizedTxs.length}</span> uncategorized transaction{uncategorizedTxs.length !== 1 ? "s" : ""} — tap a category badge to fix</>
                    : <span className="pacioli-text-success font-medium">All transactions categorized!</span>
                  }
                </p>
              </div>
              <button onClick={() => setReviewMode(false)} className="text-xs pacioli-text-muted hover:pacioli-text-primary transition-colors shrink-0">
                Show all
              </button>
            </div>
          )}
          <h3 className="text-sm font-semibold pacioli-text-secondary mb-4">
            {reviewMode ? "Uncategorized Transactions" : "Recent Transactions"}
          </h3>
          {recentTx.length === 0 && reviewMode && (
            <p className="text-sm pacioli-text-muted text-center py-4">Nothing left to categorize.</p>
          )}
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
    <div className={`flex items-center gap-3 py-2 border-b pacioli-border-subtle last:border-0 group relative ${compact ? "" : "py-2.5"}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm pacioli-text-primary truncate">{tx.merchant}</p>
        <p className="text-xs pacioli-text-muted">{tx.date}</p>
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
        {justSaved && <CheckCircle2 size={13} className="pacioli-text-success" />}
        <span className="text-sm font-medium pacioli-text-primary">{formatCurrency(tx.amount)}</span>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 pacioli-bg-nav border pacioli-border rounded-xl shadow-xl p-1.5 min-w-44 max-h-64 overflow-y-auto">
          <p className="text-[10px] pacioli-text-faint px-2 py-1 uppercase tracking-wide">Move to category</p>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => { onRecategorize(tx, cat); setOpen(false); }}
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors pacioli-bg-nav-hover ${cat === tx.category ? "pacioli-text-primary font-semibold" : "pacioli-text-secondary"}`}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[cat] ?? "#6366f1" }} />
              {cat}
              {cat === tx.category && <span className="ml-auto pacioli-text-faint">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

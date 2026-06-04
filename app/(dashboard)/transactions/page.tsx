"use client";
import { useState, useMemo, useCallback } from "react";
import {
  formatCurrency, formatMonth,
  loadRules, saveRules, loadOverrides, saveOverrides,
  applyRulesAndOverrides, useTransactions,
  Transaction,
} from "@/lib/data";
import { useDemo } from "@/components/demo-provider";
import {
  Search, X, Check, ChevronUp, ChevronDown, ChevronsUpDown,
  Tag, Pencil, CheckSquare, Square, Filter,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_CATEGORIES = [
  "Childcare", "Dining Out", "Entertainment", "Groceries", "Health", "Housing",
  "Kids Activities", "Savings", "Shopping", "Subscriptions", "Transport", "Travel", "Uncategorized",
];

const CATEGORY_COLORS: Record<string, string> = {
  Housing: "#6366f1", Groceries: "#10b981", "Dining Out": "#f59e0b",
  Transport: "#ef4444", Subscriptions: "#ec4899", Health: "#3b82f6",
  Shopping: "#8b5cf6", Travel: "#14b8a6", Entertainment: "#f97316",
  Savings: "#22d3ee", Uncategorized: "#71717a",
};

type SortField = "date" | "merchant" | "category" | "amount";
type SortDir = "asc" | "desc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dot(cat: string) {
  return <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ background: CATEGORY_COLORS[cat] ?? "#71717a" }} />;
}

// ─── Inline category picker ───────────────────────────────────────────────────

function CategoryPicker({
  value,
  onChange,
  onClose,
  categories,
}: {
  value: string;
  onChange: (cat: string) => void;
  onClose: () => void;
  categories: string[];
}) {
  return (
    <div className="absolute z-50 mt-1 right-0 w-44 pacioli-bg-surface border rounded-xl shadow-xl overflow-hidden">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => { onChange(cat); onClose(); }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-indigo-600 hover:text-white transition-colors ${cat === value ? "bg-indigo-600/20 text-indigo-400" : "pacioli-text-secondary"}`}
        >
          {dot(cat)}
          {cat}
          {cat === value && <Check size={11} className="ml-auto" />}
        </button>
      ))}
    </div>
  );
}

// ─── Transaction row ──────────────────────────────────────────────────────────

function TxRow({
  tx,
  selected,
  onSelect,
  onCategoryChange,
  categories,
}: {
  tx: Transaction;
  selected: boolean;
  onSelect: (id: string) => void;
  onCategoryChange: (id: string, cat: string) => void;
  categories: string[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const color = CATEGORY_COLORS[tx.category] ?? "#71717a";

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b pacioli-border-subtle last:border-0 transition-colors ${selected ? "pacioli-bg-surface-2" : "pacioli-bg-nav-hover"}`}>
      {/* Checkbox */}
      <button
        onClick={() => onSelect(tx.id)}
        className={`shrink-0 transition-colors ${selected ? "text-indigo-400" : "pacioli-text-muted hover:pacioli-text-primary"}`}
      >
        {selected ? <CheckSquare size={16} /> : <Square size={16} />}
      </button>

      {/* Date */}
      <span className="w-24 shrink-0 text-xs pacioli-text-muted tabular-nums">{tx.date}</span>

      {/* Merchant */}
      <span className="flex-1 text-sm pacioli-text-primary truncate">{tx.merchant}</span>

      {/* Category pill + picker */}
      <div className="relative shrink-0">
        <button
          onClick={() => setPickerOpen((o) => !o)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors hover:border-indigo-500/50 group"
          style={{ borderColor: `${color}40`, color }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
          {tx.category}
          <Pencil size={10} className="opacity-0 group-hover:opacity-60 transition-opacity" />
        </button>
        {pickerOpen && (
          <CategoryPicker
            value={tx.category}
            onChange={(cat) => onCategoryChange(tx.id, cat)}
            onClose={() => setPickerOpen(false)}
            categories={categories}
          />
        )}
      </div>

      {/* Amount */}
      <span className="w-24 text-right text-sm font-semibold pacioli-text-primary tabular-nums shrink-0">
        {formatCurrency(tx.amount)}
      </span>
    </div>
  );
}

// ─── Sort header button ────────────────────────────────────────────────────────

function SortBtn({
  field, current, dir, onClick, children,
}: {
  field: SortField; current: SortField; dir: SortDir;
  onClick: (f: SortField) => void; children: React.ReactNode;
}) {
  const active = field === current;
  const Icon = active ? (dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <button
      onClick={() => onClick(field)}
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors ${active ? "pacioli-text-primary" : "pacioli-text-muted hover:pacioli-text-primary"}`}
    >
      {children}
      <Icon size={12} />
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const { isDemo } = useDemo();
  const ns = isDemo ? "demo" : "";

  // Own rules/overrides state so edits apply instantly
  const [rules, setRules] = useState<Record<string, string>>(() => loadRules(ns));
  const [overrides, setOverrides] = useState<Record<string, string>>(() => loadOverrides(ns));
  const transactions = useTransactions(ns, rules, overrides);

  // ── Filters ──
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string[]>([]);
  const [filterMonthFrom, setFilterMonthFrom] = useState("");
  const [filterMonthTo, setFilterMonthTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false);
  const [catFilterOpen, setCatFilterOpen] = useState(false);
  const [showAmountFilter, setShowAmountFilter] = useState(false);

  // ── Sort ──
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Selection ──
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState("");
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);

  // ── Derived ──
  const allMonths = useMemo(() => [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort().reverse(), [transactions]);
  const allCategories = useMemo(() => {
    const cats = new Set(transactions.map((t) => t.category));
    ALL_CATEGORIES.forEach((c) => cats.add(c));
    return [...cats].sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    let txs = transactions;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      txs = txs.filter((t) => t.merchant.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
    }
    if (uncategorizedOnly) {
      txs = txs.filter((t) => t.category === "Uncategorized" || !t.category);
    } else if (filterCat.length > 0) {
      txs = txs.filter((t) => filterCat.includes(t.category));
    }
    if (filterMonthFrom) txs = txs.filter((t) => t.date.slice(0, 7) >= filterMonthFrom);
    if (filterMonthTo)   txs = txs.filter((t) => t.date.slice(0, 7) <= filterMonthTo);
    const minAmt = amountMin !== "" ? Number(amountMin) : null;
    const maxAmt = amountMax !== "" ? Number(amountMax) : null;
    if (minAmt !== null) txs = txs.filter((t) => t.amount >= minAmt);
    if (maxAmt !== null) txs = txs.filter((t) => t.amount <= maxAmt);
    return txs;
  }, [transactions, search, filterCat, filterMonthFrom, filterMonthTo, amountMin, amountMax, uncategorizedOnly]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = a.date < b.date ? -1 : 1;
      else if (sortField === "merchant") cmp = a.merchant.localeCompare(b.merchant);
      else if (sortField === "category") cmp = a.category.localeCompare(b.category);
      else if (sortField === "amount") cmp = a.amount - b.amount;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  // Stats for visible transactions
  const visibleTotal = useMemo(() => filtered.reduce((s, t) => s + t.amount, 0), [filtered]);

  // ── Handlers ──
  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === sorted.length) setSelected(new Set());
    else setSelected(new Set(sorted.map((t) => t.id)));
  }

  const handleCategoryChange = useCallback((id: string, cat: string) => {
    const updated = { ...overrides, [id]: cat };
    setOverrides(updated);
    saveOverrides(updated, ns);
  }, [overrides, ns]);

  function applyBulkCategory(cat: string) {
    if (!cat || selected.size === 0) return;
    const updated = { ...overrides };
    for (const id of selected) updated[id] = cat;
    setOverrides(updated);
    saveOverrides(updated, ns);
    setSelected(new Set());
    setBulkCat("");
    setBulkPickerOpen(false);
  }

  function clearFilters() {
    setSearch("");
    setFilterCat([]);
    setFilterMonthFrom("");
    setFilterMonthTo("");
    setAmountMin("");
    setAmountMax("");
    setUncategorizedOnly(false);
  }

  const hasFilters = search.trim() || filterCat.length > 0 || filterMonthFrom || filterMonthTo || amountMin || amountMax || uncategorizedOnly;
  const allSelected = sorted.length > 0 && selected.size === sorted.length;
  const someSelected = selected.size > 0;

  if (!isDemo && transactions.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <p className="pacioli-text-muted text-sm mb-1">All transactions from your accounts and CSV imports.</p>
      <h2 className="text-3xl font-bold pacioli-text-primary mt-1 mb-6">Transactions</h2>
      <p className="pacioli-text-muted mb-8 max-w-sm">No transactions yet. Import a CSV to see your spending history.</p>
      <a href="/connect" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"#534AB7", color:"#fff", padding:"12px 24px", borderRadius:10, fontWeight:600, textDecoration:"none" }}>
        Connect data
      </a>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="pacioli-text-muted text-sm">All transactions from your accounts and CSV imports</p>
        <h2 className="text-3xl font-bold pacioli-text-primary mt-1">Transactions</h2>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <div className="pacioli-bg-surface border rounded-xl px-4 py-2.5">
          <p className="text-xs pacioli-text-muted">Showing</p>
          <p className="text-lg font-bold pacioli-text-primary">{filtered.length.toLocaleString()}</p>
        </div>
        <div className="pacioli-bg-surface border rounded-xl px-4 py-2.5">
          <p className="text-xs pacioli-text-muted">Total spend</p>
          <p className="text-lg font-bold pacioli-text-primary">{formatCurrency(visibleTotal)}</p>
        </div>
        <div className="pacioli-bg-surface border rounded-xl px-4 py-2.5">
          <p className="text-xs pacioli-text-muted">All time</p>
          <p className="text-lg font-bold pacioli-text-primary">{transactions.length.toLocaleString()} transactions</p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="space-y-2">
        {/* Row 1: search + date range + category + amount toggle */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pacioli-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search merchant or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pacioli-bg-input border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 pacioli-text-primary placeholder:pacioli-text-muted"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 pacioli-text-muted hover:pacioli-text-primary">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Date range */}
          <select
            value={filterMonthFrom}
            onChange={(e) => setFilterMonthFrom(e.target.value)}
            className="pacioli-bg-input border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 pacioli-text-primary"
          >
            <option value="">From…</option>
            {allMonths.slice().reverse().map((m) => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
          <select
            value={filterMonthTo}
            onChange={(e) => setFilterMonthTo(e.target.value)}
            className="pacioli-bg-input border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 pacioli-text-primary"
          >
            <option value="">To…</option>
            {allMonths.slice().reverse().map((m) => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>

          {/* Category filter */}
          <div className="relative">
            <button
              onClick={() => setCatFilterOpen((o) => !o)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-sm transition-colors ${filterCat.length > 0 ? "border-indigo-500 text-indigo-400" : "pacioli-text-muted pacioli-bg-input hover:pacioli-text-primary"}`}
            >
              <Filter size={13} />
              {filterCat.length > 0 ? `${filterCat.length} categories` : "Category"}
            </button>
            {catFilterOpen && (
              <div className="absolute z-50 mt-1 left-0 w-48 pacioli-bg-surface border rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                {allCategories.map((cat) => {
                  const active = filterCat.includes(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => setFilterCat((prev) => active ? prev.filter((c) => c !== cat) : [...prev, cat])}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${active ? "pacioli-bg-surface-2 pacioli-accent" : "pacioli-text-secondary pacioli-bg-nav-hover"}`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[cat] ?? "#71717a" }} />
                      {cat}
                      {active && <Check size={11} className="ml-auto" />}
                    </button>
                  );
                })}
                {filterCat.length > 0 && (
                  <button
                    onClick={() => { setFilterCat([]); setCatFilterOpen(false); }}
                    className="w-full px-3 py-2 text-xs text-center pacioli-text-muted border-t pacioli-border-subtle hover:pacioli-text-primary"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Amount filter toggle */}
          <button
            onClick={() => setShowAmountFilter((o) => !o)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-sm transition-colors ${(amountMin || amountMax) ? "border-indigo-500 text-indigo-400" : "pacioli-text-muted pacioli-bg-input hover:pacioli-text-primary"}`}
          >
            $ Amount
          </button>

          {/* Uncategorized quick filter */}
          <button
            onClick={() => { setUncategorizedOnly((o) => !o); setFilterCat([]); }}
            className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-sm transition-colors ${uncategorizedOnly ? "border-amber-500 text-amber-400" : "pacioli-text-muted pacioli-bg-input hover:pacioli-text-primary"}`}
          >
            Uncategorized
          </button>

          {/* Clear filters */}
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs pacioli-text-muted hover:pacioli-text-primary transition-colors">
              <X size={12} /> Clear all
            </button>
          )}
        </div>

        {/* Row 2: amount range (expandable) */}
        {showAmountFilter && (
          <div className="flex items-center gap-2">
            <span className="text-xs pacioli-text-muted">Amount:</span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs pacioli-text-muted">$</span>
              <input
                type="number"
                placeholder="Min"
                value={amountMin}
                onChange={(e) => setAmountMin(e.target.value)}
                className="w-28 pacioli-bg-input border rounded-xl pl-6 pr-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 pacioli-text-primary"
              />
            </div>
            <span className="text-xs pacioli-text-muted">–</span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs pacioli-text-muted">$</span>
              <input
                type="number"
                placeholder="Max"
                value={amountMax}
                onChange={(e) => setAmountMax(e.target.value)}
                className="w-28 pacioli-bg-input border rounded-xl pl-6 pr-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 pacioli-text-primary"
              />
            </div>
            {(amountMin || amountMax) && (
              <button onClick={() => { setAmountMin(""); setAmountMax(""); }} className="text-xs pacioli-text-muted hover:pacioli-text-primary">
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-600/10 border border-indigo-500/30 rounded-xl">
          <span className="text-sm font-medium text-indigo-400">
            {selected.size} selected
          </span>
          <span className="pacioli-text-muted text-xs">·</span>
          <div className="relative">
            <button
              onClick={() => setBulkPickerOpen((o) => !o)}
              className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Tag size={13} />
              Set category
            </button>
            {bulkPickerOpen && (
              <div className="absolute z-50 mt-1 left-0 w-44 pacioli-bg-surface border rounded-xl shadow-xl overflow-hidden">
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => applyBulkCategory(cat)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs pacioli-text-secondary hover:bg-indigo-600 hover:text-white transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[cat] ?? "#71717a" }} />
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs pacioli-text-muted hover:pacioli-text-primary transition-colors flex items-center gap-1"
          >
            <X size={12} /> Deselect
          </button>
        </div>
      )}

      {/* Table */}
      <div className="pacioli-bg-surface rounded-2xl border overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b pacioli-border-subtle pacioli-bg-surface-2">
          {/* Select all */}
          <button
            onClick={toggleSelectAll}
            className={`shrink-0 transition-colors ${allSelected ? "text-indigo-400" : "pacioli-text-muted hover:pacioli-text-primary"}`}
          >
            {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
          </button>
          <div className="w-24 shrink-0">
            <SortBtn field="date" current={sortField} dir={sortDir} onClick={toggleSort}>Date</SortBtn>
          </div>
          <div className="flex-1">
            <SortBtn field="merchant" current={sortField} dir={sortDir} onClick={toggleSort}>Merchant</SortBtn>
          </div>
          <div className="w-36 shrink-0">
            <SortBtn field="category" current={sortField} dir={sortDir} onClick={toggleSort}>Category</SortBtn>
          </div>
          <div className="w-24 text-right shrink-0">
            <SortBtn field="amount" current={sortField} dir={sortDir} onClick={toggleSort}>Amount</SortBtn>
          </div>
        </div>

        {/* Rows */}
        {sorted.length === 0 ? (
          <div className="py-16 text-center">
            <p className="pacioli-text-muted text-sm">No transactions match your filters.</p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-2 text-xs text-indigo-400 hover:text-indigo-300">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div>
            {sorted.map((tx) => (
              <TxRow
                key={tx.id}
                tx={tx}
                selected={selected.has(tx.id)}
                onSelect={toggleSelect}
                onCategoryChange={handleCategoryChange}
                categories={allCategories}
              />
            ))}
          </div>
        )}

        {/* Footer count */}
        {sorted.length > 0 && (
          <div className="px-4 py-3 border-t pacioli-border-subtle flex justify-between items-center">
            <span className="text-xs pacioli-text-muted">{sorted.length} transactions · {formatCurrency(visibleTotal)} total</span>
            {someSelected && (
              <span className="text-xs text-indigo-400">{selected.size} selected</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

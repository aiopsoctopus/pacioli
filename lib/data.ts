// Data loader — reads from /public/data JSON files
// When you're ready to connect Plaid, swap these loaders for API calls

// ─── React hook (client-only) ─────────────────────────────────────────────────
// Imported at the top to keep the "use client" boundary clear for consumers.
// This file has no "use client" directive — pages that use the hook are already
// client components. The hook itself uses React APIs so it must only be called
// inside client components.
import { useEffect, useState, useMemo } from "react";

export async function fetchJSON<T>(file: string): Promise<T> {
  const res = await fetch(`/data/${file}`);
  if (!res.ok) throw new Error(`Failed to load ${file}`);
  return res.json();
}

export interface Account {
  id: string;
  name: string;
  institution: string | null;
  type: string;
  balances: Record<string, number>;
}

export interface AccountData {
  assets: Account[];
  liabilities: Account[];
}

export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  account: string;
}

export interface IncomeSource {
  label: string;
  amount: number;
  type: string;
}

export interface MonthIncome {
  month: string;
  sources: IncomeSource[];
}

export interface SinkingFund {
  id: string;
  name: string;
  emoji: string;
  target: number;
  saved: number;
  monthly_contribution: number;
  target_date: string;
  color: string;
}

export interface ForecastMonth {
  month: string;
  projected_net_worth: number;
  projected_savings: number;
  projected_income: number;
  projected_expenses: number;
}

export interface Forecast {
  monthly_income: number;
  monthly_fixed_expenses: number;
  monthly_variable_avg: number;
  monthly_savings_contributions: number;
  starting_net_worth: number;
  months: ForecastMonth[];
}

// Helpers
export function formatCurrency(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

export function getNetWorth(accounts: AccountData, month: string): number {
  const assets = accounts.assets.reduce((s, a) => s + (a.balances[month] ?? 0), 0);
  const liabilities = accounts.liabilities.reduce((s, l) => s + (l.balances[month] ?? 0), 0);
  return assets - liabilities;
}

export function getMonthlySpend(transactions: Transaction[], month: string): Record<string, number> {
  const byCategory: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.date.startsWith(month) && tx.category !== "Savings") {
      byCategory[tx.category] = (byCategory[tx.category] ?? 0) + tx.amount;
    }
  }
  return byCategory;
}

// ─── Budget analysis engine ───────────────────────────────────────────────────

export interface BudgetAnalysis {
  category: string;
  monthlyAmounts: number[];          // last N months in chronological order
  avg: number;                       // 6-month average
  trend: "rising" | "falling" | "stable";
  trendPct: number;                  // % change first half vs second half of window
  peakMonth: string;                 // month key of highest spend
  peakAmount: number;
  isSeasonal: boolean;               // true if peak > 1.5× avg
  suggestedBudget: number;           // rounded recommended amount
  rationale: string;                 // rule-based explanation
  // LLM_HOOK: replace `rationale` string with an LLM-generated version
  // that interprets merchant names, references specific events, and speaks
  // in plain English. Pass { category, monthlyAmounts, avg, trend, peakMonth,
  // peakAmount, isSeasonal, suggestedBudget, recentMerchants[] } as context.
}

export interface BudgetEnvelope {
  category: string;
  budgetAmount: number;              // user-confirmed monthly target
  suggestedAmount: number;           // AI suggestion at time of setup
}

export const BUDGET_STORAGE_KEY = "pacioli-budget-envelopes";

export function loadBudgetEnvelopes(ns = ""): Record<string, BudgetEnvelope> {
  if (typeof window === "undefined") return {};
  try {
    const key = ns ? `${ns}-${BUDGET_STORAGE_KEY}` : BUDGET_STORAGE_KEY;
    return JSON.parse(localStorage.getItem(key) ?? "{}");
  } catch { return {}; }
}

export function saveBudgetEnvelopes(envelopes: Record<string, BudgetEnvelope>, ns = "") {
  const key = ns ? `${ns}-${BUDGET_STORAGE_KEY}` : BUDGET_STORAGE_KEY;
  localStorage.setItem(key, JSON.stringify(envelopes));
}

/** Analyse spending per category over the last `windowMonths` completed months */
export function analyseCategorySpend(
  transactions: Transaction[],
  allMonths: string[],           // sorted list of all available month keys
  currentMonth: string,          // excluded (partial)
  windowMonths = 6
): BudgetAnalysis[] {
  // Only look at completed months before currentMonth
  const completedMonths = allMonths
    .filter((m) => m < currentMonth)
    .slice(-windowMonths);

  if (completedMonths.length === 0) return [];

  // Build { category -> amount[] } in chronological order
  const byCategory: Record<string, number[]> = {};
  for (const m of completedMonths) {
    const spend = getMonthlySpend(transactions, m);
    const seenThisMonth = new Set<string>();
    for (const [cat, amt] of Object.entries(spend)) {
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(amt);
      seenThisMonth.add(cat);
    }
    // Fill 0 for months where a category had no spend
    for (const cat of Object.keys(byCategory)) {
      if (!seenThisMonth.has(cat)) byCategory[cat].push(0);
    }
  }

  const results: BudgetAnalysis[] = [];

  for (const [category, amounts] of Object.entries(byCategory)) {
    const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    if (avg < 5) continue; // skip negligible categories

    // Trend: compare first half vs second half of window
    const half = Math.floor(amounts.length / 2);
    const firstHalfAvg = amounts.slice(0, half).reduce((s, v) => s + v, 0) / (half || 1);
    const secondHalfAvg = amounts.slice(half).reduce((s, v) => s + v, 0) / (amounts.length - half || 1);
    const trendPct = firstHalfAvg > 0
      ? Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100)
      : 0;
    const trend: BudgetAnalysis["trend"] =
      trendPct >= 8 ? "rising" : trendPct <= -8 ? "falling" : "stable";

    // Peak month
    const peakIdx = amounts.reduce((maxI, v, i, arr) => v > arr[maxI] ? i : maxI, 0);
    const peakMonth = completedMonths[peakIdx] ?? completedMonths[0];
    const peakAmount = amounts[peakIdx] ?? 0;
    const isSeasonal = peakAmount > avg * 1.5 && amounts.length >= 3;

    // Suggested budget — rules:
    // Rising:   use 110% of recent (second-half) average, rounded up to nearest $25
    // Falling:  use 100% of recent average (don't cut too aggressively)
    // Stable:   use 105% of overall avg for breathing room
    // Seasonal: nudge up by 10% to account for occasional spikes
    let raw = trend === "rising"
      ? secondHalfAvg * 1.1
      : trend === "falling"
      ? secondHalfAvg * 1.0
      : avg * 1.05;
    if (isSeasonal) raw = raw * 1.1;
    const suggestedBudget = Math.ceil(raw / 25) * 25; // round up to nearest $25

    // Rule-based rationale
    // LLM_HOOK: the string below is generated deterministically.
    // To upgrade, call the LLM API with the stats above + recent merchant names
    // and replace this string with the LLM response.
    let rationale = "";
    const avgStr = formatCurrency(Math.round(avg));
    const peakMonthLabel = formatMonth(peakMonth);
    if (trend === "rising") {
      rationale = `Up ${Math.abs(trendPct)}% over the past ${windowMonths} months (avg ${avgStr}). Budget set at recent pace + 10% buffer.`;
    } else if (trend === "falling") {
      rationale = `Trending down ${Math.abs(trendPct)}% — avg ${avgStr}. Budget tracks your recent lower spend.`;
    } else {
      rationale = `Steady at ~${avgStr}/mo over ${windowMonths} months. Small 5% buffer added for flexibility.`;
    }
    if (isSeasonal) {
      rationale += ` Spiked to ${formatCurrency(Math.round(peakAmount))} in ${peakMonthLabel} — seasonal bump included.`;
    }

    results.push({
      category,
      monthlyAmounts: amounts,
      avg: Math.round(avg),
      trend,
      trendPct,
      peakMonth,
      peakAmount: Math.round(peakAmount),
      isSeasonal,
      suggestedBudget,
      rationale,
    });
  }

  // Sort by avg spend descending
  return results.sort((a, b) => b.avg - a.avg);
}

/** Returns how far through the current month we are as a 0–1 fraction */
export function monthProgressFraction(): number {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return now.getDate() / daysInMonth;
}

/** Average monthly income over the last N completed months */
export function avgMonthlyIncome(income: MonthIncome[], currentMonth: string, windowMonths = 6): number {
  const completed = income
    .filter((i) => i.month < currentMonth)
    .slice(-windowMonths);
  if (completed.length === 0) return 0;
  const total = completed.reduce(
    (s, i) => s + i.sources.reduce((ss, src) => ss + src.amount, 0), 0
  );
  return Math.round(total / completed.length);
}

// ─── Category rules & overrides ──────────────────────────────────────────────
// Shared constants and helpers used by the hook and by cash-flow/page.tsx.

export const RULES_KEY    = "pacioli-category-rules";  // { [merchantPattern]: category }
export const OVERRIDE_KEY = "pacioli-tx-overrides";    // { [txId]: category }
export const IMPORTED_KEY = "pacioli-imported-transactions";

export function loadRules(ns = ""): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const key = ns ? `${ns}-${RULES_KEY}` : RULES_KEY;
    return JSON.parse(localStorage.getItem(key) ?? "{}");
  } catch { return {}; }
}

export function saveRules(rules: Record<string, string>, ns = "") {
  const key = ns ? `${ns}-${RULES_KEY}` : RULES_KEY;
  localStorage.setItem(key, JSON.stringify(rules));
}

export function loadOverrides(ns = ""): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const key = ns ? `${ns}-${OVERRIDE_KEY}` : OVERRIDE_KEY;
    return JSON.parse(localStorage.getItem(key) ?? "{}");
  } catch { return {}; }
}

export function saveOverrides(overrides: Record<string, string>, ns = "") {
  const key = ns ? `${ns}-${OVERRIDE_KEY}` : OVERRIDE_KEY;
  localStorage.setItem(key, JSON.stringify(overrides));
}

/**
 * Apply category rules then per-transaction overrides to a transaction list.
 * Order: rules (merchant pattern match) → override (explicit per-id) wins on top.
 */
export function applyRulesAndOverrides(
  txs: Transaction[],
  rules: Record<string, string>,
  overrides: Record<string, string>,
): Transaction[] {
  return txs.map((tx) => {
    // Per-transaction override wins unconditionally
    if (overrides[tx.id]) return { ...tx, category: overrides[tx.id] };
    // Merchant pattern rules (case-insensitive substring match)
    const merchant = tx.merchant.toLowerCase().trim();
    for (const [pattern, cat] of Object.entries(rules)) {
      if (merchant.includes(pattern.toLowerCase())) return { ...tx, category: cat };
    }
    return tx;
  });
}

// ─── useTransactions hook ─────────────────────────────────────────────────────
/**
 * Loads transactions from two sources and merges them:
 *   1. /data/transactions.json  — static seed data
 *   2. localStorage[IMPORTED_KEY] — rows saved by the CSV importer
 *
 * Imported rows are keyed by a synthetic id (`imp_<date>_<merchant>_<amount>`)
 * so re-uploading the same file is idempotent (duplicates are deduplicated by id).
 *
 * Category rules and per-transaction overrides are applied at read time.
 *
 * `rulesOverride` / `overridesOverride` — when a page owns its own rules/overrides
 * state (e.g. cash-flow, which lets the user edit them live), pass them here so the
 * hook always uses the caller's copy instead of re-reading from localStorage.
 * Pages that don't write rules/overrides can omit these and the hook manages them.
 *
 * Pass `ns` (namespace) to scope localStorage keys to demo mode.
 */
export function useTransactions(
  ns = "",
  rulesOverride?: Record<string, string>,
  overridesOverride?: Record<string, string>,
): Transaction[] {
  const [staticTxs, setStaticTxs]     = useState<Transaction[]>([]);
  const [importedTxs, setImportedTxs] = useState<Transaction[]>([]);
  // Internal state used only when the caller doesn't pass its own rules/overrides
  const [internalRules, setInternalRules]         = useState<Record<string, string>>(() => loadRules(ns));
  const [internalOverrides, setInternalOverrides] = useState<Record<string, string>>(() => loadOverrides(ns));

  const rules     = rulesOverride     ?? internalRules;
  const overrides = overridesOverride ?? internalOverrides;

  // Load static JSON once on mount
  useEffect(() => {
    fetchJSON<Transaction[]>("transactions.json")
      .then(setStaticTxs)
      .catch((e) => console.error("[Pacioli] transactions.json failed:", e));
  }, []);

  // Re-sync internal state and imports whenever ns changes (demo toggle).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInternalRules(loadRules(ns));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInternalOverrides(loadOverrides(ns));

    try {
      const importKey = ns ? `${ns}-${IMPORTED_KEY}` : IMPORTED_KEY;
      const raw = localStorage.getItem(importKey);
      if (!raw) { setImportedTxs([]); return; }

      // Imported rows may lack an `id` or `account` field — normalise them.
      const parsed: Partial<Transaction>[] = JSON.parse(raw);
      const normalised: Transaction[] = parsed.map((t) => ({
        id:       t.id ?? `imp_${t.date}_${t.merchant}_${t.amount}`,
        date:     t.date    ?? "",
        merchant: t.merchant ?? "Unknown",
        category: t.category ?? "Uncategorized",
        amount:   t.amount  ?? 0,
        account:  t.account ?? "Imported",
      }));
      setImportedTxs(normalised);
    } catch { setImportedTxs([]); }
  }, [ns]);

  // Merge: static first, then imported. Deduplicate by id (imported wins on conflict).
  const merged = useMemo(() => {
    const map = new Map<string, Transaction>();
    for (const tx of staticTxs)   map.set(tx.id, tx);
    for (const tx of importedTxs) map.set(tx.id, tx); // imported overwrites on same id
    return Array.from(map.values()).sort((a, b) => a.date < b.date ? 1 : -1);
  }, [staticTxs, importedTxs]);

  // Apply rules + overrides
  return useMemo(
    () => applyRulesAndOverrides(merged, rules, overrides),
    [merged, rules, overrides],
  );
}

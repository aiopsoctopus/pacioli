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
  memo?: string;
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

// Helpers — pure formatters live in lib/format.ts (hook-free, server-safe);
// re-exported here so existing client-side imports keep working.
export { formatCurrency, formatMonth } from "./format";
import { formatCurrency, formatMonth } from "./format";

export function getNetWorth(accounts: AccountData, month: string): number {
  const assets = accounts.assets.reduce((s, a) => s + (a.balances[month] ?? 0), 0);
  const liabilities = accounts.liabilities.reduce((s, l) => s + (l.balances[month] ?? 0), 0);
  return assets - liabilities;
}

/**
 * Returns the latest month that appears in BOTH the account balances AND
 * the transaction list. Use this everywhere a "current month" is needed so
 * all pages stay in sync even when balance data runs ahead of transactions.
 */
export function getLatestSharedMonth(accounts: AccountData, transactions: Transaction[]): string {
  const txMonths = new Set(transactions.map((t) => t.date.slice(0, 7)));
  const balanceMonths = Object.keys(accounts.assets[0]?.balances ?? {}).sort();
  // Walk backwards from the latest balance month until we find one with tx data
  for (let i = balanceMonths.length - 1; i >= 0; i--) {
    if (txMonths.has(balanceMonths[i])) return balanceMonths[i];
  }
  // Fallback: latest balance month
  return balanceMonths[balanceMonths.length - 1];
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
  avg: number;                       // simple 6-month average (for trend/display only)
  normalizedMonthlyAmount: number;   // true monthly cost — annual/one-off costs amortized
  hasAnnualCosts: boolean;           // true if any merchant in this category is annual/one-off
  trend: "rising" | "falling" | "stable";
  trendPct: number;                  // % change first half vs second half of window
  peakMonth: string;                 // month key of highest spend
  peakAmount: number;
  isSeasonal: boolean;               // true if peak > 1.5× avg
  suggestedBudget: number;           // rounded recommended amount (based on normalizedMonthlyAmount)
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

  // Transactions scoped to the analysis window (excludes current partial month)
  const windowTxs = transactions.filter((t) => completedMonths.includes(t.date.slice(0, 7)));

  // Normalized monthly amounts via frequency classifier — amortizes annual/one-off costs
  // so a $1,200 annual insurance premium contributes $100/mo rather than spiking one month.
  const classifiedMerchants = classifyMerchants(windowTxs);
  const normalizedByCat: Record<string, number> = {};
  const annualCatFlags: Record<string, boolean> = {};
  for (const c of classifiedMerchants) {
    normalizedByCat[c.category] = (normalizedByCat[c.category] ?? 0) + c.normalizedMonthlyAmount;
    if (c.frequency === "annual" || c.frequency === "one-off") {
      annualCatFlags[c.category] = true;
    }
  }

  // Build { category -> amount[] } in chronological order (for trend/sparkline display)
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

    // True monthly cost: use normalized amount from classifier (amortizes annual costs).
    // Fall back to simple avg if the classifier has no data for this category.
    const normalizedMonthlyAmount = Math.round(normalizedByCat[category] ?? avg);
    const hasAnnualCosts = annualCatFlags[category] ?? false;

    // Suggested budget: apply trend multiplier on top of the normalized base.
    // Rising:  +10% buffer on recent pace; Falling: track recent lower spend; Stable: +5% buffer.
    const trendMultiplier = trend === "rising" ? 1.1 : trend === "falling" ? 1.0 : 1.05;
    const raw = normalizedMonthlyAmount * trendMultiplier;
    const suggestedBudget = Math.ceil(raw / 25) * 25; // round up to nearest $25

    // Rule-based rationale
    // LLM_HOOK: the string below is generated deterministically.
    // To upgrade, call the LLM API with the stats above + recent merchant names
    // and replace this string with the LLM response.
    let rationale = "";
    const normalizedStr = formatCurrency(normalizedMonthlyAmount);
    const peakMonthLabel = formatMonth(peakMonth);
    if (hasAnnualCosts) {
      rationale = `Includes annual or irregular costs amortized to ${normalizedStr}/mo.`;
      if (trend === "rising") {
        rationale += ` Spending is up ${Math.abs(trendPct)}% — 10% buffer added.`;
      } else if (trend === "falling") {
        rationale += ` Trending down ${Math.abs(trendPct)}%.`;
      }
    } else if (trend === "rising") {
      rationale = `Up ${Math.abs(trendPct)}% over the past ${windowMonths} months (avg ${normalizedStr}). Budget set at recent pace + 10% buffer.`;
    } else if (trend === "falling") {
      rationale = `Trending down ${Math.abs(trendPct)}% — avg ${normalizedStr}. Budget tracks your recent lower spend.`;
    } else {
      rationale = `Steady at ~${normalizedStr}/mo over ${windowMonths} months. Small 5% buffer added for flexibility.`;
    }
    if (isSeasonal && !hasAnnualCosts) {
      rationale += ` Spiked to ${formatCurrency(Math.round(peakAmount))} in ${peakMonthLabel} — seasonal bump included.`;
    }

    results.push({
      category,
      monthlyAmounts: amounts,
      avg: Math.round(avg),
      normalizedMonthlyAmount,
      hasAnnualCosts,
      trend,
      trendPct,
      peakMonth,
      peakAmount: Math.round(peakAmount),
      isSeasonal,
      suggestedBudget,
      rationale,
    });
  }

  // Sort by normalized monthly amount descending (more accurate than raw avg for annual-heavy cats)
  return results.sort((a, b) => b.normalizedMonthlyAmount - a.normalizedMonthlyAmount);
}

// ─── Expense frequency classifier ─────────────────────────────────────────────

export type ExpenseFrequency =
  | "monthly"    // appears in most months with consistent amount (subscriptions, rent)
  | "variable"   // appears in most months but amount varies (groceries, dining)
  | "annual"     // appears in 1–2 months per year, or same calendar month across years
  | "one-off";   // appears in a single month, never repeated

export interface MerchantClassification {
  merchant: string;
  category: string;
  frequency: ExpenseFrequency;
  /** True monthly cost: actual monthly average for recurring, amortized for annual */
  normalizedMonthlyAmount: number;
  /** How many distinct months this merchant appeared in */
  monthsPresent: number;
  /** Total months of history in the dataset */
  totalHistoryMonths: number;
}

/**
 * Classify each merchant's spending pattern from transaction history.
 *
 * Algorithm:
 * 1. Group transactions by merchant.
 * 2. Count distinct months present vs total history.
 * 3. Compute coefficient of variation (CV = stddev / mean) of monthly totals.
 * 4. Classify:
 *    - ≥50% of months present + CV < 0.35 → monthly (consistent recurring)
 *    - ≥50% of months present + CV ≥ 0.35 → variable (frequent but irregular)
 *    - <50% of months but appears in same calendar month across years → annual
 *    - <50% of months, no year-repeat → one-off
 * 5. Amortize annual costs: total / historyMonths gives true monthly impact.
 */
export function classifyMerchants(transactions: Transaction[]): MerchantClassification[] {
  if (transactions.length === 0) return [];

  // Total history span in months
  const allMonths = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort();
  const totalHistoryMonths = allMonths.length;

  // Group by merchant
  const byMerchant = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.category === "Savings") continue;
    const existing = byMerchant.get(tx.merchant) ?? [];
    existing.push(tx);
    byMerchant.set(tx.merchant, existing);
  }

  const results: MerchantClassification[] = [];

  for (const [merchant, txs] of byMerchant) {
    const category = txs[0].category;

    // Monthly totals
    const byMonth = new Map<string, number>();
    for (const tx of txs) {
      const m = tx.date.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + tx.amount);
    }

    const monthsPresent = byMonth.size;
    const presenceFraction = monthsPresent / totalHistoryMonths;
    const amounts = [...byMonth.values()];
    const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const variance = amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

    // Check for annual pattern: same calendar month across different years
    const calendarMonths = txs.map((t) => t.date.slice(5, 7)); // "01"–"12"
    const uniqueCalendarMonths = new Set(calendarMonths);
    const years = new Set(txs.map((t) => t.date.slice(0, 4)));
    const isAnnual =
      presenceFraction < 0.4 &&
      uniqueCalendarMonths.size <= 2 &&
      years.size >= 2;

    let frequency: ExpenseFrequency;
    if (presenceFraction >= 0.5 && cv < 0.35) {
      frequency = "monthly";
    } else if (presenceFraction >= 0.5) {
      frequency = "variable";
    } else if (isAnnual) {
      frequency = "annual";
    } else if (monthsPresent === 1) {
      frequency = "one-off";
    } else {
      // Irregular but not annual — treat as variable for budget purposes
      frequency = "variable";
    }

    // Normalized monthly amount: amortize over full history
    const totalSpend = amounts.reduce((s, v) => s + v, 0);
    const normalizedMonthlyAmount = totalSpend / totalHistoryMonths;

    results.push({
      merchant,
      category,
      frequency,
      normalizedMonthlyAmount: Math.round(normalizedMonthlyAmount * 100) / 100,
      monthsPresent,
      totalHistoryMonths,
    });
  }

  return results.sort((a, b) => b.normalizedMonthlyAmount - a.normalizedMonthlyAmount);
}

/**
 * Compute true average monthly spend per category using the frequency classifier.
 * Annual and one-off costs are amortized across the full history window,
 * so a $1,200 annual insurance premium contributes $100/mo rather than
 * spiking the month it occurs.
 *
 * Returns: { category → normalizedMonthlyAmount }
 */
export function getNormalizedMonthlyCategorySpend(
  transactions: Transaction[],
): Record<string, number> {
  const classifications = classifyMerchants(transactions);
  const byCat: Record<string, number> = {};
  for (const c of classifications) {
    byCat[c.category] = (byCat[c.category] ?? 0) + c.normalizedMonthlyAmount;
  }
  return byCat;
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
 * Loads transactions from three sources and merges them:
 *   1. /data/transactions.json       — static seed data (demo mode only)
 *   2. localStorage[IMPORTED_KEY]    — rows saved by the CSV importer
 *   3. GET /api/plaid/transactions   — rows stored in Supabase (live mode only)
 *
 * Category rules and per-transaction overrides are applied at read time.
 *
 * `rulesOverride` / `overridesOverride` — when a page owns its own rules/overrides
 * state (e.g. cash-flow, which lets the user edit them live), pass them here so the
 * hook always uses the caller's copy instead of re-reading from localStorage.
 * Pages that don't write rules/overrides can omit these and the hook manages them.
 *
 * Pass `ns` (namespace) to scope localStorage keys to demo mode.
 * Pass `userId` to re-fetch when the signed-in user changes.
 */
export function useTransactions(
  ns = "",
  rulesOverride?: Record<string, string>,
  overridesOverride?: Record<string, string>,
  userId?: string | null,
): Transaction[] {
  const [staticTxs, setStaticTxs]     = useState<Transaction[]>([]);
  const [importedTxs, setImportedTxs] = useState<Transaction[]>([]);
  const [plaidTxs, setPlaidTxs]       = useState<Transaction[]>([]);
  // Internal state used only when the caller doesn't pass its own rules/overrides
  const [internalRules, setInternalRules]         = useState<Record<string, string>>(() => loadRules(ns));
  const [internalOverrides, setInternalOverrides] = useState<Record<string, string>>(() => loadOverrides(ns));

  const rules     = rulesOverride     ?? internalRules;
  const overrides = overridesOverride ?? internalOverrides;

  // Load static JSON only in demo mode (ns is non-empty when demo is active)
  useEffect(() => {
    if (!ns) { setStaticTxs([]); return; }
    fetchJSON<Transaction[]>("transactions.json")
      .then(setStaticTxs)
      .catch((e) => console.error("[Pacioli] transactions.json failed:", e));
  }, [ns]);

  // Re-sync internal state and imports whenever ns or userId changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInternalRules(loadRules(ns));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInternalOverrides(loadOverrides(ns));

    const prefix = userId ? `${userId}:` : "";

    // CSV imports
    try {
      const importKey = ns ? `${ns}-${IMPORTED_KEY}` : `${prefix}${IMPORTED_KEY}`;
      const raw = localStorage.getItem(importKey);
      if (!raw) { setImportedTxs([]); }
      else {
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
      }
    } catch { setImportedTxs([]); }

    // Plaid transactions — fetch from Supabase via API (not used in demo mode)
    if (!ns) {
      fetch("/api/plaid/transactions")
        .then((r) => r.ok ? r.json() : { transactions: [] })
        .then((data: { transactions?: Partial<Transaction>[] }) => {
          const parsed = data.transactions ?? [];
          const normalised: Transaction[] = parsed.map((t) => ({
            id:       t.id ?? `plaid_${t.date}_${t.merchant}_${t.amount}`,
            date:     t.date    ?? "",
            merchant: t.merchant ?? "Unknown",
            category: t.category ?? "Uncategorized",
            amount:   t.amount  ?? 0,
            account:  t.account ?? "Plaid",
          }));
          setPlaidTxs(normalised);
        })
        .catch(() => setPlaidTxs([]));
    } else {
      setPlaidTxs([]);
    }
  }, [ns, userId]);

  // Merge: static → CSV imports → Plaid. Deduplicate by id (later sources win).
  const merged = useMemo(() => {
    const map = new Map<string, Transaction>();
    for (const tx of staticTxs)   map.set(tx.id, tx);
    for (const tx of importedTxs) map.set(tx.id, tx);
    for (const tx of plaidTxs)    map.set(tx.id, tx);
    return Array.from(map.values()).sort((a, b) => a.date < b.date ? 1 : -1);
  }, [staticTxs, importedTxs, plaidTxs]);

  // Apply rules + overrides
  return useMemo(
    () => applyRulesAndOverrides(merged, rules, overrides),
    [merged, rules, overrides],
  );
}

// ─── Manual accounts (localStorage) ──────────────────────────────────────────

export const MANUAL_ACCOUNTS_KEY = "pacioli-manual-accounts";

export interface ManualAccountData {
  assets: Account[];
  liabilities: Account[];
}

export function loadManualAccounts(ns = ""): ManualAccountData {
  try {
    const key = ns ? `${ns}-${MANUAL_ACCOUNTS_KEY}` : MANUAL_ACCOUNTS_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return { assets: [], liabilities: [] };
    return JSON.parse(raw);
  } catch {
    return { assets: [], liabilities: [] };
  }
}

export function saveManualAccounts(data: ManualAccountData, ns = ""): void {
  try {
    const key = ns ? `${ns}-${MANUAL_ACCOUNTS_KEY}` : MANUAL_ACCOUNTS_KEY;
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* ignore */ }
}

/**
 * useAccounts — merges static JSON seed (demo only) with localStorage manual accounts.
 *
 * - Demo mode:  fetches accounts.json and overlays manual edits on top
 * - Real users: manual accounts are the only source of truth
 *
 * Returns [accountData, setAccountData] where setAccountData persists to localStorage
 * and triggers a re-render.
 */
export function useAccounts(
  ns = "",
  userId?: string | null,
): [AccountData | null, (data: AccountData) => void] {
  const [staticData, setStaticData] = useState<AccountData | null>(null);
  const [manualData, setManualData] = useState<ManualAccountData>(() =>
    typeof window !== "undefined" ? loadManualAccounts(ns) : { assets: [], liabilities: [] }
  );

  // Load static JSON in demo mode only
  useEffect(() => {
    if (!ns) { setStaticData(null); return; }
    fetchJSON<AccountData>("accounts.json")
      .then(setStaticData)
      .catch(() => setStaticData({ assets: [], liabilities: [] }));
  }, [ns]);

  // Re-read manual accounts when ns or userId changes
  useEffect(() => {
    const key = ns
      ? `${ns}-${MANUAL_ACCOUNTS_KEY}`
      : userId
        ? `${userId}:${MANUAL_ACCOUNTS_KEY}`
        : MANUAL_ACCOUNTS_KEY;
    try {
      const raw = localStorage.getItem(key);
      setManualData(raw ? JSON.parse(raw) : { assets: [], liabilities: [] });
    } catch {
      setManualData({ assets: [], liabilities: [] });
    }
  }, [ns, userId]);

  const merged = useMemo((): AccountData | null => {
    // Real users: show nothing until they add accounts
    if (!ns && manualData.assets.length === 0 && manualData.liabilities.length === 0) {
      return null;
    }
    // Demo mode: wait for static JSON to load before returning anything
    if (ns && !staticData) return null;
    // Demo: start from static JSON, overlay manual edits
    const base: AccountData = staticData ?? { assets: [], liabilities: [] };

    function mergeAccounts(baseList: Account[], manualList: Account[]): Account[] {
      const map = new Map<string, Account>();
      for (const a of baseList) map.set(a.id, a);
      // Manual accounts override or add — deletions tracked via __deleted flag
      for (const a of manualList) {
        if ((a as Account & { __deleted?: boolean }).__deleted) {
          map.delete(a.id);
        } else {
          map.set(a.id, a);
        }
      }
      return Array.from(map.values());
    }

    return {
      assets:      mergeAccounts(base.assets,      manualData.assets),
      liabilities: mergeAccounts(base.liabilities, manualData.liabilities),
    };
  }, [ns, staticData, manualData]);

  const setAccounts = (data: AccountData) => {
    // For real users, data IS the manual data
    // For demo users, we store only the delta (additions + overrides)
    // For simplicity: store the full AccountData as manual — easy to reason about
    const manual: ManualAccountData = { assets: data.assets, liabilities: data.liabilities };
    const key = ns
      ? `${ns}-${MANUAL_ACCOUNTS_KEY}`
      : userId
        ? `${userId}:${MANUAL_ACCOUNTS_KEY}`
        : MANUAL_ACCOUNTS_KEY;
    try { localStorage.setItem(key, JSON.stringify(manual)); } catch { /* ignore */ }
    setManualData(manual);
  };

  return [merged, setAccounts];
}

// Data loader — reads from /public/data JSON files
// When you're ready to connect Plaid, swap these loaders for API calls

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

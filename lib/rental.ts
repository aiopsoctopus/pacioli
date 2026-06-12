/**
 * lib/rental.ts — Rental Property P&L
 *
 * Pure, deterministic. Takes a rental property config (purchase price,
 * mortgage terms, income, recurring expenses) and computes a monthly
 * profit & loss, NOI, cap rate, and cash-on-cash return.
 *
 * Mortgage P&I split is computed via standard amortization. Other expenses
 * (tax, insurance, HOA, maintenance reserve, vacancy reserve, management fee)
 * are entered as monthly or annual figures by the user, since this data
 * isn't available from transaction history.
 */

export const RENTAL_CONFIG_KEY = "pacioli-rental";

export interface RentalConfig {
  label: string;
  /** Current market value of the property */
  propertyValue: number;
  /** Original purchase price (for cash-on-cash basis; falls back to propertyValue if unknown) */
  purchasePrice: number;
  /** Cash invested at purchase (down payment + closing costs) */
  cashInvested: number;
  /** Monthly gross rental income */
  monthlyRent: number;

  // Mortgage
  mortgageBalance: number;
  mortgageRate: number; // annual, e.g. 0.06
  mortgagePayment: number; // monthly P&I

  // Operating expenses (monthly unless noted)
  propertyTaxAnnual: number;
  insuranceAnnual: number;
  hoaMonthly: number;
  maintenancePct: number; // % of rent reserved for maintenance, e.g. 0.05
  vacancyPct: number; // % of rent reserved for vacancy, e.g. 0.05
  managementPct: number; // % of rent paid to property manager, e.g. 0.08
  otherMonthly: number; // catch-all (utilities owner pays, etc.)
}

export function defaultRentalConfig(): RentalConfig {
  return {
    label: "Rental Property",
    propertyValue: 423801,
    purchasePrice: 380000,
    cashInvested: 76000,
    monthlyRent: 2842,
    mortgageBalance: 293440,
    mortgageRate: 0.055,
    mortgagePayment: 1850,
    propertyTaxAnnual: 4800,
    insuranceAnnual: 1600,
    hoaMonthly: 0,
    maintenancePct: 0.05,
    vacancyPct: 0.05,
    managementPct: 0.0,
    otherMonthly: 0,
  };
}

export function loadRentalConfig(): RentalConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RENTAL_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveRentalConfig(config: RentalConfig | null) {
  if (config) localStorage.setItem(RENTAL_CONFIG_KEY, JSON.stringify(config));
  else localStorage.removeItem(RENTAL_CONFIG_KEY);
}

/** Split a single mortgage payment into principal & interest given a remaining balance */
export function splitPayment(balance: number, monthlyRate: number, payment: number): {
  interest: number;
  principal: number;
} {
  const interest = balance * monthlyRate;
  const principal = Math.max(0, Math.min(payment - interest, balance));
  return { interest: Math.round(interest), principal: Math.round(principal) };
}

export interface RentalPL {
  // Income
  grossRent: number;
  vacancyLoss: number;
  effectiveIncome: number;

  // Operating expenses (excludes mortgage — this is NOI)
  propertyTax: number;
  insurance: number;
  hoa: number;
  maintenance: number;
  management: number;
  other: number;
  totalOperatingExpenses: number;

  // NOI and below
  noi: number; // Net Operating Income = effectiveIncome - totalOperatingExpenses
  mortgageInterest: number;
  mortgagePrincipal: number;
  totalDebtService: number;
  netCashFlow: number; // NOI - debt service

  // Returns
  capRate: number; // NOI (annualized) / propertyValue
  cashOnCash: number; // annual net cash flow / cash invested
  annualNetCashFlow: number;
}

/** Compute a monthly P&L snapshot from the current config */
export function computeRentalPL(config: RentalConfig): RentalPL {
  const grossRent = config.monthlyRent;
  const vacancyLoss = grossRent * config.vacancyPct;
  const effectiveIncome = grossRent - vacancyLoss;

  const propertyTax = config.propertyTaxAnnual / 12;
  const insurance = config.insuranceAnnual / 12;
  const hoa = config.hoaMonthly;
  const maintenance = grossRent * config.maintenancePct;
  const management = grossRent * config.managementPct;
  const other = config.otherMonthly;

  const totalOperatingExpenses = propertyTax + insurance + hoa + maintenance + management + other;
  const noi = effectiveIncome - totalOperatingExpenses;

  const monthlyRate = config.mortgageRate / 12;
  const { interest: mortgageInterest, principal: mortgagePrincipal } = splitPayment(
    config.mortgageBalance,
    monthlyRate,
    config.mortgagePayment,
  );
  const totalDebtService = mortgageInterest + mortgagePrincipal;
  const netCashFlow = noi - totalDebtService;

  const annualNetCashFlow = netCashFlow * 12;
  const capRate = config.propertyValue > 0 ? (noi * 12) / config.propertyValue : 0;
  const cashOnCash = config.cashInvested > 0 ? annualNetCashFlow / config.cashInvested : 0;

  return {
    grossRent: Math.round(grossRent),
    vacancyLoss: Math.round(vacancyLoss),
    effectiveIncome: Math.round(effectiveIncome),
    propertyTax: Math.round(propertyTax),
    insurance: Math.round(insurance),
    hoa: Math.round(hoa),
    maintenance: Math.round(maintenance),
    management: Math.round(management),
    other: Math.round(other),
    totalOperatingExpenses: Math.round(totalOperatingExpenses),
    noi: Math.round(noi),
    mortgageInterest,
    mortgagePrincipal,
    totalDebtService: Math.round(totalDebtService),
    netCashFlow: Math.round(netCashFlow),
    capRate,
    cashOnCash,
    annualNetCashFlow: Math.round(annualNetCashFlow),
  };
}

/**
 * lib/equity.ts — Equity Compensation Modeling
 *
 * Pure, deterministic. Takes a grant definition and returns a list of
 * ScenarioEvents representing each vest date's income hit.
 *
 * Supports:
 *   RSUs  — value at vest = shares * current_price (or estimated price)
 *   ISOs / NSOs — spread at exercise = shares * (fmv - strike_price)
 *
 * The vesting schedule supports:
 *   - Standard 4yr/1yr cliff (most common)
 *   - Custom cliff + monthly/quarterly vesting after cliff
 *   - Fully custom vest dates with explicit share counts
 */

import { ScenarioEvent } from "./scenario";
import { nextMonthKey } from "./scenario";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EquityType = "rsu" | "iso" | "nso";
export type VestFrequency = "monthly" | "quarterly";

export interface RSUGrant {
  type: "rsu";
  id: string;
  label: string;
  /** Total shares granted */
  totalShares: number;
  /** Estimated price per share at vest (today's price as a proxy) */
  pricePerShare: number;
  /** Grant date — YYYY-MM */
  grantMonth: string;
  /** Months until first vest (cliff). Standard = 12. */
  cliffMonths: number;
  /** Shares that vest at the cliff as a fraction of total (e.g. 0.25 = 25%) */
  cliffFraction: number;
  /** How often remaining shares vest after cliff */
  vestFrequency: VestFrequency;
  /** Total vesting period in months (standard = 48) */
  vestingPeriodMonths: number;
}

export interface OptionGrant {
  type: "iso" | "nso";
  id: string;
  label: string;
  /** Total shares granted */
  totalShares: number;
  /** Strike price (exercise price) per share */
  strikePrice: number;
  /** Current fair market value per share (used to calculate spread) */
  currentFMV: number;
  /** Assumed annual appreciation of FMV for future vest dates (e.g. 0.10 = 10%/yr) */
  annualAppreciation: number;
  /** Grant date — YYYY-MM */
  grantMonth: string;
  /** Months until first vest (cliff). Standard = 12. */
  cliffMonths: number;
  /** Shares that vest at the cliff as a fraction of total */
  cliffFraction: number;
  /** How often remaining shares vest after cliff */
  vestFrequency: VestFrequency;
  /** Total vesting period in months */
  vestingPeriodMonths: number;
}

export type EquityGrant = RSUGrant | OptionGrant;

/** One vest event in the computed schedule */
export interface VestEvent {
  monthKey: string;
  shares: number;
  valueAtVest: number;   // dollars
  cumulativeShares: number;
  cumulativeValue: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addMonths(yyyyMM: string, n: number): string {
  let current = yyyyMM;
  for (let i = 0; i < n; i++) current = nextMonthKey(current);
  return current;
}

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

// ─── RSU schedule ─────────────────────────────────────────────────────────────

export function computeRSUSchedule(grant: RSUGrant): VestEvent[] {
  const events: VestEvent[] = [];
  let sharesVested = 0;
  let cumulativeValue = 0;

  // Cliff vest
  const cliffMonth = addMonths(grant.grantMonth, grant.cliffMonths);
  const cliffShares = Math.round(grant.totalShares * grant.cliffFraction);
  const cliffValue = cliffShares * grant.pricePerShare;
  sharesVested += cliffShares;
  cumulativeValue += cliffValue;
  events.push({ monthKey: cliffMonth, shares: cliffShares, valueAtVest: cliffValue, cumulativeShares: sharesVested, cumulativeValue });

  // Post-cliff vesting
  const remainingShares = grant.totalShares - cliffShares;
  const monthsRemaining = grant.vestingPeriodMonths - grant.cliffMonths;
  const intervalMonths = grant.vestFrequency === "monthly" ? 1 : 3;
  const vestCount = Math.floor(monthsRemaining / intervalMonths);
  const sharesPerVest = remainingShares / vestCount;

  for (let i = 1; i <= vestCount; i++) {
    const month = addMonths(cliffMonth, i * intervalMonths);
    if (monthsBetween(grant.grantMonth, month) > grant.vestingPeriodMonths) break;

    const shares = i === vestCount
      ? grant.totalShares - sharesVested  // remainder goes to last vest
      : Math.round(sharesPerVest);
    const value = shares * grant.pricePerShare;
    sharesVested += shares;
    cumulativeValue += value;
    events.push({ monthKey: month, shares, valueAtVest: value, cumulativeShares: sharesVested, cumulativeValue });
  }

  return events;
}

// ─── Options schedule ─────────────────────────────────────────────────────────

export function computeOptionSchedule(grant: OptionGrant): VestEvent[] {
  const events: VestEvent[] = [];
  let sharesVested = 0;
  let cumulativeValue = 0;

  function fmvAtMonth(monthKey: string): number {
    const months = monthsBetween(grant.grantMonth, monthKey);
    const years = months / 12;
    return grant.currentFMV * Math.pow(1 + grant.annualAppreciation, years);
  }

  function spreadAtMonth(monthKey: string, shares: number): number {
    const fmv = fmvAtMonth(monthKey);
    const spread = Math.max(0, fmv - grant.strikePrice) * shares;
    return Math.round(spread);
  }

  // Cliff
  const cliffMonth = addMonths(grant.grantMonth, grant.cliffMonths);
  const cliffShares = Math.round(grant.totalShares * grant.cliffFraction);
  const cliffValue = spreadAtMonth(cliffMonth, cliffShares);
  sharesVested += cliffShares;
  cumulativeValue += cliffValue;
  events.push({ monthKey: cliffMonth, shares: cliffShares, valueAtVest: cliffValue, cumulativeShares: sharesVested, cumulativeValue });

  // Post-cliff
  const remainingShares = grant.totalShares - cliffShares;
  const monthsRemaining = grant.vestingPeriodMonths - grant.cliffMonths;
  const intervalMonths = grant.vestFrequency === "monthly" ? 1 : 3;
  const vestCount = Math.floor(monthsRemaining / intervalMonths);
  const sharesPerVest = remainingShares / vestCount;

  for (let i = 1; i <= vestCount; i++) {
    const month = addMonths(cliffMonth, i * intervalMonths);
    if (monthsBetween(grant.grantMonth, month) > grant.vestingPeriodMonths) break;

    const shares = i === vestCount
      ? grant.totalShares - sharesVested
      : Math.round(sharesPerVest);
    const value = spreadAtMonth(month, shares);
    sharesVested += shares;
    cumulativeValue += value;
    events.push({ monthKey: month, shares, valueAtVest: value, cumulativeShares: sharesVested, cumulativeValue });
  }

  return events;
}

// ─── Convert to ScenarioEvents ────────────────────────────────────────────────

/**
 * Convert an equity grant's vest schedule into ScenarioEvents for the projection engine.
 * Each vest date becomes a one-time income event.
 * Only future vest dates (after today) are included.
 */
export function equityGrantToScenarioEvents(grant: EquityGrant): ScenarioEvent[] {
  const todayMonth = new Date().toISOString().slice(0, 7);

  const vestEvents = grant.type === "rsu"
    ? computeRSUSchedule(grant)
    : computeOptionSchedule(grant);

  return vestEvents
    .filter((v) => v.monthKey >= todayMonth && v.valueAtVest > 0)
    .map((v) => ({
      id: `equity_${grant.id}_${v.monthKey}`,
      label: `${grant.label} vest (${v.shares} ${grant.type === "rsu" ? "RSUs" : "options"})`,
      type: "income" as const,
      startMonth: v.monthKey,
      delta: v.valueAtVest,
      recurring: false,
    }));
}

export const EQUITY_GRANTS_KEY = "pacioli-equity-grants";

export function loadEquityGrants(): EquityGrant[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(EQUITY_GRANTS_KEY) ?? "[]"); }
  catch { return []; }
}

export function saveEquityGrants(grants: EquityGrant[]) {
  localStorage.setItem(EQUITY_GRANTS_KEY, JSON.stringify(grants));
}

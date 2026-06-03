/**
 * lib/scenario.ts — Pacioli Scenario Projection Engine
 *
 * Pure, deterministic, LLM-free. Takes a baseline and a list of timed events,
 * returns a monthly time series and summary metrics.
 *
 * The LLM layer (Phase 1) only parses NL → ScenarioEvent[] and narrates results.
 * It never does arithmetic. All math lives here.
 */

import { formatMonth } from "./data";

// ─── Constants ────────────────────────────────────────────────────────────────

export const INVESTMENT_ANNUAL_RETURN = 0.066; // 6.6% annualised
export const MONTHLY_RETURN = INVESTMENT_ANNUAL_RETURN / 12;
export const PROJECTION_MONTHS = 12;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A single timed event that modifies the monthly cash flow.
 *
 * Examples:
 *   Quit job:         { type: "income",   startMonth: "2026-09", delta: -8500, recurring: true }
 *   Open bookstore:   { type: "income",   startMonth: "2027-01", delta: 4000,  recurring: true, endMonth: undefined }
 *   Kitchen remodel:  { type: "expense",  startMonth: "2026-11", delta: 40000, recurring: false }
 *   Save more:        { type: "savings",  startMonth: "2026-06", delta: 500,   recurring: true }
 *
 * delta is always a positive number representing the magnitude of change.
 * For income events, positive delta = more income; negative delta = less income (e.g. quitting).
 * For expense events, delta is always the cost (subtracted from cash flow).
 * For savings events, delta is added to monthly savings.
 */
export interface ScenarioEvent {
  id: string;
  label: string;
  type: "income" | "expense" | "savings";
  /** YYYY-MM when this event starts affecting cash flow */
  startMonth: string;
  /** YYYY-MM when this event stops (undefined = forever) */
  endMonth?: string;
  /** Monthly magnitude in dollars. Always positive — sign applied by type. */
  delta: number;
  /** True = affects every month in [startMonth, endMonth]; false = one-time hit in startMonth */
  recurring: boolean;
  /**
   * Optional bracket for uncertain events.
   * When present, the engine runs three projections and the chart shows a range band.
   * `delta` should equal `bracket.base` — it's the single value used when no bracket is shown.
   */
  bracket?: {
    pessimistic: number;  // worst-case delta magnitude
    base: number;         // most-likely delta magnitude
    optimistic: number;   // best-case delta magnitude
  };
}

/** The raw inputs needed to run a projection */
export interface ScenarioBaseline {
  /** Current net worth in dollars */
  startingNW: number;
  /** Average monthly cash flow (income − spend) from historical data */
  monthlyCashFlow: number;
  /** YYYY-MM of the first projected month (usually current calendar month) */
  startMonth: string;
  /** Number of months to project forward */
  projectionMonths?: number;
  /** Annual investment return rate (default: INVESTMENT_ANNUAL_RETURN) */
  annualReturn?: number;
}

/** One row in the output time series */
export interface ProjectionRow {
  /** Human-readable month label, e.g. "Jun 2026" */
  month: string;
  /** YYYY-MM key */
  monthKey: string;
  /** Net worth with no scenario events applied */
  base: number;
  /** Net worth with scenario events applied */
  scenario: number;
  /** Net cash flow this month in the scenario (income − expenses) */
  scenarioCashFlow: number;
}

/** Summary statistics returned alongside the time series */
export interface ProjectionSummary {
  /** Net worth at end of projection, baseline */
  endBase: number;
  /** Net worth at end of projection, with scenario */
  endScenario: number;
  /** NW gain over projection, baseline */
  gainBase: number;
  /** NW gain over projection, scenario */
  gainScenario: number;
  /** Lowest net worth reached during scenario projection */
  scenarioTrough: number;
  /** Month key when the trough occurs */
  scenarioTroughMonth: string;
  /** True if scenario NW ever goes below zero */
  goesNegative: boolean;
  /** Month key when NW first goes negative (undefined if it doesn't) */
  goesNegativeMonth?: string;
  /** Months of runway at the scenario trough cash-flow rate (undefined if cash flow stays positive) */
  runwayMonths?: number;
}

export interface ProjectionResult {
  rows: ProjectionRow[];
  summary: ProjectionSummary;
}

/** One row in a bracket projection — three parallel NW values */
export interface BracketRow {
  month: string;
  monthKey: string;
  base: number;
  pessimistic: number;
  optimistic: number;
}

export interface BracketProjectionResult {
  rows: BracketRow[];
  summaryPessimistic: ProjectionSummary;
  summaryBase: ProjectionSummary;
  summaryOptimistic: ProjectionSummary;
  /** True if any bracketed event is present */
  hasBracket: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function nextMonthKey(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const d = new Date(y, m); // month is 0-based, so this advances by one
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Returns the net cash-flow delta from all events active in a given month */
function eventDeltaForMonth(events: ScenarioEvent[], monthKey: string): number {
  let delta = 0;
  for (const ev of events) {
    const started = monthKey >= ev.startMonth;
    const notEnded = !ev.endMonth || monthKey <= ev.endMonth;
    const active = started && notEnded;

    if (!active) continue;

    if (ev.recurring) {
      // Monthly recurring: apply every active month
      if (ev.type === "income") delta += ev.delta;
      else delta -= ev.delta; // expense or savings goal reduces free cash
    } else {
      // One-time: only apply in the exact start month
      if (monthKey === ev.startMonth) {
        if (ev.type === "income") delta += ev.delta;
        else delta -= ev.delta;
      }
    }
  }
  return delta;
}

// ─── Core projection function ─────────────────────────────────────────────────

/**
 * Project net worth forward from a baseline, optionally layering scenario events.
 *
 * This is the single source of truth for all financial math in Pacioli.
 * It is pure: no side effects, no randomness, no I/O.
 */
export function runProjection(
  baseline: ScenarioBaseline,
  events: ScenarioEvent[] = [],
): ProjectionResult {
  const months = baseline.projectionMonths ?? PROJECTION_MONTHS;
  const monthlyReturn = (baseline.annualReturn ?? INVESTMENT_ANNUAL_RETURN) / 12;

  const rows: ProjectionRow[] = [];

  // "Now" anchor row (month 0)
  rows.push({
    month: "Now",
    monthKey: baseline.startMonth,
    base: Math.round(baseline.startingNW),
    scenario: Math.round(baseline.startingNW),
    scenarioCashFlow: baseline.monthlyCashFlow,
  });

  let baseNW = baseline.startingNW;
  let scenarioNW = baseline.startingNW;
  let current = baseline.startMonth;

  let scenarioTrough = baseline.startingNW;
  let scenarioTroughMonth = baseline.startMonth;
  let goesNegative = false;
  let goesNegativeMonth: string | undefined;

  for (let i = 0; i < months; i++) {
    current = nextMonthKey(current);
    const evDelta = eventDeltaForMonth(events, current);
    const scenarioCashFlow = baseline.monthlyCashFlow + evDelta;

    baseNW = baseNW * (1 + monthlyReturn) + baseline.monthlyCashFlow;
    scenarioNW = scenarioNW * (1 + monthlyReturn) + scenarioCashFlow;

    if (scenarioNW < scenarioTrough) {
      scenarioTrough = scenarioNW;
      scenarioTroughMonth = current;
    }
    if (scenarioNW < 0 && !goesNegative) {
      goesNegative = true;
      goesNegativeMonth = current;
    }

    rows.push({
      month: formatMonth(current),
      monthKey: current,
      base: Math.round(baseNW),
      scenario: Math.round(scenarioNW),
      scenarioCashFlow: Math.round(scenarioCashFlow),
    });
  }

  const endBase = rows[rows.length - 1].base;
  const endScenario = rows[rows.length - 1].scenario;
  const lastCashFlow = rows[rows.length - 1].scenarioCashFlow;

  // Runway: if cash flow is negative, how many months until NW hits zero?
  let runwayMonths: number | undefined;
  if (lastCashFlow < 0 && endScenario > 0) {
    runwayMonths = Math.floor(endScenario / Math.abs(lastCashFlow));
  }

  return {
    rows,
    summary: {
      endBase,
      endScenario,
      gainBase: endBase - baseline.startingNW,
      gainScenario: endScenario - baseline.startingNW,
      scenarioTrough: Math.round(scenarioTrough),
      scenarioTroughMonth,
      goesNegative,
      goesNegativeMonth,
      runwayMonths,
    },
  };
}

// ─── Bracket projection ───────────────────────────────────────────────────────

/**
 * Run three parallel projections for bracketed scenarios (pessimistic / base / optimistic).
 *
 * For each event with a `bracket`, the three projections substitute
 * pessimistic/base/optimistic delta values respectively.
 * Events without a bracket use their `delta` in all three runs.
 *
 * Returns merged rows with three NW columns plus per-scenario summaries.
 */
export function runBracketProjection(
  baseline: ScenarioBaseline,
  events: ScenarioEvent[],
): BracketProjectionResult {
  const hasBracket = events.some((e) => e.bracket != null);

  // Build three event lists — substituting bracket deltas where available
  function substituteEvents(which: "pessimistic" | "base" | "optimistic"): ScenarioEvent[] {
    return events.map((e) => {
      if (!e.bracket) return e;
      return { ...e, delta: e.bracket[which] };
    });
  }

  const { rows: baseRows,        summary: summaryBase }        = runProjection(baseline, substituteEvents("base"));
  const { rows: pessimisticRows, summary: summaryPessimistic } = runProjection(baseline, substituteEvents("pessimistic"));
  const { rows: optimisticRows,  summary: summaryOptimistic }  = runProjection(baseline, substituteEvents("optimistic"));

  // Merge into BracketRows — base.scenario is the primary scenario line
  const rows: BracketRow[] = baseRows.map((b, i) => ({
    month:       b.month,
    monthKey:    b.monthKey,
    base:        b.scenario,
    pessimistic: pessimisticRows[i]?.scenario ?? b.scenario,
    optimistic:  optimisticRows[i]?.scenario  ?? b.scenario,
  }));

  return { rows, summaryBase, summaryPessimistic, summaryOptimistic, hasBracket };
}

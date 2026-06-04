"use client";
/**
 * CollegeFund
 *
 * Two modes:
 *   "backsolve" — given a target amount and date, calculate required monthly savings
 *   "forward"   — given a monthly contribution, project the balance at target date
 *
 * Injects the monthly savings as a recurring expense (savings goal) scenario event
 * so the projection chart reflects the cash flow impact.
 *
 * Math: future value of a series of equal payments (annuity)
 *   FV = PMT × [(1 + r)^n - 1] / r
 *   Solved for PMT: PMT = FV × r / [(1 + r)^n - 1]
 */
import { useState, useMemo } from "react";
import { GraduationCap, ChevronDown, ChevronUp } from "lucide-react";
import { ScenarioEvent } from "@/lib/scenario";
import { formatCurrency } from "@/lib/data";

const TODAY_MONTH = new Date().toISOString().slice(0, 7);
const STORAGE_KEY = "pacioli-college-funds";

type Mode = "backsolve" | "forward";

export interface CollegeFundConfig {
  id: string;
  label: string;           // e.g. "Emma's 529"
  mode: Mode;
  targetAmount: number;    // goal (backsolve mode)
  targetYear: number;      // year college starts
  monthlyContribution: number; // known contribution (forward mode)
  currentBalance: number;  // existing savings already set aside
  annualReturn: number;    // e.g. 0.07 = 7%
  startMonth: string;
}

const STORAGE_KEY_STORE = STORAGE_KEY;

function load(): CollegeFundConfig[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_STORE) ?? "[]"); }
  catch { return []; }
}

function save(funds: CollegeFundConfig[]) {
  localStorage.setItem(STORAGE_KEY_STORE, JSON.stringify(funds));
}

/** Months between two YYYY-MM strings */
function monthsUntil(fromMonth: string, toYear: number): number {
  const [y, m] = fromMonth.split("-").map(Number);
  return Math.max(0, (toYear - y) * 12 - (m - 1));
}

/** Backsolve: monthly payment needed to reach FV given current balance */
function solveMonthlyPayment(targetFV: number, currentBalance: number, months: number, annualReturn: number): number {
  if (months <= 0) return 0;
  const r = annualReturn / 12;
  // Grow existing balance to target date
  const grownBalance = currentBalance * Math.pow(1 + r, months);
  const remaining = targetFV - grownBalance;
  if (remaining <= 0) return 0; // already funded
  if (r === 0) return remaining / months;
  return remaining * r / (Math.pow(1 + r, months) - 1);
}

/** Forward: projected balance at target date given monthly contribution */
function projectBalance(monthlyContribution: number, currentBalance: number, months: number, annualReturn: number): number {
  if (months <= 0) return currentBalance;
  const r = annualReturn / 12;
  const grownBalance = currentBalance * Math.pow(1 + r, months);
  if (r === 0) return grownBalance + monthlyContribution * months;
  const annuityFV = monthlyContribution * (Math.pow(1 + r, months) - 1) / r;
  return grownBalance + annuityFV;
}

/** Convert a college fund config to a ScenarioEvent */
export function collegeFundToScenarioEvent(fund: CollegeFundConfig): ScenarioEvent | null {
  const months = monthsUntil(fund.startMonth, fund.targetYear);
  if (months <= 0) return null;

  const endYear = fund.targetYear;
  const endMonth = `${endYear}-08`; // August = college start

  let monthlySavings: number;
  if (fund.mode === "backsolve") {
    monthlySavings = solveMonthlyPayment(fund.targetAmount, fund.currentBalance, months, fund.annualReturn);
  } else {
    monthlySavings = fund.monthlyContribution;
  }

  if (monthlySavings <= 0) return null;

  return {
    id: `college_${fund.id}`,
    label: `${fund.label} savings`,
    type: "savings",
    startMonth: fund.startMonth,
    endMonth,
    delta: Math.round(monthlySavings),
    recurring: true,
  };
}

function defaultFund(): Omit<CollegeFundConfig, "id"> {
  return {
    label: "College fund",
    mode: "backsolve",
    targetAmount: 200000,
    targetYear: new Date().getFullYear() + 18,
    monthlyContribution: 500,
    currentBalance: 0,
    annualReturn: 0.07,
    startMonth: TODAY_MONTH,
  };
}

interface Props {
  onChange: () => void;
}

export default function CollegeFund({ onChange }: Props) {
  const [funds, setFunds] = useState<CollegeFundConfig[]>(() => load());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<CollegeFundConfig, "id">>(defaultFund());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function persist(updated: CollegeFundConfig[]) {
    setFunds(updated);
    save(updated);
    onChange();
  }

  function add() {
    const fund: CollegeFundConfig = { ...form, id: `fund_${Date.now()}` };
    persist([...funds, fund]);
    setShowForm(false);
    setForm(defaultFund());
    setExpandedId(fund.id);
  }

  function remove(id: string) {
    persist(funds.filter((f) => f.id !== id));
  }

  function updateFund(id: string, updates: Partial<CollegeFundConfig>) {
    persist(funds.map((f) => f.id === id ? { ...f, ...updates } : f));
  }

  return (
    <div className="pacioli-bg-surface rounded-2xl border p-6 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <GraduationCap size={16} className="pacioli-accent" />
          <h3 className="text-sm font-semibold pacioli-text-primary">College Fund</h3>
        </div>
        <p className="text-xs pacioli-text-muted mt-0.5">
          Backsolve how much to save monthly, or project what you'll have.
        </p>
      </div>

      {/* Fund list */}
      {funds.map((fund) => {
        const months = monthsUntil(fund.startMonth, fund.targetYear);
        const isExpanded = expandedId === fund.id;

        const monthlySavings = fund.mode === "backsolve"
          ? solveMonthlyPayment(fund.targetAmount, fund.currentBalance, months, fund.annualReturn)
          : fund.monthlyContribution;

        const projectedBalance = projectBalance(
          fund.mode === "backsolve" ? monthlySavings : fund.monthlyContribution,
          fund.currentBalance, months, fund.annualReturn
        );

        const funded = projectedBalance >= fund.targetAmount;
        const yearsLeft = Math.floor(months / 12);

        return (
          <div key={fund.id} className="pacioli-bg-surface-2 rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400">
                    {fund.mode === "backsolve" ? "Goal" : "Forward"}
                  </span>
                  <span className="text-sm font-medium pacioli-text-primary">{fund.label}</span>
                </div>
                <p className="text-xs pacioli-text-muted mt-0.5">
                  {fund.mode === "backsolve"
                    ? `${formatCurrency(monthlySavings)}/mo needed → ${formatCurrency(fund.targetAmount)} by ${fund.targetYear}`
                    : `${formatCurrency(fund.monthlyContribution)}/mo → ${formatCurrency(projectedBalance)} by ${fund.targetYear}`
                  }
                  {" · "}{yearsLeft}yr left
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${funded ? "pacioli-text-success" : "pacioli-text-warning"}`}>
                  {funded ? "On track ✓" : `${formatCurrency(fund.targetAmount - projectedBalance)} gap`}
                </span>
                <button onClick={() => setExpandedId(isExpanded ? null : fund.id)} className="pacioli-text-muted hover:pacioli-text-primary transition-colors">
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button onClick={() => remove(fund.id)} className="pacioli-text-muted hover:pacioli-text-danger transition-colors text-xs">✕</button>
              </div>
            </div>

            {isExpanded && (
              <div className="space-y-4 pt-3 border-t pacioli-border-subtle">
                {/* Mode toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => updateFund(fund.id, { mode: "backsolve" })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${fund.mode === "backsolve" ? "bg-indigo-600 text-white" : "pacioli-bg-surface border pacioli-text-muted"}`}
                  >
                    How much do I need to save?
                  </button>
                  <button
                    onClick={() => updateFund(fund.id, { mode: "forward" })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${fund.mode === "forward" ? "bg-indigo-600 text-white" : "pacioli-bg-surface border pacioli-text-muted"}`}
                  >
                    What will I have?
                  </button>
                </div>

                {/* Result callout */}
                <div className={`text-xs rounded-lg px-3 py-2.5 border ${funded ? "bg-emerald-500/8 border-emerald-500/20" : "bg-amber-500/8 border-amber-500/20"}`}>
                  {fund.mode === "backsolve" ? (
                    monthlySavings <= 0
                      ? <span className="pacioli-text-success font-semibold">Already funded! Your current balance covers the goal.</span>
                      : <>Save <span className="font-semibold pacioli-text-primary">{formatCurrency(Math.round(monthlySavings))}/mo</span> for {yearsLeft} years at {(fund.annualReturn * 100).toFixed(0)}% return to reach <span className="font-semibold pacioli-text-primary">{formatCurrency(fund.targetAmount)}</span> by {fund.targetYear}.</>
                  ) : (
                    <>At {formatCurrency(fund.monthlyContribution)}/mo for {yearsLeft} years, you'll have <span className={`font-semibold ${funded ? "pacioli-text-success" : "text-amber-400"}`}>{formatCurrency(Math.round(projectedBalance))}</span> by {fund.targetYear}
                    {!funded && <> — <span className="text-amber-400">{formatCurrency(Math.round(fund.targetAmount - projectedBalance))} short of your {formatCurrency(fund.targetAmount)} goal</span></>}.</>
                  )}
                </div>

                {/* Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs pacioli-text-muted mb-1 block">Fund name</label>
                    <input className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      value={fund.label} onChange={(e) => updateFund(fund.id, { label: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs pacioli-text-muted mb-1 block">Target amount ($)</label>
                    <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      value={fund.targetAmount} onChange={(e) => updateFund(fund.id, { targetAmount: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs pacioli-text-muted mb-1 block">College start year</label>
                    <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      value={fund.targetYear} onChange={(e) => updateFund(fund.id, { targetYear: Number(e.target.value) })} />
                  </div>
                  {fund.mode === "forward" && (
                    <div>
                      <label className="text-xs pacioli-text-muted mb-1 block">Monthly contribution ($)</label>
                      <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        value={fund.monthlyContribution} onChange={(e) => updateFund(fund.id, { monthlyContribution: Number(e.target.value) })} />
                    </div>
                  )}
                  <div>
                    <label className="text-xs pacioli-text-muted mb-1 block">Current balance ($)</label>
                    <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      value={fund.currentBalance} onChange={(e) => updateFund(fund.id, { currentBalance: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs pacioli-text-muted mb-1 block">Annual return (%)</label>
                    <input type="number" step="0.5" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      value={(fund.annualReturn * 100).toFixed(0)} onChange={(e) => updateFund(fund.id, { annualReturn: Number(e.target.value) / 100 })} />
                  </div>
                  <div>
                    <label className="text-xs pacioli-text-muted mb-1 block">Savings start month</label>
                    <input type="month" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      value={fund.startMonth} onChange={(e) => updateFund(fund.id, { startMonth: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add form */}
      {showForm ? (
        <div className="pacioli-bg-surface-2 rounded-xl border p-5 space-y-4">
          <p className="text-xs font-semibold pacioli-text-secondary">New college fund</p>

          {/* Mode toggle */}
          <div className="flex gap-2">
            {(["backsolve", "forward"] as Mode[]).map((m) => (
              <button key={m}
                onClick={() => setForm((f) => ({ ...f, mode: m }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${form.mode === m ? "bg-indigo-600 text-white" : "pacioli-bg-surface border pacioli-text-muted"}`}
              >
                {m === "backsolve" ? "How much do I need?" : "What will I have?"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs pacioli-text-muted mb-1 block">Fund name</label>
              <input className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="e.g. Emma's 529" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">Target amount ($)</label>
              <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.targetAmount} onChange={(e) => setForm((f) => ({ ...f, targetAmount: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">College start year</label>
              <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.targetYear} onChange={(e) => setForm((f) => ({ ...f, targetYear: Number(e.target.value) }))} />
            </div>
            {form.mode === "forward" && (
              <div>
                <label className="text-xs pacioli-text-muted mb-1 block">Monthly contribution ($)</label>
                <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  value={form.monthlyContribution} onChange={(e) => setForm((f) => ({ ...f, monthlyContribution: Number(e.target.value) }))} />
              </div>
            )}
            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">Current balance ($)</label>
              <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.currentBalance} onChange={(e) => setForm((f) => ({ ...f, currentBalance: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">Annual return (%)</label>
              <input type="number" step="0.5" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={(form.annualReturn * 100).toFixed(0)} onChange={(e) => setForm((f) => ({ ...f, annualReturn: Number(e.target.value) / 100 }))} />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={add} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors">
              Add fund
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-1.5 pacioli-bg-btn-cancel pacioli-text-primary text-xs font-medium rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 text-xs font-medium pacioli-accent hover:opacity-80 transition-colors">
          <GraduationCap size={13} /> Add college fund
        </button>
      )}
    </div>
  );
}

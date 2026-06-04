"use client";
/**
 * MortgageAccelerator
 *
 * Models extra mortgage payments and shows:
 *   - Months saved off the loan term
 *   - Total interest saved
 *   - New payoff date
 *
 * Injects a recurring expense event (the extra payment) into the scenario
 * so the projection chart reflects the cash flow impact.
 */
import { useState, useMemo } from "react";
import { Home, ChevronDown, ChevronUp } from "lucide-react";
import { ScenarioEvent } from "@/lib/scenario";
import { formatCurrency } from "@/lib/data";

const TODAY_MONTH = new Date().toISOString().slice(0, 7);
const STORAGE_KEY = "pacioli-mortgage";

export interface MortgageConfig {
  label: string;
  balance: number;          // current outstanding balance
  monthlyPayment: number;   // current required P&I payment
  annualRate: number;       // e.g. 0.065 = 6.5%
  extraPayment: number;     // additional monthly payment
  startMonth: string;       // when extra payments begin
}

function defaultConfig(): MortgageConfig {
  return {
    label: "Primary mortgage",
    balance: 400000,
    monthlyPayment: 2500,
    annualRate: 0.065,
    extraPayment: 500,
    startMonth: TODAY_MONTH,
  };
}

function load(): MortgageConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function save(config: MortgageConfig | null) {
  if (config) localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  else localStorage.removeItem(STORAGE_KEY);
}

/** Run amortization and return months to payoff + total interest paid */
function amortize(balance: number, monthlyPayment: number, annualRate: number, extraMonthly = 0): {
  months: number;
  totalInterest: number;
  payoffMonth: string;
} {
  const monthlyRate = annualRate / 12;
  let remaining = balance;
  let months = 0;
  let totalInterest = 0;
  const maxMonths = 600; // 50yr cap

  while (remaining > 0 && months < maxMonths) {
    const interest = remaining * monthlyRate;
    const principal = Math.min(monthlyPayment + extraMonthly - interest, remaining);
    if (principal <= 0) { months = maxMonths; break; } // payment doesn't cover interest
    remaining -= principal;
    totalInterest += interest;
    months++;
  }

  // Calculate payoff month
  const now = new Date();
  const payoff = new Date(now.getFullYear(), now.getMonth() + months);
  const payoffMonth = `${payoff.getFullYear()}-${String(payoff.getMonth() + 1).padStart(2, "0")}`;

  return { months, totalInterest: Math.round(totalInterest), payoffMonth };
}

/** Convert active mortgage config to a ScenarioEvent */
export function mortgageToScenarioEvent(config: MortgageConfig | null): ScenarioEvent | null {
  if (!config || config.extraPayment <= 0) return null;

  // Calculate when the loan pays off with extra payments, so we can set endMonth
  const { payoffMonth } = amortize(config.balance, config.monthlyPayment, config.annualRate, config.extraPayment);

  return {
    id: "mortgage_extra",
    label: `Extra mortgage payment (${config.label})`,
    type: "expense",
    startMonth: config.startMonth,
    endMonth: payoffMonth,
    delta: config.extraPayment,
    recurring: true,
  };
}

interface Props {
  onChange: () => void;
}

export default function MortgageAccelerator({ onChange }: Props) {
  const [config, setConfig] = useState<MortgageConfig | null>(() => load());
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<MortgageConfig>(() => load() ?? defaultConfig());

  function persist(updated: MortgageConfig | null) {
    setConfig(updated);
    save(updated);
    onChange();
  }

  function saveForm() {
    persist(form);
    setShowForm(false);
    setExpanded(true);
  }

  function remove() {
    persist(null);
    setExpanded(false);
    setForm(defaultConfig());
  }

  // Compute amortization scenarios
  const analysis = useMemo(() => {
    if (!config) return null;
    const base = amortize(config.balance, config.monthlyPayment, config.annualRate, 0);
    const accelerated = amortize(config.balance, config.monthlyPayment, config.annualRate, config.extraPayment);
    return {
      base,
      accelerated,
      monthsSaved: base.months - accelerated.months,
      interestSaved: base.totalInterest - accelerated.totalInterest,
    };
  }, [config]);

  return (
    <div className="pacioli-bg-surface rounded-2xl border p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Home size={16} className="pacioli-accent" />
            <h3 className="text-sm font-semibold pacioli-text-primary">Mortgage Payoff Accelerator</h3>
          </div>
          <p className="text-xs pacioli-text-muted mt-0.5">
            Model extra payments and see interest saved.
          </p>
        </div>
        {analysis && (
          <div className="text-right">
            <p className="text-xs pacioli-text-muted">Interest saved</p>
            <p className="text-sm font-bold pacioli-text-success">{formatCurrency(analysis.interestSaved)}</p>
          </div>
        )}
      </div>

      {/* Active config */}
      {config && analysis && (
        <div className="pacioli-bg-surface-2 rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium pacioli-text-primary">{config.label}</p>
              <p className="text-xs pacioli-text-muted mt-0.5">
                +{formatCurrency(config.extraPayment)}/mo extra · saves {analysis.monthsSaved} months
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setExpanded(!expanded)} className="pacioli-text-muted hover:pacioli-text-primary transition-colors">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>

          {expanded && (
            <div className="space-y-4 pt-2 border-t pacioli-border-subtle">
              {/* Summary table */}
              <div className="grid grid-cols-2 gap-3">
                <div className="pacioli-bg-surface rounded-lg p-3">
                  <p className="text-xs pacioli-text-muted mb-1">Without extra payments</p>
                  <p className="text-sm font-semibold pacioli-text-primary">{Math.floor(analysis.base.months / 12)}y {analysis.base.months % 12}m left</p>
                  <p className="text-xs pacioli-text-muted">Payoff {analysis.base.payoffMonth}</p>
                  <p className="text-xs pacioli-text-danger mt-1">{formatCurrency(analysis.base.totalInterest)} interest</p>
                </div>
                <div className="pacioli-bg-surface rounded-lg p-3 border border-emerald-500/20">
                  <p className="text-xs pacioli-text-muted mb-1">With +{formatCurrency(config.extraPayment)}/mo</p>
                  <p className="text-sm font-semibold pacioli-text-success">{Math.floor(analysis.accelerated.months / 12)}y {analysis.accelerated.months % 12}m left</p>
                  <p className="text-xs pacioli-text-muted">Payoff {analysis.accelerated.payoffMonth}</p>
                  <p className="text-xs pacioli-text-success mt-1">{formatCurrency(analysis.accelerated.totalInterest)} interest</p>
                </div>
              </div>

              {/* Savings callout */}
              <div className="text-xs bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-3 py-2.5">
                Pay off <span className="font-semibold pacioli-text-success">{analysis.monthsSaved} months early</span> and save <span className="font-semibold pacioli-text-success">{formatCurrency(analysis.interestSaved)}</span> in interest by adding {formatCurrency(config.extraPayment)}/mo.
              </div>

              {/* Edit form */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="col-span-2">
                  <label className="text-xs pacioli-text-muted mb-1 block">Label</label>
                  <input className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs pacioli-text-muted mb-1 block">Current balance ($)</label>
                  <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    value={form.balance} onChange={(e) => setForm((f) => ({ ...f, balance: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-xs pacioli-text-muted mb-1 block">Monthly P&I payment ($)</label>
                  <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    value={form.monthlyPayment} onChange={(e) => setForm((f) => ({ ...f, monthlyPayment: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-xs pacioli-text-muted mb-1 block">Interest rate (%)</label>
                  <input type="number" step="0.1" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    value={(form.annualRate * 100).toFixed(2)} onChange={(e) => setForm((f) => ({ ...f, annualRate: Number(e.target.value) / 100 }))} />
                </div>
                <div>
                  <label className="text-xs pacioli-text-muted mb-1 block">Extra monthly payment ($)</label>
                  <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    value={form.extraPayment} onChange={(e) => setForm((f) => ({ ...f, extraPayment: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-xs pacioli-text-muted mb-1 block">Start month</label>
                  <input type="month" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    value={form.startMonth} onChange={(e) => setForm((f) => ({ ...f, startMonth: e.target.value }))} />
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={saveForm} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors">
                  Save changes
                </button>
                <button onClick={remove} className="px-4 py-1.5 pacioli-bg-btn-cancel pacioli-text-danger text-xs font-medium rounded-lg transition-colors">
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add form */}
      {!config && showForm && (
        <div className="pacioli-bg-surface-2 rounded-xl border p-5 space-y-4">
          <p className="text-xs font-semibold pacioli-text-secondary">Mortgage details</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs pacioli-text-muted mb-1 block">Label</label>
              <input className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">Current balance ($)</label>
              <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.balance} onChange={(e) => setForm((f) => ({ ...f, balance: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">Monthly P&I payment ($)</label>
              <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.monthlyPayment} onChange={(e) => setForm((f) => ({ ...f, monthlyPayment: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">Interest rate (%)</label>
              <input type="number" step="0.1" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={(form.annualRate * 100).toFixed(2)} onChange={(e) => setForm((f) => ({ ...f, annualRate: Number(e.target.value) / 100 }))} />
            </div>
            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">Extra monthly payment ($)</label>
              <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.extraPayment} onChange={(e) => setForm((f) => ({ ...f, extraPayment: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">Start month</label>
              <input type="month" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.startMonth} onChange={(e) => setForm((f) => ({ ...f, startMonth: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={saveForm} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors">
              Add mortgage
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-1.5 pacioli-bg-btn-cancel pacioli-text-primary text-xs font-medium rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {!config && !showForm && (
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 text-xs font-medium pacioli-accent hover:opacity-80 transition-colors">
          <Home size={13} /> Add mortgage
        </button>
      )}
    </div>
  );
}

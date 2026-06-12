"use client";
/**
 * RentalPL
 *
 * Rental property profit & loss card. User enters property assumptions
 * (purchase price, mortgage terms, rent, operating expenses) and the card
 * computes NOI, mortgage P&I split, net cash flow, cap rate, and
 * cash-on-cash return.
 */
import { useState, useMemo } from "react";
import { Building2, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/data";
import {
  RentalConfig,
  defaultRentalConfig,
  loadRentalConfig,
  saveRentalConfig,
  computeRentalPL,
} from "@/lib/rental";

interface Props {
  onChange?: () => void;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default function RentalPL({ onChange }: Props) {
  const [config, setConfig] = useState<RentalConfig | null>(() => loadRentalConfig());
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RentalConfig>(() => loadRentalConfig() ?? defaultRentalConfig());

  function persist(updated: RentalConfig | null) {
    setConfig(updated);
    saveRentalConfig(updated);
    onChange?.();
  }

  function saveFormFn() {
    persist(form);
    setShowForm(false);
    setExpanded(true);
  }

  function remove() {
    persist(null);
    setExpanded(false);
    setForm(defaultRentalConfig());
  }

  const pl = useMemo(() => (config ? computeRentalPL(config) : null), [config]);

  const numField = (key: keyof RentalConfig, label: string, step = 1, suffix?: string) => (
    <div>
      <label className="text-xs pacioli-text-muted mb-1 block">{label}{suffix ? ` (${suffix})` : ""}</label>
      <input
        type="number"
        step={step}
        className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        value={form[key] as number}
        onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
      />
    </div>
  );

  const pctField = (key: keyof RentalConfig, label: string) => (
    <div>
      <label className="text-xs pacioli-text-muted mb-1 block">{label} (%)</label>
      <input
        type="number"
        step={0.1}
        className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        value={((form[key] as number) * 100).toFixed(1)}
        onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) / 100 }))}
      />
    </div>
  );

  return (
    <div className="pacioli-bg-surface rounded-2xl border p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 size={16} className="pacioli-accent" />
            <h3 className="text-sm font-semibold pacioli-text-primary">Rental Property P&amp;L</h3>
          </div>
          <p className="text-xs pacioli-text-muted mt-0.5">
            Income, expenses, and returns for your rental.
          </p>
        </div>
        {pl && (
          <div className="text-right">
            <p className="text-xs pacioli-text-muted">Monthly cash flow</p>
            <p className={`text-sm font-bold ${pl.netCashFlow >= 0 ? "pacioli-text-success" : "pacioli-text-danger"}`}>
              {pl.netCashFlow >= 0 ? "+" : "−"}{formatCurrency(Math.abs(pl.netCashFlow))}
            </p>
          </div>
        )}
      </div>

      {/* Active config */}
      {config && pl && (
        <div className="pacioli-bg-surface-2 rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium pacioli-text-primary">{config.label}</p>
              <p className="text-xs pacioli-text-muted mt-0.5">
                {formatCurrency(config.monthlyRent)}/mo rent · cap rate {pct(pl.capRate)} · cash-on-cash {pct(pl.cashOnCash)}
              </p>
            </div>
            <button onClick={() => setExpanded(!expanded)} className="pacioli-text-muted hover:pacioli-text-primary transition-colors">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {expanded && (
            <div className="space-y-4 pt-2 border-t pacioli-border-subtle">
              {/* P&L table */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                <div className="col-span-2 text-[11px] uppercase tracking-wide pacioli-text-muted font-semibold pt-1">Income</div>
                <span className="pacioli-text-secondary">Gross rent</span>
                <span className="text-right pacioli-text-primary tabular-nums">{formatCurrency(pl.grossRent)}</span>
                <span className="pacioli-text-secondary">Vacancy reserve ({pct(config.vacancyPct)})</span>
                <span className="text-right pacioli-text-danger tabular-nums">−{formatCurrency(pl.vacancyLoss)}</span>
                <span className="pacioli-text-secondary font-medium">Effective income</span>
                <span className="text-right pacioli-text-primary font-medium tabular-nums">{formatCurrency(pl.effectiveIncome)}</span>

                <div className="col-span-2 text-[11px] uppercase tracking-wide pacioli-text-muted font-semibold pt-2">Operating expenses</div>
                <span className="pacioli-text-secondary">Property tax</span>
                <span className="text-right pacioli-text-primary tabular-nums">−{formatCurrency(pl.propertyTax)}</span>
                <span className="pacioli-text-secondary">Insurance</span>
                <span className="text-right pacioli-text-primary tabular-nums">−{formatCurrency(pl.insurance)}</span>
                {pl.hoa > 0 && (<>
                  <span className="pacioli-text-secondary">HOA</span>
                  <span className="text-right pacioli-text-primary tabular-nums">−{formatCurrency(pl.hoa)}</span>
                </>)}
                <span className="pacioli-text-secondary">Maintenance reserve ({pct(config.maintenancePct)})</span>
                <span className="text-right pacioli-text-primary tabular-nums">−{formatCurrency(pl.maintenance)}</span>
                {pl.management > 0 && (<>
                  <span className="pacioli-text-secondary">Management ({pct(config.managementPct)})</span>
                  <span className="text-right pacioli-text-primary tabular-nums">−{formatCurrency(pl.management)}</span>
                </>)}
                {pl.other > 0 && (<>
                  <span className="pacioli-text-secondary">Other</span>
                  <span className="text-right pacioli-text-primary tabular-nums">−{formatCurrency(pl.other)}</span>
                </>)}
                <span className="pacioli-text-secondary font-medium">Total operating expenses</span>
                <span className="text-right pacioli-text-primary font-medium tabular-nums">−{formatCurrency(pl.totalOperatingExpenses)}</span>

                <div className="col-span-2 border-t pacioli-border-subtle my-1" />
                <span className="pacioli-text-secondary font-semibold">Net Operating Income (NOI)</span>
                <span className="text-right pacioli-text-primary font-semibold tabular-nums">{formatCurrency(pl.noi)}</span>

                <div className="col-span-2 text-[11px] uppercase tracking-wide pacioli-text-muted font-semibold pt-2">Debt service</div>
                <span className="pacioli-text-secondary">Mortgage interest</span>
                <span className="text-right pacioli-text-primary tabular-nums">−{formatCurrency(pl.mortgageInterest)}</span>
                <span className="pacioli-text-secondary">Mortgage principal</span>
                <span className="text-right pacioli-text-primary tabular-nums">−{formatCurrency(pl.mortgagePrincipal)}</span>

                <div className="col-span-2 border-t pacioli-border-subtle my-1" />
                <span className="pacioli-text-secondary font-semibold">Net cash flow</span>
                <span className={`text-right font-semibold tabular-nums ${pl.netCashFlow >= 0 ? "pacioli-text-success" : "pacioli-text-danger"}`}>
                  {pl.netCashFlow >= 0 ? "" : "−"}{formatCurrency(Math.abs(pl.netCashFlow))}
                </span>
              </div>

              {/* Returns summary */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="pacioli-bg-surface rounded-lg p-3 text-center">
                  <p className="text-xs pacioli-text-muted mb-1">Cap rate</p>
                  <p className="text-sm font-semibold pacioli-text-primary">{pct(pl.capRate)}</p>
                </div>
                <div className="pacioli-bg-surface rounded-lg p-3 text-center">
                  <p className="text-xs pacioli-text-muted mb-1">Cash-on-cash</p>
                  <p className={`text-sm font-semibold ${pl.cashOnCash >= 0 ? "pacioli-text-success" : "pacioli-text-danger"}`}>{pct(pl.cashOnCash)}</p>
                </div>
                <div className="pacioli-bg-surface rounded-lg p-3 text-center">
                  <p className="text-xs pacioli-text-muted mb-1">Annual cash flow</p>
                  <p className={`text-sm font-semibold ${pl.annualNetCashFlow >= 0 ? "pacioli-text-success" : "pacioli-text-danger"}`}>{formatCurrency(pl.annualNetCashFlow)}</p>
                </div>
              </div>

              {/* Edit form */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t pacioli-border-subtle">
                <div className="col-span-2 pt-1">
                  <label className="text-xs pacioli-text-muted mb-1 block">Label</label>
                  <input className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
                </div>
                {numField("propertyValue", "Current property value", 1000, "$")}
                {numField("purchasePrice", "Purchase price", 1000, "$")}
                {numField("cashInvested", "Cash invested (down payment + costs)", 500, "$")}
                {numField("monthlyRent", "Monthly rent", 25, "$")}
                {numField("mortgageBalance", "Mortgage balance", 500, "$")}
                {numField("mortgagePayment", "Monthly P&I payment", 25, "$")}
                {pctField("mortgageRate", "Mortgage rate")}
                {numField("propertyTaxAnnual", "Property tax (annual)", 100, "$")}
                {numField("insuranceAnnual", "Insurance (annual)", 50, "$")}
                {numField("hoaMonthly", "HOA (monthly)", 10, "$")}
                {pctField("maintenancePct", "Maintenance reserve")}
                {pctField("vacancyPct", "Vacancy reserve")}
                {pctField("managementPct", "Management fee")}
                {numField("otherMonthly", "Other monthly costs", 10, "$")}
              </div>

              <div className="flex gap-2">
                <button onClick={saveFormFn} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors">
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
          <p className="text-xs font-semibold pacioli-text-secondary">Rental property details</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs pacioli-text-muted mb-1 block">Label</label>
              <input className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
            {numField("propertyValue", "Current property value", 1000, "$")}
            {numField("purchasePrice", "Purchase price", 1000, "$")}
            {numField("cashInvested", "Cash invested (down payment + costs)", 500, "$")}
            {numField("monthlyRent", "Monthly rent", 25, "$")}
            {numField("mortgageBalance", "Mortgage balance", 500, "$")}
            {numField("mortgagePayment", "Monthly P&I payment", 25, "$")}
            {pctField("mortgageRate", "Mortgage rate")}
            {numField("propertyTaxAnnual", "Property tax (annual)", 100, "$")}
            {numField("insuranceAnnual", "Insurance (annual)", 50, "$")}
            {numField("hoaMonthly", "HOA (monthly)", 10, "$")}
            {pctField("maintenancePct", "Maintenance reserve")}
            {pctField("vacancyPct", "Vacancy reserve")}
            {pctField("managementPct", "Management fee")}
            {numField("otherMonthly", "Other monthly costs", 10, "$")}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={saveFormFn} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors">
              Add rental property
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-1.5 pacioli-bg-btn-cancel pacioli-text-primary text-xs font-medium rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {!config && !showForm && (
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 text-xs font-medium pacioli-accent hover:opacity-80 transition-colors">
          <Building2 size={13} /> Add rental property
        </button>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import {
  EquityGrant, RSUGrant, OptionGrant, VestFrequency,
  computeRSUSchedule, computeOptionSchedule,
  loadEquityGrants, saveEquityGrants,
  EQUITY_GRANTS_KEY,
} from "@/lib/equity";
import { formatCurrency } from "@/lib/data";

interface Props {
  onChange: () => void; // called whenever grants change, so forecast re-derives events
}

const TODAY_MONTH = new Date().toISOString().slice(0, 7);

function defaultRSU(): Omit<RSUGrant, "id"> {
  return {
    type: "rsu",
    label: "RSU Grant",
    totalShares: 1000,
    pricePerShare: 100,
    grantMonth: TODAY_MONTH,
    cliffMonths: 12,
    cliffFraction: 0.25,
    vestFrequency: "quarterly",
    vestingPeriodMonths: 48,
  };
}

function defaultOption(): Omit<OptionGrant, "id"> {
  return {
    type: "iso",
    label: "Option Grant",
    totalShares: 5000,
    strikePrice: 10,
    currentFMV: 15,
    annualAppreciation: 0.10,
    grantMonth: TODAY_MONTH,
    cliffMonths: 12,
    cliffFraction: 0.25,
    vestFrequency: "monthly",
    vestingPeriodMonths: 48,
  };
}

export default function EquityGrants({ onChange }: Props) {
  const [grants, setGrants] = useState<EquityGrant[]>(() => loadEquityGrants());
  const [showForm, setShowForm] = useState(false);
  const [newType, setNewType] = useState<"rsu" | "iso" | "nso">("rsu");
  const [form, setForm] = useState<Omit<RSUGrant | OptionGrant, "id">>(defaultRSU());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function persist(updated: EquityGrant[]) {
    setGrants(updated);
    saveEquityGrants(updated);
    onChange();
  }

  function handleTypeChange(t: "rsu" | "iso" | "nso") {
    setNewType(t);
    setForm(t === "rsu" ? defaultRSU() : { ...defaultOption(), type: t });
  }

  function addGrant() {
    const grant = { ...form, id: `grant_${Date.now()}` } as EquityGrant;
    persist([...grants, grant]);
    setShowForm(false);
    setForm(defaultRSU());
    setNewType("rsu");
  }

  function removeGrant(id: string) {
    persist(grants.filter((g) => g.id !== id));
  }

  function updateField(field: string, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const totalFutureValue = grants.reduce((sum, g) => {
    const events = g.type === "rsu" ? computeRSUSchedule(g) : computeOptionSchedule(g);
    return sum + events
      .filter((e) => e.monthKey >= TODAY_MONTH)
      .reduce((s, e) => s + e.valueAtVest, 0);
  }, 0);

  return (
    <div className="pacioli-bg-surface rounded-2xl border p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="pacioli-accent" />
            <h3 className="text-sm font-semibold pacioli-text-primary">Equity Compensation</h3>
          </div>
          <p className="text-xs pacioli-text-muted mt-0.5">
            Vest events are injected into your scenario as one-time income.
          </p>
        </div>
        {totalFutureValue > 0 && (
          <div className="text-right">
            <p className="text-xs pacioli-text-muted">Unvested value</p>
            <p className="text-sm font-bold pacioli-text-success">{formatCurrency(totalFutureValue)}</p>
          </div>
        )}
      </div>

      {/* Grant list */}
      {grants.map((grant) => {
        const events = grant.type === "rsu"
          ? computeRSUSchedule(grant)
          : computeOptionSchedule(grant);
        const futureEvents = events.filter((e) => e.monthKey >= TODAY_MONTH);
        const totalFuture = futureEvents.reduce((s, e) => s + e.valueAtVest, 0);
        const isExpanded = expandedId === grant.id;

        return (
          <div key={grant.id} className="pacioli-bg-surface-2 rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400">
                    {grant.type.toUpperCase()}
                  </span>
                  <span className="text-sm font-medium pacioli-text-primary">{grant.label}</span>
                </div>
                <p className="text-xs pacioli-text-muted mt-0.5">
                  {grant.totalShares.toLocaleString()} shares · {futureEvents.length} future vests · {formatCurrency(totalFuture)} remaining
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : grant.id)}
                  className="text-xs pacioli-text-muted hover:pacioli-text-primary transition-colors"
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button
                  onClick={() => removeGrant(grant.id)}
                  className="pacioli-text-muted hover:pacioli-text-danger transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Vest schedule */}
            {isExpanded && (
              <div className="space-y-1 pt-1 border-t pacioli-border-subtle">
                <p className="text-xs font-semibold pacioli-text-muted uppercase tracking-wide mb-2">Vest schedule</p>
                {events.map((e) => {
                  const isPast = e.monthKey < TODAY_MONTH;
                  return (
                    <div key={e.monthKey} className={`flex justify-between text-xs ${isPast ? "opacity-40" : ""}`}>
                      <span className="pacioli-text-secondary">
                        {e.monthKey} · {e.shares.toLocaleString()} shares
                        {isPast && " ✓"}
                      </span>
                      <span className={`font-medium ${isPast ? "pacioli-text-muted" : "pacioli-text-primary"}`}>
                        {formatCurrency(e.valueAtVest)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Add grant form */}
      {showForm ? (
        <div className="pacioli-bg-surface-2 rounded-xl border p-5 space-y-4">
          <p className="text-xs font-semibold pacioli-text-secondary">New equity grant</p>

          {/* Type selector */}
          <div className="flex gap-2">
            {(["rsu", "iso", "nso"] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  newType === t
                    ? "bg-indigo-600 text-white"
                    : "pacioli-bg-surface border pacioli-text-muted hover:pacioli-text-primary"
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Common fields */}
            <div className="col-span-2">
              <label className="text-xs pacioli-text-muted mb-1 block">Grant name</label>
              <input
                className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.label}
                onChange={(e) => updateField("label", e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">Total shares</label>
              <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.totalShares} onChange={(e) => updateField("totalShares", Number(e.target.value))} />
            </div>

            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">Grant date</label>
              <input type="month" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.grantMonth} onChange={(e) => updateField("grantMonth", e.target.value)} />
            </div>

            {/* RSU-specific */}
            {form.type === "rsu" && (
              <div>
                <label className="text-xs pacioli-text-muted mb-1 block">Price per share ($)</label>
                <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  value={(form as RSUGrant).pricePerShare}
                  onChange={(e) => updateField("pricePerShare", Number(e.target.value))} />
              </div>
            )}

            {/* Options-specific */}
            {(form.type === "iso" || form.type === "nso") && (
              <>
                <div>
                  <label className="text-xs pacioli-text-muted mb-1 block">Strike price ($)</label>
                  <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    value={(form as OptionGrant).strikePrice}
                    onChange={(e) => updateField("strikePrice", Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-xs pacioli-text-muted mb-1 block">Current FMV ($)</label>
                  <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    value={(form as OptionGrant).currentFMV}
                    onChange={(e) => updateField("currentFMV", Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-xs pacioli-text-muted mb-1 block">Annual FMV growth (%)</label>
                  <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    value={Math.round((form as OptionGrant).annualAppreciation * 100)}
                    onChange={(e) => updateField("annualAppreciation", Number(e.target.value) / 100)} />
                </div>
              </>
            )}

            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">Cliff (months)</label>
              <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.cliffMonths} onChange={(e) => updateField("cliffMonths", Number(e.target.value))} />
            </div>

            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">Cliff vest (%)</label>
              <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={Math.round(form.cliffFraction * 100)}
                onChange={(e) => updateField("cliffFraction", Number(e.target.value) / 100)} />
            </div>

            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">Vest frequency</label>
              <select className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.vestFrequency}
                onChange={(e) => updateField("vestFrequency", e.target.value as VestFrequency)}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>

            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">Total period (months)</label>
              <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.vestingPeriodMonths} onChange={(e) => updateField("vestingPeriodMonths", Number(e.target.value))} />
            </div>
          </div>

          {/* Preview total */}
          {(() => {
            const previewGrant = { ...form, id: "preview" } as EquityGrant;
            const events = previewGrant.type === "rsu"
              ? computeRSUSchedule(previewGrant as RSUGrant)
              : computeOptionSchedule(previewGrant as OptionGrant);
            const total = events.reduce((s, e) => s + e.valueAtVest, 0);
            const future = events.filter((e) => e.monthKey >= TODAY_MONTH).reduce((s, e) => s + e.valueAtVest, 0);
            return total > 0 ? (
              <div className="text-xs pacioli-text-muted bg-indigo-500/8 border border-indigo-500/20 rounded-lg px-3 py-2">
                Total grant value: <span className="font-semibold pacioli-text-primary">{formatCurrency(total)}</span>
                {future < total && <> · Unvested: <span className="font-semibold text-indigo-400">{formatCurrency(future)}</span></>}
              </div>
            ) : null;
          })()}

          <div className="flex gap-2 pt-1">
            <button onClick={addGrant} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors">
              Add grant
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-1.5 pacioli-bg-btn-cancel pacioli-text-primary text-xs font-medium rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-xs font-medium pacioli-accent hover:opacity-80 transition-colors"
        >
          <Plus size={13} /> Add equity grant
        </button>
      )}
    </div>
  );
}

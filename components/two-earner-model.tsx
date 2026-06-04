"use client";
/**
 * TwoEarnerModel
 *
 * Models a second income stream (partner/spouse) as scenario events.
 * Each earner's income becomes a recurring income event in the projection.
 * Supports an optional end date (e.g. parental leave, sabbatical, retirement).
 *
 * The component also lets the user model an income *change* for earner 1
 * (e.g. one partner cuts to part-time) without touching the baseline.
 */
import { useState } from "react";
import { Users, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { ScenarioEvent } from "@/lib/scenario";
import { formatCurrency } from "@/lib/data";

const TODAY_MONTH = new Date().toISOString().slice(0, 7);
const STORAGE_KEY = "pacioli-two-earner";

export interface EarnerStream {
  id: string;
  label: string;           // e.g. "Partner income", "My part-time switch"
  monthlyAmount: number;   // positive = added income, negative = income reduction
  startMonth: string;
  endMonth?: string;
  annualGrowth: number;    // e.g. 0.03 = 3%/yr
}

function load(): EarnerStream[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}

function save(streams: EarnerStream[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(streams));
}

/** Convert earner streams to ScenarioEvents for the projection engine */
export function earnerStreamsToScenarioEvents(streams: EarnerStream[]): ScenarioEvent[] {
  return streams.map((s) => ({
    id: `earner_${s.id}`,
    label: s.label,
    type: s.monthlyAmount >= 0 ? "income" : "expense",
    startMonth: s.startMonth,
    endMonth: s.endMonth,
    delta: Math.abs(s.monthlyAmount),
    recurring: true,
  }));
}

function defaultStream(): Omit<EarnerStream, "id"> {
  return {
    label: "Partner income",
    monthlyAmount: 5000,
    startMonth: TODAY_MONTH,
    endMonth: undefined,
    annualGrowth: 0.03,
  };
}

interface Props {
  onChange: () => void;
}

export default function TwoEarnerModel({ onChange }: Props) {
  const [streams, setStreams] = useState<EarnerStream[]>(() => load());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<EarnerStream, "id">>(defaultStream());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function persist(updated: EarnerStream[]) {
    setStreams(updated);
    save(updated);
    onChange();
  }

  function add() {
    const stream: EarnerStream = { ...form, id: `stream_${Date.now()}` };
    persist([...streams, stream]);
    setShowForm(false);
    setForm(defaultStream());
  }

  function remove(id: string) {
    persist(streams.filter((s) => s.id !== id));
  }

  function update(id: string, field: string, value: string | number) {
    persist(streams.map((s) => s.id === id ? { ...s, [field]: value } : s));
  }

  const totalMonthly = streams.reduce((sum, s) => sum + s.monthlyAmount, 0);

  return (
    <div className="pacioli-bg-surface rounded-2xl border p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users size={16} className="pacioli-accent" />
            <h3 className="text-sm font-semibold pacioli-text-primary">Two-Earner Household</h3>
          </div>
          <p className="text-xs pacioli-text-muted mt-0.5">
            Add a second income or model a change to your own.
          </p>
        </div>
        {totalMonthly !== 0 && (
          <div className="text-right">
            <p className="text-xs pacioli-text-muted">Net monthly impact</p>
            <p className={`text-sm font-bold ${totalMonthly >= 0 ? "pacioli-text-success" : "pacioli-text-danger"}`}>
              {totalMonthly >= 0 ? "+" : ""}{formatCurrency(totalMonthly)}/mo
            </p>
          </div>
        )}
      </div>

      {/* Stream list */}
      {streams.map((s) => {
        const isExpanded = expandedId === s.id;
        const isReduction = s.monthlyAmount < 0;
        return (
          <div key={s.id} className="pacioli-bg-surface-2 rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isReduction
                      ? "bg-red-500/15 text-red-400"
                      : "bg-emerald-500/15 text-emerald-400"
                  }`}>
                    {isReduction ? "− Income" : "+ Income"}
                  </span>
                  <span className="text-sm font-medium pacioli-text-primary">{s.label}</span>
                </div>
                <p className="text-xs pacioli-text-muted mt-0.5">
                  {formatCurrency(Math.abs(s.monthlyAmount))}/mo
                  {s.annualGrowth > 0 ? ` · ${(s.annualGrowth * 100).toFixed(0)}%/yr growth` : ""}
                  {s.endMonth ? ` · ends ${s.endMonth}` : " · ongoing"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setExpandedId(isExpanded ? null : s.id)} className="pacioli-text-muted hover:pacioli-text-primary transition-colors">
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button onClick={() => remove(s.id)} className="pacioli-text-muted hover:pacioli-text-danger transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t pacioli-border-subtle">
                <div className="col-span-2">
                  <label className="text-xs pacioli-text-muted mb-1 block">Label</label>
                  <input className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    value={s.label} onChange={(e) => update(s.id, "label", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs pacioli-text-muted mb-1 block">Monthly amount ($)</label>
                  <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    value={s.monthlyAmount} onChange={(e) => update(s.id, "monthlyAmount", Number(e.target.value))} />
                  <p className="text-xs pacioli-text-faint mt-1">Negative = income reduction (e.g. part-time switch)</p>
                </div>
                <div>
                  <label className="text-xs pacioli-text-muted mb-1 block">Annual growth (%)</label>
                  <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    value={(s.annualGrowth * 100).toFixed(0)} onChange={(e) => update(s.id, "annualGrowth", Number(e.target.value) / 100)} />
                </div>
                <div>
                  <label className="text-xs pacioli-text-muted mb-1 block">Start month</label>
                  <input type="month" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    value={s.startMonth} onChange={(e) => update(s.id, "startMonth", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs pacioli-text-muted mb-1 block">End month (optional)</label>
                  <input type="month" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    value={s.endMonth ?? ""} onChange={(e) => update(s.id, "endMonth", e.target.value || "")} />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add form */}
      {showForm ? (
        <div className="pacioli-bg-surface-2 rounded-xl border p-5 space-y-4">
          <p className="text-xs font-semibold pacioli-text-secondary">New income stream</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs pacioli-text-muted mb-1 block">Label</label>
              <input className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">Monthly amount ($)</label>
              <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.monthlyAmount} onChange={(e) => setForm((f) => ({ ...f, monthlyAmount: Number(e.target.value) }))} />
              <p className="text-xs pacioli-text-faint mt-1">Negative = income reduction</p>
            </div>
            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">Annual growth (%)</label>
              <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={(form.annualGrowth * 100).toFixed(0)} onChange={(e) => setForm((f) => ({ ...f, annualGrowth: Number(e.target.value) / 100 }))} />
            </div>
            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">Start month</label>
              <input type="month" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.startMonth} onChange={(e) => setForm((f) => ({ ...f, startMonth: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs pacioli-text-muted mb-1 block">End month (optional)</label>
              <input type="month" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={form.endMonth ?? ""} onChange={(e) => setForm((f) => ({ ...f, endMonth: e.target.value || undefined }))} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={add} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors">
              Add stream
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-1.5 pacioli-bg-btn-cancel pacioli-text-primary text-xs font-medium rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 text-xs font-medium pacioli-accent hover:opacity-80 transition-colors">
          <Plus size={13} /> Add income stream
        </button>
      )}
    </div>
  );
}

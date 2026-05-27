"use client";
import { useEffect, useState } from "react";
import { fetchJSON, formatCurrency, SinkingFund } from "@/lib/data";
import { useDemo } from "@/components/demo-provider";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";

const STORAGE_KEY = "vela-sinking-funds";
const COLORS = ["#6366f1","#10b981","#f59e0b","#f97316","#ec4899","#3b82f6","#8b5cf6","#14b8a6"];
const EMOJIS = ["✈️","🛡️","🚗","🏠","🎁","📚","💻","🌴","💍","🏋️"];

function monthsUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.max(0, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
}

function blankFund(): SinkingFund {
  return {
    id: `sf_${Date.now()}`,
    name: "New Goal",
    emoji: "🎯",
    target: 5000,
    saved: 0,
    monthly_contribution: 200,
    target_date: new Date(Date.now() + 365*24*60*60*1000*2).toISOString().slice(0,10),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

export default function SinkingFunds() {
  const { isDemo } = useDemo();
  const storageKey = isDemo ? `demo-${STORAGE_KEY}` : STORAGE_KEY;

  const [funds, setFunds] = useState<SinkingFund[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<SinkingFund | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setFunds(JSON.parse(saved));
    } else {
      fetchJSON<SinkingFund[]>("sinking_funds.json").then((f) => {
        setFunds(f);
        localStorage.setItem(storageKey, JSON.stringify(f));
      });
    }
  }, [storageKey]);

  function save(updated: SinkingFund[]) {
    setFunds(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  }

  function startEdit(f: SinkingFund) {
    setEditing(f.id);
    setDraft({ ...f });
  }

  function commitEdit() {
    if (!draft) return;
    save(funds.map((f) => f.id === draft.id ? draft : f));
    setEditing(null);
    setDraft(null);
  }

  function cancelEdit() {
    if (isAdding && draft) {
      setIsAdding(false);
    }
    setEditing(null);
    setDraft(null);
  }

  function deleteFund(id: string) {
    save(funds.filter((f) => f.id !== id));
  }

  function addFund() {
    const f = blankFund();
    const updated = [...funds, f];
    setFunds(updated);
    setEditing(f.id);
    setDraft({ ...f });
    setIsAdding(true);
  }

  function commitAdd() {
    if (!draft) return;
    save(funds.map((f) => f.id === draft.id ? draft : f));
    setEditing(null);
    setDraft(null);
    setIsAdding(false);
  }

  if (!funds.length) return <div className="vela-text-muted animate-pulse">Loading goals...</div>;

  const totalSaved = funds.reduce((s, f) => s + f.saved, 0);
  const totalTarget = funds.reduce((s, f) => s + f.target, 0);
  const totalMonthly = funds.reduce((s, f) => s + f.monthly_contribution, 0);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <p className="vela-text-muted text-sm">Named buckets, real targets, clear timelines.</p>
          <h2 className="text-3xl font-bold vela-text-primary mt-1">Achieve My Goals</h2>
        </div>
        <button
          onClick={addFund}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={15} /> Add Goal
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="vela-bg-surface rounded-2xl p-5 border">
          <p className="text-xs vela-text-muted uppercase tracking-wide mb-2">Total Saved</p>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalSaved)}</p>
        </div>
        <div className="vela-bg-surface rounded-2xl p-5 border">
          <p className="text-xs vela-text-muted uppercase tracking-wide mb-2">Total Goal</p>
          <p className="text-2xl font-bold vela-text-primary">{formatCurrency(totalTarget)}</p>
        </div>
        <div className="vela-bg-surface rounded-2xl p-5 border">
          <p className="text-xs vela-text-muted uppercase tracking-wide mb-2">Setting Aside Monthly</p>
          <p className="text-2xl font-bold text-indigo-400">{formatCurrency(totalMonthly)}</p>
        </div>
      </div>

      {/* Fund cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {funds.map((f) => {
          const isEdit = editing === f.id;
          const data = isEdit && draft ? draft : f;
          const pct = Math.min(100, Math.round((data.saved / data.target) * 100));
          const remaining = data.target - data.saved;
          const mLeft = monthsUntil(data.target_date);
          const neededPerMonth = mLeft > 0 ? Math.ceil(remaining / mLeft) : 0;
          const onTrack = neededPerMonth <= data.monthly_contribution;
          const targetDate = new Date(data.target_date).toLocaleDateString("en-US", { month: "long", year: "numeric" });

          return (
            <div key={f.id} className={`vela-bg-surface rounded-2xl p-6 border transition-all ${isEdit ? "border-indigo-600/60 ring-1 ring-indigo-600/30" : ""}`}>
              {isEdit && draft ? (
                /* ── Edit mode ── */
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs vela-text-muted mb-1 block">Goal name</label>
                      <input
                        className="w-full vela-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      />
                    </div>
                    <div className="w-20">
                      <label className="text-xs vela-text-muted mb-1 block">Emoji</label>
                      <select
                        className="w-full vela-bg-input border rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        value={draft.emoji}
                        onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
                      >
                        {EMOJIS.map((e) => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs vela-text-muted mb-1 block">Target amount ($)</label>
                      <input type="number" className="w-full vela-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        value={draft.target} onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-xs vela-text-muted mb-1 block">Already saved ($)</label>
                      <input type="number" className="w-full vela-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        value={draft.saved} onChange={(e) => setDraft({ ...draft, saved: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-xs vela-text-muted mb-1 block">Monthly contribution ($)</label>
                      <input type="number" className="w-full vela-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        value={draft.monthly_contribution} onChange={(e) => setDraft({ ...draft, monthly_contribution: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-xs vela-text-muted mb-1 block">Target date</label>
                      <input type="date" className="w-full vela-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        value={draft.target_date.slice(0,10)} onChange={(e) => setDraft({ ...draft, target_date: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs vela-text-muted mb-2 block">Color</label>
                    <div className="flex gap-2">
                      {COLORS.map((c) => (
                        <button key={c} onClick={() => setDraft({ ...draft, color: c })}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${draft.color === c ? "border-indigo-500 scale-110" : "border-transparent"}`}
                          style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={isAdding ? commitAdd : commitEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors">
                      <Check size={13} /> Save
                    </button>
                    <button onClick={cancelEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 vela-bg-btn-cancel vela-text-primary text-xs font-medium rounded-lg transition-colors">
                      <X size={13} /> Cancel
                    </button>
                    {!isAdding && (
                      <button onClick={() => { cancelEdit(); deleteFund(f.id); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 vela-alert-danger border hover:opacity-80 vela-text-danger text-xs font-medium rounded-lg transition-colors ml-auto">
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-2xl">{data.emoji}</span>
                      <h3 className="text-lg font-bold vela-text-primary mt-1">{data.name}</h3>
                      <p className="text-xs vela-text-muted">Target: {targetDate} · {mLeft} months away</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${onTrack ? "vela-badge-success" : "vela-badge-danger"}`}>
                        {onTrack ? "On track ✓" : "Behind ↑"}
                      </span>
                      <button onClick={() => startEdit(f)} className="p-1.5 vela-text-muted hover:vela-text-primary vela-bg-nav-hover rounded-lg transition-all">
                        <Pencil size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="vela-text-secondary">{formatCurrency(data.saved)} saved</span>
                      <span className="vela-text-muted">{pct}% of {formatCurrency(data.target)}</span>
                    </div>
                    <div className="w-full h-3 vela-bar-track rounded-full overflow-hidden">
                      <div className="h-3 rounded-full transition-all" style={{ width: `${pct}%`, background: data.color }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <Stat label="Remaining" value={formatCurrency(remaining)} />
                    <Stat label="Contributing" value={`${formatCurrency(data.monthly_contribution)}/mo`} />
                    <Stat label="Need / mo" value={neededPerMonth > 0 ? `${formatCurrency(neededPerMonth)}/mo` : "Done!"} highlight={!onTrack ? "vela-text-warning" : undefined} />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="vela-bg-surface-2 rounded-lg p-3">
      <p className="text-xs vela-text-muted mb-1">{label}</p>
      <p className={`text-sm font-semibold ${highlight ?? "vela-text-primary"}`}>{value}</p>
    </div>
  );
}

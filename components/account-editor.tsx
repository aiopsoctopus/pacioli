"use client";
/**
 * AccountEditor
 *
 * Lets users add, edit, and delete accounts without a CSV import.
 * Works for both demo mode (overlays edits on top of static JSON) and
 * real users (manual accounts are the sole source of truth).
 *
 * Props:
 *   accounts  — current merged AccountData
 *   onChange  — called with the new full AccountData after any change
 */
import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { Account, AccountData, formatCurrency } from "@/lib/data";

const ASSET_TYPES = [
  { value: "checking",   label: "Cash & Checking" },
  { value: "savings",    label: "Savings" },
  { value: "investment", label: "Investments" },
  { value: "property",   label: "Real Estate" },
  { value: "vehicle",    label: "Vehicle" },
  { value: "other",      label: "Other Asset" },
];

const LIABILITY_TYPES = [
  { value: "mortgage",   label: "Mortgage" },
  { value: "auto_loan",  label: "Auto Loan" },
  { value: "student_loan", label: "Student Loan" },
  { value: "credit_card", label: "Credit Card" },
  { value: "other",      label: "Other Liability" },
];

const TYPE_COLORS: Record<string, string> = {
  checking:    "#06b6d4",
  savings:     "#10b981",
  investment:  "#6366f1",
  property:    "#f59e0b",
  vehicle:     "#8b5cf6",
  mortgage:    "#ef4444",
  auto_loan:   "#f97316",
  student_loan:"#ec4899",
  credit_card: "#dc2626",
  other:       "#71717a",
};

function blankAccount(side: "asset" | "liability"): Omit<Account, "id"> & { side: "asset" | "liability" } {
  const today = new Date().toISOString().slice(0, 7);
  return {
    name: "",
    institution: "",
    type: side === "asset" ? "checking" : "mortgage",
    balances: { [today]: 0 },
    side,
  };
}

interface AccountWithSide extends Account {
  side: "asset" | "liability";
}

interface Props {
  accounts: AccountData;
  onChange: (updated: AccountData) => void;
}

export default function AccountEditor({ accounts, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<AccountWithSide | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const today = new Date().toISOString().slice(0, 7);

  // Flatten both sides into one list for display
  const allAccounts: AccountWithSide[] = [
    ...accounts.assets.map(a => ({ ...a, side: "asset" as const })),
    ...accounts.liabilities.map(a => ({ ...a, side: "liability" as const })),
  ];

  function startEdit(acc: AccountWithSide) {
    setEditing(acc.id);
    setDraft({ ...acc, balances: { ...acc.balances } });
    setIsAdding(false);
  }

  function startAdd(side: "asset" | "liability") {
    const id = `manual_${Date.now()}`;
    const blank: AccountWithSide = { id, ...blankAccount(side) };
    setDraft(blank);
    setEditing(id);
    setIsAdding(true);
  }

  function commit() {
    if (!draft) return;
    const updated = applyDraft(accounts, draft);
    onChange(updated);
    setEditing(null);
    setDraft(null);
    setIsAdding(false);
  }

  function cancel() {
    setEditing(null);
    setDraft(null);
    setIsAdding(false);
  }

  function deleteAccount(acc: AccountWithSide) {
    const updated: AccountData = {
      assets:      acc.side === "asset"
        ? accounts.assets.filter(a => a.id !== acc.id)
        : accounts.assets,
      liabilities: acc.side === "liability"
        ? accounts.liabilities.filter(a => a.id !== acc.id)
        : accounts.liabilities,
    };
    onChange(updated);
  }

  function updateDraftBalance(value: string) {
    if (!draft) return;
    const num = parseFloat(value.replace(/,/g, "")) || 0;
    setDraft({ ...draft, balances: { ...draft.balances, [today]: num } });
  }

  const types = draft?.side === "liability" ? LIABILITY_TYPES : ASSET_TYPES;
  const currentBalance = draft ? (draft.balances[today] ?? Object.values(draft.balances).at(-1) ?? 0) : 0;

  return (
    <div className="pacioli-bg-surface rounded-2xl border">
      {/* Header toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:opacity-90 transition-opacity"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold pacioli-text-secondary">Edit Accounts</span>
          <span className="text-xs pacioli-text-muted">· {allAccounts.length} accounts</span>
        </div>
        {open ? <ChevronUp size={14} className="pacioli-text-muted" /> : <ChevronDown size={14} className="pacioli-text-muted" />}
      </button>

      {open && (
        <div className="border-t pacioli-border px-5 pb-5 space-y-5 pt-4">
          {/* Account list */}
          {allAccounts.length > 0 && (
            <div className="space-y-2">
              {allAccounts.map(acc => {
                const isEdit = editing === acc.id;
                const bal = acc.balances[today] ?? Object.values(acc.balances).at(-1) ?? 0;
                const color = TYPE_COLORS[acc.type] ?? "#71717a";

                if (isEdit && draft) {
                  return (
                    <div key={acc.id} className="pacioli-bg-surface-2 rounded-xl border border-teal-600/40 p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs pacioli-text-muted mb-1 block">Account name</label>
                          <input
                            className="w-full pacioli-bg-input border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal-600"
                            value={draft.name}
                            onChange={e => setDraft({ ...draft, name: e.target.value })}
                            placeholder="e.g. Vanguard Brokerage"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="text-xs pacioli-text-muted mb-1 block">Institution (optional)</label>
                          <input
                            className="w-full pacioli-bg-input border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal-600"
                            value={draft.institution ?? ""}
                            onChange={e => setDraft({ ...draft, institution: e.target.value })}
                            placeholder="e.g. Vanguard"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs pacioli-text-muted mb-1 block">Type</label>
                          <select
                            className="w-full pacioli-bg-input border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal-600"
                            value={draft.type}
                            onChange={e => setDraft({ ...draft, type: e.target.value })}
                          >
                            {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs pacioli-text-muted mb-1 block">Current balance</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pacioli-text-muted">$</span>
                            <input
                              className="w-full pacioli-bg-input border rounded-lg pl-6 pr-3 py-1.5 text-sm focus:outline-none focus:border-teal-600"
                              type="number"
                              min="0"
                              step="1"
                              value={currentBalance || ""}
                              onChange={e => updateDraftBalance(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={cancel} className="flex items-center gap-1.5 px-3 py-1.5 text-xs pacioli-text-muted hover:pacioli-text-primary border rounded-lg transition-colors">
                          <X size={12} /> Cancel
                        </button>
                        <button
                          onClick={commit}
                          disabled={!draft.name.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white rounded-lg transition-colors disabled:opacity-40"
                          style={{ background: "#0d6e6e" }}
                        >
                          <Check size={12} /> Save
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={acc.id} className="flex items-center justify-between pacioli-bg-surface-2 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium pacioli-text-primary truncate">{acc.name}</p>
                        {acc.institution && <p className="text-xs pacioli-text-muted truncate">{acc.institution}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-sm font-semibold ${acc.side === "liability" ? "pacioli-text-danger" : "pacioli-text-primary"}`}>
                        {acc.side === "liability" ? "−" : ""}{formatCurrency(bal)}
                      </span>
                      <button onClick={() => startEdit(acc)} className="p-1.5 pacioli-text-muted hover:pacioli-text-primary rounded-lg transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => deleteAccount(acc)} className="p-1.5 pacioli-text-muted hover:pacioli-text-danger rounded-lg transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add new account inline form */}
          {isAdding && draft && (
            <div className="pacioli-bg-surface-2 rounded-xl border border-teal-600/40 p-4 space-y-3">
              <p className="text-xs font-semibold pacioli-text-secondary">
                New {draft.side === "liability" ? "Liability" : "Asset"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs pacioli-text-muted mb-1 block">Account name</label>
                  <input
                    className="w-full pacioli-bg-input border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal-600"
                    value={draft.name}
                    onChange={e => setDraft({ ...draft, name: e.target.value })}
                    placeholder="e.g. Vanguard Brokerage"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs pacioli-text-muted mb-1 block">Institution (optional)</label>
                  <input
                    className="w-full pacioli-bg-input border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal-600"
                    value={draft.institution ?? ""}
                    onChange={e => setDraft({ ...draft, institution: e.target.value })}
                    placeholder="e.g. Vanguard"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs pacioli-text-muted mb-1 block">Type</label>
                  <select
                    className="w-full pacioli-bg-input border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal-600"
                    value={draft.type}
                    onChange={e => setDraft({ ...draft, type: e.target.value })}
                  >
                    {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs pacioli-text-muted mb-1 block">Current balance</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pacioli-text-muted">$</span>
                    <input
                      className="w-full pacioli-bg-input border rounded-lg pl-6 pr-3 py-1.5 text-sm focus:outline-none focus:border-teal-600"
                      type="number"
                      min="0"
                      step="1"
                      value={currentBalance || ""}
                      onChange={e => updateDraftBalance(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={cancel} className="flex items-center gap-1.5 px-3 py-1.5 text-xs pacioli-text-muted hover:pacioli-text-primary border rounded-lg transition-colors">
                  <X size={12} /> Cancel
                </button>
                <button
                  onClick={commit}
                  disabled={!draft.name.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white rounded-lg transition-colors disabled:opacity-40"
                  style={{ background: "#0d6e6e" }}
                >
                  <Check size={12} /> Add account
                </button>
              </div>
            </div>
          )}

          {/* Add buttons */}
          {!isAdding && (
            <div className="flex gap-2">
              <button
                onClick={() => startAdd("asset")}
                className="flex items-center gap-1.5 px-3 py-2 text-xs pacioli-text-muted hover:pacioli-text-primary border rounded-lg transition-colors"
              >
                <Plus size={13} /> Add asset
              </button>
              <button
                onClick={() => startAdd("liability")}
                className="flex items-center gap-1.5 px-3 py-2 text-xs pacioli-text-muted hover:pacioli-text-danger border rounded-lg transition-colors"
              >
                <Plus size={13} /> Add liability
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helper: apply a draft edit back into AccountData ─────────────────────────
function applyDraft(accounts: AccountData, draft: Account & { side: "asset" | "liability" }): AccountData {
  const { side, ...account } = draft;

  function upsert(list: Account[]): Account[] {
    const exists = list.some(a => a.id === account.id);
    if (exists) return list.map(a => a.id === account.id ? account : a);
    return [...list, account];
  }

  if (side === "asset") {
    return { ...accounts, assets: upsert(accounts.assets) };
  } else {
    return { ...accounts, liabilities: upsert(accounts.liabilities) };
  }
}

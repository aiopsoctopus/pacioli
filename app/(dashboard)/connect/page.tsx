"use client";
import { useState, useRef } from "react";
import { Upload, Landmark, FileText, CheckCircle2, AlertCircle, Plus, Trash2, FlaskConical, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/data";
import { useDemo } from "@/components/demo-provider";

const MANUAL_ACCOUNTS_KEY = "vela-manual-accounts";

interface ManualAccount {
  id: string;
  name: string;
  type: "asset" | "liability";
  balance: number;
  institution: string;
}

interface ParsedTransaction {
  date: string;
  merchant: string;
  amount: number;
  category: string;
}

function parseCSV(text: string): ParsedTransaction[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().replace(/"/g, "");
  const cols = header.split(",");

  // Try to detect common bank CSV column names
  const dateIdx = cols.findIndex((c) => c.includes("date"));
  const descIdx = cols.findIndex((c) => c.includes("desc") || c.includes("name") || c.includes("merchant") || c.includes("payee"));
  const amtIdx = cols.findIndex((c) => c.includes("amount") || c.includes("debit") || c.includes("credit"));

  if (dateIdx < 0 || amtIdx < 0) return [];

  return lines.slice(1).map((line) => {
    const parts = line.replace(/"/g, "").split(",");
    const raw = parseFloat(parts[amtIdx]?.replace(/[$,]/g, "") ?? "0");
    return {
      date: parts[dateIdx]?.trim() ?? "",
      merchant: parts[descIdx]?.trim() ?? "Unknown",
      amount: Math.abs(raw),
      category: "Uncategorized",
    };
  }).filter((t) => t.date && !isNaN(t.amount) && t.amount > 0);
}

export default function ConnectPage() {
  const { isDemo, enterDemo, exitDemo } = useDemo();
  const [csvResult, setCsvResult] = useState<{ count: number; preview: ParsedTransaction[] } | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [manualAccounts, setManualAccounts] = useState<ManualAccount[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem(MANUAL_ACCOUNTS_KEY);
    return saved ? JSON.parse(saved) : [
      { id: "ma1", name: "Primary Home", type: "asset", balance: 520000, institution: "Manual" },
      { id: "ma2", name: "2022 Honda CR-V", type: "asset", balance: 24000, institution: "Manual" },
    ];
  });

  const [newAccount, setNewAccount] = useState<Omit<ManualAccount, "id">>({
    name: "", type: "asset", balance: 0, institution: "",
  });
  const [showAddForm, setShowAddForm] = useState(false);

  function saveAccounts(updated: ManualAccount[]) {
    setManualAccounts(updated);
    localStorage.setItem(MANUAL_ACCOUNTS_KEY, JSON.stringify(updated));
  }

  function addAccount() {
    if (!newAccount.name) return;
    const updated = [...manualAccounts, { ...newAccount, id: `ma_${Date.now()}` }];
    saveAccounts(updated);
    setNewAccount({ name: "", type: "asset", balance: 0, institution: "" });
    setShowAddForm(false);
  }

  function deleteAccount(id: string) {
    saveAccounts(manualAccounts.filter((a) => a.id !== id));
  }

  function updateBalance(id: string, balance: number) {
    saveAccounts(manualAccounts.map((a) => a.id === id ? { ...a, balance } : a));
  }

  function handleFile(file: File) {
    setCsvError(null);
    setCsvResult(null);
    if (!file.name.endsWith(".csv")) {
      setCsvError("Please upload a .csv file. Most banks let you export transactions as CSV.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        setCsvError("Couldn't parse this CSV. Make sure it has Date, Description, and Amount columns. Try exporting directly from your bank's website.");
        return;
      }
      setCsvResult({ count: parsed.length, preview: parsed.slice(0, 5) });
      // In a real app, we'd merge these into the transactions store here
      localStorage.setItem("vela-imported-transactions", JSON.stringify(parsed));
    };
    reader.readAsText(file);
  }

  const assets = manualAccounts.filter((a) => a.type === "asset");
  const liabilities = manualAccounts.filter((a) => a.type === "liability");
  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-8">
      <div>
        <p className="vela-text-muted text-sm">Get your real numbers in.</p>
        <h2 className="text-3xl font-bold vela-text-primary mt-1">Connect Data</h2>
      </div>

      {/* Demo mode toggle */}
      <div className={`rounded-2xl p-6 border flex items-center justify-between gap-6 ${
        isDemo
          ? "bg-indigo-950/30 border-indigo-700/40"
          : "vela-bg-surface"
      }`}>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isDemo ? "bg-indigo-600" : "vela-bg-surface-2"
          }`}>
            <FlaskConical size={18} className={isDemo ? "text-white" : "vela-text-muted"} />
          </div>
          <div>
            <p className="text-sm font-semibold vela-text-primary">
              {isDemo ? "Sandbox / Demo mode is ON" : "Try the sandbox first"}
            </p>
            <p className="text-xs vela-text-muted mt-1 max-w-md">
              {isDemo
                ? "You're exploring with fictional sample data. Any changes you make (goals, rules, budgets) are sandboxed and won't affect your real data. Share this experience with others using the ?demo=true URL."
                : "Explore Vela with realistic sample data before connecting your own accounts. Nothing is real — income, transactions, and balances are all fictional."}
            </p>
            {isDemo && (
              <p className="text-xs text-indigo-400 mt-2 font-medium flex items-center gap-1">
                Shareable link: <span className="font-mono">{typeof window !== "undefined" ? window.location.origin : ""}/?demo=true</span>
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0">
          {isDemo ? (
            <button
              onClick={exitDemo}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Use my own data <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={enterDemo}
              className="flex items-center gap-2 px-4 py-2 vela-bg-surface-2 border vela-text-primary text-sm font-medium rounded-xl hover:border-indigo-500/50 transition-colors"
            >
              <FlaskConical size={14} />
              Enter sandbox
            </button>
          )}
        </div>
      </div>

      {/* Three connection options */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* CSV Upload */}
        <div className="vela-bg-surface rounded-2xl p-6 border xl:col-span-2">
          <div className="flex items-center gap-3 mb-1">
            <FileText size={18} className="text-indigo-400" />
            <h3 className="text-sm font-semibold vela-text-primary">Upload Bank CSV</h3>
          </div>
          <p className="text-xs vela-text-muted mb-5">
            Export transactions from your bank's website and drop the CSV here. Works with Chase, BofA, Wells Fargo, Amex, and most other banks.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-indigo-500 bg-indigo-900/20"
                : "vela-border hover:bg-zinc-500/10"
            }`}
          >
            <Upload size={24} className="mx-auto mb-3 vela-text-muted" />
            <p className="text-sm vela-text-secondary font-medium">Drop your CSV here or click to browse</p>
            <p className="text-xs vela-text-faint mt-1">Most banks: Accounts → Download → CSV or Spreadsheet</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          </div>

          {/* Result */}
          {csvError && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-red-900/20 border border-red-800/40 rounded-lg">
              <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-300">{csvError}</p>
            </div>
          )}
          {csvResult && (
            <div className="mt-4 p-4 bg-emerald-900/20 border border-emerald-800/40 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={15} className="text-emerald-400" />
                <p className="text-sm font-medium text-emerald-300">{csvResult.count} transactions imported successfully</p>
              </div>
              <p className="text-xs vela-text-muted mb-2">Preview (first 5):</p>
              <div className="space-y-1.5">
                {csvResult.preview.map((tx, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="vela-text-secondary">{tx.date} · {tx.merchant}</span>
                    <span className="vela-text-primary font-medium">{formatCurrency(tx.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Plaid (coming soon) */}
        <div className="vela-bg-surface rounded-2xl p-6 border flex flex-col">
          <div className="flex items-center gap-3 mb-1">
            <Landmark size={18} className="vela-text-muted" />
            <h3 className="text-sm font-semibold vela-text-primary">Live Bank Connection</h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 vela-bg-chip vela-text-muted rounded-full">Soon</span>
          </div>
          <p className="text-xs vela-text-muted mb-4 flex-1">
            Automatic transaction sync via Plaid — connects to 12,000+ banks and updates daily. No more manual exports.
          </p>
          <div className="space-y-2 text-xs vela-text-muted">
            <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full vela-bar-track inline-block" />Chase, BofA, Wells Fargo</p>
            <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full vela-bar-track inline-block" />Amex, Citi, Capital One</p>
            <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full vela-bar-track inline-block" />Fidelity, Vanguard, Schwab</p>
          </div>
          <button disabled className="mt-5 w-full py-2 text-sm font-medium vela-text-muted vela-bg-surface-2 border vela-border rounded-lg cursor-not-allowed">
            Connect a Bank
          </button>
        </div>
      </div>

      {/* Manual account balances */}
      <div className="vela-bg-surface rounded-2xl p-6 border">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-sm font-semibold vela-text-primary">Manual Account Balances</h3>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <Plus size={13} /> Add account
          </button>
        </div>
        <p className="text-xs vela-text-muted mb-5">
          For accounts that can't be linked — home value, cars, investment accounts at unlisted institutions. These feed into your net worth calculation.
        </p>

        {/* Add form */}
        {showAddForm && (
          <div className="mb-5 p-4 vela-bg-surface-2 rounded-xl border vela-border space-y-3">
            <p className="text-xs font-semibold vela-text-secondary">New account</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs vela-text-muted mb-1 block">Name</label>
                <input className="w-full vela-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Primary Home" value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs vela-text-muted mb-1 block">Institution</label>
                <input className="w-full vela-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Manual / Zillow" value={newAccount.institution}
                  onChange={(e) => setNewAccount({ ...newAccount, institution: e.target.value })} />
              </div>
              <div>
                <label className="text-xs vela-text-muted mb-1 block">Type</label>
                <select className="w-full vela-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  value={newAccount.type} onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value as "asset" | "liability" })}>
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                </select>
              </div>
              <div>
                <label className="text-xs vela-text-muted mb-1 block">Current balance ($)</label>
                <input type="number" className="w-full vela-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  value={newAccount.balance} onChange={(e) => setNewAccount({ ...newAccount, balance: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={addAccount} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors">Save</button>
              <button onClick={() => setShowAddForm(false)} className="px-4 py-1.5 vela-bg-btn-cancel vela-text-primary text-xs font-medium rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {/* Account list */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {[
            { title: "Assets", accounts: assets, total: totalAssets, color: "text-emerald-400", bar: "#34d399" },
            { title: "Liabilities", accounts: liabilities, total: totalLiabilities, color: "text-red-400", bar: "#f87171" },
          ].map(({ title, accounts, total, color, bar }) => (
            <div key={title}>
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-semibold vela-text-muted uppercase tracking-wide">{title}</p>
                <span className={`text-sm font-bold ${color}`}>{formatCurrency(total)}</span>
              </div>
              {accounts.length === 0 && (
                <p className="text-xs vela-text-faint italic">No {title.toLowerCase()} added yet.</p>
              )}
              <div className="space-y-3">
                {accounts.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 group">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="vela-text-secondary">{a.name}</span>
                      </div>
                      {a.institution && <p className="text-xs vela-text-faint">{a.institution}</p>}
                    </div>
                    <input
                      type="number"
                      className="w-32 vela-bg-input border rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:border-indigo-500"
                      value={a.balance}
                      onChange={(e) => updateBalance(a.id, Number(e.target.value))}
                    />
                    <button onClick={() => deleteAccount(a.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 vela-text-muted hover:text-red-400 transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs vela-text-faint mt-6">
          Balances are saved in your browser. When you connect Plaid, linked accounts will automatically update — only manual entries stay here.
        </p>
      </div>
    </div>
  );
}

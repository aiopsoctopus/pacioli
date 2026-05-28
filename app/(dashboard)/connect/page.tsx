"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Landmark, FileText, CheckCircle2, AlertCircle, Plus, Trash2, FlaskConical, ArrowRight, Tag } from "lucide-react";
import { formatCurrency, IMPORTED_KEY } from "@/lib/data";
import { useDemo } from "@/components/demo-provider";

const MANUAL_ACCOUNTS_KEY = "pacioli-manual-accounts";

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
  const [csvResult, setCsvResult] = useState<{ count: number; uncategorized: number; preview: ParsedTransaction[] } | null>(null);
  const router = useRouter();
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [manualAccounts, setManualAccounts] = useState<ManualAccount[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem(MANUAL_ACCOUNTS_KEY);
    return saved ? JSON.parse(saved) : [];
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
      const uncategorized = parsed.filter((t) => t.category === "Uncategorized").length;
      setCsvResult({ count: parsed.length, uncategorized, preview: parsed.slice(0, 5) });
      localStorage.setItem(IMPORTED_KEY, JSON.stringify(parsed));
      // Signal to Cash Flow that there are uncategorized items to review
      if (uncategorized > 0) sessionStorage.setItem("pacioli-review-uncategorized", "1");
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
        <p className="pacioli-text-muted text-sm">Get your real numbers in.</p>
        <h2 className="text-3xl font-bold pacioli-text-primary mt-1">Connect Data</h2>
      </div>

      {/* Demo mode toggle */}
      <div className={`rounded-2xl p-6 border flex items-center justify-between gap-6 ${
        isDemo
          ? "bg-indigo-950/30 border-indigo-700/40"
          : "pacioli-bg-surface"
      }`}>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isDemo ? "bg-indigo-600" : "pacioli-bg-surface-2"
          }`}>
            <FlaskConical size={18} className={isDemo ? "text-white" : "pacioli-text-muted"} />
          </div>
          <div>
            <p className="text-sm font-semibold pacioli-text-primary">
              {isDemo ? "Sandbox / Demo mode is ON" : "Try the sandbox first"}
            </p>
            <p className="text-xs pacioli-text-muted mt-1 max-w-md">
              {isDemo
                ? "You're exploring with fictional sample data. Any changes you make (goals, rules, budgets) are sandboxed and won't affect your real data. Share this experience with others using the ?demo=true URL."
                : "Explore Pacioli with realistic sample data before connecting your own accounts. Nothing is real — income, transactions, and balances are all fictional."}
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
              className="flex items-center gap-2 px-4 py-2 pacioli-bg-surface-2 border pacioli-text-primary text-sm font-medium rounded-xl hover:border-indigo-500/50 transition-colors"
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
        <div className="pacioli-bg-surface rounded-2xl p-6 border xl:col-span-2">
          <div className="flex items-center gap-3 mb-1">
            <FileText size={18} className="text-indigo-400" />
            <h3 className="text-sm font-semibold pacioli-text-primary">Upload Bank CSV</h3>
          </div>
          <p className="text-xs pacioli-text-muted mb-5">
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
                : "pacioli-border hover:bg-zinc-500/10"
            }`}
          >
            <Upload size={24} className="mx-auto mb-3 pacioli-text-muted" />
            <p className="text-sm pacioli-text-secondary font-medium">Drop your CSV here or click to browse</p>
            <p className="text-xs pacioli-text-faint mt-1">Most banks: Accounts → Download → CSV or Spreadsheet</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          </div>

          {/* Result */}
          {csvError && (
            <div className="mt-4 flex items-start gap-2 p-3 pacioli-alert-danger border rounded-lg">
              <AlertCircle size={15} className="pacioli-text-danger mt-0.5 shrink-0" />
              <p className="text-xs pacioli-text-danger">{csvError}</p>
            </div>
          )}
          {csvResult && (
            <div className="mt-4 p-4 pacioli-alert-success border rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="pacioli-text-success shrink-0" />
                <p className="text-sm font-medium pacioli-text-success">
                  {csvResult.count} transaction{csvResult.count !== 1 ? "s" : ""} imported
                </p>
              </div>

              {/* Uncategorized prompt */}
              {csvResult.uncategorized > 0 && (
                <div className="flex items-center justify-between gap-3 px-3 py-2.5 pacioli-alert-warning border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Tag size={13} className="pacioli-text-warning shrink-0" />
                    <p className="text-xs pacioli-text-warning">
                      <span className="font-semibold">{csvResult.uncategorized}</span> transaction{csvResult.uncategorized !== 1 ? "s" : ""} need a category
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/cash-flow")}
                    className="flex items-center gap-1 text-xs font-semibold pacioli-text-warning hover:opacity-80 transition-opacity shrink-0"
                  >
                    Review now <ArrowRight size={12} />
                  </button>
                </div>
              )}

              {csvResult.uncategorized === 0 && (
                <p className="text-xs pacioli-text-success opacity-70">All transactions were auto-categorized.</p>
              )}

              <div>
                <p className="text-xs pacioli-text-muted mb-1.5">Preview (first 5):</p>
                <div className="space-y-1.5">
                  {csvResult.preview.map((tx, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="pacioli-text-secondary">{tx.date} · {tx.merchant}</span>
                      <span className="pacioli-text-primary font-medium">{formatCurrency(tx.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Plaid (coming soon) */}
        <div className="pacioli-bg-surface rounded-2xl p-6 border flex flex-col">
          <div className="flex items-center gap-3 mb-1">
            <Landmark size={18} className="pacioli-text-muted" />
            <h3 className="text-sm font-semibold pacioli-text-primary">Live Bank Connection</h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 pacioli-bg-chip pacioli-text-muted rounded-full">Soon</span>
          </div>
          <p className="text-xs pacioli-text-muted mb-4 flex-1">
            Automatic transaction sync via Plaid — connects to 12,000+ banks and updates daily. No more manual exports.
          </p>
          <div className="space-y-2 text-xs pacioli-text-muted">
            <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full pacioli-bar-track inline-block" />Chase, BofA, Wells Fargo</p>
            <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full pacioli-bar-track inline-block" />Amex, Citi, Capital One</p>
            <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full pacioli-bar-track inline-block" />Fidelity, Vanguard, Schwab</p>
          </div>
          <button disabled className="mt-5 w-full py-2 text-sm font-medium pacioli-text-muted pacioli-bg-surface-2 border pacioli-border rounded-lg cursor-not-allowed">
            Connect a Bank
          </button>
        </div>
      </div>

      {/* Manual account balances */}
      <div className="pacioli-bg-surface rounded-2xl p-6 border">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-sm font-semibold pacioli-text-primary">Manual Account Balances</h3>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <Plus size={13} /> Add account
          </button>
        </div>
        <p className="text-xs pacioli-text-muted mb-5">
          For accounts that can't be linked — home value, cars, investment accounts at unlisted institutions. These feed into your net worth calculation.
        </p>

        {/* Add form */}
        {showAddForm && (
          <div className="mb-5 p-4 pacioli-bg-surface-2 rounded-xl border pacioli-border space-y-3">
            <p className="text-xs font-semibold pacioli-text-secondary">New account</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs pacioli-text-muted mb-1 block">Name</label>
                <input className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Primary Home" value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs pacioli-text-muted mb-1 block">Institution</label>
                <input className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Manual / Zillow" value={newAccount.institution}
                  onChange={(e) => setNewAccount({ ...newAccount, institution: e.target.value })} />
              </div>
              <div>
                <label className="text-xs pacioli-text-muted mb-1 block">Type</label>
                <select className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  value={newAccount.type} onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value as "asset" | "liability" })}>
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                </select>
              </div>
              <div>
                <label className="text-xs pacioli-text-muted mb-1 block">Current balance ($)</label>
                <input type="number" className="w-full pacioli-bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  value={newAccount.balance} onChange={(e) => setNewAccount({ ...newAccount, balance: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={addAccount} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors">Save</button>
              <button onClick={() => setShowAddForm(false)} className="px-4 py-1.5 pacioli-bg-btn-cancel pacioli-text-primary text-xs font-medium rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {/* Account list */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {[
            { title: "Assets", accounts: assets, total: totalAssets, colorClass: "pacioli-text-success" },
            { title: "Liabilities", accounts: liabilities, total: totalLiabilities, colorClass: "pacioli-text-danger" },
          ].map(({ title, accounts, total, colorClass }) => (
            <div key={title}>
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-semibold pacioli-text-muted uppercase tracking-wide">{title}</p>
                <span className={`text-sm font-bold ${colorClass}`}>{formatCurrency(total)}</span>
              </div>
              {accounts.length === 0 && (
                <p className="text-xs pacioli-text-faint italic">No {title.toLowerCase()} added yet.</p>
              )}
              <div className="space-y-3">
                {accounts.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 group">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="pacioli-text-secondary">{a.name}</span>
                      </div>
                      {a.institution && <p className="text-xs pacioli-text-faint">{a.institution}</p>}
                    </div>
                    <input
                      type="number"
                      className="w-32 pacioli-bg-input border rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:border-indigo-500"
                      value={a.balance}
                      onChange={(e) => updateBalance(a.id, Number(e.target.value))}
                    />
                    <button onClick={() => deleteAccount(a.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 pacioli-text-muted hover:pacioli-text-danger transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs pacioli-text-faint mt-6">
          Balances are saved in your browser. When you connect Plaid, linked accounts will automatically update — only manual entries stay here.
        </p>
      </div>
    </div>
  );
}

"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle2, AlertCircle, FlaskConical, ArrowRight, Tag, Download, FolderOpen } from "lucide-react";
import { formatCurrency, IMPORTED_KEY } from "@/lib/data";
import { useDemo } from "@/components/demo-provider";
import PlaidLinkButton from "@/components/plaid-link-button";

const MANUAL_ACCOUNTS_KEY = "pacioli-manual-accounts";

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

  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");
  const [importError, setImportError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // All the localStorage keys that make up a user's Pacioli data
  const EXPORT_KEYS = [
    "pacioli-imported-transactions",
    "pacioli-category-rules",
    "pacioli-tx-overrides",
    "pacioli-budget-envelopes",
    "pacioli-sinking-funds",
    MANUAL_ACCOUNTS_KEY,
    "pacioli-scenario-events",
    "pacioli-scenario-delta",
    "pacioli-setup-complete",
    "hfos-theme",
  ];

  function exportData() {
    const snapshot: Record<string, unknown> = {
      _version: 1,
      _exportedAt: new Date().toISOString(),
    };
    for (const key of EXPORT_KEYS) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        try { snapshot[key] = JSON.parse(val); }
        catch { snapshot[key] = val; }
      }
    }
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pacioli-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(file: File) {
    setImportStatus("idle");
    setImportError(null);
    if (!file.name.endsWith(".json")) {
      setImportStatus("error");
      setImportError("Please upload a Pacioli backup .json file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data._version) throw new Error("Not a valid Pacioli backup file.");
        let restored = 0;
        for (const key of EXPORT_KEYS) {
          if (key in data && key !== "_version" && key !== "_exportedAt") {
            localStorage.setItem(key, JSON.stringify(data[key]));
            restored++;
          }
        }
        setImportStatus("success");
        // Brief delay then reload so all hooks re-init from the restored data
        setTimeout(() => window.location.reload(), 1200);
      } catch (err) {
        setImportStatus("error");
        setImportError(err instanceof Error ? err.message : "Could not read backup file.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="pacioli-text-muted text-sm">Get your real numbers in.</p>
        <h2 className="text-3xl font-bold pacioli-text-primary mt-1">Connect Data</h2>
      </div>

      {/* Demo mode toggle */}
      <div className={`rounded-2xl p-6 border flex items-center justify-between gap-6 ${
        isDemo
          ? "pacioli-bg-surface-2 pacioli-border"
          : "pacioli-bg-surface"
      }`}>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isDemo ? "bg-teal-700" : "pacioli-bg-surface-2"
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
              <p className="text-xs pacioli-accent mt-2 font-medium flex items-center gap-1">
                Shareable link: <span className="font-mono">{typeof window !== "undefined" ? window.location.origin : ""}/?demo=true</span>
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0">
          {isDemo ? (
            <button
              onClick={exitDemo}
              className="flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Use my own data <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={enterDemo}
              className="flex items-center gap-2 px-4 py-2 pacioli-bg-surface-2 border pacioli-text-primary text-sm font-medium rounded-xl hover:border-teal-600/50 transition-colors"
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
            <FileText size={18} className="pacioli-accent" />
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
                : "pacioli-border pacioli-bg-nav-hover"
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

        {/* Plaid live connection */}
        <PlaidLinkButton />
      </div>

      {/* Manual account balances — now lives on Net Worth page */}
      <div className="pacioli-bg-surface rounded-2xl p-5 border flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold pacioli-text-primary mb-0.5">Manual Account Balances</h3>
          <p className="text-xs pacioli-text-muted">
            Add home value, cars, or accounts at unlisted institutions. Managed on the Net Worth page.
          </p>
        </div>
        <a
          href="/net-worth"
          className="shrink-0 flex items-center gap-1.5 text-xs font-semibold pacioli-text-success hover:underline whitespace-nowrap"
        >
          Go to Net Worth <ArrowRight size={12} />
        </a>
      </div>

      {/* Export / Import */}
      <div className="pacioli-bg-surface rounded-2xl p-6 border">
        <h3 className="text-sm font-semibold pacioli-text-primary mb-1">Backup & Restore</h3>
        <p className="text-xs pacioli-text-muted mb-5">
          Export all your data as a JSON file — transactions, category rules, budgets, goals, and account balances. Keep a copy as a backup, or use it to migrate to a future Pacioli account when login ships.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Export */}
          <div className="pacioli-bg-surface-2 rounded-xl p-5 border">
            <div className="flex items-center gap-2 mb-2">
              <Download size={15} className="pacioli-accent" />
              <p className="text-sm font-medium pacioli-text-primary">Export data</p>
            </div>
            <p className="text-xs pacioli-text-muted mb-4">
              Downloads a <span className="font-mono">pacioli-backup-YYYY-MM-DD.json</span> file with everything saved in your browser.
            </p>
            <button
              onClick={exportData}
              className="flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Download size={14} /> Download backup
            </button>
          </div>

          {/* Import */}
          <div className="pacioli-bg-surface-2 rounded-xl p-5 border">
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen size={15} className="pacioli-accent" />
              <p className="text-sm font-medium pacioli-text-primary">Restore from backup</p>
            </div>
            <p className="text-xs pacioli-text-muted mb-4">
              Upload a Pacioli backup JSON to restore your data. This will overwrite your current data.
            </p>
            <button
              onClick={() => importRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 pacioli-bg-surface border pacioli-text-primary text-sm font-medium rounded-xl hover:border-indigo-500/50 transition-colors"
            >
              <FolderOpen size={14} /> Choose backup file
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleImportFile(e.target.files[0]); }}
            />
            {importStatus === "success" && (
              <div className="flex items-center gap-2 mt-3">
                <CheckCircle2 size={13} className="pacioli-text-success shrink-0" />
                <p className="text-xs pacioli-text-success">Data restored — reloading…</p>
              </div>
            )}
            {importStatus === "error" && importError && (
              <div className="flex items-center gap-2 mt-3">
                <AlertCircle size={13} className="pacioli-text-danger shrink-0" />
                <p className="text-xs pacioli-text-danger">{importError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

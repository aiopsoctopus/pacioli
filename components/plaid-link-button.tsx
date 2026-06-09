"use client";
import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Landmark, CheckCircle2, RefreshCw, Trash2, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/data";

interface PlaidItem {
  itemId: string;
  institutionName: string | null;
  connectedAt: string;
  accounts: PlaidAccount[];
}

interface PlaidAccount {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  balance: number;
}

export default function PlaidLinkButton({ onSync }: { onSync?: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadItems() {
    try {
      const res = await fetch("/api/plaid/items");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      // Non-fatal — items stay empty
    }
  }

  // Load connected items on mount
  useEffect(() => { loadItems(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch a link token on mount
  useEffect(() => {
    console.log("[Plaid] fetching link token...");
    fetch("/api/plaid/link-token", { method: "POST" })
      .then((r) => {
        console.log("[Plaid] link-token response status", r.status);
        return r.json();
      })
      .then((d) => {
        console.log("[Plaid] link-token data", d);
        setLinkToken(d.link_token);
      })
      .catch((err) => {
        console.log("[Plaid] link-token fetch error", err);
        setError("Could not initialize bank connection. Check your Plaid credentials.");
      });
  }, []);

  useEffect(() => {
    console.log("[Plaid] linkToken state changed:", linkToken);
  }, [linkToken]);

  const onSuccess = useCallback(async (
    publicToken: string,
    metadata: { institution?: { name: string } | null },
  ) => {
    console.log("[Plaid] onSuccess fired", publicToken, metadata);
    setError(null);
    const exchangeRes = await fetch("/api/plaid/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_token: publicToken, metadata }),
    });
    const exchangeData = await exchangeRes.json();
    if (!exchangeRes.ok) {
      setError(exchangeData.error ?? "Failed to connect bank.");
      return;
    }

    // Reload items first so the new item appears, then sync its transactions
    await loadItems();
    await syncItem(exchangeData.item_id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkToken]);

  async function syncItem(itemId: string) {
    setSyncing(itemId);
    setError(null);
    try {
      const res = await fetch("/api/plaid/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Sync failed");
      }
      // Refresh account balances after sync
      await loadItems();
      onSync?.();
    } catch (err) {
      const name = items.find((i) => i.itemId === itemId)?.institutionName ?? "this account";
      setError(`Sync failed for ${name}. ${err instanceof Error ? err.message : "Try again."}`);
    } finally {
      setSyncing(null);
    }
  }

  async function removeItem(itemId: string) {
    await fetch("/api/plaid/items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId }),
    });
    setItems((prev) => prev.filter((i) => i.itemId !== itemId));
    onSync?.();
  }

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  useEffect(() => {
    console.log("[Plaid] usePlaidLink ready:", ready, "token:", linkToken, "onSuccess identity:", onSuccess);
  }, [ready, linkToken, onSuccess]);

  const allAccounts = items.flatMap((i) => i.accounts);
  const totalBalance = allAccounts.reduce((s, a) => {
    if (["depository", "investment"].includes(a.type)) return s + a.balance;
    if (a.type === "credit" || a.type === "loan") return s - a.balance;
    return s;
  }, 0);

  return (
    <div className="pacioli-bg-surface rounded-2xl p-6 border flex flex-col gap-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Landmark size={18} className="pacioli-accent" />
          <h3 className="text-sm font-semibold pacioli-text-primary">Live Bank Connection</h3>
          <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-500/15 text-indigo-400 rounded-full">Plaid</span>
        </div>
        <p className="text-xs pacioli-text-muted">
          Connect your bank for automatic daily transaction sync — no more manual CSV exports.
        </p>
      </div>

      {/* Privacy note */}
      <div className="text-xs pacioli-text-muted bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2.5 leading-relaxed">
        <span className="font-semibold text-amber-400">Privacy note:</span> Plaid routes your bank data through their infrastructure. Unlike CSV import (which stays 100% on your device), connecting a live bank shares data with a third party.{" "}
        <a href="https://plaid.com/legal/privacy-statement/" target="_blank" rel="noopener noreferrer" className="underline opacity-70 hover:opacity-100">Plaid privacy policy ↗</a>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 pacioli-alert-danger border rounded-lg">
          <AlertCircle size={14} className="pacioli-text-danger mt-0.5 shrink-0" />
          <p className="text-xs pacioli-text-danger">{error}</p>
        </div>
      )}

      {/* Connected accounts */}
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-xs font-semibold pacioli-text-muted uppercase tracking-wide">Connected banks</p>
            {allAccounts.length > 0 && (
              <span className="text-xs pacioli-text-muted">
                Net balance: <span className="font-semibold pacioli-text-primary">{formatCurrency(totalBalance)}</span>
              </span>
            )}
          </div>
          {items.map((item) => (
            <div key={item.itemId} className="pacioli-bg-surface-2 rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="pacioli-text-success" />
                  <span className="text-sm font-medium pacioli-text-primary">
                    {item.institutionName ?? "Bank"}
                  </span>
                  <span className="text-xs pacioli-text-faint">
                    · synced {new Date(item.connectedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => syncItem(item.itemId)}
                    disabled={syncing === item.itemId}
                    className="flex items-center gap-1 text-xs pacioli-text-muted hover:pacioli-text-primary transition-colors"
                  >
                    <RefreshCw size={12} className={syncing === item.itemId ? "animate-spin" : ""} />
                    {syncing === item.itemId ? "Syncing…" : "Sync"}
                  </button>
                  <button
                    onClick={() => removeItem(item.itemId)}
                    className="text-xs pacioli-text-muted hover:pacioli-text-danger transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {item.accounts.length > 0 && (
                <div className="space-y-1.5">
                  {item.accounts.map((a) => (
                    <div key={a.id} className="flex justify-between text-xs">
                      <span className="pacioli-text-secondary">
                        {a.name} <span className="pacioli-text-faint">({a.subtype ?? a.type})</span>
                      </span>
                      <span className="pacioli-text-primary font-medium">{formatCurrency(a.balance)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Connect button */}
      <button
        onClick={() => open()}
        disabled={!ready || !linkToken}
        className="w-full py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors"
      >
        {items.length > 0 ? "+ Connect another bank" : "Connect a bank"}
      </button>
    </div>
  );
}

"use client";
import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Landmark, CheckCircle2, RefreshCw, Trash2, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/data";
import { useAuth } from "@clerk/nextjs";
import { scopedStorage } from "@/lib/storage";

const PLAID_ITEMS_KEY = "pacioli-plaid-items";
const PLAID_TRANSACTIONS_KEY = "pacioli-plaid-transactions";
const PLAID_ACCOUNTS_KEY = "pacioli-plaid-accounts";

interface PlaidItem {
  itemId: string;
  accessToken: string;
  institution: { name: string } | null;
  connectedAt: string;
}

interface PlaidAccount {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  balance: number;
  itemId: string;
}

export default function PlaidLinkButton({ onSync }: { onSync?: () => void }) {
  const { userId } = useAuth();
  const storage = scopedStorage(userId);

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [accounts, setAccounts] = useState<PlaidAccount[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load persisted items + accounts
  useEffect(() => {
    const saved = storage.getItem(PLAID_ITEMS_KEY);
    if (saved) setItems(JSON.parse(saved));
    const savedAccounts = storage.getItem(PLAID_ACCOUNTS_KEY);
    if (savedAccounts) setAccounts(JSON.parse(savedAccounts));
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch a link token when the component mounts
  useEffect(() => {
    fetch("/api/plaid/link-token", { method: "POST" })
      .then((r) => r.json())
      .then((d) => setLinkToken(d.link_token))
      .catch(() => setError("Could not initialize bank connection. Check your Plaid credentials."));
  }, []);

  const onSuccess = useCallback(async (publicToken: string, metadata: { institution?: { name: string } | null }) => {
    setError(null);
    // Exchange public token for access token
    const res = await fetch("/api/plaid/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_token: publicToken, metadata }),
    });
    const data = await res.json();

    const newItem: PlaidItem = {
      itemId: data.item_id,
      accessToken: data.access_token,
      institution: metadata.institution ?? null,
      connectedAt: new Date().toISOString(),
    };

    const updated = [...items.filter((i) => i.itemId !== newItem.itemId), newItem];
    setItems(updated);
    storage.setItem(PLAID_ITEMS_KEY, JSON.stringify(updated));

    // Immediately sync transactions
    await syncItem(newItem, updated);
  }, [items, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function syncItem(item: PlaidItem, currentItems?: PlaidItem[]) {
    setSyncing(item.itemId);
    setError(null);
    try {
      const res = await fetch("/api/plaid/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: item.accessToken }),
      });
      const data = await res.json();

      // Merge accounts (tag with itemId)
      const itemAccounts: PlaidAccount[] = data.accounts.map((a: PlaidAccount) => ({
        ...a,
        itemId: item.itemId,
      }));

      // Merge with accounts from other items
      const otherAccounts = accounts.filter((a) => a.itemId !== item.itemId);
      const mergedAccounts = [...otherAccounts, ...itemAccounts];
      setAccounts(mergedAccounts);
      storage.setItem(PLAID_ACCOUNTS_KEY, JSON.stringify(mergedAccounts));

      // Merge transactions — replace all from this item
      const existingRaw = storage.getItem(PLAID_TRANSACTIONS_KEY);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const otherTxs = existing.filter((t: { _itemId?: string }) => t._itemId !== item.itemId);
      const newTxs = data.transactions.map((t: object) => ({ ...(t as object), _itemId: item.itemId }));
      const merged = [...otherTxs, ...newTxs];
      storage.setItem(PLAID_TRANSACTIONS_KEY, JSON.stringify(merged));

      onSync?.();
    } catch {
      setError(`Sync failed for ${item.institution?.name ?? "this account"}. Try again.`);
    } finally {
      setSyncing(null);
    }
  }

  function removeItem(itemId: string) {
    const updated = items.filter((i) => i.itemId !== itemId);
    setItems(updated);
    storage.setItem(PLAID_ITEMS_KEY, JSON.stringify(updated));

    const updatedAccounts = accounts.filter((a) => a.itemId !== itemId);
    setAccounts(updatedAccounts);
    storage.setItem(PLAID_ACCOUNTS_KEY, JSON.stringify(updatedAccounts));

    const existingRaw = storage.getItem(PLAID_TRANSACTIONS_KEY);
    if (existingRaw) {
      const existing = JSON.parse(existingRaw);
      const updated2 = existing.filter((t: { _itemId?: string }) => t._itemId !== itemId);
      storage.setItem(PLAID_TRANSACTIONS_KEY, JSON.stringify(updated2));
    }
    onSync?.();
  }

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  const totalBalance = accounts.reduce((s, a) => {
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
        <span className="font-semibold text-amber-400">Privacy note:</span> Plaid routes your bank data through their infrastructure. Unlike CSV import (which stays 100% on your device), connecting a live bank shares data with a third party. <a href="https://plaid.com/legal/privacy-statement/" target="_blank" rel="noopener noreferrer" className="underline opacity-70 hover:opacity-100">Plaid privacy policy ↗</a>
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
            {accounts.length > 0 && (
              <span className="text-xs pacioli-text-muted">Net balance: <span className="font-semibold pacioli-text-primary">{formatCurrency(totalBalance)}</span></span>
            )}
          </div>
          {items.map((item) => {
            const itemAccounts = accounts.filter((a) => a.itemId === item.itemId);
            return (
              <div key={item.itemId} className="pacioli-bg-surface-2 rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="pacioli-text-success" />
                    <span className="text-sm font-medium pacioli-text-primary">
                      {item.institution?.name ?? "Bank"}
                    </span>
                    <span className="text-xs pacioli-text-faint">
                      · synced {new Date(item.connectedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => syncItem(item)}
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
                {itemAccounts.length > 0 && (
                  <div className="space-y-1.5">
                    {itemAccounts.map((a) => (
                      <div key={a.id} className="flex justify-between text-xs">
                        <span className="pacioli-text-secondary">{a.name} <span className="pacioli-text-faint">({a.subtype ?? a.type})</span></span>
                        <span className="pacioli-text-primary font-medium">{formatCurrency(a.balance)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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

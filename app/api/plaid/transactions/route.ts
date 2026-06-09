import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { plaidClient } from "@/lib/plaid-client";
import { supabaseAdmin } from "@/lib/supabase";

// GET — return stored transactions for the current user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();

  const { data, error } = await db
    .from("plaid_transactions")
    .select("*, plaid_items!inner(user_id)")
    .eq("plaid_items.user_id", userId)
    .order("date", { ascending: false });

  if (error) {
    console.error("[Plaid] transactions GET error:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const transactions = (data ?? []).map((t) => ({
    id: t.transaction_id,
    date: t.date,
    merchant: t.merchant,
    category: t.category,
    amount: Number(t.amount),
    account: t.account_id,
    _source: "plaid" as const,
  }));

  return NextResponse.json({ transactions });
}

// POST — sync a single item from Plaid and persist to Supabase
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { item_id } = await req.json();
  if (!item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });

  const db = supabaseAdmin();

  // Look up access_token — enforce user ownership
  const { data: item, error: itemError } = await db
    .from("plaid_items")
    .select("access_token, sync_cursor")
    .eq("item_id", item_id)
    .eq("user_id", userId)
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // Cursor-based sync — incremental after first run
  let cursor: string | undefined = item.sync_cursor ?? undefined;
  const toUpsert: object[] = [];
  const toDelete: string[] = [];
  let hasMore = true;

  while (hasMore) {
    const res = await plaidClient.transactionsSync({ access_token: item.access_token, cursor });
    const data = res.data;

    for (const t of [...data.added, ...data.modified]) {
      toUpsert.push({
        transaction_id: t.transaction_id,
        item_id,
        account_id: t.account_id,
        date: t.date,
        merchant: (t as { merchant_name?: string }).merchant_name ?? t.name,
        category:
          (t as { personal_finance_category?: { primary: string } }).personal_finance_category?.primary ??
          ((t as { category?: string[] }).category?.[0]) ??
          "Uncategorized",
        // Plaid amounts are positive for debits; we store absolute value
        amount: Math.abs(t.amount),
      });
    }

    for (const r of data.removed) {
      toDelete.push(r.transaction_id);
    }

    cursor = data.next_cursor;
    hasMore = data.has_more;
  }

  // Persist changes
  if (toUpsert.length > 0) {
    await db.from("plaid_transactions").upsert(toUpsert, { onConflict: "transaction_id" });
  }
  if (toDelete.length > 0) {
    await db.from("plaid_transactions").delete().in("transaction_id", toDelete);
  }

  // Update cursor and refresh account balances
  await db.from("plaid_items").update({ sync_cursor: cursor }).eq("item_id", item_id);

  const accountsRes = await plaidClient.accountsGet({ access_token: item.access_token });
  const accounts = accountsRes.data.accounts.map((a) => ({
    account_id: a.account_id,
    item_id,
    name: a.name,
    type: a.type as string,
    subtype: (a.subtype as string | null) ?? null,
    balance: a.balances.current ?? 0,
  }));

  if (accounts.length > 0) {
    await db.from("plaid_accounts").upsert(accounts, { onConflict: "account_id" });
  }

  return NextResponse.json({
    synced: toUpsert.length,
    removed: toDelete.length,
    accounts: accounts.map((a) => ({
      id: a.account_id,
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      balance: a.balance,
    })),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid-client";
import { supabaseAdmin } from "@/lib/supabase";

// Plaid webhook handler.
// Register this URL in your Plaid dashboard: https://<your-domain>/api/plaid/webhook
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { webhook_type, webhook_code, item_id } = body as {
    webhook_type?: string;
    webhook_code?: string;
    item_id?: string;
  };

  if (webhook_type !== "TRANSACTIONS" || webhook_code !== "SYNC_UPDATES_AVAILABLE" || !item_id) {
    return NextResponse.json({ ok: true });
  }

  const db = supabaseAdmin();

  // Look up the item — no userId check needed since this is a server-to-server call
  const { data: item } = await db
    .from("plaid_items")
    .select("access_token, sync_cursor")
    .eq("item_id", item_id)
    .single();

  if (!item) {
    console.warn("[Plaid] webhook: unknown item_id", item_id);
    return NextResponse.json({ ok: true });
  }

  let cursor: string | undefined = item.sync_cursor ?? undefined;
  const toUpsert: object[] = [];
  const toDelete: string[] = [];
  let hasMore = true;

  try {
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
          amount: Math.abs(t.amount),
        });
      }

      for (const r of data.removed) {
        toDelete.push(r.transaction_id);
      }

      cursor = data.next_cursor;
      hasMore = data.has_more;
    }

    if (toUpsert.length > 0) {
      await db.from("plaid_transactions").upsert(toUpsert, { onConflict: "transaction_id" });
    }
    if (toDelete.length > 0) {
      await db.from("plaid_transactions").delete().in("transaction_id", toDelete);
    }

    await db.from("plaid_items").update({ sync_cursor: cursor }).eq("item_id", item_id);
  } catch (err) {
    console.error("[Plaid] webhook sync error:", err);
    // Return 200 so Plaid doesn't retry immediately — log the error instead
  }

  return NextResponse.json({ ok: true });
}

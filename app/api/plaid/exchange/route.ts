import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { plaidClient } from "@/lib/plaid-client";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { public_token, metadata } = await req.json();
  const db = supabaseAdmin();

  const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token });
  const accessToken = exchangeRes.data.access_token;
  const itemId = exchangeRes.data.item_id;
  const institutionName: string | null = metadata?.institution?.name ?? null;

  // Persist the item — upsert in case the user re-connects the same institution
  const { error: itemError } = await db.from("plaid_items").upsert({
    item_id: itemId,
    user_id: userId,
    access_token: accessToken,
    institution_name: institutionName,
    connected_at: new Date().toISOString(),
  }, { onConflict: "item_id" });

  if (itemError) {
    console.error("[Plaid] exchange upsert error:", itemError);
    return NextResponse.json({ error: "Failed to save item" }, { status: 500 });
  }

  // Fetch accounts and persist them
  try {
    const accountsRes = await plaidClient.accountsGet({ access_token: accessToken });
    const accounts = accountsRes.data.accounts.map((a) => ({
      account_id: a.account_id,
      item_id: itemId,
      name: a.name,
      type: a.type as string,
      subtype: (a.subtype as string | null) ?? null,
      balance: a.balances.current ?? 0,
    }));

    if (accounts.length > 0) {
      await db.from("plaid_accounts").upsert(accounts, { onConflict: "account_id" });
    }
  } catch (err) {
    console.error("[Plaid] exchange accounts fetch error:", err);
    // Non-fatal — the sync step will retry
  }

  return NextResponse.json({ item_id: itemId, institution_name: institutionName });
}

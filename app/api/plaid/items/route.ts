import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET — list all connected items + their accounts for the current user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();

  const { data: items, error } = await db
    .from("plaid_items")
    .select("item_id, institution_name, connected_at")
    .eq("user_id", userId)
    .order("connected_at", { ascending: false });

  if (error) {
    console.error("[Plaid] items GET error:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const itemIds = items.map((i) => i.item_id);
  const { data: accounts } = await db
    .from("plaid_accounts")
    .select("account_id, item_id, name, type, subtype, balance")
    .in("item_id", itemIds);

  const accountsByItem = new Map<string, typeof accounts>();
  for (const a of accounts ?? []) {
    const list = accountsByItem.get(a.item_id) ?? [];
    list.push(a);
    accountsByItem.set(a.item_id, list);
  }

  return NextResponse.json({
    items: items.map((item) => ({
      itemId: item.item_id,
      institutionName: item.institution_name ?? null,
      connectedAt: item.connected_at,
      accounts: (accountsByItem.get(item.item_id) ?? []).map((a) => ({
        id: a.account_id,
        name: a.name,
        type: a.type,
        subtype: a.subtype ?? null,
        balance: Number(a.balance),
      })),
    })),
  });
}

// DELETE — remove an item and all its data (cascade handles accounts + transactions)
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { item_id } = await req.json();
  if (!item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });

  const db = supabaseAdmin();

  const { error } = await db
    .from("plaid_items")
    .delete()
    .eq("item_id", item_id)
    .eq("user_id", userId);

  if (error) {
    console.error("[Plaid] items DELETE error:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

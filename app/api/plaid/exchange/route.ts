import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { plaidClient } from "@/lib/plaid-client";

/**
 * Exchange a Plaid public_token for an access_token.
 * Stores the access_token in localStorage on the client (via response).
 *
 * Note: In a production app with a database you'd store this server-side
 * keyed to the userId. For now we return it to the client to store in
 * localStorage (scoped to userId via lib/storage.ts).
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { public_token, metadata } = await req.json();

  const response = await plaidClient.itemPublicTokenExchange({ public_token });
  const accessToken = response.data.access_token;
  const itemId = response.data.item_id;

  return NextResponse.json({
    access_token: accessToken,
    item_id: itemId,
    institution: metadata?.institution ?? null,
  });
}

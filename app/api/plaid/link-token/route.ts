import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { plaidClient } from "@/lib/plaid-client";
import { CountryCode, Products } from "plaid";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "Pacioli",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
    // Use instant match to avoid microdeposit / phone MFA flows
    auth: {
      automated_microdeposits_enabled: false,
      instant_match_enabled: true,
      same_day_microdeposits_enabled: false,
    },
  });

  return NextResponse.json({ link_token: response.data.link_token });
}

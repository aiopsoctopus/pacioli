import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { plaidClient } from "@/lib/plaid-client";

/**
 * Fetch transactions for a given access_token.
 * Fetches up to 90 days of history on first sync.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { access_token } = await req.json();
  if (!access_token) return NextResponse.json({ error: "access_token required" }, { status: 400 });

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 90);

  const startDate = start.toISOString().slice(0, 10);
  const endDate = now.toISOString().slice(0, 10);

  // Paginate through all transactions
  let transactions: object[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token,
      cursor,
    });
    const data = response.data;
    transactions = transactions.concat(data.added);
    cursor = data.next_cursor;
    hasMore = data.has_more;
  }

  // Normalize to Pacioli's Transaction shape
  const normalized = transactions
    .map((tx: object) => {
      const t = tx as {
        transaction_id: string;
        date: string;
        merchant_name?: string;
        name: string;
        personal_finance_category?: { primary: string };
        category?: string[];
        amount: number;
        account_id: string;
      };
      return {
        id: t.transaction_id,
        date: t.date,
        merchant: t.merchant_name ?? t.name,
        category: t.personal_finance_category?.primary
          ?? t.category?.[0]
          ?? "Uncategorized",
        // Plaid amounts are positive for debits (money leaving), negative for credits
        amount: Math.abs(t.amount),
        account: t.account_id,
        _source: "plaid",
      };
    })
    // Only include debits (spending), skip credits/income
    .filter((t: object) => {
      const tx = t as { amount: number };
      return tx.amount > 0;
    });

  // Also fetch account balances
  const accountsResponse = await plaidClient.accountsGet({ access_token });
  const accounts = accountsResponse.data.accounts.map((a) => ({
    id: a.account_id,
    name: a.name,
    institution: null,
    type: a.type,
    subtype: a.subtype,
    balance: a.balances.current ?? 0,
  }));

  return NextResponse.json({
    transactions: normalized,
    accounts,
    startDate,
    endDate,
  });
}

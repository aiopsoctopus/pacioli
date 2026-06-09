-- Run this in the Supabase SQL editor to create the Plaid persistence tables.
-- access_token is stored server-side only; the browser never sees it.
-- RLS is intentionally disabled — user_id filtering is enforced in API routes via Clerk auth.

CREATE TABLE IF NOT EXISTS plaid_items (
  item_id          TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  access_token     TEXT NOT NULL,
  institution_name TEXT,
  connected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_cursor      TEXT
);

CREATE TABLE IF NOT EXISTS plaid_accounts (
  account_id  TEXT PRIMARY KEY,
  item_id     TEXT NOT NULL REFERENCES plaid_items(item_id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,
  subtype     TEXT,
  balance     NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plaid_transactions (
  transaction_id TEXT PRIMARY KEY,
  item_id        TEXT NOT NULL REFERENCES plaid_items(item_id) ON DELETE CASCADE,
  account_id     TEXT NOT NULL,
  date           TEXT NOT NULL,
  merchant       TEXT NOT NULL,
  category       TEXT NOT NULL,
  amount         NUMERIC NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id        ON plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_item_id     ON plaid_accounts(item_id);
CREATE INDEX IF NOT EXISTS idx_plaid_transactions_item_id ON plaid_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_plaid_transactions_date    ON plaid_transactions(date);

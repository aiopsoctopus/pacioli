---
name: project-supabase-plaid
description: Plaid access tokens and transactions moved from localStorage to Supabase server-side persistence
metadata:
  type: project
---

Plaid data (items, accounts, transactions) is now stored in Supabase, not localStorage. Access tokens never reach the browser.

**Why:** Security (access tokens shouldn't live in localStorage) and multi-device persistence.

**How to apply:** When touching Plaid flows, always go through the API routes. The browser never sees access_token.

## Schema
Run `supabase/schema.sql` in the Supabase SQL editor. Tables: `plaid_items`, `plaid_accounts`, `plaid_transactions`. Cascade deletes are configured.

## Required env vars (.env.local)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/public key (currently unused but expected by the user)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key for server-side writes (never expose to browser)

## API surface
- `GET /api/plaid/items` — list connected items + accounts
- `DELETE /api/plaid/items` — remove item by item_id
- `POST /api/plaid/exchange` — exchange public_token, save item + accounts, return { item_id, institution_name }
- `POST /api/plaid/transactions` — sync item by item_id (cursor-based), upsert to Supabase
- `GET /api/plaid/transactions` — return stored transactions for current user
- `POST /api/plaid/webhook` — handle SYNC_UPDATES_AVAILABLE (register URL in Plaid dashboard)

## Notes
- `supabaseAdmin()` in `lib/supabase.ts` uses service role key; call only from server-side API routes
- RLS is not enabled — user_id filtering enforced in API route code via Clerk auth
- `useTransactions` in `lib/data.ts` now fetches Plaid transactions from `GET /api/plaid/transactions` instead of localStorage

# Pacioli Roadmap
_Last updated: 2026-06-03_

---

## ✅ Phase 1 — Core App (Shipped)

- Local-first, no backend, all data in localStorage
- CSV import with merchant categorization rules
- **Zoom Out** dashboard — net worth, budget remaining, monthly spend, goals progress
- **Net Worth** — balance sheet with YoY change, liquid/invested/illiquid breakdown, asset composition bar, grouped asset view, debt-to-asset ratio
- **Cash Flow** — cash waterfall (fixed/variable/surplus), income source breakdown by type, category drill-down, re-categorization
- **Transactions** — search, date range filter, amount range filter, uncategorized quick filter, category multi-select, bulk recategorize, rules engine
- **Budget** — envelope budgeting, smart setup from 6-month spending analysis, pace tracking, month-end projection, alerts, surplus routing panel with savings rate and goal callouts
- **Sinking Funds** — named goals, progress tracking, on-track/behind badges, monthly contribution requirements
- **Scenario Planner** — NL "What if?" input (Groq llama-3.3-70b), bracket projection chart, 1/3/5/10yr horizons, optimistic/base/pessimistic lines, manual income/expense/savings events
- **Connect** — CSV import flow
- **Demo mode** — sandbox data with realistic complex-household profile (see below)
- Dark/light mode, privacy-first positioning, signature footer

### Demo data profile (upgraded 2026-06-03)
- Dual income household: Alex ($185K) + Jordan ($140K) = $325K combined gross
- Net worth ~$1.67M: two 401ks, two Roths, joint brokerage, RSU holdings (MSFT, quarterly vests), 529, primary home ($985K), rental property, two cars
- RSU vesting events visible in Sep/Dec/Mar/Jun income
- Rental income $2,800/mo
- Realistic high-earner spending: Whole Foods, Equinox, Bright Horizons daycare, Nordstrom, Blue Bottle, travel-heavy months
- Sinking funds: Europe Trip, Emergency Fund ($75K target), Kitchen Renovation, 529 Top-Up, Tax Reserve (RSU), Holiday & Gifts

---

## 🔲 Phase 2 — Polish & Power Features (Next)

### 🔴 Critical bugs (from critique session 2026-06-03)

- [ ] **Fix `?demo=true` direct URL entry** — navigating directly to any page with `?demo=true` shows empty state; shareable demo link is broken. Must work as a standalone entry point without going through the landing page.
- [ ] **Chart y-axis baseline** — net worth trend and scenario planner both start y-axis at $0, leaving 90% of chart empty. Should start near the data minimum (~$1.4M for current demo NW).
- [ ] **Suppress budget alerts early in month** — over-budget alerts fire at day 3 for lumpy categories (travel, annual costs). Apply same `monthProgress < 0.25` guard already used for pace label.
- [ ] **Sinking funds target date accuracy** — funds past their target date or within the current month show wrong status badge ("On track" when they're actually missed/at risk). Fix status logic to account for elapsed target dates.

### 🟡 High value (from critique session 2026-06-03)

- [ ] **Zoom Out — recommended action callout** — surface one actionable insight on the dashboard (e.g. "Emergency Fund is $8K short with 6 months left — needs $1,334/mo" or "RSU vest this month: do you have a tax reserve?")
- [ ] **Household Models — real content or proper coming soon** — the collapsed "Equity · Two-earner · Mortgage · College" section currently does nothing visible when expanded; needs either working templates or an explained "coming soon" treatment
- [ ] **Scenario Planner — Household Models** — implement the Equity, Two-earner, Mortgage, College model templates (currently UI stubs only)

### 🟢 Improvements

- [ ] **Transactions filtering** — ✅ done (date range, amount range, uncategorized filter, source column, memos)
- [ ] **Budget default envelopes for new demo visitors** — ✅ done (smart setup auto-runs; stale envelopes auto-wiped)
- [ ] **Cash Flow — 12-month savings rate trend** — add a small sparkline showing savings rate over time
- [ ] **Net Worth — account editing** — let users add/edit/remove accounts without a CSV import
- [ ] **Transactions — export** — filtered CSV export of visible transactions

---

## 🔲 Phase 3 — Auth + Plaid (v2 Platform Shift)

Ship Auth and Plaid together — they require the same backend infrastructure.

- [ ] **Auth** — Clerk or NextAuth magic-link, no passwords
- [ ] **Database** — Supabase or PlanetScale to persist user data server-side
- [ ] **Plaid** — live bank connection alongside CSV import (user's choice)
  - Privacy disclosure required: Plaid routes data through Plaid's infrastructure; local CSV import stays on device
  - localStorage data exportable as JSON for migration to authenticated account
- [ ] **Webhook-driven refresh** — Plaid webhooks update balances/transactions automatically

---

## 🔲 Phase 4 — Complex-Household Specialization

- [ ] **Equity comp vesting** — RSU/option vesting schedule as timed Scenario Planner events; tax withholding estimates
- [ ] **College fund backsolve** — given child age and target school cost, calculate required monthly 529 contribution
- [ ] **Two-earner modeling** — model one partner going part-time, taking leave, or changing jobs
- [ ] **Mortgage payoff accelerator** — extra principal payment scenarios with interest saved and payoff date
- [ ] **Rental property P&L** — track rental income vs. expenses (mortgage, maintenance, vacancy) as a mini income statement

---

## LLM Hooks (Wired up when Groq/OpenAI integration expands)

Marked `// LLM_HOOK` in source — these are stubs ready to be activated:

- Budget setup rationale — per-category plain-English explanation
- Monthly CFO memo — narrative summary of the month's financial picture
- Anomaly explanation — what drove a category overage (merchant-level)
- Scenario narration — plain-English interpretation of projection results

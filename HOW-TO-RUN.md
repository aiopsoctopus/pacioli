# Household Financial OS — How to Run

## First time setup

```bash
cd "Household Financial OS/app"
npm install
npm run dev
```

Then open **http://localhost:3000** in your browser.

## What you'll see

Five views, navigable from the left sidebar:

| Nav label | Route | What it shows |
|---|---|---|
| Zoom Out | `/` | Net worth, monthly cash flow, spending pie, goals at a glance |
| My Net Worth | `/net-worth` | Balance sheet — assets vs liabilities over time |
| How My Money Moves | `/cash-flow` | Income vs spending, category breakdown, recent transactions |
| Achieve My Goals | `/sinking-funds` | Sinking fund progress bars with on-track status |
| What the Future Looks Like | `/forecast` | 12-month net worth projection with assumptions |

## Data files

All data lives in `public/data/` — these are the synthetic files:

- `accounts.json` — 7 asset accounts + 4 liability accounts, 13 months of balances
- `transactions.json` — 511 transactions across 12 months
- `income.json` — monthly income by source (salary, freelance, dividends)
- `sinking_funds.json` — 5 named goal buckets
- `forecast.json` — 12-month projection assumptions

## When you're ready for real data

The data layer is in `lib/data.ts`. Every `fetchJSON()` call is the swap point — replace with a Plaid API call, a database query, or your own backend. The UI components don't need to change at all.

## Next steps to build out

- [ ] Add a month picker to the Zoom Out dashboard
- [ ] Make sinking fund contributions editable
- [ ] Add a "what if I contributed $X more?" scenario tool on Forecast
- [ ] Wire in Plaid sandbox for real transaction data
- [ ] Add authentication (NextAuth.js)
- [ ] Deploy to Vercel (free tier, one command)

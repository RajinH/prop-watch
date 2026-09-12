# PropWatch

**Remove the guesswork from property ownership.** PropWatch is a property portfolio
intelligence tool for residential property investors (Australian / New Zealand market).
Enter a few facts about each property — value, debt, rent, repayment, expenses — and
PropWatch works out the rest: your cashflow, equity, LVR, yield, capital growth, risk
exposure, and a prioritised list of plain-English insights about what to pay attention to.

## What it does

- **Portfolio dashboard** — a live financial picture of every property you own, in one place.
- **Insights** — ~20 rule-based, explainable alerts ("your portfolio goes cashflow-negative
  at just +0.5% in rates", "fixed rate expiring in 30 days", "usable equity available for a
  next purchase").
- **Risk analysis** — a 0–100 risk score plus rate/vacancy/expense sensitivity and debt
  projections.
- **Growth tracking** — unrealised gains, annualised growth (CAGR), and how much equity you
  can release.
- **Scenario planning** — stress-test what-if changes to rates, rent, expenses, or value.
- **Frictionless onboarding** — add your first property and see real insights *before*
  creating an account.

Everything you see is **derived** from the raw facts you enter — you never fill in a number
the app can calculate for you.

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Supabase** — Postgres, Auth, and Row-Level Security
- **Zod** for input validation, **Recharts** / **visx** for charts
- **Vitest** for the engine test suite

## Getting started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (or the Supabase CLI for local dev)
- API keys for the two address/valuation data providers (optional, for address
  autocomplete and property estimates)

### Environment

Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key

# Server-only (never exposed to the browser)
HTAG_API_KEY=your-htag-key           # property price/rent estimates
CHECKIFY_API_KEY=your-checkify-key   # AU/NZ address autocomplete

# Billing / paywall — all server-only
STRIPE_SECRET_KEY=rk_test_...        # Stripe sandbox key
STRIPE_WEBHOOK_SECRET=whsec_...      # from `stripe listen --print-secret`
SUPABASE_SECRET_KEY=sb_secret_...    # bypasses RLS; Stripe webhook only
ACCESS_CODE_PEPPER=...               # peppers the HMAC of access codes at rest
```

#### Stripe

One-time setup, idempotent and re-runnable (it is also how live mode gets
configured later, with a live key):

```bash
node scripts/stripe-setup.mjs            # product, AUD prices, customer portal
node scripts/stripe-setup.mjs --reprice --monthly=3900
```

Prices are resolved at runtime by `lookup_key`, so `--reprice` moves the key to
a new Price: new signups get the new amount with no deploy, and existing
subscribers keep what they signed up at.

For local webhooks:

```bash
npm install -g @stripe/cli && stripe login
stripe listen --forward-to localhost:3000/api/billing/webhook
```

`stripe listen` prints the `whsec_...` to put in `STRIPE_WEBHOOK_SECRET`. Don't
mix it with a Dashboard endpoint's secret — they verify different events.

Checkout flow variants (trial/no-trial, monthly/annual, card-upfront or not)
live in `src/lib/propwatch/stripe/flows.ts`; `/pricing?flow=<key>` pins one.

#### Access codes

Comp codes let beta users bypass the paywall without a Stripe subscription.
Mint them with:

```bash
node scripts/mint-access-code.mjs --label="beta cohort 1" --days=90 --uses=25
node scripts/mint-access-code.mjs --label="founder" --days=forever --count=5
```

Codes are printed once and stored only as an HMAC, so a lost code can be
revoked and reissued but never recovered. `ACCESS_CODE_PEPPER` must not change
once codes exist — rotating it invalidates every outstanding code (hence the
`pepper_version` column, which exists so a future rotation can dual-verify).

### Database

Apply the migrations in `supabase/migrations/` to your Supabase project (e.g. with the
Supabase CLI: `supabase db push`). They create the `profiles`, `portfolios`,
`properties`, snapshot, `insights`, and `scenarios` tables, all protected by Row-Level
Security.

### Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Lint |
| `npm test` | Run the engine unit tests (Vitest) |

## How it's built

A user's raw property facts are the **source of truth**. From them, a pure, deterministic
**engine** (`src/lib/propwatch/engine/`) computes point-in-time *snapshots* and generates
*insights*. Snapshots are persisted (dated, one per day) so the app can show change over
time; insights are cheap and recomputed on demand.

There are two implementations of the domain by design:

- a lightweight **pre-auth engine** (`src/engine/`, localStorage) that powers the
  single-property onboarding wizard, so a prospect gets value before signing up; and
- the full **authenticated engine** (`src/lib/propwatch/engine/`, Supabase-backed) that
  powers the multi-property product.

> **Contributing / working with AI agents:** see [`CLAUDE.md`](./CLAUDE.md) for a deep
> architectural walkthrough. Note this project runs a **non-standard Next.js version** —
> consult `node_modules/next/dist/docs/` before writing framework code (for example, auth
> middleware lives in `src/proxy.ts`, not the usual `middleware.ts`).

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
```

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

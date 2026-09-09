@AGENTS.md

# PropWatch — agent context

> **Read this before touching code.** It explains what PropWatch *is*, the product
> thinking behind it, and how the system is wired together. The `@AGENTS.md` include
> above is not optional: this is a **non-standard Next.js version** — check
> `node_modules/next/dist/docs/` before writing framework code.

---

## 1. What the product is

PropWatch is a **property portfolio intelligence tool** for residential property
investors (Australian / New Zealand market). An investor enters a handful of raw facts
about each property — value, debt, rent, repayment, expenses — and PropWatch derives
their complete financial picture: cashflow, equity, LVR, yield, capital growth, risk
exposure, and a prioritised list of plain-English insights. They can then stress-test
decisions with what-if scenarios.

The tagline says it plainly: *"Remove the guesswork from property ownership. Understand
your cashflow, equity, and risk in minutes."*

### The problem it solves

Property investors typically manage portfolios in spreadsheets that are static,
error-prone, and don't *interpret* anything. They know their numbers but not what those
numbers *mean* — is the portfolio over-leveraged? How exposed is it to a rate rise? Which
property is dragging returns? PropWatch turns raw facts into a live, interpreted view and
tells the investor what to pay attention to and why.

### The market context (why the domain logic looks the way it does)

The engine encodes **Australian/NZ property-investment conventions**: LVR (loan-to-value
ratio), negative gearing, gross rental yield, marginal income-tax brackets (default
0.325), fixed-rate roll-offs, landlord insurance, `en-AU` currency formatting, and AU/NZ
address models. Thresholds throughout (80% LVR, 3.5% yield, 8% CAGR benchmark, etc.) are
market heuristics, not arbitrary constants.

---

## 2. Product thinking (the "why" behind the shape)

These principles explain design decisions you'll otherwise find surprising:

- **Value before signup.** Onboarding is a **pre-auth wizard**. A prospect adds one
  property, sees a real insights reveal, *then* is asked to sign up. This is why a whole
  second engine + `localStorage` layer exists (see §4) — so the product can deliver value
  with no account.
- **Derived, not entered.** Users only ever enter *raw facts* (source of truth). Every
  interpreted number — equity, LVR, yield, cashflow, risk score, sensitivity, growth — is
  **computed** by a deterministic engine. Never ask a user for something the engine can
  derive.
- **Transparent, rule-based insights (not ML).** Insights come from explicit, thresholded
  rules (`generateInsights.ts`). Every insight is explainable ("goes cashflow-negative at
  +0.5% rates"). Prefer a readable rule over a clever model.
- **Siloed decision surfaces, not one mega-dashboard.** Each authed page owns a single
  concern: Portfolio (health overview), Properties (data management), Risk (exposure &
  sensitivity), Plan (scenarios), Growth (capital gains & equity release). The
  "decision surface" concept (`decisionSurface.ts`) groups concerns into five dimensions.
- **Snapshots enable history.** Computed state is persisted as dated snapshots so the
  product can show change over time (Growth page reads a 12-month series), even though
  most read paths recompute live.

---

## 3. Tech stack

| Concern        | Choice |
|----------------|--------|
| Framework      | **Next.js 16** (App Router, React 19) — *non-standard version, read the bundled docs* |
| Language       | TypeScript (strict) |
| Styling        | Tailwind CSS v4 (green-forward brand palette) |
| Data / auth    | **Supabase** (Postgres, Auth, Row-Level Security) via `@supabase/ssr` |
| Validation     | Zod (all API route inputs) |
| Charts         | **shadcn/ui charts** (`components/ui/chart.tsx`) — a theming layer over Recharts. Always build charts with `ChartContainer` + a `ChartConfig`; never import Recharts' `ResponsiveContainer`/`Tooltip` directly. Colours come from the `--chart-*` tokens in `globals.css`. |
| Icons          | lucide-react, @radix-ui/react-icons |
| Tests          | Vitest (engine unit tests) |

Scripts: `npm run dev` · `npm run build` · `npm run lint` · `npm test` (vitest).

---

## 4. The two-engine / two-track architecture ⚠️

This is the single most important thing to understand. There are **two parallel
implementations** of the domain, for two different lifecycle stages. Do not confuse them.

### Track A — pre-auth, localStorage, single-property

- **Engine:** `src/engine/*` (`cashflow`, `equity`, `yield`, `risk`, `insights`, `types`)
- **Storage:** `src/lib/storage.ts` (localStorage: portfolio draft, onboarding draft,
  HTAG cache)
- **Used by:** the onboarding wizard (`src/components/onboarding/*`) and its instant
  insights reveal, *before* the user has an account.
- **Scope:** one property, simplified model, `camelCase` field names
  (`estimatedValue`, `monthlyMortgagePayment`, `isTenanted`).

### Track B — authenticated, Supabase, multi-property (the real product)

- **Engine:** `src/lib/propwatch/engine/*` — the actual portfolio engine (see §5).
- **Storage:** Supabase Postgres (see §6), reached through API routes and server
  components.
- **Used by:** everything behind auth — the `(app)` route group.
- **Scope:** whole portfolios, full loan/insurance/tax model, `snake_case` field names
  matching DB columns (`current_value`, `monthly_repayment`, `monthly_rent`).

> When onboarding completes for a signed-in user, the wizard writes to **both** tracks:
> it POSTs the property to `/api/properties` (Track B) *and* saves to localStorage
> (Track A). See `OnboardingFlow.handleConfirmReview`.

---

## 5. The engine is the brain — `src/lib/propwatch/engine/`

Pure, deterministic, unit-tested functions. No I/O, no framework — just facts in,
computed model out. This is where the product's intelligence lives; treat it as the core
asset.

| Module | Responsibility |
|--------|----------------|
| `computePropertySnapshot.ts` | Per-property: equity, monthly cashflow, LVR, gross yield |
| `computePortfolioSnapshot.ts` | Aggregate portfolio snapshot (totals, weighted LVR, yield) |
| `computeSensitivity.ts` | Rate/vacancy/expense break-even thresholds |
| `computeRiskScore.ts` | 0–100 risk score across rate / cashflow / concentration / liquidity |
| `computeCapitalGrowth.ts` | Unrealised gains, CAGR, best performer (needs purchase data) |
| `computeAcquisitionCapacity.ts` | Usable equity & max next purchase at 70/80% LVR |
| `computeDebtProjection.ts` | Amortisation curve, payoff date, total interest |
| `computeAfterTaxCashflow.ts` | Negative-gearing tax effect using the portfolio's tax bracket |
| `computeGoalProgress.ts` | Progress toward a passive-income target |
| `rankProperties.ts` | Composite ranking of properties (yield / efficiency / LVR / CAGR) |
| `runScenario.ts` | Apply what-if deltas (rate/rent/expense/value) → projected snapshot + delta |
| `generateInsights.ts` | **~22 thresholded rules** → prioritised insight list (see below) |
| `decisionSurface.ts` | Groups insights into 5 decision dimensions for the Portfolio home |
| `money.ts` | `safeDiv`, `round2`, and money-safe helpers |

**`generateInsights.ts` is the flagship.** It emits severity-tagged insights
(`positive` / `info` / `warning` / `critical`) covering cashflow, LVR, yield,
concentration, data quality, rate sensitivity, negative gearing, fixed-rate expiry,
above-market rates, insurance (renewal/underinsured/missing/on-record), capital growth,
and equity availability. Rules are mostly mutually exclusive by design (only the highest
relevant severity fires per concern). When adding a rule, follow the existing pattern:
threshold → push a fully-formed insight with `type`, `severity`, `title`, `description`,
optional `impact`/`metadata`; then map its `type` in `decisionSurface.ts` if it's a
portfolio-level health concern.

Tests live in `src/lib/propwatch/engine/__tests__/`. **Changing engine math without
updating/adding tests is a red flag** — run `npm test`.

---

## 6. Data model & persistence — `supabase/`

```
profiles (1:1 auth.users)
  └─ portfolios (a user's portfolio; holds passive_income_target, income_tax_bracket)
       ├─ properties          ← user-entered facts, the SOURCE OF TRUTH
       │    (+ loan details, insurance details, address fields)
       ├─ property_snapshots   ← computed per-property state, dated (unique per day)
       ├─ portfolio_snapshots  ← computed aggregate state, dated (unique per day)
       ├─ insights             ← persisted rule outputs (status = active)
       └─ scenarios            ← saved what-if configs (jsonb)
```

- **RLS is enabled on every table.** Ownership is enforced via the portfolio chain
  (`auth.uid()`). Any new table must enable RLS with an equivalent owner policy — never
  ship a table without it.
- **Snapshots are keyed `(entity_id, snapshot_date)`** and upserted, so one row per day —
  re-saving the same day overwrites rather than duplicating.
- Migrations are timestamped in `supabase/migrations/`. Schema history: init →
  insight metadata → loan/insurance details → portfolio settings (goal + tax bracket) →
  property address fields.

### Compute model — when numbers get calculated

- **Write path (recompute-on-write).** Mutating routes (e.g. `POST /api/properties`)
  insert the fact, then call `upsertPropertySnapshot` → `upsertPortfolioSnapshot` →
  `refreshInsights` (which **deletes active insights and regenerates them**). See
  `src/lib/propwatch/db/snapshotHelpers.ts`.
- **Read path (recompute-live).** The `(app)` server pages (`dashboard`, `risk`,
  `growth`) read the *latest persisted snapshot* + properties, then call
  `generateInsights` **live at render time** rather than reading the `insights` table.
  `GET /api/dashboard` is the exception — it reads persisted insights.
  Net effect: **snapshots are the durable time-series; insights are cheap to recompute**
  and are regenerated freely.

---

## 7. Routing & auth

- **Auth = Supabase SSR.** `src/proxy.ts` is this Next version's renamed **middleware**
  (exports `proxy()` + a `config.matcher`, runs on Edge). It guards `/dashboard`,
  `/properties`, `/settings` and redirects unauthenticated users to `/signin`. OAuth
  finishes at `/auth/callback`.
- Browser client: `src/lib/supabase/browser-client.ts`; server client:
  `src/lib/supabase/server-client.ts`.

### Route map

| Route | Purpose |
|-------|---------|
| `/` | Marketing splash → onboarding |
| `/onboarding` | **Pre-auth** single-property wizard + instant insights reveal (Track A) |
| `/signin`, `/signup`, `/auth/callback` | Auth |
| `(app)/dashboard` | **Portfolio** — health overview & decision surface |
| `(app)/properties`, `/properties/new`, `/properties/[id]/edit` | Property CRUD (address autocomplete + estimates) |
| `(app)/risk` | Risk profile, sensitivity, debt projection, insights |
| `(app)/plan` | What-if **scenarios** |
| `(app)/growth` | Capital growth, unrealised gains, equity release |
| `(app)/settings` | Account |

> Nuance: `/growth` exists as a full page but is **not** in the sidebar nav
> (`Sidebar.tsx` lists Portfolio / Properties / Risk / Plan). Growth content also surfaces
> inside the Portfolio dashboard tabs. Confirm intended navigation before "fixing" this.

---

## 8. External integrations (server-only)

Both are wrapped so their API keys **never reach the client** — the wrappers live under
`src/lib/propwatch/*/server.ts`, are imported only by API route handlers, and read
non-`NEXT_PUBLIC_` env vars.

- **Checkify** (`checkify/server.ts`) — AU/NZ address autocomplete + structured address
  details. Powers `AddressAutocomplete.tsx`. Routes: `/api/checkify/autocomplete[-details]`.
- **HTAG** (`htag/server.ts`) — property price/rent estimates + geocoding, used to
  pre-fill valuations when adding a property. Routes: `/api/htag/address-resolve`,
  `/api/htag/property-estimates`. Responses are cached in localStorage with a 30-day TTL
  (`storage.ts`) to limit billable calls.

> **Before working with HTAG, read `docs/htag-integration.md`.** It records measured
> pricing (which differs from the published rates), the per-endpoint free allowance,
> several parameter gotchas that return 400 or silently truncate, and which endpoints
> are worth the call. It will save you money and a debugging session.

Never move these keys to `NEXT_PUBLIC_`, and never import `*/server.ts` from a client
component.

---

## 9. Code organisation & conventions

```
src/
  app/
    (app)/            authed pages (sidebar shell layout)
    api/              route handlers (Zod-validated, thin — delegate to engine/db)
    onboarding/ signin/ signup/ auth/
  components/
    onboarding/       Track-A wizard steps
    dashboard/        DashboardShell + tabs (Portfolio/Growth/Risk/Insights/Scenarios)
    properties/ insights/ auth/ charts/ ui/
  engine/             Track A — pre-auth localStorage engine (single property)
  lib/
    propwatch/
      engine/         Track B — the real portfolio engine (pure, tested)
      db/             snapshot helpers, portfolio resolution
      api/            respond helpers, auth-user helpers, fetch client
      checkify/ htag/ server-only integration wrappers
    supabase/         browser + server clients
    storage.ts        Track-A localStorage
    formatters.ts     en-AU currency/number/percent formatting
  proxy.ts            auth middleware (Next's renamed middleware)
```

Conventions to preserve:
- **API routes stay thin:** validate with Zod, resolve portfolio/user, delegate to the
  engine and `db/` helpers, return via `ok`/`err` (`lib/propwatch/api/respond.ts`).
- **Engine functions stay pure** — no DB, no `fetch`, no framework imports. I/O belongs in
  `db/`, routes, or server components.
- **DB field names are `snake_case`** (Track B) and match columns; Track A is `camelCase`.
- Use `formatters.ts` for money/percent display (en-AU), not ad-hoc formatting.
- Money math goes through `money.ts` (`safeDiv` guards divide-by-zero → `null`).

## 10. Working here — checklist

- Touching domain math? Edit **Track B** engine functions and update
  `__tests__/`, then `npm test`.
- Adding a fact users provide? It's a `properties` column + migration + Zod schema +
  wizard/edit form — *not* a derived value.
- Adding an insight? New rule in `generateInsights.ts` (+ test) and, if portfolio-level,
  a mapping in `decisionSurface.ts`.
- New table/column? Timestamped migration in `supabase/migrations/`, enable **RLS** with
  an owner policy.
- New external data? Server-only wrapper + API route; key stays non-`NEXT_PUBLIC_`.
- Writing framework code? Read `node_modules/next/dist/docs/` first — APIs differ from
  stock Next.js.

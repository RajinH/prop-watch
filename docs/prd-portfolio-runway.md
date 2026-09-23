# PRD: Portfolio Runway ("Your position" card)

- **Status:** Ready to build · one session (~1–2 hours)
- **Owner:** Rajin
- **Date:** 2026-09-23
- **Context:** First slice of the MVP vision: *PropWatch tells property investors
  whether their portfolio can take a hit, and the one thing worth doing next.*
  This PRD covers the "Am I okay?" half.

---

## 1. Problem

Investors with several properties across several lenders can't easily answer three
questions (the most-requested ask in r/AusPropertyChat research):

1. What does my portfolio actually cost me each month after rent?
2. How long could my cash cover that if a property sat vacant?
3. What happens if rates rise 2%?

PropWatch already computes monthly cashflow and debt, but it has no notion of
**cash on hand**, so it can't turn cashflow into *runway*.

## 2. Goal for this slice

Ship a pure, tested engine function that computes runway under three scenarios, and
a basic "Your position" card on the Portfolio tab that visualises it and lets the
user sanity-check the numbers against their own spreadsheet.

**Non-goals (do NOT build in this slice):**

- No database migration, no new column, no API route. The cash reserve is **client
  state only** for now (persistence is a follow-up PRD).
- No offset/redraw per-loan modelling.
- No changes to `generateInsights.ts` or the decision engine (see §7 stretch).
- No onboarding (Track A / `src/engine/*`) changes.
- No new nav items or pages.

## 3. Read first

- `CLAUDE.md` (project context) and `AGENTS.md`. This is a **non-standard Next.js**;
  check `node_modules/next/dist/docs/` before writing framework code.
- Pattern to copy: `src/lib/propwatch/engine/computeSensitivity.ts` (same inputs,
  same style, same rate-rise approximation).
- Helpers: `src/lib/propwatch/engine/money.ts` (`safeDiv`, `round2`),
  `src/lib/formatters.ts` (`formatCurrency`, `formatCashflow`).
- Thresholds live in `src/lib/propwatch/engine/thresholds.ts`.
- Charts: `src/components/ui/chart.tsx` (`ChartContainer` + `ChartConfig`), example in
  `src/components/charts/BarChart.tsx`. Colour tokens in `src/app/globals.css`.
- Mount point: `src/components/dashboard/tabs/PortfolioTab.tsx` (client component;
  already receives `portfolioSnapshot` and `properties`).

> The working tree has uncommitted changes in `PortfolioTab.tsx` and other files.
> Commit or stash before starting so this slice is a clean diff.

## 4. Engine: `computeRunway`

**New file:** `src/lib/propwatch/engine/computeRunway.ts`. Pure: no I/O, no framework
imports.

### Types (add to `src/lib/propwatch/engine/types.ts`)

```ts
export type RunwayScenarioKey = 'current' | 'vacancy' | 'rate_plus_2'

export type RunwayStatus =
  | 'self_funding'    // scenario cashflow >= 0: the reserve is not being drawn down
  | 'finite'          // negative cashflow and a known reserve: runway_months is a number
  | 'unknown_reserve' // negative cashflow but cashReserve is null

export type RunwayScenario = {
  key: RunwayScenarioKey
  monthly_cashflow: number        // scenario cashflow (can be negative)
  monthly_out_of_pocket: number   // max(0, -monthly_cashflow)
  runway_months: number | null    // null unless status === 'finite'
  runway_capped: boolean          // true when the value hit RUNWAY_CAP_MONTHS
  status: RunwayStatus
}

export type RunwayResult = {
  cash_reserve: number | null
  vacancy_property_id: string | null  // the property removed in the vacancy scenario
  scenarios: RunwayScenario[]         // always in order: current, vacancy, rate_plus_2
}
```

### Signature

```ts
export function computeRunway(
  snap: PortfolioSnapshotInsert,
  properties: Property[],
  cashReserve: number | null
): RunwayResult
```

### Rules

| Scenario | Scenario monthly cashflow |
| --- | --- |
| `current` | `snap.monthly_cashflow` |
| `vacancy` | `snap.monthly_cashflow - maxRent`, where `maxRent` is the `monthly_rent` of the property with the **highest** rent. With no properties, equals `current` and `vacancy_property_id` is `null`. Ties: first in array order. |
| `rate_plus_2` | `snap.monthly_cashflow - snap.total_debt * RATE_SHOCK_PCT / 12` (same approximation as `computeSensitivity`) |

For each scenario:

- `monthly_out_of_pocket = max(0, -cashflow)`, rounded with `round2`.
- If `out_of_pocket === 0` → `status: 'self_funding'`, `runway_months: null`.
- Else if `cashReserve === null` → `status: 'unknown_reserve'`, `runway_months: null`.
- Else → `status: 'finite'`, `runway_months = round2(min(cashReserve / out_of_pocket, RUNWAY_CAP_MONTHS))`
  using `safeDiv`; `runway_capped = true` when the cap was applied.
- Treat a negative `cashReserve` as invalid input: clamp to 0 (the UI prevents it anyway).

### Constants (add to `thresholds.ts`)

```ts
/** Rate rise used for the runway stress scenario (2 percentage points). */
export const RATE_SHOCK_PCT = 0.02
/** Upper bound on displayed runway; beyond this is "10+ years". */
export const RUNWAY_CAP_MONTHS = 120
/** Runway below this many months is critical. */
export const RUNWAY_CRITICAL_MONTHS = 6
/** Runway below this many months is a warning. */
export const RUNWAY_WARNING_MONTHS = 12
```

## 5. Tests: `src/lib/propwatch/engine/__tests__/computeRunway.test.ts`

Write these first. Use a helper to build `Property` fixtures (only fields the function
reads need realistic values).

| # | Setup | Expected |
| --- | --- | --- |
| 1 | cf **-600**, debt **900,000**, rents 2,400 and 2,000, reserve **30,000** | current: out-of-pocket 600, **50** months · vacancy: cf -3,000, **10** months, `vacancy_property_id` = the 2,400 property · +2%: cf -2,100, **14.29** months |
| 2 | cf **+400**, debt **600,000**, rents 2,500 and 2,000, reserve **20,000** | current: `self_funding`, out-of-pocket 0 · vacancy: cf -2,100, **9.52** months · +2%: cf -600, **33.33** months |
| 3 | cf -600, reserve **1,000,000** | current: runway **120**, `runway_capped: true` |
| 4 | cf -600, reserve **null** | negative scenarios: `unknown_reserve`, `runway_months: null` |
| 5 | cf -600, reserve **0** | current: `finite`, **0** months |
| 6 | no properties, cf 0, debt 0 | all scenarios `self_funding`; `vacancy_property_id: null` |
| 7 | two properties with equal top rent | vacancy removes the first in array order |
| 8 | scenarios order | keys are exactly `['current','vacancy','rate_plus_2']` |

`npm test` must pass, including all existing suites.

## 6. UI: "Your position" card

**New component:** `src/components/dashboard/YourPositionCard.tsx` (`'use client'`).
Render it at the **top of `PortfolioTab`**, above existing content. Props:
`portfolioSnapshot`, `properties`. It calls `computeRunway` client-side (the engine is
pure, so importing it into a client component is fine).

### Layout (top to bottom)

1. **Heading:** "Your position"
2. **Headline number:** current monthly out-of-pocket, formatted with `formatCurrency`,
   labelled "Monthly out-of-pocket after rent". If `self_funding`, show
   "Self-funding: rent covers costs (+$X/month)" instead.
3. **Cash reserve input:**
   - Label: "Cash available (savings + offset balances)"
   - Numeric input, AUD, whole dollars, starts empty (so `null`).
   - Validation: accept digits and commas; reject negatives and non-numbers with an
     inline error ("Enter a positive dollar amount"); treat empty as `null`.
   - Helper text: "Not saved yet. Used only for this view."
4. **Runway chart:** horizontal bar chart, one bar per scenario:
   - Row labels: "Today", "Largest rent vacant (<property name>)", "Rates +2%".
   - Bar length = `runway_months`; `self_funding` rows show a full-width muted bar
     or no bar with the text "Self-funding"; `unknown_reserve` rows show
     "Add cash to see runway".
   - **Direct value labels** on each bar: "14 months" / "10+ years" when capped /
     "Self-funding".
   - Colour by **status** using `--color-status-*` tokens: `< RUNWAY_CRITICAL_MONTHS`
     → critical, `< RUNWAY_WARNING_MONTHS` → warning, otherwise or self-funding → good.
   - Build with `ChartContainer` + a `ChartConfig`. Do **not** import Recharts'
     `ResponsiveContainer`/`Tooltip` directly. Don't use `--color-series-*` here;
     these colours encode state, not identity.
   - Status must not rely on colour alone: the value label carries the meaning.
5. **"How this is calculated" (collapsible, closed by default):** the validation
   panel. A small table, one row per scenario:
   | Scenario | Monthly cashflow | Adjustment | Out-of-pocket | Cash ÷ out-of-pocket | Runway |
   Show the actual arithmetic, e.g. "−$600 − $1,500 (2% × $900,000 ÷ 12) = −$2,100";
   "$30,000 ÷ $2,100 = 14.3 months". Then one line of assumptions: "Rates +2% assumes
   interest on all debt rises 2 points; repayments may differ for principal-and-interest
   loans. Vacancy removes one month of rent from the highest-rent property."

### Empty and edge states

- No portfolio or no properties: don't render the card.
- All scenarios self-funding: the chart shows three "Self-funding" rows; that's a
  valid, good outcome, not an error.

### Copy rules

- Observations, not advice: "Your cash covers about 10 months if …", never
  "you should …".
- Currency via `formatters.ts`. Chart labels: months to 1 decimal under 12, whole
  numbers above. The calculation panel always shows 1 decimal.

## 7. Stretch (only if everything above is done and green)

- Add one rule to `generateInsights.ts`: when a runway is known and the `vacancy`
  scenario is `< RUNWAY_WARNING_MONTHS`, push a `warning` insight ("Your cash would
  cover about N months if <property> sat vacant"), plus a test. Map it in
  `decisionSurface.ts` if it fits an existing dimension. Note this needs the reserve
  passed in, so skip it if that means threading client state server-side.

## 8. Acceptance criteria

1. `computeRunway` exists, is pure, and all §5 tests pass; `npm test`, `npm run lint`
   and `npm run build` succeed.
2. The Portfolio tab shows the "Your position" card above existing content for a
   portfolio with properties.
3. Entering a cash amount updates all three bars immediately; clearing it returns
   negative-cashflow rows to "Add cash to see runway".
4. Invalid input (negative, text) shows the inline error and doesn't change the chart.
5. The "How this is calculated" panel reproduces every displayed runway number from
   visible inputs.
6. No migration, API route, or persistence was added.
7. Chart follows the `ChartContainer` + token conventions in `CLAUDE.md`.

## 9. Follow-ups (not this PRD)

- Persist `cash_reserve` on `portfolios` and `offset_balance` per property (migration +
  RLS + Zod + edit form), then compute runway server-side on the dashboard.
- Runway insights (critical vs `minimum_cash_buffer` goal; warning under 6 months).
- Optional cash-buffer question and runway in the pre-auth onboarding reveal.

# HTAG integration — pricing, gotchas, and what the data is worth

Everything here was measured against the live API (September 2026), not read off
the pricing page. Where the two disagree, the measurement is noted — they
disagree in several places that matter.

Raw captures live in `tmp/htag-probe/` (gitignored). The throwaway probe and
loader that produced them are under `src/app/api/dev/`.

---

## 1. Billing model

Prepaid **AUD balance**, billed **per row returned** — not per request. Every
response carries headers, already parsed and logged by `htag/server.ts` as
`[htag:billing]`:

| Header | Meaning |
|---|---|
| `x-billing-cost` | AUD charged for this request |
| `x-billing-balance` | Account balance after the deduction |
| `x-billing-units` | Billable units — rows, addresses or properties, endpoint-dependent |
| `x-billing-tier` | `free` \| `tier1` \| `tier2` \| `tier3` |
| `x-billing-free-remaining` / `-granted` | Per-endpoint free allowance |

**Every endpoint has its own free allowance of roughly 25 units.** This is the
single most important fact for cost planning, and it is not on the pricing page.

Non-2xx responses are **not charged**, so a malformed request costs nothing but
the round trip. Quota is 100,000 billable rows per month, per endpoint, with
volume discounts at 30k and 70k.

### Published tiers vs what we were charged

| Tier | Published $/row | Measured |
|---|---|---|
| Reference | $0.001 | **$0.002** (2x) |
| Standard | $0.034 | not reached — free allowance covered it |
| Enhanced | $0.057 | not reached |
| Premium | $0.081 | not reached |
| Restricted | $0.111 | not sampled |

Worked example: `/markets/trends/price` returned 288 rows. 25 were free, 263
were charged, total $0.526 — exactly $0.002 per charged row.

### The rule that follows

> **Cost is driven by row count, not by tier.** Snapshot-shaped endpoints return
> ~1 row per property or per suburb, so they stay inside the free allowance and
> are effectively **free below ~25 subjects**. Time-series endpoints return one
> row per month and blow through it immediately.

Pulling all 30 snapshot endpoints (13 locality + 17 per-property) for a
4-property portfolio cost **$0.22**. Three time-series calls cost **$1.58**.

---

## 2. Endpoint gotchas

Each of these cost real debugging time.

**`/address/geocode` returns `score: null` for every candidate.** The field is
documented but never populated. `PropertyWizard` originally gated on
`score >= 0.8`, which can never pass, so the wizard never auto-confirmed an
address and always fell through to manual disambiguation. Match on the
structured fields instead — see `htag/matchAddress.ts`.

**Address-feature endpoints take `address_keys` (plural, CSV, up to 50).** They
have **no** single-address mode; passing `address_key` returns 400. One call
covers the whole portfolio.

**Market endpoints take `area_id` as an array**, and `level` (`suburb` | `lga`)
is **required**.

**`limit` defaults to 100, max 1000.** A 36-month series across 4 localities is
144 rows and will silently truncate unless you set it.

**Trend endpoints return both `house` and `unit` rows**, doubling the row count —
and therefore the bill — unless `property_type` is set.

**`rent_estimate` and `median_rent` are WEEKLY.** Convert with `* 52 / 12`.

**Vacancy, days-on-market, inventory and stock-on-market are Restricted tier as
*time series*.** Pull them as current values from `/markets/demand` instead; the
series would have cost ~$24 where the snapshot was free.

---

## 3. Join keys

`/address/geocode` returns far more than the wrapper originally kept:

```
address_key, gnaf_property_pid, legal_parcel_id,
loc_pid, lga_pid, sa1_code21, sa2_code21, sa4_name21, gcc_name21,
lat, lon, locality_name, postcode, state, ...
```

**`loc_pid` is the `area_id` that every `/markets/*` endpoint takes.** It is
persisted on `properties.htag_loc_pid` alongside `htag_address_key`, so
server-side market lookups never need to re-geocode.

---

## 4. Data quality, measured

- **Price series reaches back to 2018-01** (104 months sampled); rent and yield
  were pulled for 36.
- **Zero nulls** across four localities, including regional Toukley — where
  OpenStreetMap has no building data at all. HTAG's coverage is materially
  better than OSM's.
- The series is **smoothed, not a raw median**: paths are monotonic despite only
  5-23 sales per month, so month-to-month ratios are usable without further
  smoothing.
- `/markets/summary.confidence` reports how much to trust a locality's figures.
- **Back-indexing validated**: taking Bellbird Park's current estimate back to
  its 2021 sale via the locality price index predicted $532,237 against an
  actual $520,000 — **+2.4% error over five years**. This is the basis for the
  reconstructed snapshot backfill.
- `/property/history` returns **real recorded transactions back to 1981** in our
  sample, with beds/baths/land area per event.
- **`own_status` disagreed with the portfolio** on all four properties (HTAG
  said "owner occupied" for tenanted properties). Treat it as a cross-check
  signal, not as truth.

---

## 5. What is worth pulling

Ranked for a portfolio-performance product. All of these were free at
4-property scale.

| Endpoint | Why it matters |
|---|---|
| `/markets/growth/{cumulative,annualised}` | Pre-computed price/rent/yield growth at 1m-10y in one row. Deeper than any series we store. |
| `/markets/demand` | `dom`, `vacancy_rate`, `discounting`, `clearance_rate` — the only real inputs for a liquidity measure. |
| `/markets/cycle` | Cycle position plus **forward** projections; everything else in the product looks backwards. |
| `/address/environment` | `flood`, `bushfire`, `heritage`, `zoning` per property — bears on insurability and resale. |
| `/property/summary` | beds/baths/parking/lot_size/build date — enables $/m² and bedroom-matched comparison. |
| `/markets/summary` | Headline figures plus `confidence`. |
| `/markets/{scores,fundamentals,risk}` | Composite scores, affordability, suburb hazard indices. |
| `/economics/cpi/*` | Real vs nominal returns. Cheap and rarely shown anywhere. |

Deliberately skipped: `amenities`, `aviation`, `road-infrastructure`, `hazards`,
`nuisance`. Free and interesting, but they are **buy-side** data — they explain
why a property is *worth* something rather than how it is *performing*, and
adding them drifts the product toward a research portal.

---

## 6. Where this data lands

| Table | Contents |
|---|---|
| `market_trends` | Locality monthly series (price, rent, yield) |
| `market_snapshots` | Current locality conditions, all 13 endpoints merged, plus `raw jsonb` |
| `property_market_facts` | Per-property estimates, attributes, environmental overlays |
| `property_transactions` | Observed sale and rental history |
| `properties.htag_address_key` / `.htag_loc_pid` | Join keys |

`market_trends` and `market_snapshots` are **not user-owned** — they describe
public suburb conditions shared by every user holding property there. Their RLS
allows any authenticated read; writes are currently open to authenticated users
because ingestion runs as the signed-in user, and **must move to a service role
before production**.

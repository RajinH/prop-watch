# HTAG integration — pricing, gotchas, and what the data is worth

Everything here was measured against the live API (September 2026), not read off
the pricing page. Where the two disagree, the measurement is noted — they
disagree in several places that matter.

**Revised 2026-09-16.** The original cost rule in §1 was measured on fresh free
allowances and understated steady-state cost by roughly 24x. See "What tier1
actually costs" below before doing any cost planning.

Raw captures live in `tmp/htag-probe/` (gitignored). The throwaway probe and
loader that produced them are under `src/app/api/dev/`.

---

## 1. Billing model

Prepaid **AUD balance**, billed **per billable unit** — not per request, and not
always per row. A unit is a row on most endpoints but a *subject* on some:
`/address/geocode` bills 1 unit for a call returning 10 candidate rows. Every
response carries headers, already parsed and logged by `htag/server.ts` as
`[htag:billing]`:

| Header | Meaning |
|---|---|
| `x-billing-cost` | AUD charged for this request |
| `x-billing-balance` | Account balance after the deduction |
| `x-billing-units` | Billable units — rows, addresses or properties, endpoint-dependent |
| `x-billing-tier` | `free` \| `tier1` \| `tier2` \| `tier3` |
| `x-billing-free-remaining` | Free units left on this endpoint after the call |
| `x-billing-free-granted` | Free units consumed **by this call** — not a monthly total |

**Every endpoint has its own free allowance of roughly 25 units.** This is the
single most important fact for cost planning, and it is not on the pricing page.

Non-2xx responses are **not charged**, so a malformed request costs nothing but
the round trip. Quota is 100,000 billable rows per month, per endpoint, with
volume discounts at 30k and 70k.

### What tier1 actually costs

`tier1` is **not one price**. The tier name is not what sets the rate — the
endpoint class is:

| Endpoint class | Measured post-allowance rate |
|---|---|
| Snapshots (`/markets/*` current values, `/address/geocode`) | **$0.031 per unit** |
| Series (`/markets/trends/*`) | **$0.002 per row** |

A snapshot unit costs **15x a series row**. Both report `tier1`.

Measured 2026-09-16 on `/markets/summary`: 4 localities with no `property_type`
filter = 8 units, of which 7 were free and 1 was charged, `x-billing-cost` =
$0.031. The header breakdown isolates the rate exactly.

Earlier measurement, still correct: `/markets/trends/price` returned 288 rows,
25 free, 263 charged, total $0.526 — exactly $0.002 per charged row.

Published tiers (Reference $0.001 / Standard $0.034 / Enhanced $0.057 /
Premium $0.081 / Restricted $0.111) never matched an observed charge. Ignore
them; measure the endpoint you intend to use.

### The rule that follows

> **Free allowance is the only thing making snapshots cheap, and it is ~25 units
> per endpoint per month.** Inside it, snapshots are free. Outside it, they are
> the most expensive thing in the API per unit of information.

The original version of this document said cost is driven by row count rather
than tier, and that pulling all 30 snapshot endpoints (13 locality +
17 per-property) for a 4-property portfolio cost **$0.22**. That figure was
real but measured on fresh allowances. The same pull at steady state is
**172 units x $0.031 = ~$5.33** — about **24x** more. Plan against the second
number.

### Cost per locality, one full refresh, allowances exhausted

| | Unfiltered | With `property_type` set |
|---|---|---|
| 13 locality snapshots | 26 units → **$0.81** | 13 units → **$0.40** |
| 3 trends series (36mo) | 216 rows → **$0.43** | 108 rows → **$0.22** |
| **Total per locality** | **~$1.24** | **~$0.62** |

Setting `property_type` halves everything, snapshots included.

Across 13 snapshot endpoints the monthly allowance is roughly 325 free units,
or about **160 locality-refreshes per month at zero cost**.

**The cost shape that hurts** is refreshing on a schedule rather than on demand:
cost then scales with *suburb coverage* instead of user count, and you pay for
suburbs nobody looks at. Refresh only localities where a user actually holds
property, and only when stale. Done that way the worst case stays bounded by
user count — roughly $0.37/user/month at 1,000 users across 300 suburbs.

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

**`rent_estimate` and `median_rent` are WEEKLY.** Convert with `* 52 / 12`, not
`* 4` — the naive version is ~8% low.

**`/address/geocode` has no free allowance at all** (`free-granted: 0`), unlike
every other endpoint. It bills **$0.031 per address queried** from the first
call. It is billed per address, not per candidate returned — 1 unit for 10 rows
— so there is no saving in narrowing the query. This is the single most
expensive call in the normal user flow.

**`bedrooms` is a request parameter, not just a response field.** Every capture
shows `bedrooms: "All"` only because the probe never passed one. Passing
`bedrooms=N` to `/markets/summary` or `/markets/trends/rent` returns
bedroom-matched figures, which are materially different from the rollup —
measured on NSW3961 houses: 2bd $494, 3bd $615, 4bd $769, against an "All"
figure of $625. The rollup overprices a 2-bed by 26% and underprices a 4-bed
by 19%. Segments with no data return all-nulls rather than an error.

**`confidence` does not track sample size.** The same NSW3961 query returns
`confidence: High` on a 4-bedroom median built from **two** rentals. Gate any
user-facing claim on the `rentals` count yourself; below ~5 comparables the
figure is context, not evidence.

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
  smoothing. The rent series makes this unmistakable — a bedroom-filtered pull
  returned 607/609/611/613/615/617 over six months with `rentals` pinned at 4,
  so the count is a trailing window, not six independent monthly samples. Good
  for direction; do not present it as six observations.
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
| `/markets/summary` | Headline figures plus `confidence`. Pass `bedrooms=N` for a bedroom-matched median rent — the strongest input available for a rent-optimisation insight. |
| `/markets/{scores,fundamentals,risk}` | Composite scores, affordability, suburb hazard indices. |
| `/economics/cpi/*` | Real vs nominal returns. Cheap and rarely shown anywhere. |

**HTAG has no property-cost data of any kind.** Checked the full field list of
every endpoint 2026-09-16: no council rates, strata or body corporate, land tax,
insurance premiums, management fees — and no land value, which is the field that
would unlock rates and land tax. It is a valuation and market API; costs are out
of scope. The nearest usable signals are `/property/summary.lot_size` and
`.build_reno_date` (inputs to a maintenance estimate) and
`/address/environment.flood` / `.bushfire` (which explain an insurance premium
but cannot price one). Don't re-investigate this.

Deliberately skipped: `amenities`, `aviation`, `road-infrastructure`, `hazards`,
`nuisance`. Free and interesting, but they are **buy-side** data — they explain
why a property is *worth* something rather than how it is *performing*, and
adding them drifts the product toward a research portal.

---

## 6. What production actually calls

Measured from the call graph 2026-09-16. Only **two** endpoints are reachable
outside the dev routes, and both are called only by `PropertyWizard`:

| Call | Trigger | Cost |
|---|---|---|
| `/address/geocode` | user picks an address from Checkify autocomplete | **$0.031** per address |
| `/property/estimates` | user clicks *Prefill* | free tier, 1 unit |

Neither fires on keystroke or page load, and both check the localStorage cache
first. **So the marginal cost of a user adding a property is ~$0.031**, entirely
geocode. Realistically $0.03-$0.10 once you allow for correcting a wrong address
pick and for the cache being per-browser, so a second device re-pays.

Two consequences worth holding onto:

- **Free users cost nothing.** Onboarding is pre-auth and never touches HTAG —
  `AddressAutocomplete` lives only in `PropertyWizard`, which sits behind the
  paywall, and `/api/htag/*` returns 402 without an entitlement.
- **Market data is not ingested in production.** `market_snapshots` and
  `market_trends` are read by `/market` but written only by
  `/api/dev/htag-load`, which 404s outside development. The Market page has no
  data for real users until that ingestion moves into a production path.

## 7. Where this data lands

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

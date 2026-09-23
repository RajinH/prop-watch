-- Current market conditions per locality, and the static profile of each
-- property. Both are "snapshot" shaped: one row per subject, refreshed rather
-- than accumulated, which is what makes them cheap — HTAG bills per row, so a
-- one-row-per-suburb endpoint stays inside its free allowance where a monthly
-- series does not.
--
-- Field names mirror HTAG's payloads (captured 2026-09-09). Scalars the UI and
-- engine actually read are promoted to columns; the untouched remainder is kept
-- in `raw` so new fields can be used later without a migration.

create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  area_id text not null,
  area_level text not null default 'suburb' check (area_level in ('suburb', 'lga')),
  property_type text not null,
  period_end date not null,

  -- headline (/markets/summary)
  typical_price numeric,
  median_rent numeric,              -- weekly AUD
  gross_yield numeric,
  annual_sales_volume integer,
  annual_rental_volume integer,
  estimated_dwellings integer,
  -- HTAG's own view of how much to trust this row. Thin suburbs trade rarely,
  -- so a median there moves on composition rather than on value.
  confidence text,

  -- liquidity (/markets/demand) — how quickly, and at what discount, stock moves
  days_on_market numeric,
  vacancy_rate numeric,
  discounting numeric,
  clearance_rate numeric,
  buy_search_index numeric,
  rent_search_index numeric,

  -- supply (/markets/supply)
  inventory_months numeric,
  building_approvals numeric,
  typical_hold_period numeric,

  -- cycle and forward projections (/markets/cycle) — the only forward-looking
  -- figures available anywhere in the product
  cycle_position text,
  projected_growth_low numeric,
  projected_growth_high numeric,
  projected_rent_increase numeric,
  projected_roi_low numeric,
  projected_roi_high numeric,

  -- composite scores (/markets/scores)
  score_overall numeric,
  score_cashflow numeric,
  score_capital_growth numeric,
  score_lower_risk numeric,
  volatility_index numeric,

  -- fundamentals (/markets/fundamentals) and risk indices (/markets/risk)
  irsad_decile numeric,
  years_to_own numeric,
  rent_own_ratio numeric,
  risk_flood numeric,
  risk_fire numeric,
  economic_diversity numeric,

  -- multi-horizon growth (/markets/growth/{cumulative,annualised}). HTAG returns
  -- these pre-computed back to 10 years, far deeper than our stored series.
  price_growth_1y numeric,
  price_growth_3y numeric,
  price_growth_5y numeric,
  price_growth_10y numeric,
  rent_growth_1y numeric,
  rent_growth_3y numeric,
  rent_growth_5y numeric,
  rent_growth_10y numeric,
  price_growth_1y_annualised numeric,
  price_growth_3y_annualised numeric,
  price_growth_5y_annualised numeric,
  price_growth_10y_annualised numeric,
  rent_growth_1y_annualised numeric,
  rent_growth_3y_annualised numeric,
  rent_growth_5y_annualised numeric,
  rent_growth_10y_annualised numeric,

  raw jsonb not null default '{}',
  fetched_at timestamptz not null default now(),
  unique (area_id, area_level, property_type)
);

create index if not exists market_snapshots_area_idx
  on public.market_snapshots (area_id, property_type);

-- Static per-property profile: physical attributes and environmental overlays.
-- None of this changes month to month, so it is bought once per property.
alter table public.property_market_facts
  add column if not exists property_type text,
  add column if not exists beds integer,
  add column if not exists baths integer,
  add column if not exists parking integer,
  add column if not exists lot_size numeric,
  add column if not exists floor_area numeric,
  add column if not exists build_reno_date date,
  add column if not exists own_status text,
  add column if not exists flood boolean,
  add column if not exists bushfire boolean,
  add column if not exists heritage text,
  add column if not exists zoning text;

comment on column public.property_market_facts.own_status is
  'HTAG''s view of occupancy. Worth cross-checking against the portfolio''s own tenancy record — a disagreement means one of the two is stale.';

-- Market data has no owner: it describes public suburb conditions shared by
-- every user holding property there. Same policy shape as market_trends.
alter table public.market_snapshots enable row level security;

create policy "market_snapshots_read" on public.market_snapshots
  for select using (auth.uid() is not null);

-- TODO: as with market_trends, move ingestion to a service role before
-- production so reference data cannot be written from a user session.
create policy "market_snapshots_write" on public.market_snapshots
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

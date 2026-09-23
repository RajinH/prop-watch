-- HTAG market data: the external reference frame the engine has never had.
--
-- Shapes here mirror the payloads HTAG actually returns (captured 2026-09-09),
-- not the API docs. Three concerns, deliberately separate because they have very
-- different lifecycles:
--   market_trends          locality time series, shared across all users
--   property_market_facts  current HTAG view of one property, refreshed
--   property_transactions  observed sale/rental history, effectively immutable

-- Join keys onto HTAG. Both come back from /address/geocode, which the wizard
-- already calls and pays for — they were simply being discarded. Persisting them
-- means server-side market lookups never need to re-geocode.
alter table public.properties
  add column if not exists htag_address_key text,
  add column if not exists htag_loc_pid text;

comment on column public.properties.htag_loc_pid is
  'HTAG locality id. This is the area_id every /markets/* endpoint takes.';

-- ---------------------------------------------------------------------------
-- Locality trends. One row per area/period/type/bedrooms, merging the price,
-- rent and yield series (they share a key, so keeping them apart would mean
-- three-way joins for every read).
--
-- NOT user-owned: this is reference data about suburbs, shared by every user who
-- owns property there. That is the point — cost scales with geography, not with
-- the user base.
-- ---------------------------------------------------------------------------
create table if not exists public.market_trends (
  id uuid primary key default gen_random_uuid(),
  area_id text not null,
  area_level text not null default 'suburb' check (area_level in ('suburb', 'lga')),
  period_end date not null,
  property_type text not null,
  bedrooms text not null default 'All',
  typical_price numeric,
  sales_count integer,
  median_rent numeric,          -- weekly AUD, as HTAG reports it
  rentals_count integer,
  gross_yield numeric,          -- fraction, e.g. 0.0332
  fetched_at timestamptz not null default now(),
  unique (area_id, area_level, period_end, property_type, bedrooms)
);

create index if not exists market_trends_area_period_idx
  on public.market_trends (area_id, property_type, period_end desc);

-- ---------------------------------------------------------------------------
-- Per-property current market view. One row per property.
-- ---------------------------------------------------------------------------
create table if not exists public.property_market_facts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  address_key text not null,
  loc_pid text,
  lga_pid text,
  sa2_code21 text,
  price_estimate numeric,
  rent_estimate_weekly numeric, -- HTAG reports rent weekly; convert with *52/12
  last_sold_price numeric,
  last_sold_date date,
  last_rented_price numeric,
  last_rented_date date,
  rental_percentage numeric,    -- share of the street/area rented, from /property/market
  years_to_own numeric,
  hold_period numeric,
  ownership text,
  htag_last_updated date,
  fetched_at timestamptz not null default now(),
  unique (property_id)
);

-- ---------------------------------------------------------------------------
-- Observed transaction history from /property/history. These are real recorded
-- events (some reach back to 1990), so unlike a reconstructed snapshot series
-- they are fact, not derivation.
-- ---------------------------------------------------------------------------
create table if not exists public.property_transactions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  kind text not null check (kind in ('sale', 'rental')),
  event_date date not null,
  price numeric,                -- whole AUD for sales, AUD/week for rentals; null when undisclosed
  bedrooms integer,
  bathrooms integer,
  car_spaces integer,
  land_area numeric,
  floor_area numeric,
  fetched_at timestamptz not null default now(),
  unique (property_id, kind, event_date, price)
);

create index if not exists property_transactions_property_idx
  on public.property_transactions (property_id, event_date desc);

-- ---------------------------------------------------------------------------
-- RLS. Per CLAUDE.md every table enables it; the two property-scoped tables
-- reuse the existing property -> portfolio ownership chain verbatim.
-- ---------------------------------------------------------------------------
alter table public.market_trends enable row level security;
alter table public.property_market_facts enable row level security;
alter table public.property_transactions enable row level security;

-- market_trends has no owner, so ownership cannot gate it. Any signed-in user
-- may read it: it describes public suburb-level market conditions and contains
-- nothing personal.
create policy "market_trends_read" on public.market_trends
  for select using (auth.uid() is not null);

-- Writes are open to authenticated users only because the loader currently runs
-- as the signed-in user (there is no service-role key in this project).
-- TODO: before production, move ingestion to a service role and drop this policy
-- so reference data cannot be altered from a user session.
create policy "market_trends_write" on public.market_trends
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "property_market_facts_owner" on public.property_market_facts
  for all using (
    exists (
      select 1 from public.properties pr
      join public.portfolios po on po.id = pr.portfolio_id
      where pr.id = property_id and po.user_id = auth.uid()
    )
  );

create policy "property_transactions_owner" on public.property_transactions
  for all using (
    exists (
      select 1 from public.properties pr
      join public.portfolios po on po.id = pr.portfolio_id
      where pr.id = property_id and po.user_id = auth.uid()
    )
  );

-- Decision intelligence layer: investor goals, engine runs, recommendations,
-- events, and outcomes. See docs/decision-intelligence-mvp.md.

-- 1. New user-entered facts powering the rent-review strategy
alter table public.properties
  add column if not exists comparable_monthly_rent numeric,
  add column if not exists last_rent_review_date date;

-- 2. One primary investor goal per portfolio
create table public.investor_goals (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  type text not null check (type in ('improve_cashflow', 'prepare_next_purchase', 'reduce_debt', 'reduce_risk')),
  target_value numeric,
  target_date date,
  max_monthly_deficit numeric,
  minimum_cash_buffer numeric,
  risk_tolerance text not null default 'balanced' check (risk_tolerance in ('conservative', 'balanced', 'growth')),
  available_lump_sum numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portfolio_id)
);

-- 3. Immutable audit of every decision-engine run.
-- detected_conditions/candidates/evaluations are embedded jsonb rather than
-- tables: write-once audit data with no independent query path in the MVP.
create table public.decision_engine_runs (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  engine_version text not null,
  goal_id uuid references public.investor_goals(id) on delete set null,
  snapshot_date date,
  trigger text not null check (trigger in ('property_write', 'goal_change', 'settings_change', 'assumption_change', 'status_change', 'scheduled', 'manual')),
  config jsonb not null default '{}',
  detected_conditions jsonb not null default '[]',
  candidates jsonb not null default '[]',
  evaluations jsonb not null default '[]',
  baseline jsonb,
  changes jsonb,
  created_at timestamptz not null default now()
);

create index decision_engine_runs_portfolio_idx
  on public.decision_engine_runs (portfolio_id, created_at desc);

-- 4. Live recommendation state. The row is the mutable current view
-- (re-ranked each run); history lives in runs + events. Identity is
-- (portfolio, action_type, property) — one live row per underlying decision.
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  action_type text not null check (action_type in ('review_refinance', 'review_rent', 'pay_down_debt')),
  status text not null default 'new' check (status in ('new', 'viewed', 'investigating', 'deferred', 'dismissed', 'completed', 'expired')),
  rank integer,
  score numeric,
  confidence text check (confidence in ('low', 'medium', 'high')),
  score_components jsonb not null default '{}',
  payload jsonb not null,
  assumption_overrides jsonb not null default '{}',
  engine_version text not null,
  first_run_id uuid references public.decision_engine_runs(id) on delete set null,
  last_run_id uuid references public.decision_engine_runs(id) on delete set null,
  deferred_until date,
  status_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index recommendations_identity
  on public.recommendations (portfolio_id, action_type, coalesce(property_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index recommendations_portfolio_status_idx
  on public.recommendations (portfolio_id, status);

-- 5. Event log: state transitions + product analytics (this table IS the
-- MVP analytics store — usefulness metrics are SQL over these rows).
create table public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'viewed', 'assumptions_opened', 'assumptions_changed', 'status_changed', 're_evaluated', 'expired', 'outcome_recorded')),
  from_status text,
  to_status text,
  reason text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index recommendation_events_portfolio_idx
  on public.recommendation_events (portfolio_id, created_at desc);

create index recommendation_events_recommendation_idx
  on public.recommendation_events (recommendation_id);

-- 6. Estimated-vs-actual outcome per completed recommendation
create table public.recommendation_outcomes (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  recommendation_id uuid not null unique references public.recommendations(id) on delete cascade,
  estimated jsonb not null,
  actual_monthly_delta numeric,
  actual_one_off_cost numeric,
  actual_rate numeric,
  notes text,
  created_at timestamptz not null default now()
);

-- RLS: ownership via the portfolio chain, matching every existing table
alter table public.investor_goals enable row level security;
create policy "investor_goals_owner" on public.investor_goals
  for all using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
  );

alter table public.decision_engine_runs enable row level security;
create policy "decision_engine_runs_owner" on public.decision_engine_runs
  for all using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
  );

alter table public.recommendations enable row level security;
create policy "recommendations_owner" on public.recommendations
  for all using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
  );

alter table public.recommendation_events enable row level security;
create policy "recommendation_events_owner" on public.recommendation_events
  for all using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
  );

alter table public.recommendation_outcomes enable row level security;
create policy "recommendation_outcomes_owner" on public.recommendation_outcomes
  for all using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
  );

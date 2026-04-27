-- profiles: app-level user metadata linked to auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- portfolios: a user's property portfolio
create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'My Portfolio',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);
create index portfolios_user_id_idx on public.portfolios(user_id);

-- properties: user-entered property facts (source of truth)
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  name text not null,
  current_value numeric not null default 0,
  current_debt numeric not null default 0,
  monthly_rent numeric not null default 0,
  monthly_repayment numeric not null default 0,
  annual_expenses numeric not null default 0,
  purchase_price numeric,
  purchase_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index properties_portfolio_id_idx on public.properties(portfolio_id);

-- property_snapshots: computed state at a point in time per property
create table public.property_snapshots (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  snapshot_date date not null default current_date,
  value numeric not null,
  debt numeric not null,
  equity numeric not null,
  monthly_cashflow numeric not null,
  lvr numeric,
  yield numeric,
  created_at timestamptz not null default now(),
  unique(property_id, snapshot_date)
);
create index property_snapshots_property_id_date_idx
  on public.property_snapshots(property_id, snapshot_date desc);

-- portfolio_snapshots: computed state at a point in time for the portfolio
create table public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  snapshot_date date not null default current_date,
  total_value numeric not null,
  total_debt numeric not null,
  total_equity numeric not null,
  monthly_cashflow numeric not null,
  weighted_lvr numeric,
  yield numeric,
  created_at timestamptz not null default now(),
  unique(portfolio_id, snapshot_date)
);
create index portfolio_snapshots_portfolio_id_date_idx
  on public.portfolio_snapshots(portfolio_id, snapshot_date desc);

-- insights: rule-based interpretations of portfolio/property state
create table public.insights (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  type text not null,
  severity text not null,
  title text not null,
  description text not null,
  impact numeric,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index insights_portfolio_id_status_idx on public.insights(portfolio_id, status);
create index insights_property_id_idx on public.insights(property_id);

-- scenarios: saved scenario configurations
create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scenarios_portfolio_id_idx on public.scenarios(portfolio_id);

-- RLS: enable on all application tables
alter table public.profiles enable row level security;
alter table public.portfolios enable row level security;
alter table public.properties enable row level security;
alter table public.property_snapshots enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.insights enable row level security;
alter table public.scenarios enable row level security;

-- profiles: own row only
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id);

-- portfolios: own rows only
create policy "portfolios_owner" on public.portfolios
  for all using (auth.uid() = user_id);

-- properties: via portfolio ownership
create policy "properties_owner" on public.properties
  for all using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
  );

-- property_snapshots: via property -> portfolio ownership
create policy "property_snapshots_owner" on public.property_snapshots
  for all using (
    exists (
      select 1 from public.properties pr
      join public.portfolios po on po.id = pr.portfolio_id
      where pr.id = property_id and po.user_id = auth.uid()
    )
  );

-- portfolio_snapshots: via portfolio ownership
create policy "portfolio_snapshots_owner" on public.portfolio_snapshots
  for all using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
  );

-- insights: via portfolio ownership
create policy "insights_owner" on public.insights
  for all using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
  );

-- scenarios: via portfolio ownership
create policy "scenarios_owner" on public.scenarios
  for all using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
  );

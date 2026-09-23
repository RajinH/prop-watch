-- Usage ledger and caps for the paid external APIs (HTAG, Checkify).
--
-- Every call from a user-facing route claims a row here first. The claim checks
-- two limits and records the call in one transaction:
--   * per user, per provider, over a rolling 24 hours (stops one account, or a
--     script using its session, draining the balance)
--   * per provider, per calendar month in Sydney time (a hard ceiling on spend,
--     whatever the number of users)
-- Once the upstream call returns, the route settles the row with the actual
-- charge from HTAG's billing headers, so the monthly budget tracks real spend.
--
-- Service role only: RLS is on with no policies, and both functions are
-- revoked from anon and authenticated. A user who could write here could zero
-- out their own charges and lift the budget for everyone.

create table public.api_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  provider      text not null check (provider in ('htag', 'checkify')),
  endpoint      text not null,
  -- Charge assumed at claim time, used until the real one is known.
  est_cost_aud  numeric not null default 0,
  -- Actual charge once settled; null while in flight or when the provider
  -- doesn't report one (Checkify).
  cost_aud      numeric,
  created_at    timestamptz not null default now()
);

create index api_usage_user_recent_idx
  on public.api_usage(user_id, provider, created_at desc);
create index api_usage_provider_recent_idx
  on public.api_usage(provider, created_at desc);

alter table public.api_usage enable row level security;

create or replace function public.claim_api_call(
  p_user_id            uuid,
  p_provider           text,
  p_endpoint           text,
  p_est_cost_aud       numeric,
  p_user_daily_limit   integer,
  p_monthly_budget_aud numeric,  -- null = no spend ceiling
  p_monthly_call_limit integer   -- null = no call ceiling
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month_start timestamptz :=
    date_trunc('month', now() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney';
  v_user_calls  integer;
  v_month_spend numeric;
  v_month_calls integer;
  v_id          bigint;
begin
  -- Serialise claims per provider so two concurrent requests can't both see
  -- room under a limit and both take it. Held only for this transaction.
  perform pg_advisory_xact_lock(hashtext('api_usage:' || p_provider));

  select count(*) into v_user_calls
    from public.api_usage
   where user_id = p_user_id
     and provider = p_provider
     and created_at > now() - interval '24 hours';

  if v_user_calls >= p_user_daily_limit then
    return jsonb_build_object('ok', false, 'reason', 'user_daily');
  end if;

  select coalesce(sum(coalesce(cost_aud, est_cost_aud)), 0), count(*)
    into v_month_spend, v_month_calls
    from public.api_usage
   where provider = p_provider
     and created_at >= v_month_start;

  if p_monthly_budget_aud is not null
     and v_month_spend + p_est_cost_aud > p_monthly_budget_aud then
    return jsonb_build_object('ok', false, 'reason', 'monthly_budget');
  end if;

  if p_monthly_call_limit is not null and v_month_calls >= p_monthly_call_limit then
    return jsonb_build_object('ok', false, 'reason', 'monthly_calls');
  end if;

  insert into public.api_usage (user_id, provider, endpoint, est_cost_aud)
  values (p_user_id, p_provider, p_endpoint, p_est_cost_aud)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.settle_api_call(p_id bigint, p_cost_aud numeric)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.api_usage set cost_aud = p_cost_aud where id = p_id;
$$;

revoke all on function public.claim_api_call(uuid, text, text, numeric, integer, numeric, integer)
  from public, anon, authenticated;
revoke all on function public.settle_api_call(bigint, numeric)
  from public, anon, authenticated;
grant execute on function public.claim_api_call(uuid, text, text, numeric, integer, numeric, integer)
  to service_role;
grant execute on function public.settle_api_call(bigint, numeric) to service_role;

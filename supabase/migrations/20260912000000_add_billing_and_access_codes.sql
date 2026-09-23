-- Paywall: entitlements, access codes, and redemption.
--
-- Billing state deliberately does NOT live on `profiles`. The existing
-- "profiles_self" policy is `for all using (auth.uid() = id)` with no WITH
-- CHECK, so a signed-in user can UPDATE their own profiles row with the
-- publishable key — an `is_subscribed` column there would be self-grantable
-- from the browser console. `entitlements` is readable but not writable by its
-- owner; only the service role (Stripe webhook) and the SECURITY DEFINER
-- redemption function below can write it.
--
-- One row per user answers "does this user have access?", whether that access
-- came from Stripe or from a comp code. Access is derived at read time from
-- these columns (see src/lib/propwatch/access/resolveAccess.ts), so an expiring
-- comp needs no scheduled job.

-- Comp codes. Never stored in plaintext: code_hash is
-- HMAC-SHA256(normalised code, ACCESS_CODE_PEPPER). pepper_version exists from
-- day one because retrofitting rotation means dual-verification of every code.
create table public.access_codes (
  id              uuid primary key default gen_random_uuid(),
  code_hash       bytea not null unique,
  pepper_version  smallint not null default 1,
  label           text not null,
  grant_days      integer check (grant_days is null or grant_days > 0),
  uses_remaining  integer not null default 1 check (uses_remaining >= 0),
  expires_at      timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);

create table public.access_code_redemptions (
  id           uuid primary key default gen_random_uuid(),
  code_id      uuid not null references public.access_codes(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  redeemed_at  timestamptz not null default now(),
  unique (code_id, user_id)
);
create index access_code_redemptions_user_id_idx on public.access_code_redemptions(user_id);

-- Failed redemption attempts, for the brute-force throttle. Only failures are
-- recorded; successes are in access_code_redemptions.
create table public.access_code_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  attempted_at  timestamptz not null default now()
);
create index access_code_attempts_user_recent_idx
  on public.access_code_attempts(user_id, attempted_at desc);

create table public.entitlements (
  user_id                 uuid primary key references public.profiles(id) on delete cascade,

  -- Stripe mirror. Written only by the webhook via the service role. Raw Stripe
  -- values are stored verbatim and interpreted in TypeScript, never in SQL.
  stripe_customer_id      text unique,
  stripe_subscription_id  text,
  stripe_price_id         text,
  stripe_status           text,
  stripe_access_until     timestamptz,
  stripe_cancel_at        timestamptz,
  stripe_trial_end        timestamptz,
  -- Wall-clock time of the Stripe read that produced this row. Stripe does not
  -- guarantee event ordering, so a write carrying an older stamp is dropped.
  stripe_synced_at        timestamptz,

  -- Comp grant. comp_source set with comp_until null means access forever.
  comp_source             text check (comp_source in ('code', 'staff')),
  comp_until              timestamptz,
  comp_code_id            uuid references public.access_codes(id) on delete set null,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- RLS: three different shapes, deliberately.
alter table public.access_codes enable row level security;
alter table public.access_code_redemptions enable row level security;
alter table public.access_code_attempts enable row level security;
alter table public.entitlements enable row level security;

-- access_codes: RLS enabled with NO policies at all = deny-all to
-- `authenticated`. Codes must never be enumerable by a signed-in user. Reached
-- only through redeem_access_code() below, which is SECURITY DEFINER.
-- (access_code_attempts likewise has no policies.)

-- entitlements: owner may read, nobody may write. The service role bypasses RLS.
create policy "entitlements_self_read" on public.entitlements
  for select using (auth.uid() = user_id);

create policy "access_code_redemptions_self_read" on public.access_code_redemptions
  for select using (auth.uid() = user_id);

-- Redeem a code and grant the resulting comp, as one transaction.
--
-- SECURITY DEFINER so it can reach the deny-all access_codes table; it takes the
-- caller's identity from auth.uid() rather than a parameter, so a caller cannot
-- redeem on someone else's behalf. The code arrives pre-hashed because the
-- pepper is a server-side secret that must never reach Postgres or the browser.
create or replace function public.redeem_access_code(p_code_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Hex text rather than bytea: bytea round-trips ambiguously through
  -- PostgREST's JSON boundary, so the caller sends hex and it is decoded here.
  v_hash       bytea := decode(p_code_hash, 'hex');
  v_user_id    uuid := auth.uid();
  v_failures   integer;
  v_code       record;
  v_claimed    boolean := false;
  v_prior_code uuid;
  v_comp_until timestamptz;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  select count(*) into v_failures
    from public.access_code_attempts
   where user_id = v_user_id
     and attempted_at > now() - interval '1 hour';

  if v_failures >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  -- Advisory pre-check: has this user already redeemed this code? Without it, a
  -- user re-submitting a single-use code they already redeemed gets "invalid"
  -- and has a failed attempt recorded against them -- five of those and an
  -- honest user throttles themselves out. This is a message-quality check only;
  -- the unique_violation handler below remains the actual race guard.
  select id into v_prior_code
    from public.access_codes
   where code_hash = v_hash;

  if v_prior_code is not null and exists (
    select 1 from public.access_code_redemptions
     where code_id = v_prior_code and user_id = v_user_id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_redeemed');
  end if;

  begin
    -- Atomic claim. Under Read Committed, Postgres re-evaluates this WHERE
    -- clause against the updated row version, so of N concurrent callers
    -- exactly one can take the last remaining use. A no-match is UPDATE 0 --
    -- not an error -- hence the explicit `found` check.
    --
    -- Deliberately not SELECT ... FOR UPDATE: access_code_redemptions has an FK
    -- to this table, and a plain row lock on the parent blocks concurrent child
    -- inserts. SKIP LOCKED would be worse still -- it would report a valid code
    -- as invalid.
    update public.access_codes
       set uses_remaining = uses_remaining - 1
     where code_hash = v_hash
       and revoked_at is null
       and uses_remaining > 0
       and (expires_at is null or expires_at > now())
    returning id, label, grant_days into v_code;

    v_claimed := found;

    if v_claimed then
      insert into public.access_code_redemptions (code_id, user_id)
      values (v_code.id, v_user_id);
    end if;
  exception when unique_violation then
    -- Same user redeeming the same code twice. The UPDATE and INSERT share this
    -- subtransaction, so rolling it back also undoes the decrement: a repeat
    -- redemption cannot burn a use.
    return jsonb_build_object('ok', false, 'reason', 'already_redeemed');
  end;

  if not v_claimed then
    insert into public.access_code_attempts (user_id) values (v_user_id);
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  v_comp_until := case
                    when v_code.grant_days is null then null
                    else now() + make_interval(days => v_code.grant_days)
                  end;

  insert into public.entitlements as e (user_id, comp_source, comp_until, comp_code_id)
  values (v_user_id, 'code', v_comp_until, v_code.id)
  on conflict (user_id) do update
     set comp_source  = 'code',
         comp_code_id = excluded.comp_code_id,
         -- Never shorten an existing comp: a forever grant stays forever, and a
         -- dated one extends to the later of the two.
         comp_until   = case
                          when e.comp_source is not null and e.comp_until is null then null
                          when excluded.comp_until is null then null
                          else greatest(e.comp_until, excluded.comp_until)
                        end,
         updated_at   = now();

  return jsonb_build_object(
    'ok', true,
    'label', v_code.label,
    'comp_until', v_comp_until
  );
end;
$$;

revoke all on function public.redeem_access_code(text) from public;
revoke all on function public.redeem_access_code(text) from anon;
grant execute on function public.redeem_access_code(text) to authenticated;

-- Grandfather every existing account. These are all dev/test accounts, so they
-- get a permanent staff comp rather than being walled at cutover.
insert into public.entitlements (user_id, comp_source, comp_until)
select id, 'staff', null from public.profiles
on conflict (user_id) do nothing;

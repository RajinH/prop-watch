-- Close the user-session write path into shared market reference data.
--
-- market_trends and market_snapshots describe public suburb conditions shared by
-- every user who holds property there. Their write policies let any signed-in
-- user insert, update or delete rows with the public anon key, so one account
-- could corrupt the suburb data every other account reads.
--
-- Those policies only existed because the loader ran as the signed-in user. No
-- production code writes these tables yet; the dev loader now uses the service
-- role, which bypasses RLS. Dropping the policies leaves them read-only to users.

drop policy if exists "market_trends_write" on public.market_trends;
drop policy if exists "market_snapshots_write" on public.market_snapshots;

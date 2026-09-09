-- Undisclosed sales were duplicating on every ingest run.
--
-- `unique (property_id, kind, event_date, price)` does not deduplicate rows
-- whose price is NULL, because SQL treats NULL as distinct from NULL — so an
-- upsert on an undisclosed sale never found a conflict and inserted again. A
-- property with an undisclosed sale gained one phantom row per load.
--
-- Postgres 15+ can compare nulls as equal in a unique constraint, which is the
-- behaviour we actually want: two undisclosed sales of the same property on the
-- same date are the same event.

-- Collapse the duplicates already stored, keeping one row per real event.
delete from public.property_transactions t
using public.property_transactions keep
where t.property_id = keep.property_id
  and t.kind = keep.kind
  and t.event_date = keep.event_date
  and t.price is not distinct from keep.price
  and t.ctid > keep.ctid;

alter table public.property_transactions
  drop constraint if exists property_transactions_property_id_kind_event_date_price_key;

alter table public.property_transactions
  add constraint property_transactions_event_key
  unique nulls not distinct (property_id, kind, event_date, price);

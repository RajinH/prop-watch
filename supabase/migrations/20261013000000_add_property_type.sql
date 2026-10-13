-- Property type, storeys and land area: user-entered, display-only facts.
-- They set how each property is drawn on the Portfolio Island; no engine
-- maths reads them.
--
-- Property type is house / townhouse / unit / land. Nullable: properties
-- added before this column, or whose owner hasn't said, are drawn as a house.
alter table public.properties
  add column if not exists property_type text
  check (property_type in ('house', 'townhouse', 'unit', 'land'));

-- Storeys in the building (for a unit, the block it sits in). Nullable: the
-- model picks a typical height when it's not given.
alter table public.properties
  add column if not exists storeys smallint
  check (storeys between 1 and 120);

-- Land area in square metres. Nullable: the island draws a typical plot.
alter table public.properties
  add column if not exists land_area numeric
  check (land_area > 0);

-- Backfill from HTAG where we already hold a classification for the property,
-- so existing portfolios don't all start as generic houses. Owners can still
-- change it on the edit form.
update public.properties p
set property_type = case lower(f.property_type)
    when 'house' then 'house'
    when 'townhouse' then 'townhouse'
    when 'unit' then 'unit'
    when 'apartment' then 'unit'
    when 'land' then 'land'
  end
from public.property_market_facts f
where f.property_id = p.id
  and p.property_type is null
  and lower(f.property_type) in ('house', 'townhouse', 'unit', 'apartment', 'land');

-- Same for land area, from HTAG's lot size.
update public.properties p
set land_area = f.lot_size
from public.property_market_facts f
where f.property_id = p.id
  and p.land_area is null
  and f.lot_size > 0;

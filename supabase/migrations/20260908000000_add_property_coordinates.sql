-- Geographic coordinates for the property, used to render its map.
-- Populated from Checkify's autocomplete-details on address selection; rows
-- predating that (or entered without autocomplete) are backfilled once via
-- Nominatim. Display-only — no engine calculation reads these.
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS latitude  double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Ownership is already enforced by the existing portfolio-chain RLS policies on
-- properties; new columns inherit them, so no policy change is required.

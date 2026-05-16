ALTER TABLE portfolios
  ADD COLUMN IF NOT EXISTS passive_income_target numeric,
  ADD COLUMN IF NOT EXISTS income_tax_bracket numeric DEFAULT 0.325;

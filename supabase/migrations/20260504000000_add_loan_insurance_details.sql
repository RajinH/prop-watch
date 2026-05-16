ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS loan_type text,
  ADD COLUMN IF NOT EXISTS interest_rate numeric,
  ADD COLUMN IF NOT EXISTS interest_rate_type text,
  ADD COLUMN IF NOT EXISTS loan_term_years integer,
  ADD COLUMN IF NOT EXISTS lender text,
  ADD COLUMN IF NOT EXISTS fixed_rate_expiry date,
  ADD COLUMN IF NOT EXISTS insurer text,
  ADD COLUMN IF NOT EXISTS annual_insurance_premium numeric,
  ADD COLUMN IF NOT EXISTS insurance_policy_type text,
  ADD COLUMN IF NOT EXISTS insurance_renewal_date date;

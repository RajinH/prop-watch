export type Property = {
  id: string
  portfolio_id: string
  name: string
  current_value: number
  current_debt: number
  monthly_rent: number
  monthly_repayment: number
  annual_expenses: number
  purchase_price: number | null
  purchase_date: string | null
  // Loan details
  loan_type: 'principal_and_interest' | 'interest_only' | null
  interest_rate: number | null
  interest_rate_type: 'variable' | 'fixed' | 'split' | null
  loan_term_years: number | null
  lender: string | null
  fixed_rate_expiry: string | null
  // Insurance details
  insurer: string | null
  annual_insurance_premium: number | null
  insurance_policy_type: 'landlord' | 'building' | 'contents' | 'combined' | null
  insurance_renewal_date: string | null
}

export type PropertySnapshotInsert = {
  property_id: string
  snapshot_date: string
  value: number
  debt: number
  equity: number
  monthly_cashflow: number
  lvr: number | null
  yield: number | null
}

export type PropertySnapshot = PropertySnapshotInsert & { id?: string }

export type PortfolioSnapshotInsert = {
  portfolio_id: string
  snapshot_date: string
  total_value: number
  total_debt: number
  total_equity: number
  monthly_cashflow: number
  weighted_lvr: number | null
  yield: number | null
}

export type InsightInsert = {
  portfolio_id: string
  property_id?: string
  type: string
  severity: 'positive' | 'info' | 'warning' | 'critical'
  title: string
  description: string
  impact?: number
  metadata?: Record<string, unknown>
  status: 'active'
}

export type RiskProfile = {
  overall: number
  label: 'low' | 'moderate' | 'high' | 'critical'
  interest_rate: number
  cashflow: number
  concentration: number
  liquidity: number
}

export type SensitivityResult = {
  rate_breakeven_pct: number | null
  vacancy_breakeven_weeks: number | null
  expense_shock_pct: number | null
}

export type ScenarioAssumptions = {
  interestRateDeltaPercent?: number
  rentDeltaPercent?: number
  expenseDeltaPercent?: number
  valueDeltaPercent?: number
}

export type ScenarioResult = {
  total_value: number
  total_debt: number
  total_equity: number
  monthly_cashflow: number
  weighted_lvr: number | null
  yield: number | null
}

export type ScenarioDelta = {
  total_value: number
  total_equity: number
  monthly_cashflow: number
  weighted_lvr: number | null
}

export type ScenarioInsight = {
  type: string
  severity: string
  title: string
  description: string
  impact?: number
}

export type PropertyGrowth = {
  property_id: string
  property_name: string
  purchase_price: number | null
  years_held: number | null
  unrealised_gain: number | null
  unrealised_gain_pct: number | null
  annualised_growth_rate: number | null
}

export type CapitalGrowthSummary = {
  total_unrealised_gain: number
  portfolio_annualised_growth: number | null
  best_performer: string | null
  best_performer_cagr: number | null
  properties: PropertyGrowth[]
}

export type AcquisitionCapacity = {
  usable_equity_80: number
  usable_equity_70: number
  max_purchase_price_80: number
  max_purchase_price_70: number
}

export type DebtProjectionPoint = {
  year: number
  balance: number
  cumulative_interest: number
}

export type PropertyDebtProjection = {
  property_id: string
  property_name: string
  months_to_payoff: number | null
  payoff_year: number | null
  effective_annual_rate: number | null
  total_interest_cost: number | null
  curve: DebtProjectionPoint[]
}

export type AfterTaxCashflow = {
  gross_monthly_cashflow: number
  annual_tax_deductible: number
  annual_tax_saving: number
  monthly_tax_saving: number
  after_tax_monthly_cashflow: number
  tax_bracket: number
}

export type GoalProgress = {
  target: number
  current: number
  progress_pct: number
  monthly_gap: number
}

export type PropertyRank = {
  property_id: string
  property_name: string
  rank: number
  yield_score: number
  cashflow_efficiency: number | null
  lvr: number | null
  cagr: number | null
  composite_score: number
}

export type PortfolioHistoryPoint = {
  snapshot_date: string
  total_value: number
  total_debt: number
  total_equity: number
  monthly_cashflow: number
  weighted_lvr: number | null
  yield: number | null
}

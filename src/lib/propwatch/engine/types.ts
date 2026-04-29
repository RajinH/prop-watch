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

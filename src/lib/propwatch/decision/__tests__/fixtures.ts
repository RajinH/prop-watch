import type { Property, PortfolioSnapshotInsert } from '../../engine/types'
import type { AssumptionOverrides, InvestorGoal } from '../types'
import { DECISION_CONFIG } from '../config'
import { buildDecisionContext } from '../context'

export const PORTFOLIO_ID = 'port-1'
export const TODAY = '2026-07-18'

export const baseProp = (overrides: Partial<Property> = {}): Property => ({
  id: 'prop-1',
  portfolio_id: PORTFOLIO_ID,
  name: 'Test Property',
  current_value: 500_000,
  current_debt: 0,
  monthly_rent: 0,
  monthly_repayment: 0,
  annual_expenses: 0,
  purchase_price: null,
  purchase_date: null,
  loan_type: null,
  interest_rate: null,
  interest_rate_type: null,
  loan_term_years: null,
  lender: null,
  fixed_rate_expiry: null,
  insurer: null,
  annual_insurance_premium: null,
  insurance_policy_type: null,
  insurance_renewal_date: null,
  comparable_monthly_rent: null,
  last_rent_review_date: null,
  ...overrides,
})

export const baseSnap = (
  overrides: Partial<PortfolioSnapshotInsert> = {}
): PortfolioSnapshotInsert => ({
  portfolio_id: PORTFOLIO_ID,
  snapshot_date: TODAY,
  total_value: 500_000,
  total_debt: 0,
  total_equity: 500_000,
  monthly_cashflow: 100,
  weighted_lvr: 0,
  yield: 0.05,
  ...overrides,
})

export const baseGoal = (overrides: Partial<InvestorGoal> = {}): InvestorGoal => ({
  id: 'goal-1',
  portfolio_id: PORTFOLIO_ID,
  type: 'improve_cashflow',
  target_value: null,
  target_date: null,
  max_monthly_deficit: null,
  minimum_cash_buffer: null,
  risk_tolerance: 'balanced',
  available_lump_sum: null,
  ...overrides,
})

export const makeContext = (input: {
  properties?: Property[]
  snapshot?: PortfolioSnapshotInsert
  goal?: InvestorGoal | null
  overrides?: Record<string, AssumptionOverrides>
}) =>
  buildDecisionContext({
    portfolio_id: PORTFOLIO_ID,
    today: TODAY,
    snapshot: input.snapshot ?? baseSnap(),
    properties: input.properties ?? [],
    goal: input.goal ?? null,
    config: DECISION_CONFIG,
    overrides: input.overrides,
  })

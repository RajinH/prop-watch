import { describe, it, expect } from 'vitest'
import type { Property, PortfolioSnapshotInsert } from '../../engine/types'
import type { DecisionContextBase, InvestorGoal } from '../types'
import { DECISION_CONFIG } from '../config'
import { detectConditions } from '../conditions'

const PORTFOLIO_ID = 'port-1'
const TODAY = '2026-07-18'

const baseProp = (overrides: Partial<Property> = {}): Property => ({
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

const baseSnap = (
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

const baseGoal = (overrides: Partial<InvestorGoal> = {}): InvestorGoal => ({
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

const ctx = (overrides: Partial<DecisionContextBase> = {}): DecisionContextBase => ({
  portfolio_id: PORTFOLIO_ID,
  today: TODAY,
  snapshot: baseSnap(),
  properties: [],
  goal: null,
  config: DECISION_CONFIG,
  ...overrides,
})

const byCode = (conditions: ReturnType<typeof detectConditions>, code: string) =>
  conditions.filter((c) => c.code === code)

describe('detectConditions', () => {
  it('fires negative_cashflow as warning when portfolio cashflow is negative', () => {
    const conditions = detectConditions(
      ctx({ snapshot: baseSnap({ monthly_cashflow: -500 }) })
    )
    const found = byCode(conditions, 'negative_cashflow')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('warning')
    expect(found[0].evidence.monthly_cashflow).toBe(-500)
    expect(found[0].detected_at).toBe(TODAY)
  })

  it('escalates negative_cashflow to critical when deficit exceeds goal max_monthly_deficit', () => {
    const conditions = detectConditions(
      ctx({
        snapshot: baseSnap({ monthly_cashflow: -500 }),
        goal: baseGoal({ max_monthly_deficit: 400 }),
      })
    )
    expect(byCode(conditions, 'negative_cashflow')[0].severity).toBe('critical')
  })

  it('does not fire negative_cashflow when cashflow is non-negative', () => {
    const conditions = detectConditions(ctx({ snapshot: baseSnap({ monthly_cashflow: 0 }) }))
    expect(byCode(conditions, 'negative_cashflow')).toHaveLength(0)
  })

  it('fires property_negative_cashflow per losing property', () => {
    const conditions = detectConditions(
      ctx({
        properties: [
          baseProp({ id: 'p1', monthly_rent: 2000, monthly_repayment: 2500 }),
          baseProp({ id: 'p2', monthly_rent: 2000, monthly_repayment: 1000 }),
        ],
      })
    )
    const found = byCode(conditions, 'property_negative_cashflow')
    expect(found).toHaveLength(1)
    expect(found[0].property_id).toBe('p1')
    expect(found[0].evidence.monthly_cashflow).toBe(-500)
  })

  it('fires rate_above_reference only above the flag threshold', () => {
    const conditions = detectConditions(
      ctx({
        properties: [
          baseProp({ id: 'p1', interest_rate: 0.075, current_debt: 400_000 }),
          baseProp({ id: 'p2', interest_rate: 0.07 }),
          baseProp({ id: 'p3', interest_rate: null }),
        ],
      })
    )
    const found = byCode(conditions, 'rate_above_reference')
    expect(found).toHaveLength(1)
    expect(found[0].property_id).toBe('p1')
    expect(found[0].evidence.interest_rate).toBe(0.075)
    expect(found[0].evidence.reference_rate).toBe(DECISION_CONFIG.reference_interest_rate)
  })

  it('fires high_lvr at portfolio (critical) and property (warning) scopes', () => {
    const conditions = detectConditions(
      ctx({
        snapshot: baseSnap({ weighted_lvr: 0.85 }),
        properties: [baseProp({ id: 'p1', current_debt: 450_000 })],
      })
    )
    const found = byCode(conditions, 'high_lvr')
    expect(found).toHaveLength(2)
    const portfolio = found.find((c) => c.scope === 'portfolio')!
    const property = found.find((c) => c.scope === 'property')!
    expect(portfolio.severity).toBe('critical')
    expect(property.severity).toBe('warning')
    expect(property.property_id).toBe('p1')
  })

  it('fires low_yield at portfolio and property scopes', () => {
    const conditions = detectConditions(
      ctx({
        snapshot: baseSnap({ yield: 0.03 }),
        properties: [baseProp({ id: 'p1', monthly_rent: 1000 })], // 2.4% yield
      })
    )
    const found = byCode(conditions, 'low_yield')
    expect(found).toHaveLength(2)
    expect(found.some((c) => c.scope === 'portfolio')).toBe(true)
    expect(found.some((c) => c.scope === 'property' && c.property_id === 'p1')).toBe(true)
  })

  it('fires fixed_expiry_approaching with severity by proximity', () => {
    const conditions = detectConditions(
      ctx({
        properties: [
          baseProp({ id: 'p1', fixed_rate_expiry: '2026-08-01' }), // 14 days
          baseProp({ id: 'p2', fixed_rate_expiry: '2026-10-01' }), // 75 days
          baseProp({ id: 'p3', fixed_rate_expiry: '2026-12-01' }), // beyond window
        ],
      })
    )
    const found = byCode(conditions, 'fixed_expiry_approaching')
    expect(found).toHaveLength(2)
    expect(found.find((c) => c.property_id === 'p1')!.severity).toBe('critical')
    expect(found.find((c) => c.property_id === 'p2')!.severity).toBe('warning')
    expect(found.find((c) => c.property_id === 'p1')!.evidence.days_until_expiry).toBe(14)
  })

  it('fires rent_review_due when never reviewed or past the interval', () => {
    const conditions = detectConditions(
      ctx({
        properties: [
          baseProp({ id: 'p1', monthly_rent: 2000, last_rent_review_date: null }),
          baseProp({ id: 'p2', monthly_rent: 2000, last_rent_review_date: '2026-01-18' }),
          baseProp({ id: 'p3', monthly_rent: 2000, last_rent_review_date: '2025-01-18' }),
          baseProp({ id: 'p4', monthly_rent: 0 }),
        ],
      })
    )
    const found = byCode(conditions, 'rent_review_due')
    expect(found.map((c) => c.property_id).sort()).toEqual(['p1', 'p3'])
  })

  it('fires comparable_rent_gap only when comparable exceeds current rent', () => {
    const conditions = detectConditions(
      ctx({
        properties: [
          baseProp({ id: 'p1', monthly_rent: 2000, comparable_monthly_rent: 2200 }),
          baseProp({ id: 'p2', monthly_rent: 2000, comparable_monthly_rent: 1900 }),
        ],
      })
    )
    const found = byCode(conditions, 'comparable_rent_gap')
    expect(found).toHaveLength(1)
    expect(found[0].property_id).toBe('p1')
    expect(found[0].evidence.monthly_gap).toBe(200)
  })

  it('fires funds_available only at or above the minimum lump sum', () => {
    expect(
      byCode(
        detectConditions(ctx({ goal: baseGoal({ available_lump_sum: 20_000 }) })),
        'funds_available'
      )
    ).toHaveLength(1)
    expect(
      byCode(
        detectConditions(ctx({ goal: baseGoal({ available_lump_sum: 3_000 }) })),
        'funds_available'
      )
    ).toHaveLength(0)
    expect(byCode(detectConditions(ctx()), 'funds_available')).toHaveLength(0)
  })

  it('fires missing_required_data for absent loan facts and comparable rent', () => {
    const conditions = detectConditions(
      ctx({
        properties: [
          baseProp({ id: 'p1', current_debt: 300_000, monthly_rent: 2000 }),
          baseProp({
            id: 'p2',
            current_debt: 300_000,
            monthly_rent: 2000,
            interest_rate: 0.06,
            loan_type: 'principal_and_interest',
            comparable_monthly_rent: 2100,
          }),
        ],
      })
    )
    const found = byCode(conditions, 'missing_required_data')
    expect(found).toHaveLength(1)
    expect(found[0].property_id).toBe('p1')
    expect(found[0].evidence.missing_fields).toBe(
      'interest_rate,loan_type,comparable_monthly_rent'
    )
  })

  it('is deterministic for identical inputs', () => {
    const input = ctx({
      snapshot: baseSnap({ monthly_cashflow: -200, weighted_lvr: 0.82, yield: 0.03 }),
      properties: [
        baseProp({ id: 'p1', current_debt: 450_000, interest_rate: 0.078, monthly_rent: 1500, monthly_repayment: 2400 }),
      ],
      goal: baseGoal({ available_lump_sum: 50_000 }),
    })
    expect(detectConditions(input)).toEqual(detectConditions(input))
  })
})

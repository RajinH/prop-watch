import { describe, it, expect } from 'vitest'
import { computeRunway } from '../computeRunway'
import type { Property, PortfolioSnapshotInsert, RunwayResult, RunwayScenarioKey } from '../types'

const PORTFOLIO_ID = 'port-1'

function makeProperty(id: string, monthly_rent: number): Property {
  return {
    id,
    portfolio_id: PORTFOLIO_ID,
    name: `Property ${id}`,
    current_value: 700000,
    current_debt: 450000,
    monthly_rent,
    monthly_repayment: 2500,
    annual_expenses: 6000,
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
  }
}

function makeSnap(monthly_cashflow: number, total_debt: number): PortfolioSnapshotInsert {
  return {
    portfolio_id: PORTFOLIO_ID,
    snapshot_date: '2026-09-23',
    total_value: 1_400_000,
    total_debt,
    total_equity: 1_400_000 - total_debt,
    monthly_cashflow,
    weighted_lvr: null,
    yield: null,
  }
}

function scenario(result: RunwayResult, key: RunwayScenarioKey) {
  const s = result.scenarios.find((x) => x.key === key)
  if (!s) throw new Error(`missing scenario ${key}`)
  return s
}

describe('computeRunway', () => {
  it('computes runway for a negatively geared portfolio (case 1)', () => {
    const properties = [makeProperty('a', 2400), makeProperty('b', 2000)]
    const r = computeRunway(makeSnap(-600, 900_000), properties, 30_000)

    expect(r.cash_reserve).toBe(30_000)
    expect(r.vacancy_property_id).toBe('a')

    const current = scenario(r, 'current')
    expect(current.status).toBe('finite')
    expect(current.monthly_out_of_pocket).toBe(600)
    expect(current.runway_months).toBe(50)

    const vacancy = scenario(r, 'vacancy')
    expect(vacancy.monthly_cashflow).toBe(-3000)
    expect(vacancy.runway_months).toBe(10)

    const rate = scenario(r, 'rate_plus_2')
    expect(rate.monthly_cashflow).toBe(-2100)
    expect(rate.runway_months).toBe(14.29)
    expect(rate.runway_capped).toBe(false)
  })

  it('treats positive current cashflow as self-funding but still stresses it (case 2)', () => {
    const properties = [makeProperty('a', 2500), makeProperty('b', 2000)]
    const r = computeRunway(makeSnap(400, 600_000), properties, 20_000)

    const current = scenario(r, 'current')
    expect(current.status).toBe('self_funding')
    expect(current.monthly_out_of_pocket).toBe(0)
    expect(current.runway_months).toBeNull()

    const vacancy = scenario(r, 'vacancy')
    expect(vacancy.monthly_cashflow).toBe(-2100)
    expect(vacancy.runway_months).toBe(9.52)

    const rate = scenario(r, 'rate_plus_2')
    expect(rate.monthly_cashflow).toBe(-600)
    expect(rate.runway_months).toBe(33.33)
  })

  it('caps runway at RUNWAY_CAP_MONTHS (case 3)', () => {
    const r = computeRunway(makeSnap(-600, 0), [makeProperty('a', 2000)], 1_000_000)
    const current = scenario(r, 'current')
    expect(current.runway_months).toBe(120)
    expect(current.runway_capped).toBe(true)
  })

  it('reports unknown_reserve for negative scenarios when reserve is null (case 4)', () => {
    const r = computeRunway(makeSnap(-600, 500_000), [makeProperty('a', 2000)], null)
    expect(r.cash_reserve).toBeNull()
    for (const s of r.scenarios) {
      expect(s.status).toBe('unknown_reserve')
      expect(s.runway_months).toBeNull()
    }
  })

  it('reports zero months with a zero reserve (case 5)', () => {
    const r = computeRunway(makeSnap(-600, 0), [makeProperty('a', 2000)], 0)
    const current = scenario(r, 'current')
    expect(current.status).toBe('finite')
    expect(current.runway_months).toBe(0)
  })

  it('clamps a negative reserve to zero', () => {
    const r = computeRunway(makeSnap(-600, 0), [makeProperty('a', 2000)], -5000)
    expect(r.cash_reserve).toBe(0)
    expect(scenario(r, 'current').runway_months).toBe(0)
  })

  it('is self-funding everywhere with no properties, cashflow or debt (case 6)', () => {
    const r = computeRunway(makeSnap(0, 0), [], 10_000)
    expect(r.vacancy_property_id).toBeNull()
    for (const s of r.scenarios) {
      expect(s.status).toBe('self_funding')
      expect(s.monthly_out_of_pocket).toBe(0)
    }
  })

  it('removes the first property in array order on a rent tie (case 7)', () => {
    const properties = [makeProperty('b', 2000), makeProperty('first', 2400), makeProperty('second', 2400)]
    const r = computeRunway(makeSnap(-600, 0), properties, 30_000)
    expect(r.vacancy_property_id).toBe('first')
    expect(scenario(r, 'vacancy').monthly_cashflow).toBe(-3000)
  })

  it('returns scenarios in a fixed order (case 8)', () => {
    const r = computeRunway(makeSnap(-600, 900_000), [makeProperty('a', 2400)], 30_000)
    expect(r.scenarios.map((s) => s.key)).toEqual(['current', 'vacancy', 'rate_plus_2'])
  })
})

import { describe, it, expect } from 'vitest'
import { runScenario } from '../runScenario'
import type { Property, PortfolioSnapshotInsert } from '../types'

const PORTFOLIO_ID = 'port-1'
const DATE = '2026-04-27'

const baseProperties: Property[] = [
  {
    id: 'prop-1',
    portfolio_id: PORTFOLIO_ID,
    name: 'Property 1',
    current_value: 600000,
    current_debt: 400000,
    monthly_rent: 2500,
    monthly_repayment: 1800,
    annual_expenses: 6000,
    purchase_price: null,
    purchase_date: null,
  },
  {
    id: 'prop-2',
    portfolio_id: PORTFOLIO_ID,
    name: 'Property 2',
    current_value: 400000,
    current_debt: 200000,
    monthly_rent: 1800,
    monthly_repayment: 1200,
    annual_expenses: 4800,
    purchase_price: null,
    purchase_date: null,
  },
]

const baselineSnap: PortfolioSnapshotInsert = {
  portfolio_id: PORTFOLIO_ID,
  snapshot_date: DATE,
  total_value: 1000000,
  total_debt: 600000,
  total_equity: 400000,
  monthly_cashflow: 400, // prop1: 200 + prop2: 200
  weighted_lvr: 0.6,
  yield: 0.0516,
}

describe('runScenario', () => {
  it('all-zero assumptions produce delta of 0', () => {
    const { delta } = runScenario(baselineSnap, baseProperties, {})
    expect(delta.total_value).toBe(0)
    expect(delta.total_equity).toBe(0)
    expect(delta.monthly_cashflow).toBe(0)
    expect(delta.weighted_lvr).toBe(0)
  })

  it('+1% interest rate increases debt servicing and reduces cashflow', () => {
    const { result, delta } = runScenario(baselineSnap, baseProperties, {
      interestRateDeltaPercent: 1,
    })
    // prop1 extra: 400000 * 0.01 / 12 = 333.33
    // prop2 extra: 200000 * 0.01 / 12 = 166.67
    // total extra: 500/month
    expect(result.monthly_cashflow).toBeCloseTo(baselineSnap.monthly_cashflow - 500, 0)
    expect(delta.monthly_cashflow).toBeCloseTo(-500, 0)
  })

  it('-10% rent reduces cashflow', () => {
    const { delta } = runScenario(baselineSnap, baseProperties, {
      rentDeltaPercent: -10,
    })
    // prop1 rent change: -250/month, prop2: -180/month → -430/month
    expect(delta.monthly_cashflow).toBeCloseTo(-430, 0)
  })

  it('+20% expenses increases costs', () => {
    const { delta } = runScenario(baselineSnap, baseProperties, {
      expenseDeltaPercent: 20,
    })
    // prop1 extra: 6000 * 0.2 / 12 = 100, prop2 extra: 4800 * 0.2 / 12 = 80
    expect(delta.monthly_cashflow).toBeCloseTo(-180, 0)
  })

  it('-10% value reduces total_value and shifts LVR', () => {
    const { result, delta } = runScenario(baselineSnap, baseProperties, {
      valueDeltaPercent: -10,
    })
    expect(result.total_value).toBe(900000)
    expect(delta.total_value).toBe(-100000)
    // LVR: 600000 / 900000 ≈ 0.6667
    expect(result.weighted_lvr).toBeCloseTo(0.67, 1)
  })

  it('emits scenario_cashflow_flip insight when cashflow goes from positive to negative', () => {
    // Need assumptions that cause >400/month cashflow loss
    const { insights } = runScenario(baselineSnap, baseProperties, {
      interestRateDeltaPercent: 10, // 500 * 10 = 5000/month extra
    })
    const types = insights.map((i) => i.type)
    expect(types).toContain('scenario_cashflow_flip')
  })

  it('does not emit cashflow_flip when cashflow stays positive', () => {
    const { insights } = runScenario(baselineSnap, baseProperties, {
      rentDeltaPercent: 5,
    })
    const types = insights.map((i) => i.type)
    expect(types).not.toContain('scenario_cashflow_flip')
  })

  it('emits scenario_lvr_breach when LVR would exceed 80%', () => {
    const { insights } = runScenario(baselineSnap, baseProperties, {
      valueDeltaPercent: -30,
    })
    // new value: 700000, debt: 600000, LVR: 0.857
    const types = insights.map((i) => i.type)
    expect(types).toContain('scenario_lvr_breach')
  })
})

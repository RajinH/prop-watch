import { describe, it, expect } from 'vitest'
import { computePortfolioSnapshot } from '../computePortfolioSnapshot'
import type { Property } from '../types'

const DATE = '2026-04-27'
const PORTFOLIO_ID = 'port-1'

const prop1: Property = {
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
}

const prop2: Property = {
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
}

describe('computePortfolioSnapshot', () => {
  it('handles empty properties array', () => {
    const snap = computePortfolioSnapshot(PORTFOLIO_ID, [], DATE)
    expect(snap.total_value).toBe(0)
    expect(snap.total_debt).toBe(0)
    expect(snap.total_equity).toBe(0)
    expect(snap.monthly_cashflow).toBe(0)
    expect(snap.weighted_lvr).toBeNull()
    expect(snap.yield).toBeNull()
  })

  it('computes single property correctly', () => {
    const snap = computePortfolioSnapshot(PORTFOLIO_ID, [prop1], DATE)
    expect(snap.total_value).toBe(600000)
    expect(snap.total_debt).toBe(400000)
    expect(snap.total_equity).toBe(200000)
    // 2500 - 1800 - 500 = 200
    expect(snap.monthly_cashflow).toBe(200)
    // 400000 / 600000
    expect(snap.weighted_lvr).toBeCloseTo(0.67, 1)
    // 2500 * 12 / 600000
    expect(snap.yield).toBe(0.05)
  })

  it('sums multiple properties correctly', () => {
    const snap = computePortfolioSnapshot(PORTFOLIO_ID, [prop1, prop2], DATE)
    expect(snap.total_value).toBe(1000000)
    expect(snap.total_debt).toBe(600000)
    expect(snap.total_equity).toBe(400000)
    // prop1: 200, prop2: 1800 - 1200 - 400 = 200 → total: 400
    expect(snap.monthly_cashflow).toBe(400)
    // 600000 / 1000000 = 0.6
    expect(snap.weighted_lvr).toBe(0.6)
    // (2500 + 1800) * 12 / 1000000 = 0.0516, but round2 rounds to 2dp → 0.05
    expect(snap.yield).toBe(0.05)
  })

  it('returns null weighted_lvr when total_value is 0', () => {
    const zeroProp: Property = { ...prop1, current_value: 0, current_debt: 0 }
    const snap = computePortfolioSnapshot(PORTFOLIO_ID, [zeroProp], DATE)
    expect(snap.weighted_lvr).toBeNull()
    expect(snap.yield).toBeNull()
  })

  it('handles mixed positive and negative cashflow', () => {
    const negProp: Property = { ...prop2, monthly_rent: 500 }
    const snap = computePortfolioSnapshot(PORTFOLIO_ID, [prop1, negProp], DATE)
    // prop1: 200, negProp: 500 - 1200 - 400 = -1100 → total: -900
    expect(snap.monthly_cashflow).toBe(-900)
  })
})

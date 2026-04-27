import { describe, it, expect } from 'vitest'
import { generateInsights } from '../generateInsights'
import type { Property, PortfolioSnapshotInsert } from '../types'

const PORTFOLIO_ID = 'port-1'
const DATE = '2026-04-27'

const baseSnap = (overrides: Partial<PortfolioSnapshotInsert> = {}): PortfolioSnapshotInsert => ({
  portfolio_id: PORTFOLIO_ID,
  snapshot_date: DATE,
  total_value: 1000000,
  total_debt: 600000,
  total_equity: 400000,
  monthly_cashflow: 500,
  weighted_lvr: 0.6,
  yield: 0.05,
  ...overrides,
})

const baseProp = (overrides: Partial<Property> = {}): Property => ({
  id: 'prop-1',
  portfolio_id: PORTFOLIO_ID,
  name: 'Property 1',
  current_value: 600000,
  current_debt: 400000,
  monthly_rent: 2500,
  monthly_repayment: 1800,
  annual_expenses: 6000,
  purchase_price: 500000,
  purchase_date: '2020-01-01',
  ...overrides,
})

describe('generateInsights', () => {
  it('emits cashflow_negative for negative monthly cashflow', () => {
    const snap = baseSnap({ monthly_cashflow: -200 })
    const insights = generateInsights(PORTFOLIO_ID, snap, [baseProp()])
    const types = insights.map((i) => i.type)
    expect(types).toContain('cashflow_negative')
    expect(types).not.toContain('cashflow_positive')
  })

  it('emits cashflow_positive for positive monthly cashflow', () => {
    const snap = baseSnap({ monthly_cashflow: 300 })
    const insights = generateInsights(PORTFOLIO_ID, snap, [baseProp()])
    const types = insights.map((i) => i.type)
    expect(types).toContain('cashflow_positive')
    expect(types).not.toContain('cashflow_negative')
  })

  it('emits no cashflow insight for zero cashflow', () => {
    const snap = baseSnap({ monthly_cashflow: 0 })
    const insights = generateInsights(PORTFOLIO_ID, snap, [baseProp()])
    const types = insights.map((i) => i.type)
    expect(types).not.toContain('cashflow_positive')
    expect(types).not.toContain('cashflow_negative')
  })

  it('emits lvr_high (critical) when weighted_lvr >= 0.8', () => {
    const snap = baseSnap({ weighted_lvr: 0.85 })
    const insights = generateInsights(PORTFOLIO_ID, snap, [baseProp()])
    const types = insights.map((i) => i.type)
    expect(types).toContain('lvr_high')
    expect(types).not.toContain('lvr_moderate')
    const lvr = insights.find((i) => i.type === 'lvr_high')!
    expect(lvr.severity).toBe('critical')
  })

  it('emits lvr_moderate (warning) when weighted_lvr is between 0.65 and 0.8', () => {
    const snap = baseSnap({ weighted_lvr: 0.7 })
    const insights = generateInsights(PORTFOLIO_ID, snap, [baseProp()])
    const types = insights.map((i) => i.type)
    expect(types).toContain('lvr_moderate')
    expect(types).not.toContain('lvr_high')
  })

  it('emits no LVR insight when lvr is below 0.65', () => {
    const snap = baseSnap({ weighted_lvr: 0.5 })
    const insights = generateInsights(PORTFOLIO_ID, snap, [baseProp()])
    const types = insights.map((i) => i.type)
    expect(types).not.toContain('lvr_high')
    expect(types).not.toContain('lvr_moderate')
  })

  it('emits yield_low when yield < 0.035', () => {
    const snap = baseSnap({ yield: 0.02 })
    const insights = generateInsights(PORTFOLIO_ID, snap, [baseProp()])
    const types = insights.map((i) => i.type)
    expect(types).toContain('yield_low')
  })

  it('does not emit yield_low when yield >= 0.035', () => {
    const snap = baseSnap({ yield: 0.05 })
    const insights = generateInsights(PORTFOLIO_ID, snap, [baseProp()])
    const types = insights.map((i) => i.type)
    expect(types).not.toContain('yield_low')
  })

  it('emits concentration_risk when one property > 70% of total', () => {
    const p1 = baseProp({ id: 'prop-1', current_value: 800000 })
    const p2 = baseProp({ id: 'prop-2', current_value: 200000 })
    const snap = baseSnap({ total_value: 1000000 })
    const insights = generateInsights(PORTFOLIO_ID, snap, [p1, p2])
    const types = insights.map((i) => i.type)
    expect(types).toContain('concentration_risk')
  })

  it('does not emit concentration_risk for single property', () => {
    const snap = baseSnap({ total_value: 600000 })
    const insights = generateInsights(PORTFOLIO_ID, snap, [baseProp()])
    const types = insights.map((i) => i.type)
    expect(types).not.toContain('concentration_risk')
  })

  it('emits data_quality when purchase_price or purchase_date is missing', () => {
    const prop = baseProp({ purchase_price: null })
    const snap = baseSnap()
    const insights = generateInsights(PORTFOLIO_ID, snap, [prop])
    const types = insights.map((i) => i.type)
    expect(types).toContain('data_quality')
  })

  it('does not emit data_quality when all properties have purchase data', () => {
    const prop = baseProp()
    const snap = baseSnap()
    const insights = generateInsights(PORTFOLIO_ID, snap, [prop])
    const types = insights.map((i) => i.type)
    expect(types).not.toContain('data_quality')
  })
})

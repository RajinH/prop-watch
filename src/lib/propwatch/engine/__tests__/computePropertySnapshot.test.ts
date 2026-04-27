import { describe, it, expect } from 'vitest'
import { computePropertySnapshot } from '../computePropertySnapshot'
import type { Property } from '../types'

const base: Property = {
  id: 'prop-1',
  portfolio_id: 'port-1',
  name: 'Test Property',
  current_value: 600000,
  current_debt: 400000,
  monthly_rent: 2500,
  monthly_repayment: 1800,
  annual_expenses: 6000,
  purchase_price: 500000,
  purchase_date: '2020-01-01',
}

const DATE = '2026-04-27'

describe('computePropertySnapshot', () => {
  it('computes equity correctly', () => {
    const snap = computePropertySnapshot(base, DATE)
    expect(snap.equity).toBe(200000) // 600000 - 400000
  })

  it('computes positive monthly cashflow', () => {
    const snap = computePropertySnapshot(base, DATE)
    // 2500 - 1800 - 6000/12 = 2500 - 1800 - 500 = 200
    expect(snap.monthly_cashflow).toBe(200)
  })

  it('computes negative monthly cashflow', () => {
    const prop = { ...base, monthly_rent: 1000 }
    const snap = computePropertySnapshot(prop, DATE)
    // 1000 - 1800 - 500 = -1300
    expect(snap.monthly_cashflow).toBe(-1300)
  })

  it('computes LVR', () => {
    const snap = computePropertySnapshot(base, DATE)
    // 400000 / 600000 = 0.6667
    expect(snap.lvr).toBeCloseTo(0.67, 1)
  })

  it('returns null LVR when current_value is 0', () => {
    const prop = { ...base, current_value: 0 }
    const snap = computePropertySnapshot(prop, DATE)
    expect(snap.lvr).toBeNull()
    expect(snap.yield).toBeNull()
  })

  it('computes yield', () => {
    const snap = computePropertySnapshot(base, DATE)
    // 2500 * 12 / 600000 = 0.05
    expect(snap.yield).toBe(0.05)
  })

  it('handles zero expenses', () => {
    const prop = { ...base, annual_expenses: 0 }
    const snap = computePropertySnapshot(prop, DATE)
    // 2500 - 1800 - 0 = 700
    expect(snap.monthly_cashflow).toBe(700)
  })

  it('sets snapshot_date and property_id correctly', () => {
    const snap = computePropertySnapshot(base, DATE)
    expect(snap.snapshot_date).toBe(DATE)
    expect(snap.property_id).toBe('prop-1')
  })
})

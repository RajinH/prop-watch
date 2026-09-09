import { describe, it, expect } from 'vitest'
import {
  computeMarketComparison,
  computeMarketConcentration,
  MIN_MONTHS_FOR_COMPARISON,
  type LocalityMarket,
} from '../computeMarketComparison'
import type { Property } from '../types'

const ASOF = '2026-09-01'

const baseProp = (overrides: Partial<Property> = {}): Property => ({
  id: 'p1',
  portfolio_id: 'port-1',
  name: 'Test Property',
  current_value: 1000000,
  current_debt: 400000,
  monthly_rent: 2500,
  monthly_repayment: 1800,
  annual_expenses: 6000,
  purchase_price: 500000,
  purchase_date: '2021-09-01',
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

// A suburb that doubled over the window.
const market = (overrides: Partial<LocalityMarket> = {}): LocalityMarket => ({
  area_id: 'QLD218',
  series: [
    { month: '2021-09', typical_price: 400000 },
    { month: '2023-09', typical_price: 600000 },
    { month: '2026-09', typical_price: 800000 },
  ],
  ...overrides,
})

describe('computeMarketComparison', () => {
  it('reports growth for the property and its suburb separately', () => {
    const [r] = computeMarketComparison([baseProp()], [market()], { p1: 'QLD218' }, ASOF)
    expect(r.status).toBe('comparable')
    expect(r.property_growth).toBe(1) // 500k -> 1M
    expect(r.market_growth).toBe(1) // 400k -> 800k
    expect(r.divergence).toBe(0)
  })

  it('reports a positive divergence when the property beat its market', () => {
    // Suburb up 50%, property up 100%.
    const flat = market({ series: [
      { month: '2021-09', typical_price: 400000 },
      { month: '2026-09', typical_price: 600000 },
    ] })
    const [r] = computeMarketComparison([baseProp()], [flat], { p1: 'QLD218' }, ASOF)
    expect(r.market_growth).toBe(0.5)
    expect(r.divergence).toBe(0.5)
  })

  it('splits the gain into market-driven and property-driven parts', () => {
    const [r] = computeMarketComparison([baseProp()], [market()], { p1: 'QLD218' }, ASOF)
    expect(r.value_gain).toBe(500000)
    // Suburb doubled, so the market alone explains the whole 500k gain.
    expect(r.market_driven_gain).toBe(500000)
    expect(r.property_driven_gain).toBe(0)
  })

  it('declines to compare a property held less than the minimum window', () => {
    const [r] = computeMarketComparison(
      [baseProp({ purchase_date: '2026-05-01' })],
      [market()],
      { p1: 'QLD218' },
      ASOF
    )
    expect(r.status).toBe('held_too_briefly')
    expect(r.months_held).toBe(4)
    expect(r.divergence).toBeNull()
  })

  it('compares exactly at the minimum holding window', () => {
    const [r] = computeMarketComparison(
      [baseProp({ purchase_date: '2025-09-01' })],
      [market()],
      { p1: 'QLD218' },
      ASOF
    )
    expect(r.months_held).toBe(MIN_MONTHS_FOR_COMPARISON)
    expect(r.status).toBe('comparable')
  })

  it('declines when purchase data is missing', () => {
    const [r] = computeMarketComparison(
      [baseProp({ purchase_price: null })],
      [market()],
      { p1: 'QLD218' },
      ASOF
    )
    expect(r.status).toBe('no_purchase_data')
  })

  it('declines when the property has no locality', () => {
    const [r] = computeMarketComparison([baseProp()], [market()], { p1: null }, ASOF)
    expect(r.status).toBe('no_market_data')
  })

  it('declines when no market series exists for the locality', () => {
    const [r] = computeMarketComparison([baseProp()], [], { p1: 'QLD218' }, ASOF)
    expect(r.status).toBe('no_market_data')
  })

  it('falls back to the nearest earlier month when the exact one is missing', () => {
    // No 2021-09 point; 2021-06 should be used rather than voiding the comparison.
    const gappy = market({ series: [
      { month: '2021-06', typical_price: 400000 },
      { month: '2026-09', typical_price: 800000 },
    ] })
    const [r] = computeMarketComparison([baseProp()], [gappy], { p1: 'QLD218' }, ASOF)
    expect(r.status).toBe('comparable')
    expect(r.market_growth).toBe(1)
  })
})

describe('computeMarketConcentration', () => {
  it('groups properties in the same postcode into one market', () => {
    const props = [
      baseProp({ id: 'a', current_value: 1000000 }),
      baseProp({ id: 'b', current_value: 1000000 }),
      baseProp({ id: 'c', current_value: 2000000 }),
    ]
    const r = computeMarketConcentration(props, { a: '4300', b: '4300', c: '2042' })
    const qld = r.find((x) => x.key === '4300')!
    expect(qld.property_count).toBe(2)
    expect(qld.value).toBe(2000000)
    expect(qld.share).toBe(0.5)
  })

  it('sorts the largest market first', () => {
    const props = [
      baseProp({ id: 'a', current_value: 100 }),
      baseProp({ id: 'b', current_value: 900 }),
    ]
    const r = computeMarketConcentration(props, { a: '2000', b: '4300' })
    expect(r[0].key).toBe('4300')
  })

  it('buckets properties with no postcode rather than dropping them', () => {
    const r = computeMarketConcentration([baseProp({ id: 'a' })], { a: null })
    expect(r[0].key).toBe('unknown')
    expect(r[0].label).toBe('No postcode')
  })
})

import { describe, it, expect } from 'vitest'
import { reviewRentStrategy } from '../strategies/rentReview'
import { baseProp, makeContext } from './fixtures'

// $1,200/mo on a $500k property → 2.88% yield (rounds to 3%), under the 4%
// per-property threshold, with no rent review on record.
const lowYieldProp = (overrides = {}) =>
  baseProp({
    monthly_rent: 1_200,
    comparable_monthly_rent: 1_400,
    ...overrides,
  })

describe('reviewRentStrategy.detect', () => {
  it('creates a candidate when yield is low and a review is due', () => {
    const ctx = makeContext({ properties: [lowYieldProp()] })
    const candidates = reviewRentStrategy.detect(ctx)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].id).toBe('review_rent:prop-1')
    expect(candidates[0].reason_codes).toContain('rent_review_due')
    expect(candidates[0].required_inputs).toEqual([])
  })

  it('blocks the candidate when no comparable rent is recorded', () => {
    const ctx = makeContext({ properties: [lowYieldProp({ comparable_monthly_rent: null })] })
    const [candidate] = reviewRentStrategy.detect(ctx)
    expect(candidate.required_inputs).toEqual(['comparable_monthly_rent'])
  })

  it('creates no candidate when the comparable does not exceed current rent', () => {
    const ctx = makeContext({ properties: [lowYieldProp({ comparable_monthly_rent: 1_100 })] })
    expect(reviewRentStrategy.detect(ctx)).toHaveLength(0)
  })

  it('creates no candidate when a review happened recently', () => {
    const ctx = makeContext({
      properties: [lowYieldProp({ last_rent_review_date: '2026-05-01' })],
    })
    expect(reviewRentStrategy.detect(ctx)).toHaveLength(0)
  })

  it('creates no candidate for an untenanted property', () => {
    const ctx = makeContext({ properties: [lowYieldProp({ monthly_rent: 0 })] })
    expect(reviewRentStrategy.detect(ctx)).toHaveLength(0)
  })
})

describe('reviewRentStrategy.evaluate', () => {
  it('nets the management fee out of the uplift', () => {
    const ctx = makeContext({ properties: [lowYieldProp()] })
    const [candidate] = reviewRentStrategy.detect(ctx)
    const evaluated = reviewRentStrategy.evaluate(candidate, ctx)
    // $200 uplift − 7% management fee = $186/mo
    expect(evaluated.impact.monthly_cashflow_delta).toBe(186)
    expect(evaluated.impact.estimated_one_off_cost).toBe(0)
    expect(evaluated.projected.monthly_cashflow).toBeGreaterThan(
      evaluated.baseline.monthly_cashflow
    )
  })

  it('includes a partial-capture sensitivity case', () => {
    const ctx = makeContext({ properties: [lowYieldProp()] })
    const [candidate] = reviewRentStrategy.detect(ctx)
    const evaluated = reviewRentStrategy.evaluate(candidate, ctx)
    expect(evaluated.sensitivity).toHaveLength(1)
    expect(evaluated.sensitivity![0].label).toContain('50%')
    expect(evaluated.sensitivity![0].impact.monthly_cashflow_delta).toBe(93)
  })

  it('returns a zero-impact low-confidence evaluation when blocked', () => {
    const ctx = makeContext({ properties: [lowYieldProp({ comparable_monthly_rent: null })] })
    const [candidate] = reviewRentStrategy.detect(ctx)
    const evaluated = reviewRentStrategy.evaluate(candidate, ctx)
    expect(evaluated.impact).toEqual({})
    expect(evaluated.projected).toEqual(evaluated.baseline)
    expect(evaluated.confidence).toBe('low')
  })

  it('caps confidence at medium for a user-supplied comparable', () => {
    const ctx = makeContext({ properties: [lowYieldProp()] })
    const [candidate] = reviewRentStrategy.detect(ctx)
    const evaluated = reviewRentStrategy.evaluate(candidate, ctx)
    expect(evaluated.confidence).toBe('medium')
    expect(evaluated.confidence_reasons.join(' ')).toContain('user-supplied')
  })

  it('honours an uplift-capture override', () => {
    const ctx = makeContext({
      properties: [lowYieldProp()],
      overrides: { 'review_rent:prop-1': { uplift_capture_pct: 0.5 } },
    })
    const [candidate] = reviewRentStrategy.detect(ctx)
    const evaluated = reviewRentStrategy.evaluate(candidate, ctx)
    expect(evaluated.impact.monthly_cashflow_delta).toBe(93)
  })
})

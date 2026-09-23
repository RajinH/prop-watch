import { describe, it, expect } from 'vitest'
import { reviewRefinanceStrategy } from '../strategies/refinance'
import { baseProp, makeContext } from './fixtures'

// $500k @ 7.8% with a $3,800/mo repayment — comfortably above the modelled
// 6.5% amortising repayment (~$3,376/mo over the default 25y term).
const eligibleProp = (overrides = {}) =>
  baseProp({
    current_debt: 500_000,
    interest_rate: 0.078,
    monthly_repayment: 3_800,
    monthly_rent: 2_200,
    loan_type: 'principal_and_interest',
    ...overrides,
  })

describe('reviewRefinanceStrategy.detect', () => {
  it('creates a candidate for a high-rate loan with sufficient balance', () => {
    const ctx = makeContext({ properties: [eligibleProp()] })
    const candidates = reviewRefinanceStrategy.detect(ctx)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].id).toBe('review_refinance:prop-1')
    expect(candidates[0].reason_codes).toContain('rate_above_reference')
    expect(candidates[0].required_inputs).toEqual([])
  })

  it('skips loans below the minimum balance', () => {
    const ctx = makeContext({ properties: [eligibleProp({ current_debt: 80_000, monthly_repayment: 700 })] })
    expect(reviewRefinanceStrategy.detect(ctx)).toHaveLength(0)
  })

  it('skips rates at or below the flag threshold', () => {
    const ctx = makeContext({ properties: [eligibleProp({ interest_rate: 0.07 })] })
    expect(reviewRefinanceStrategy.detect(ctx)).toHaveLength(0)
  })

  it('suppresses fixed loans with a distant expiry but keeps near-expiry ones', () => {
    const far = makeContext({
      properties: [
        eligibleProp({ interest_rate_type: 'fixed', fixed_rate_expiry: '2027-06-01' }),
      ],
    })
    expect(reviewRefinanceStrategy.detect(far)).toHaveLength(0)

    const near = makeContext({
      properties: [
        eligibleProp({ interest_rate_type: 'fixed', fixed_rate_expiry: '2026-09-01' }),
      ],
    })
    const candidates = reviewRefinanceStrategy.detect(near)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].reason_codes).toContain('fixed_expiry_approaching')
  })

  it('drops candidates whose modelled repayment offers no saving', () => {
    // Recorded repayment already below the amortising level at the target rate
    const ctx = makeContext({ properties: [eligibleProp({ monthly_repayment: 3_000 })] })
    expect(reviewRefinanceStrategy.detect(ctx)).toHaveLength(0)
  })

  it('applies persisted assumption overrides', () => {
    const ctx = makeContext({
      properties: [eligibleProp()],
      overrides: { 'review_refinance:prop-1': { target_rate: 0.06 } },
    })
    const [candidate] = reviewRefinanceStrategy.detect(ctx)
    expect(candidate.assumptions.target_rate).toBe(0.06)
  })
})

describe('reviewRefinanceStrategy.evaluate', () => {
  it('quantifies repayment saving, switching cost, and break-even', () => {
    const ctx = makeContext({ properties: [eligibleProp()] })
    const [candidate] = reviewRefinanceStrategy.detect(ctx)
    const evaluated = reviewRefinanceStrategy.evaluate(candidate, ctx)

    // ~$3,800 − ~$3,376 ≈ $424/mo saving
    expect(evaluated.impact.monthly_cashflow_delta).toBeGreaterThan(400)
    expect(evaluated.impact.monthly_cashflow_delta).toBeLessThan(450)
    expect(evaluated.impact.estimated_one_off_cost).toBe(1_500)
    expect(evaluated.impact.estimated_break_even_months).toBe(4)
    expect(evaluated.projected.monthly_cashflow).toBeGreaterThan(
      evaluated.baseline.monthly_cashflow
    )
    expect(evaluated.impact.total_interest_delta).toBeLessThan(0)
  })

  it('caps confidence at medium with a benchmark rate', () => {
    const ctx = makeContext({ properties: [eligibleProp()] })
    const [candidate] = reviewRefinanceStrategy.detect(ctx)
    const evaluated = reviewRefinanceStrategy.evaluate(candidate, ctx)
    expect(evaluated.confidence).toBe('medium')
    expect(evaluated.confidence_reasons.join(' ')).toContain('benchmark')
  })

  it('downgrades to low confidence when loan type is unknown', () => {
    const ctx = makeContext({ properties: [eligibleProp({ loan_type: null })] })
    const [candidate] = reviewRefinanceStrategy.detect(ctx)
    const evaluated = reviewRefinanceStrategy.evaluate(candidate, ctx)
    expect(evaluated.confidence).toBe('low')
  })

  it('warns about break costs on fixed loans', () => {
    const ctx = makeContext({
      properties: [
        eligibleProp({ interest_rate_type: 'fixed', fixed_rate_expiry: '2026-08-15' }),
      ],
    })
    const [candidate] = reviewRefinanceStrategy.detect(ctx)
    const evaluated = reviewRefinanceStrategy.evaluate(candidate, ctx)
    expect(evaluated.risks.join(' ')).toContain('break costs')
  })

  it('is deterministic', () => {
    const ctx = makeContext({ properties: [eligibleProp()] })
    const [candidate] = reviewRefinanceStrategy.detect(ctx)
    expect(reviewRefinanceStrategy.evaluate(candidate, ctx)).toEqual(
      reviewRefinanceStrategy.evaluate(candidate, ctx)
    )
  })
})

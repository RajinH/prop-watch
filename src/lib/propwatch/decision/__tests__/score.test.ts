import { describe, it, expect } from 'vitest'
import { scoreAction } from '../score'
import { reviewRefinanceStrategy } from '../strategies/refinance'
import { baseProp, baseGoal, makeContext } from './fixtures'

const eligibleProp = (overrides = {}) =>
  baseProp({
    current_debt: 500_000,
    interest_rate: 0.078,
    monthly_repayment: 3_800,
    monthly_rent: 2_200,
    loan_type: 'principal_and_interest',
    ...overrides,
  })

function evaluatedRefinance(goal: ReturnType<typeof baseGoal> | null = null) {
  const ctx = makeContext({ properties: [eligibleProp()], goal })
  const [candidate] = reviewRefinanceStrategy.detect(ctx)
  return { action: reviewRefinanceStrategy.evaluate(candidate, ctx), ctx }
}

describe('scoreAction', () => {
  it('keeps every component in [0, 1]', () => {
    const { action, ctx } = evaluatedRefinance(baseGoal({ type: 'improve_cashflow' }))
    const { components } = scoreAction(action, ctx)
    for (const value of Object.values(components)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('uses the goal-alignment matrix when a goal exists, neutral otherwise', () => {
    const aligned = evaluatedRefinance(baseGoal({ type: 'improve_cashflow' }))
    expect(scoreAction(aligned.action, aligned.ctx).components.goal_alignment).toBe(1)

    const noGoal = evaluatedRefinance(null)
    expect(scoreAction(noGoal.action, noGoal.ctx).components.goal_alignment).toBe(0.5)
  })

  it('scores an aligned action higher than a misaligned one', () => {
    const aligned = evaluatedRefinance(baseGoal({ type: 'improve_cashflow' }))
    const misaligned = evaluatedRefinance(baseGoal({ type: 'reduce_risk' }))
    expect(scoreAction(aligned.action, aligned.ctx).score).toBeGreaterThan(
      scoreAction(misaligned.action, misaligned.ctx).score
    )
  })

  it('applies the spec weight formula', () => {
    const { action, ctx } = evaluatedRefinance(baseGoal({ type: 'improve_cashflow' }))
    const { components, score } = scoreAction(action, ctx)
    const w = ctx.config.weights
    const expected =
      components.goal_alignment * w.goal_alignment +
      components.financial_impact * w.financial_impact +
      components.urgency * w.urgency +
      components.confidence * w.confidence +
      components.risk_reduction * w.risk_reduction -
      components.implementation_friction * w.implementation_friction -
      components.estimated_cost * w.estimated_cost
    expect(score).toBeCloseTo(expected, 4)
  })

  it('raises urgency when a critical condition backs the action', () => {
    // Fixed expiry in 14 days → critical condition on the same property
    const ctx = makeContext({
      properties: [
        eligibleProp({ interest_rate_type: 'fixed', fixed_rate_expiry: '2026-08-01' }),
      ],
    })
    const [candidate] = reviewRefinanceStrategy.detect(ctx)
    const action = reviewRefinanceStrategy.evaluate(candidate, ctx)
    expect(scoreAction(action, ctx).components.urgency).toBe(1)
  })
})

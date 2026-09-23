import { describe, it, expect } from 'vitest'
import { runDecisionPipeline } from '../runDecisionPipeline'
import { DECISION_CONFIG } from '../config'
import { PORTFOLIO_ID, TODAY, baseProp, baseSnap, baseGoal } from './fixtures'

const properties = [
  baseProp({
    id: 'p1',
    name: 'High Rate House',
    current_debt: 500_000,
    interest_rate: 0.078,
    monthly_repayment: 3_800,
    monthly_rent: 2_200,
    loan_type: 'principal_and_interest',
  }),
  baseProp({
    id: 'p2',
    name: 'Low Yield Unit',
    monthly_rent: 1_200,
    comparable_monthly_rent: 1_400,
  }),
]

const input = () => ({
  portfolio_id: PORTFOLIO_ID,
  today: TODAY,
  snapshot: baseSnap({ monthly_cashflow: -300 }),
  properties,
  goal: baseGoal({ type: 'improve_cashflow', available_lump_sum: 50_000 }),
  config: DECISION_CONFIG,
})

describe('runDecisionPipeline', () => {
  it('is deterministic: identical inputs produce deep-equal results', () => {
    expect(runDecisionPipeline(input())).toEqual(runDecisionPipeline(input()))
  })

  it('evaluates multiple action types against the same baseline', () => {
    const result = runDecisionPipeline(input())
    const types = new Set(result.evaluated.map((a) => a.action_type))
    expect(types.size).toBeGreaterThanOrEqual(3)
    for (const action of result.evaluated) {
      expect(action.baseline).toEqual(result.baseline)
    }
  })

  it('assigns sequential ranks with an eligible action first', () => {
    const result = runDecisionPipeline(input())
    expect(result.evaluated.map((a) => a.rank)).toEqual(
      result.evaluated.map((_, i) => i + 1)
    )
    expect(result.evaluated[0].primary_eligible).toBe(true)
  })

  it('attaches rendered copy and score components to every action', () => {
    const result = runDecisionPipeline(input())
    for (const action of result.evaluated) {
      expect(action.copy.title.length).toBeGreaterThan(0)
      expect(action.copy.summary.length).toBeGreaterThan(0)
      expect(action.score).toBeGreaterThanOrEqual(0)
      expect(Object.keys(action.score_components)).toHaveLength(7)
    }
  })

  it('honours persisted assumption overrides', () => {
    const withOverride = runDecisionPipeline({
      ...input(),
      overrides: { 'review_refinance:p1': { target_rate: 0.06 } },
    })
    const refinance = withOverride.evaluated.find(
      (a) => a.action_type === 'review_refinance'
    )!
    expect(refinance.assumptions.target_rate).toBe(0.06)

    const base = runDecisionPipeline(input())
    const baseRefinance = base.evaluated.find((a) => a.action_type === 'review_refinance')!
    expect(refinance.impact.monthly_cashflow_delta!).toBeGreaterThan(
      baseRefinance.impact.monthly_cashflow_delta!
    )
  })

  it('surfaces detected conditions in the result', () => {
    const result = runDecisionPipeline(input())
    const codes = result.conditions.map((c) => c.code)
    expect(codes).toContain('rate_above_reference')
    expect(codes).toContain('negative_cashflow')
  })
})

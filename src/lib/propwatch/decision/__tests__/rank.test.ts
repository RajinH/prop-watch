import { describe, it, expect } from 'vitest'
import { DECISION_CONFIG } from '../config'
import { rankActions } from '../rank'
import type { ActionScoreComponents, EvaluatedAction, PortfolioOutcome } from '../types'

const OUTCOME: PortfolioOutcome = {
  total_value: 500_000,
  total_debt: 0,
  total_equity: 500_000,
  monthly_cashflow: 100,
  annual_cashflow: 1_200,
  weighted_lvr: 0,
  gross_yield: 0.05,
  total_interest_remaining: 0,
  goal_progress_pct: null,
}

const components = (
  overrides: Partial<ActionScoreComponents> = {}
): ActionScoreComponents => ({
  goal_alignment: 0.5,
  financial_impact: 0.5,
  urgency: 0.3,
  confidence: 0.6,
  risk_reduction: 0,
  implementation_friction: 0.3,
  estimated_cost: 0,
  ...overrides,
})

const action = (overrides: Partial<EvaluatedAction> = {}): EvaluatedAction => ({
  id: 'review_rent:p1',
  action_type: 'review_rent',
  scope: 'property',
  property_id: 'p1',
  reason_codes: [],
  evidence: {},
  assumptions: {},
  required_inputs: [],
  baseline: OUTCOME,
  projected: OUTCOME,
  impact: {},
  confidence: 'medium',
  confidence_reasons: [],
  risks: [],
  score_components: components(),
  score: 0.5,
  ...overrides,
})

describe('rankActions', () => {
  it('orders by score descending', () => {
    const ranked = rankActions(
      [
        action({ id: 'review_rent:p1', score: 0.4 }),
        action({ id: 'review_refinance:p2', action_type: 'review_refinance', property_id: 'p2', score: 0.8 }),
      ],
      DECISION_CONFIG
    )
    expect(ranked.map((a) => a.id)).toEqual(['review_refinance:p2', 'review_rent:p1'])
    expect(ranked.map((a) => a.rank)).toEqual([1, 2])
  })

  it('never lets a blocked action rank first', () => {
    const ranked = rankActions(
      [
        action({ id: 'review_rent:p1', score: 0.9, required_inputs: ['comparable_monthly_rent'] }),
        action({ id: 'review_refinance:p2', action_type: 'review_refinance', property_id: 'p2', score: 0.5 }),
      ],
      DECISION_CONFIG
    )
    expect(ranked[0].id).toBe('review_refinance:p2')
    expect(ranked[0].primary_eligible).toBe(true)
    const blocked = ranked.find((a) => a.id === 'review_rent:p1')!
    expect(blocked.blocked).toBe(true)
    expect(blocked.primary_eligible).toBe(false)
  })

  it('keeps low-confidence actions off the top unless urgency is critical', () => {
    const lowConfidence = action({
      id: 'review_rent:p1',
      score: 0.9,
      confidence: 'low',
      score_components: components({ urgency: 0.6 }),
    })
    const fallback = action({
      id: 'review_refinance:p2',
      action_type: 'review_refinance',
      property_id: 'p2',
      score: 0.4,
    })
    expect(rankActions([lowConfidence, fallback], DECISION_CONFIG)[0].id).toBe(
      'review_refinance:p2'
    )

    const critical = action({
      id: 'review_rent:p1',
      score: 0.9,
      confidence: 'low',
      score_components: components({ urgency: 1 }),
    })
    expect(rankActions([critical, fallback], DECISION_CONFIG)[0].id).toBe('review_rent:p1')
  })

  it('demotes the lower-scored of a same-property refinance/paydown pair', () => {
    const ranked = rankActions(
      [
        action({
          id: 'review_refinance:p1',
          action_type: 'review_refinance',
          score: 0.8,
        }),
        action({ id: 'pay_down_debt:p1', action_type: 'pay_down_debt', score: 0.7 }),
        action({ id: 'review_rent:p2', property_id: 'p2', score: 0.1 }),
      ],
      DECISION_CONFIG
    )
    expect(ranked[0].id).toBe('review_refinance:p1')
    const demoted = ranked.find((a) => a.id === 'pay_down_debt:p1')!
    expect(demoted.primary_eligible).toBe(false)
  })

  it('prefers lower friction within the tie epsilon', () => {
    const ranked = rankActions(
      [
        action({
          id: 'review_refinance:p1',
          action_type: 'review_refinance',
          property_id: 'p1',
          score: 0.62,
          score_components: components({ implementation_friction: 0.7 }),
        }),
        action({
          id: 'review_rent:p2',
          property_id: 'p2',
          score: 0.6,
          score_components: components({ implementation_friction: 0.3 }),
        }),
      ],
      DECISION_CONFIG
    )
    expect(ranked[0].id).toBe('review_rent:p2')
  })

  it('marks nothing primary-eligible when every action is blocked', () => {
    const ranked = rankActions(
      [action({ required_inputs: ['comparable_monthly_rent'], score: 0.9 })],
      DECISION_CONFIG
    )
    expect(ranked[0].primary_eligible).toBe(false)
  })
})

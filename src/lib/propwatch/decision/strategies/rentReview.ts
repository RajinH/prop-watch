import { round2 } from '../../engine/money'
import type {
  ActionStrategy,
  CandidateAction,
  DecisionContext,
  EvaluatedAction,
} from '../types'
import { asNumber, computeOutcome, diffOutcomes, mergeAssumptions } from '../evaluate'
import { EMPTY_SCORE } from './shared'

function candidateId(propertyId: string): string {
  return `review_rent:${propertyId}`
}

export const reviewRentStrategy: ActionStrategy = {
  type: 'review_rent',

  detect(ctx: DecisionContext): CandidateAction[] {
    return ctx.properties.flatMap((property) => {
      if (property.monthly_rent <= 0) return []
      const propertyConditions = ctx.conditions.filter(
        (c) => c.property_id === property.id
      )
      const reviewDue = propertyConditions.some((c) => c.code === 'rent_review_due')
      const underperforming = propertyConditions.some(
        (c) => c.code === 'low_yield' || c.code === 'property_negative_cashflow'
      )
      if (!reviewDue || !underperforming) return []

      const id = candidateId(property.id)
      const overrides = ctx.overrides[id]
      const comparableOverride =
        overrides && typeof overrides.comparable_monthly_rent === 'number'
          ? overrides.comparable_monthly_rent
          : null
      const comparable = comparableOverride ?? property.comparable_monthly_rent

      // Never invent a market rent: without a comparable the action exists
      // only as an investigation prompt with a blocking required input.
      const blocked = comparable === null
      if (!blocked && comparable <= property.monthly_rent) return []

      const reasonCodes = propertyConditions
        .filter(
          (c) =>
            c.code === 'rent_review_due' ||
            c.code === 'low_yield' ||
            c.code === 'property_negative_cashflow' ||
            c.code === 'comparable_rent_gap'
        )
        .map((c) => c.code)

      const assumptions = mergeAssumptions(
        {
          comparable_monthly_rent: comparable,
          management_fee_pct: ctx.config.management_fee_pct,
          uplift_capture_pct: 1,
        },
        overrides
      )

      return [
        {
          id,
          action_type: 'review_rent' as const,
          scope: 'property' as const,
          property_id: property.id,
          reason_codes: [...new Set(reasonCodes)],
          evidence: {
            property_name: property.name,
            monthly_rent: property.monthly_rent,
            comparable_monthly_rent: comparable,
            last_rent_review_date: property.last_rent_review_date,
          },
          assumptions,
          required_inputs: blocked ? ['comparable_monthly_rent'] : [],
        },
      ]
    })
  },

  evaluate(candidate: CandidateAction, ctx: DecisionContext): EvaluatedAction {
    const property = ctx.properties.find((p) => p.id === candidate.property_id)!
    const baseline = computeOutcome(ctx.portfolio_id, ctx.properties, ctx.goal, ctx.today)

    const confidenceReasons: string[] = []
    const risks: string[] = [
      'Raising rent can increase vacancy risk if priced above the local market',
    ]

    if (candidate.required_inputs.length > 0) {
      confidenceReasons.push(
        'A comparable market rent is required before this action can be evaluated'
      )
      return {
        ...candidate,
        baseline,
        projected: baseline,
        impact: {},
        confidence: 'low',
        confidence_reasons: confidenceReasons,
        risks,
        score_components: EMPTY_SCORE,
        score: 0,
      }
    }

    const comparable = asNumber(
      candidate.assumptions.comparable_monthly_rent,
      property.monthly_rent
    )
    const managementFeePct = asNumber(
      candidate.assumptions.management_fee_pct,
      ctx.config.management_fee_pct
    )
    const capture = asNumber(candidate.assumptions.uplift_capture_pct, 1)

    const projectWithCapture = (capturePct: number) => {
      const uplift = Math.max(0, (comparable - property.monthly_rent) * capturePct)
      const projectedProperties = ctx.properties.map((p) =>
        p.id === property.id
          ? {
              ...p,
              monthly_rent: round2(p.monthly_rent + uplift),
              // Management fees absorb part of the uplift; modelling them as an
              // expense keeps the portfolio math consistent end to end.
              annual_expenses: round2(p.annual_expenses + uplift * 12 * managementFeePct),
            }
          : p
      )
      return computeOutcome(ctx.portfolio_id, projectedProperties, ctx.goal, ctx.today)
    }

    const projected = projectWithCapture(capture)
    const impact = diffOutcomes(baseline, projected)
    impact.estimated_one_off_cost = 0

    const sensitivityCapture = ctx.config.rent_sensitivity_capture
    const sensitivity =
      capture > sensitivityCapture
        ? [
            {
              label: `If only ${(sensitivityCapture * 100).toFixed(0)}% of the uplift is achieved`,
              impact: diffOutcomes(baseline, projectWithCapture(sensitivityCapture)),
            },
          ]
        : undefined

    // A user-supplied comparable has no verified source, so confidence is
    // capped at medium (spec guardrail).
    confidenceReasons.push('Comparable rent is user-supplied and has no verified source')
    confidenceReasons.push(
      property.last_rent_review_date
        ? `Last rent review recorded on ${property.last_rent_review_date}`
        : 'No previous rent review is recorded'
    )
    if (comparable <= property.monthly_rent) {
      confidenceReasons.push('Comparable rent does not exceed the current rent')
    }

    return {
      ...candidate,
      baseline,
      projected,
      impact,
      sensitivity,
      confidence: comparable > property.monthly_rent ? 'medium' : 'low',
      confidence_reasons: confidenceReasons,
      risks,
      score_components: EMPTY_SCORE,
      score: 0,
    }
  },
}

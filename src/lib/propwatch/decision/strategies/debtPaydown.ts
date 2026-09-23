import type { Property } from '../../engine/types'
import type {
  ActionStrategy,
  CandidateAction,
  DecisionContext,
  EvaluatedAction,
} from '../types'
import {
  asBoolean,
  asNumber,
  computeOutcome,
  diffOutcomes,
  mergeAssumptions,
  monthlyRepaymentForLoan,
  remainingTermYears,
} from '../evaluate'
import { EMPTY_SCORE } from './shared'

function candidateId(propertyId: string): string {
  return `pay_down_debt:${propertyId}`
}

/** Avalanche: target the loan with the highest known rate; fall back to the
 *  largest balance when no rates are recorded. */
function pickTarget(properties: Property[]): Property | null {
  const indebted = properties.filter((p) => p.current_debt > 0)
  if (indebted.length === 0) return null
  const withRate = indebted.filter((p) => p.interest_rate !== null)
  if (withRate.length > 0) {
    return withRate.reduce((best, p) =>
      p.interest_rate! > best.interest_rate! ? p : best
    )
  }
  return indebted.reduce((best, p) => (p.current_debt > best.current_debt ? p : best))
}

export const payDownDebtStrategy: ActionStrategy = {
  type: 'pay_down_debt',

  detect(ctx: DecisionContext): CandidateAction[] {
    const fundsCondition = ctx.conditions.find((c) => c.code === 'funds_available')
    if (!fundsCondition || !ctx.goal) return []

    const goalWantsDebtReduction =
      ctx.goal.type === 'reduce_debt' || ctx.goal.type === 'reduce_risk'
    const pressureCodes = ctx.conditions.filter(
      (c) =>
        c.code === 'high_lvr' ||
        c.code === 'negative_cashflow' ||
        c.code === 'rate_above_reference'
    )
    if (!goalWantsDebtReduction && pressureCodes.length === 0) return []

    const target = pickTarget(ctx.properties)
    if (!target) return []

    const available = ctx.goal.available_lump_sum ?? 0
    const id = candidateId(target.id)
    const assumptions = mergeAssumptions(
      {
        lump_sum: Math.min(available, target.current_debt),
        reduce_repayment: target.loan_type === 'interest_only',
      },
      ctx.overrides[id]
    )

    const reasonCodes = [
      'funds_available' as const,
      ...pressureCodes
        .filter((c) => c.scope === 'portfolio' || c.property_id === target.id)
        .map((c) => c.code),
    ]

    return [
      {
        id,
        action_type: 'pay_down_debt' as const,
        scope: 'property' as const,
        property_id: target.id,
        reason_codes: [...new Set(reasonCodes)],
        evidence: {
          property_name: target.name,
          current_debt: target.current_debt,
          interest_rate: target.interest_rate,
          available_lump_sum: available,
          target_selection:
            target.interest_rate !== null ? 'highest_rate' : 'largest_balance',
        },
        assumptions,
        required_inputs: [],
      },
    ]
  },

  evaluate(candidate: CandidateAction, ctx: DecisionContext): EvaluatedAction {
    const property = ctx.properties.find((p) => p.id === candidate.property_id)!
    const available = ctx.goal?.available_lump_sum ?? 0
    const lumpSum = Math.min(
      asNumber(candidate.assumptions.lump_sum, Math.min(available, property.current_debt)),
      property.current_debt
    )
    const reduceRepayment = asBoolean(
      candidate.assumptions.reduce_repayment,
      property.loan_type === 'interest_only'
    )

    const newDebt = property.current_debt - lumpSum
    let projectedRepayment = property.monthly_repayment
    const confidenceReasons: string[] = []

    if (reduceRepayment) {
      if (property.interest_rate !== null) {
        const term = remainingTermYears(property, ctx.today, ctx.config)
        projectedRepayment = monthlyRepaymentForLoan(
          newDebt,
          property.interest_rate,
          term.value,
          property.loan_type ?? 'principal_and_interest'
        )
      } else {
        confidenceReasons.push(
          'Interest rate not recorded — repayment kept unchanged in the projection'
        )
      }
    }

    const projectedProperties = ctx.properties.map((p) =>
      p.id === property.id
        ? { ...p, current_debt: newDebt, monthly_repayment: projectedRepayment }
        : p
    )

    const baseline = computeOutcome(ctx.portfolio_id, ctx.properties, ctx.goal, ctx.today)
    const projected = computeOutcome(ctx.portfolio_id, projectedProperties, ctx.goal, ctx.today)
    const impact = diffOutcomes(baseline, projected)
    impact.estimated_one_off_cost = 0

    if (property.interest_rate !== null) {
      confidenceReasons.push('Loan rate is recorded, so interest savings are calculated directly')
    } else {
      confidenceReasons.push('Loan rate is inferred from the recorded repayment')
    }
    confidenceReasons.push('Assumes the lump sum is not needed for other commitments')

    const risks: string[] = []
    const buffer = ctx.goal?.minimum_cash_buffer ?? null
    if (buffer !== null && available - lumpSum < buffer) {
      risks.push(
        `Using $${lumpSum.toLocaleString('en-AU')} would leave less than your minimum cash buffer`
      )
    }
    if (
      property.interest_rate !== null &&
      property.interest_rate < ctx.config.alternative_return_rate
    ) {
      risks.push(
        'The loan rate is below typical alternative returns — funds may work harder elsewhere (e.g. an offset account)'
      )
    }
    risks.push('Paying down debt reduces accessible liquidity')

    return {
      ...candidate,
      baseline,
      projected,
      impact,
      confidence: property.interest_rate !== null ? 'high' : 'medium',
      confidence_reasons: confidenceReasons,
      risks,
      score_components: EMPTY_SCORE,
      score: 0,
    }
  },
}

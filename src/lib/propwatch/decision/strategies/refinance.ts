import type { Property } from '../../engine/types'
import type {
  ActionStrategy,
  CandidateAction,
  Confidence,
  DecisionContext,
  EvaluatedAction,
} from '../types'
import {
  asNumber,
  computeOutcome,
  diffOutcomes,
  mergeAssumptions,
  monthlyRepaymentForLoan,
  remainingTermYears,
} from '../evaluate'
import { daysBetween } from '../dates'
import { EMPTY_SCORE } from './shared'

function candidateId(propertyId: string): string {
  return `review_refinance:${propertyId}`
}

function switchingCostTotal(ctx: DecisionContext): number {
  const costs = ctx.config.refinance_switching_costs
  return (
    costs.discharge_fee + costs.application_fee + costs.valuation_fee + costs.government_fees
  )
}

function isFixedAndFarFromExpiry(property: Property, ctx: DecisionContext): boolean {
  if (property.interest_rate_type !== 'fixed') return false
  if (!property.fixed_rate_expiry) return false
  const daysUntil = daysBetween(ctx.today, property.fixed_rate_expiry)
  return daysUntil > ctx.config.fixed_break_suppress_months * 30.44
}

export const reviewRefinanceStrategy: ActionStrategy = {
  type: 'review_refinance',

  detect(ctx: DecisionContext): CandidateAction[] {
    return ctx.properties.flatMap((property) => {
      const rateCondition = ctx.conditions.find(
        (c) => c.code === 'rate_above_reference' && c.property_id === property.id
      )
      if (!rateCondition || property.interest_rate === null) return []
      if (property.current_debt < ctx.config.refinance_min_balance) return []
      // Breaking a fixed rate early usually costs more than it saves.
      if (isFixedAndFarFromExpiry(property, ctx)) return []

      const id = candidateId(property.id)
      const term = remainingTermYears(property, ctx.today, ctx.config)
      const assumptions = mergeAssumptions(
        {
          target_rate: ctx.config.reference_interest_rate,
          remaining_term_years: term.value,
          switching_cost_total: switchingCostTotal(ctx),
        },
        ctx.overrides[id]
      )

      // Ineligible when the modelled switch doesn't reduce the repayment
      // (e.g. the recorded repayment is already below an amortising level).
      const projectedRepayment = monthlyRepaymentForLoan(
        property.current_debt,
        asNumber(assumptions.target_rate, ctx.config.reference_interest_rate),
        asNumber(assumptions.remaining_term_years, term.value),
        property.loan_type ?? 'principal_and_interest'
      )
      if (projectedRepayment >= property.monthly_repayment) return []

      const reasonCodes = ctx.conditions
        .filter(
          (c) =>
            (c.property_id === property.id &&
              (c.code === 'rate_above_reference' || c.code === 'fixed_expiry_approaching')) ||
            (c.scope === 'portfolio' && c.code === 'negative_cashflow')
        )
        .map((c) => c.code)

      return [
        {
          id,
          action_type: 'review_refinance' as const,
          scope: 'property' as const,
          property_id: property.id,
          reason_codes: [...new Set(reasonCodes)],
          evidence: {
            property_name: property.name,
            interest_rate: property.interest_rate,
            current_debt: property.current_debt,
            monthly_repayment: property.monthly_repayment,
            margin_above_reference:
              property.interest_rate - ctx.config.reference_interest_rate,
            remaining_term_source: term.source,
          },
          assumptions,
          required_inputs: [],
        },
      ]
    })
  },

  evaluate(candidate: CandidateAction, ctx: DecisionContext): EvaluatedAction {
    const property = ctx.properties.find((p) => p.id === candidate.property_id)!
    const targetRate = asNumber(
      candidate.assumptions.target_rate,
      ctx.config.reference_interest_rate
    )
    const termYears = asNumber(
      candidate.assumptions.remaining_term_years,
      ctx.config.default_remaining_term_years
    )
    const switchingCost = asNumber(
      candidate.assumptions.switching_cost_total,
      switchingCostTotal(ctx)
    )
    const loanType = property.loan_type ?? 'principal_and_interest'

    const projectedRepayment = monthlyRepaymentForLoan(
      property.current_debt,
      targetRate,
      termYears,
      loanType
    )
    const projectedProperties = ctx.properties.map((p) =>
      p.id === property.id
        ? { ...p, interest_rate: targetRate, monthly_repayment: projectedRepayment }
        : p
    )

    const baseline = computeOutcome(ctx.portfolio_id, ctx.properties, ctx.goal, ctx.today)
    const projected = computeOutcome(ctx.portfolio_id, projectedProperties, ctx.goal, ctx.today)
    const impact = diffOutcomes(baseline, projected)
    impact.estimated_one_off_cost = switchingCost

    const monthlySaving = impact.monthly_cashflow_delta ?? 0
    if (monthlySaving > 0) {
      impact.estimated_break_even_months = Math.ceil(switchingCost / monthlySaving)
    }

    const confidenceReasons: string[] = [
      'Current loan balance, rate, and repayment are recorded',
      `Modelled rate of ${(targetRate * 100).toFixed(2)}% is a benchmark, not a quoted offer`,
      'Switching costs are estimates and require confirmation',
    ]
    // A benchmark target rate caps confidence at medium (spec rule).
    let confidence: Confidence = 'medium'
    if (candidate.evidence.remaining_term_source === 'default') {
      confidenceReasons.push(
        `Remaining term assumed at ${termYears} years — loan term or purchase date not recorded`
      )
    } else {
      confidenceReasons.push('Remaining term estimated from loan term and purchase date')
    }
    if (property.loan_type === null) {
      confidence = 'low'
      confidenceReasons.push('Repayment type (P&I or interest-only) is not recorded')
    }
    if (monthlySaving <= 0) {
      confidence = 'low'
      confidenceReasons.push('Modelled rate does not reduce the current repayment')
    }

    const risks: string[] = []
    if (property.interest_rate_type === 'fixed') {
      risks.push('Exiting a fixed rate can incur break costs not included in this estimate')
    }
    risks.push('Actual refinance rates depend on serviceability and lender assessment')

    return {
      ...candidate,
      baseline,
      projected,
      impact,
      confidence,
      confidence_reasons: confidenceReasons,
      risks,
      score_components: EMPTY_SCORE,
      score: 0,
    }
  },
}

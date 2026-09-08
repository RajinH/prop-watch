import { formatMoney } from '../engine/money'
import type {
  ConditionCode,
  EvaluatedAction,
  InvestorGoal,
  RecommendationCopy,
} from './types'

export type RenderContext = {
  property_name: string | null
  goal: InvestorGoal | null
  /** True when this action has the largest cashflow impact of the run. */
  is_highest_impact: boolean
}

// Templates format values that already exist on the action — they never
// calculate, so a template bug can't invent a financial claim.

const pct = (rate: number) => `${(rate * 100).toFixed(2)}%`

const GOAL_LABELS: Record<InvestorGoal['type'], string> = {
  improve_cashflow: 'improving your cashflow',
  prepare_next_purchase: 'preparing for your next purchase',
  reduce_debt: 'reducing your debt',
  reduce_risk: 'reducing your portfolio risk',
}

const REASON_SENTENCES: Partial<Record<ConditionCode, string>> = {
  rate_above_reference: 'The recorded interest rate is above the reference rate.',
  fixed_expiry_approaching: 'The fixed-rate period is approaching its expiry.',
  negative_cashflow: 'The portfolio is currently cashflow negative.',
  property_negative_cashflow: 'This property is currently cashflow negative.',
  high_lvr: 'Leverage is high relative to the 80% LVR threshold.',
  low_yield: 'The gross rental yield is below target.',
  rent_review_due: 'No rent review is recorded in the last 12 months.',
  comparable_rent_gap: 'The recorded comparable rent is above the current rent.',
  funds_available: 'You have declared funds available to deploy.',
}

function moneyPerMonth(value: number | undefined): string | null {
  if (value === undefined || value === 0) return null
  return `${formatMoney(Math.abs(value))} per month`
}

function title(action: EvaluatedAction, ctx: RenderContext): string {
  const name = ctx.property_name ?? 'your portfolio'
  switch (action.action_type) {
    case 'review_refinance':
      return `Review refinancing ${name}`
    case 'review_rent':
      return action.required_inputs.length > 0
        ? `Investigate market rent for ${name}`
        : `Review rent on ${name}`
    case 'pay_down_debt':
      return `Pay down debt on ${name}`
  }
}

function summary(action: EvaluatedAction, ctx: RenderContext): string {
  const name = ctx.property_name ?? 'your portfolio'
  const monthly = moneyPerMonth(action.impact.monthly_cashflow_delta)

  switch (action.action_type) {
    case 'review_refinance': {
      const rate = action.evidence.interest_rate
      const target = action.assumptions.target_rate
      const parts = [
        typeof rate === 'number' ? `The recorded rate is ${pct(rate)}.` : null,
        typeof target === 'number' && monthly
          ? `Modelling a rate of ${pct(target)} improves estimated portfolio cashflow by ${monthly} before switching costs.`
          : null,
      ].filter(Boolean)
      return parts.join(' ') || `Review the loan on ${name} against current market rates.`
    }
    case 'review_rent': {
      if (action.required_inputs.length > 0) {
        return `Add a comparable market rent for ${name} to evaluate whether a rent review is worthwhile.`
      }
      const current = action.evidence.monthly_rent
      const comparable = action.assumptions.comparable_monthly_rent
      if (typeof current === 'number' && typeof comparable === 'number' && monthly) {
        return `Current rent is ${formatMoney(current)}. Moving toward the ${formatMoney(comparable)} comparable adds an estimated ${monthly} after management costs.`
      }
      return `Review the rent on ${name} against the local market.`
    }
    case 'pay_down_debt': {
      const lump = action.assumptions.lump_sum
      const interest = action.impact.total_interest_delta
      const parts = [
        typeof lump === 'number' ? `Applying ${formatMoney(lump)} to ${name}` : `Paying down ${name}`,
      ]
      const effects: string[] = []
      if (typeof interest === 'number' && interest < 0) {
        effects.push(`saves an estimated ${formatMoney(Math.abs(interest))} in total interest`)
      }
      if (monthly && (action.impact.monthly_cashflow_delta ?? 0) > 0) {
        effects.push(`frees up ${monthly}`)
      }
      if (action.impact.weighted_lvr_delta !== undefined && action.impact.weighted_lvr_delta < 0) {
        effects.push(
          `lowers portfolio LVR by ${(Math.abs(action.impact.weighted_lvr_delta) * 100).toFixed(1)} points`
        )
      }
      return effects.length > 0
        ? `${parts[0]} ${effects.join(', ')}.`
        : `${parts[0]} reduces your debt exposure.`
    }
  }
}

function why(action: EvaluatedAction, ctx: RenderContext): string[] {
  const reasons: string[] = []
  if (ctx.is_highest_impact && (action.impact.monthly_cashflow_delta ?? 0) > 0) {
    reasons.push('It has the highest estimated cashflow impact of the available actions.')
  }
  for (const code of action.reason_codes) {
    const sentence = REASON_SENTENCES[code]
    if (sentence) reasons.push(sentence)
  }
  if (ctx.goal) {
    reasons.push(`It supports your goal of ${GOAL_LABELS[ctx.goal.type]}.`)
  }
  return reasons
}

function caveats(action: EvaluatedAction): string[] {
  const items: string[] = []
  for (const input of action.required_inputs) {
    if (input === 'comparable_monthly_rent') {
      items.push('Blocked: a comparable market rent is required before this can be evaluated.')
    } else {
      items.push(`Blocked: ${input.replaceAll('_', ' ')} is required.`)
    }
  }
  items.push(...action.confidence_reasons)
  items.push(...action.risks)
  return items
}

export function renderTemplate(
  action: EvaluatedAction,
  ctx: RenderContext
): RecommendationCopy {
  return {
    title: title(action, ctx),
    summary: summary(action, ctx),
    why: why(action, ctx),
    caveats: caveats(action),
  }
}

import type { DecisionConfig } from './config'
import type { EvaluatedAction } from './types'

export type OrderedAction = EvaluatedAction & {
  rank: number
  blocked: boolean
  primary_eligible: boolean
}

/**
 * Ranking rules (spec):
 * 1. Actions with unresolved blocking inputs never rank first.
 * 2. Low-confidence actions only rank first when urgency is critical.
 * 3. Refinance and paydown on the same property are the same underlying
 *    decision (reducing that loan's interest cost) — only the higher-scored
 *    one may lead.
 * 4. Within the tie epsilon, prefer the lower-friction (more reversible) step.
 *
 * Guarantee: when any action is primary-eligible, the first element is.
 */
export function rankActions(
  actions: EvaluatedAction[],
  config: DecisionConfig
): OrderedAction[] {
  const sorted = [...actions].sort((a, b) => {
    if (Math.abs(a.score - b.score) <= config.tie_epsilon) {
      return (
        a.score_components.implementation_friction -
        b.score_components.implementation_friction
      )
    }
    return b.score - a.score
  })

  // Rule 3: demote the lower-scored of a same-property refinance/paydown pair.
  const demoted = new Set<string>()
  for (const action of sorted) {
    if (!action.property_id) continue
    if (action.action_type !== 'review_refinance' && action.action_type !== 'pay_down_debt')
      continue
    const sibling = sorted.find(
      (other) =>
        other !== action &&
        other.property_id === action.property_id &&
        (other.action_type === 'review_refinance' || other.action_type === 'pay_down_debt')
    )
    if (sibling && !demoted.has(sibling.id)) {
      // sorted order → the later of the pair is the lower-ranked one
      const later = sorted.indexOf(action) > sorted.indexOf(sibling) ? action : sibling
      demoted.add(later.id)
    }
  }

  const eligible = (action: EvaluatedAction): boolean => {
    if (action.required_inputs.length > 0) return false
    if (demoted.has(action.id)) return false
    if (action.confidence === 'low' && action.score_components.urgency < 1) return false
    return true
  }

  const firstEligibleIdx = sorted.findIndex(eligible)
  if (firstEligibleIdx > 0) {
    const [first] = sorted.splice(firstEligibleIdx, 1)
    sorted.unshift(first)
  }

  return sorted.map((action, idx) => ({
    ...action,
    rank: idx + 1,
    blocked: action.required_inputs.length > 0,
    primary_eligible: eligible(action),
  }))
}

import type {
  ActionScoreComponents,
  ConditionSeverity,
  DecisionContext,
  EvaluatedAction,
} from './types'

const SEVERITY_URGENCY: Record<ConditionSeverity, number> = {
  critical: 1,
  warning: 0.6,
  info: 0.3,
}

const CONFIDENCE_SCORE = { high: 1, medium: 0.6, low: 0.25 } as const

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/** Conditions that justified this action (same property or portfolio scope). */
function reasonConditions(action: EvaluatedAction, ctx: DecisionContext) {
  return ctx.conditions.filter(
    (c) =>
      action.reason_codes.includes(c.code) &&
      (c.scope === 'portfolio' || c.property_id === action.property_id)
  )
}

export function scoreAction(
  action: EvaluatedAction,
  ctx: DecisionContext
): { components: ActionScoreComponents; score: number } {
  const { config, goal } = ctx

  const goal_alignment = goal
    ? config.goal_alignment_matrix[action.action_type][goal.type]
    : config.no_goal_alignment

  // Cashflow and lifetime-interest benefits measure the same upside two ways;
  // take the larger rather than summing to avoid double counting.
  const annualCashBenefit = Math.max(0, action.impact.annual_cashflow_delta ?? 0)
  const annualInterestBenefit =
    Math.max(0, -(action.impact.total_interest_delta ?? 0)) /
    config.score_interest_horizon_years
  const financial_impact = clamp01(
    Math.max(annualCashBenefit, annualInterestBenefit) / config.impact_full_score_annual
  )

  const conditions = reasonConditions(action, ctx)
  const urgency = conditions.reduce(
    (max, c) => Math.max(max, SEVERITY_URGENCY[c.severity]),
    0.3
  )

  const confidence = CONFIDENCE_SCORE[action.confidence]

  const lvrReduction = Math.max(0, -(action.impact.weighted_lvr_delta ?? 0))
  let risk_reduction = clamp01(lvrReduction / config.lvr_full_score_delta)
  // Resolving a critical condition is meaningful risk work even when the
  // LVR needle barely moves.
  if (conditions.some((c) => c.severity === 'critical')) {
    risk_reduction = Math.max(risk_reduction, 0.5)
  }

  const implementation_friction = config.friction[action.action_type]
  const estimated_cost = clamp01(
    (action.impact.estimated_one_off_cost ?? 0) / config.cost_full_score
  )

  const components: ActionScoreComponents = {
    goal_alignment,
    financial_impact,
    urgency,
    confidence,
    risk_reduction,
    implementation_friction,
    estimated_cost,
  }

  const w = config.weights
  const score = round4(
    goal_alignment * w.goal_alignment +
      financial_impact * w.financial_impact +
      urgency * w.urgency +
      confidence * w.confidence +
      risk_reduction * w.risk_reduction -
      implementation_friction * w.implementation_friction -
      estimated_cost * w.estimated_cost
  )

  return { components, score }
}

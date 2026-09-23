import type { Property, PortfolioSnapshotInsert } from '../engine/types'
import type { DecisionConfig } from './config'
import type {
  AssumptionOverrides,
  InvestorGoal,
  PipelineResult,
  RankedAction,
} from './types'
import { buildDecisionContext } from './context'
import { computeOutcome } from './evaluate'
import { STRATEGIES } from './strategies'
import { scoreAction } from './score'
import { rankActions } from './rank'
import { renderTemplate } from './templates'

/**
 * The full deterministic decision pipeline: conditions → candidates →
 * evaluation → scoring → ranking → rendered copy. Same inputs always produce
 * the same output — no I/O, no clock, no randomness.
 */
export function runDecisionPipeline(input: {
  portfolio_id: string
  today: string
  snapshot: PortfolioSnapshotInsert
  properties: Property[]
  goal: InvestorGoal | null
  config: DecisionConfig
  overrides?: Record<string, AssumptionOverrides>
}): PipelineResult {
  const ctx = buildDecisionContext(input)

  const candidates = STRATEGIES.flatMap((strategy) => strategy.detect(ctx))

  const evaluated = candidates.map((candidate) => {
    const strategy = STRATEGIES.find((s) => s.type === candidate.action_type)!
    const action = strategy.evaluate(candidate, ctx)
    const { components, score } = scoreAction(action, ctx)
    return { ...action, score_components: components, score }
  })

  const ordered = rankActions(evaluated, ctx.config)

  const highestImpact = ordered.reduce<number>(
    (max, a) => Math.max(max, a.impact.monthly_cashflow_delta ?? 0),
    0
  )

  const ranked: RankedAction[] = ordered.map((action) => {
    const property = ctx.properties.find((p) => p.id === action.property_id)
    return {
      ...action,
      copy: renderTemplate(action, {
        property_name: property?.name ?? null,
        goal: ctx.goal,
        is_highest_impact:
          highestImpact > 0 &&
          (action.impact.monthly_cashflow_delta ?? 0) === highestImpact,
      }),
    }
  })

  return {
    conditions: ctx.conditions,
    candidates,
    evaluated: ranked,
    baseline: computeOutcome(ctx.portfolio_id, ctx.properties, ctx.goal, ctx.today),
  }
}

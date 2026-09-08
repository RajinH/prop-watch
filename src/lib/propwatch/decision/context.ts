import type { Property, PortfolioSnapshotInsert } from '../engine/types'
import type {
  AssumptionOverrides,
  DecisionContext,
  InvestorGoal,
} from './types'
import type { DecisionConfig } from './config'
import { detectConditions } from './conditions'

export function buildDecisionContext(input: {
  portfolio_id: string
  today: string
  snapshot: PortfolioSnapshotInsert
  properties: Property[]
  goal: InvestorGoal | null
  config: DecisionConfig
  overrides?: Record<string, AssumptionOverrides>
}): DecisionContext {
  const base = {
    portfolio_id: input.portfolio_id,
    today: input.today,
    snapshot: input.snapshot,
    properties: input.properties,
    goal: input.goal,
    config: input.config,
  }
  return {
    ...base,
    conditions: detectConditions(base),
    overrides: input.overrides ?? {},
  }
}

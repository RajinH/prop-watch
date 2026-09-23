import type { ActionScoreComponents } from '../types'

// Placeholder components — scoring happens in score.ts after evaluation.
export const EMPTY_SCORE: ActionScoreComponents = {
  goal_alignment: 0,
  financial_impact: 0,
  urgency: 0,
  confidence: 0,
  risk_reduction: 0,
  implementation_friction: 0,
  estimated_cost: 0,
}

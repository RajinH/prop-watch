import type { Property, PortfolioSnapshotInsert } from '../engine/types'
import type { DecisionConfig } from './config'

// All persisted shapes are snake_case, matching Track-B DB conventions.

export type GoalType =
  | 'improve_cashflow'
  | 'prepare_next_purchase'
  | 'reduce_debt'
  | 'reduce_risk'

export type RiskTolerance = 'conservative' | 'balanced' | 'growth'

export type InvestorGoal = {
  id: string
  portfolio_id: string
  type: GoalType
  target_value: number | null
  target_date: string | null
  max_monthly_deficit: number | null
  minimum_cash_buffer: number | null
  risk_tolerance: RiskTolerance
  available_lump_sum: number | null
}

export type ConditionCode =
  | 'negative_cashflow'
  | 'property_negative_cashflow'
  | 'rate_above_reference'
  | 'high_lvr'
  | 'low_yield'
  | 'fixed_expiry_approaching'
  | 'rent_review_due'
  | 'comparable_rent_gap'
  | 'funds_available'
  | 'missing_required_data'

export type ConditionSeverity = 'info' | 'warning' | 'critical'

export type EvidenceValue = number | string | boolean | null

export type DetectedCondition = {
  code: ConditionCode
  scope: 'portfolio' | 'property'
  property_id?: string
  severity: ConditionSeverity
  evidence: Record<string, EvidenceValue>
  detected_at: string
  data_as_of: string
}

// 'review_insurance' from the spec is deferred beyond the MVP.
export type ActionType = 'review_refinance' | 'review_rent' | 'pay_down_debt'

export type AssumptionOverrides = Record<string, number | string | boolean>

export type CandidateAction = {
  id: string // deterministic: `${action_type}:${property_id ?? 'portfolio'}`
  action_type: ActionType
  scope: 'portfolio' | 'property'
  property_id?: string
  reason_codes: ConditionCode[]
  evidence: Record<string, EvidenceValue>
  assumptions: Record<string, EvidenceValue>
  required_inputs: string[]
}

export type PortfolioOutcome = {
  total_value: number
  total_debt: number
  total_equity: number
  monthly_cashflow: number
  annual_cashflow: number
  weighted_lvr: number | null
  gross_yield: number | null
  total_interest_remaining: number | null
  goal_progress_pct: number | null
}

export type ActionImpact = {
  monthly_cashflow_delta?: number
  annual_cashflow_delta?: number
  total_equity_delta?: number
  weighted_lvr_delta?: number
  total_interest_delta?: number
  estimated_one_off_cost?: number
  estimated_break_even_months?: number
}

export type Confidence = 'low' | 'medium' | 'high'

export type ActionScoreComponents = {
  goal_alignment: number
  financial_impact: number
  urgency: number
  confidence: number
  risk_reduction: number
  implementation_friction: number
  estimated_cost: number
}

export type EvaluatedAction = CandidateAction & {
  baseline: PortfolioOutcome
  projected: PortfolioOutcome
  impact: ActionImpact
  sensitivity?: { label: string; impact: ActionImpact }[]
  confidence: Confidence
  confidence_reasons: string[]
  risks: string[]
  score_components: ActionScoreComponents
  score: number
}

export type RecommendationCopy = {
  title: string
  summary: string
  why: string[]
  caveats: string[]
}

export type RankedAction = EvaluatedAction & {
  rank: number
  blocked: boolean
  primary_eligible: boolean
  copy: RecommendationCopy
}

// Spec's six statuses plus 'expired': eligibility can vanish between runs and
// deleting the row would orphan its event/audit trail.
export type RecommendationStatus =
  | 'new'
  | 'viewed'
  | 'investigating'
  | 'deferred'
  | 'dismissed'
  | 'completed'
  | 'expired'

export type DecisionContextBase = {
  portfolio_id: string
  today: string
  snapshot: PortfolioSnapshotInsert
  properties: Property[]
  goal: InvestorGoal | null
  config: DecisionConfig
}

export type DecisionContext = DecisionContextBase & {
  conditions: DetectedCondition[]
  // Keyed by candidate id — persisted per-recommendation assumption edits.
  overrides: Record<string, AssumptionOverrides>
}

export type ActionStrategy = {
  type: ActionType
  detect(context: DecisionContext): CandidateAction[]
  evaluate(candidate: CandidateAction, context: DecisionContext): EvaluatedAction
}

export type RunChanges = {
  data_changed: string[]
  next_action_changed: boolean
  previous_top: string | null
  current_top: string | null
  goal_progress_delta: number | null
  deferred_due: string[]
  completed_awaiting_outcome: string[]
}

export type PipelineResult = {
  conditions: DetectedCondition[]
  candidates: CandidateAction[]
  evaluated: RankedAction[]
  baseline: PortfolioOutcome
}

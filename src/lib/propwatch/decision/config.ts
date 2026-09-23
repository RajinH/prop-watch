import {
  RATE_FLAG_THRESHOLD,
  FIXED_EXPIRY_WINDOW_DAYS,
  HIGH_LVR_THRESHOLD,
  TARGET_GROSS_YIELD,
} from '../engine/thresholds'

export const DECISION_ENGINE_VERSION = '1.0.0'

export const DECISION_CONFIG = {
  // Shared thresholds (same values the insights rules use — see engine/thresholds.ts)
  rate_flag_threshold: RATE_FLAG_THRESHOLD,
  fixed_expiry_window_days: FIXED_EXPIRY_WINDOW_DAYS,
  high_lvr_threshold: HIGH_LVR_THRESHOLD,
  target_gross_yield: TARGET_GROSS_YIELD,
  property_low_yield_threshold: 0.04,

  // Refinance
  reference_interest_rate: 0.065, // modelled achievable rate, a benchmark not a quote
  refinance_min_balance: 100_000,
  refinance_switching_costs: {
    discharge_fee: 350,
    application_fee: 600,
    valuation_fee: 300,
    government_fees: 250,
  },
  default_remaining_term_years: 25,
  fixed_break_suppress_months: 6,

  // Rent review
  rent_review_min_interval_months: 12,
  management_fee_pct: 0.07,
  rent_sensitivity_capture: 0.5,

  // Debt paydown
  paydown_min_lump_sum: 5_000,
  alternative_return_rate: 0.045,

  // Scoring (spec formula weights)
  weights: {
    goal_alignment: 0.3,
    financial_impact: 0.25,
    urgency: 0.15,
    confidence: 0.15,
    risk_reduction: 0.1,
    implementation_friction: 0.03,
    estimated_cost: 0.02,
  },
  impact_full_score_annual: 6_000,
  // Lifetime interest deltas are spread over this horizon so they compare
  // against annual cashflow deltas on the same scale.
  score_interest_horizon_years: 10,
  cost_full_score: 3_000,
  lvr_full_score_delta: 0.05,
  tie_epsilon: 0.05,
  friction: {
    review_refinance: 0.7,
    review_rent: 0.3,
    pay_down_debt: 0.2,
  },
  goal_alignment_matrix: {
    review_refinance: {
      improve_cashflow: 1.0,
      reduce_debt: 0.6,
      reduce_risk: 0.5,
      prepare_next_purchase: 0.5,
    },
    review_rent: {
      improve_cashflow: 1.0,
      reduce_debt: 0.4,
      reduce_risk: 0.3,
      prepare_next_purchase: 0.5,
    },
    pay_down_debt: {
      reduce_debt: 1.0,
      reduce_risk: 0.9,
      improve_cashflow: 0.5,
      prepare_next_purchase: 0.3,
    },
  },
  no_goal_alignment: 0.5,

  // Orchestration
  stale_run_hours: 24,
} as const

export type DecisionConfig = typeof DECISION_CONFIG

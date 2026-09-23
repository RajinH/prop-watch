import type { Property } from '../engine/types'
import { computePortfolioSnapshot } from '../engine/computePortfolioSnapshot'
import { computeDebtProjection } from '../engine/computeDebtProjection'
import { computeGoalProgress } from '../engine/computeGoalProgress'
import { round2 } from '../engine/money'
import type {
  ActionImpact,
  AssumptionOverrides,
  EvidenceValue,
  InvestorGoal,
  PortfolioOutcome,
} from './types'
import type { DecisionConfig } from './config'
import { yearsBetween } from './dates'

/**
 * The single source of portfolio math for baseline AND projected sides of a
 * counterfactual — strategies clone `properties`, override the target
 * property, and call this on both sides so the comparison can never diverge.
 */
export function computeOutcome(
  portfolioId: string,
  properties: Property[],
  goal: InvestorGoal | null,
  today: string
): PortfolioOutcome {
  const snap = computePortfolioSnapshot(portfolioId, properties, today)

  const projections = computeDebtProjection(properties)
  const interestCosts = projections
    .map((p) => p.total_interest_cost)
    .filter((v): v is number => v !== null)
  const total_interest_remaining =
    projections.length === 0
      ? 0
      : interestCosts.length === 0
        ? null
        : round2(interestCosts.reduce((s, v) => s + v, 0))

  // Progress is only well-defined for a cashflow target in the MVP; other
  // goal types rank via alignment/risk components instead.
  const goal_progress_pct =
    goal?.type === 'improve_cashflow' && goal.target_value !== null && goal.target_value > 0
      ? computeGoalProgress(snap, goal.target_value).progress_pct
      : null

  return {
    total_value: snap.total_value,
    total_debt: snap.total_debt,
    total_equity: snap.total_equity,
    monthly_cashflow: snap.monthly_cashflow,
    annual_cashflow: round2(snap.monthly_cashflow * 12),
    weighted_lvr: snap.weighted_lvr,
    gross_yield: snap.yield,
    total_interest_remaining,
    goal_progress_pct,
  }
}

/** Core outcome deltas; strategies layer costs/break-even on top. */
export function diffOutcomes(
  baseline: PortfolioOutcome,
  projected: PortfolioOutcome
): ActionImpact {
  const impact: ActionImpact = {
    monthly_cashflow_delta: round2(projected.monthly_cashflow - baseline.monthly_cashflow),
    annual_cashflow_delta: round2(projected.annual_cashflow - baseline.annual_cashflow),
    total_equity_delta: round2(projected.total_equity - baseline.total_equity),
  }
  if (baseline.weighted_lvr !== null && projected.weighted_lvr !== null) {
    impact.weighted_lvr_delta = round2(projected.weighted_lvr - baseline.weighted_lvr)
  }
  if (
    baseline.total_interest_remaining !== null &&
    projected.total_interest_remaining !== null
  ) {
    impact.total_interest_delta = round2(
      projected.total_interest_remaining - baseline.total_interest_remaining
    )
  }
  return impact
}

/**
 * Monthly repayment for a loan. P&I uses standard amortisation
 * (P·r / (1 − (1+r)^−n)); interest-only pays interest on the balance.
 */
export function monthlyRepaymentForLoan(
  balance: number,
  annualRate: number,
  termYears: number,
  loanType: 'principal_and_interest' | 'interest_only'
): number {
  if (balance <= 0) return 0
  if (loanType === 'interest_only') return round2((balance * annualRate) / 12)
  const months = Math.max(1, Math.round(termYears * 12))
  if (annualRate <= 0) return round2(balance / months)
  const r = annualRate / 12
  return round2((balance * r) / (1 - Math.pow(1 + r, -months)))
}

export type RemainingTerm = {
  value: number
  source: 'derived' | 'default'
}

/**
 * Remaining loan term. Derived from loan_term_years minus years since
 * purchase when both facts exist (assumes the loan started at purchase);
 * otherwise falls back to the configured default — callers surface the
 * source in confidence reasons.
 */
export function remainingTermYears(
  property: Property,
  today: string,
  config: DecisionConfig
): RemainingTerm {
  if (property.loan_term_years !== null && property.purchase_date !== null) {
    const elapsed = yearsBetween(property.purchase_date, today)
    const remaining = Math.min(
      property.loan_term_years,
      Math.max(1, round2(property.loan_term_years - elapsed))
    )
    return { value: remaining, source: 'derived' }
  }
  return { value: config.default_remaining_term_years, source: 'default' }
}

/** Defaults merged with any persisted per-recommendation overrides. */
export function mergeAssumptions(
  defaults: Record<string, EvidenceValue>,
  overrides: AssumptionOverrides | undefined
): Record<string, EvidenceValue> {
  return { ...defaults, ...(overrides ?? {}) }
}

export function asNumber(value: EvidenceValue, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function asBoolean(value: EvidenceValue, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

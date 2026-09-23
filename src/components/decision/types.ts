import type { RankedAction, RecommendationStatus } from '@/lib/propwatch/decision/types'

// Shape of a `recommendations` row as the UI consumes it.
export interface RecommendationRow {
  id: string
  portfolio_id: string
  property_id: string | null
  action_type: 'review_refinance' | 'review_rent' | 'pay_down_debt'
  status: RecommendationStatus
  rank: number | null
  score: number | null
  confidence: 'low' | 'medium' | 'high' | null
  payload: RankedAction
  assumption_overrides: Record<string, number | boolean>
  deferred_until: string | null
  status_reason: string | null
  updated_at: string
}

export interface OutcomeRow {
  id: string
  recommendation_id: string
  estimated: Record<string, number | undefined>
  actual_monthly_delta: number | null
  actual_one_off_cost: number | null
  actual_rate: number | null
  notes: string | null
}

export const ACTION_LABELS: Record<RecommendationRow['action_type'], string> = {
  review_refinance: 'Refinance review',
  review_rent: 'Rent review',
  pay_down_debt: 'Debt paydown',
}

export function fmtMoney(n: number): string {
  return '$' + Math.abs(n).toLocaleString('en-AU', { maximumFractionDigits: 0 })
}

export function fmtSigned(n: number): string {
  return (n >= 0 ? '+' : '−') + fmtMoney(n)
}

export function fmtPct(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : (n * 100).toFixed(1) + '%'
}

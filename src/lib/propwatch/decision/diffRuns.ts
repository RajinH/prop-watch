import type { PipelineResult, PortfolioOutcome, RunChanges } from './types'
import { round2 } from '../engine/money'

const TRACKED_FIELDS: (keyof PortfolioOutcome)[] = [
  'total_value',
  'total_debt',
  'total_equity',
  'monthly_cashflow',
  'weighted_lvr',
  'gross_yield',
]

export type PreviousRunSummary = {
  top_action_id: string | null
  baseline: PortfolioOutcome | null
}

function currentTop(result: PipelineResult): string | null {
  const first = result.evaluated[0]
  return first && first.primary_eligible ? first.id : null
}

/** The "what changed since last time" diff behind the decision brief. */
export function computeRunChanges(
  previous: PreviousRunSummary | null,
  current: PipelineResult,
  extras: { deferred_due: string[]; completed_awaiting_outcome: string[] }
): RunChanges {
  const data_changed: string[] = []
  if (previous?.baseline) {
    for (const field of TRACKED_FIELDS) {
      if (previous.baseline[field] !== current.baseline[field]) {
        data_changed.push(field)
      }
    }
  }

  const top = currentTop(current)
  const next_action_changed = previous !== null && previous.top_action_id !== top

  const goal_progress_delta =
    previous?.baseline?.goal_progress_pct != null &&
    current.baseline.goal_progress_pct != null
      ? round2(current.baseline.goal_progress_pct - previous.baseline.goal_progress_pct)
      : null

  return {
    data_changed,
    next_action_changed,
    previous_top: previous?.top_action_id ?? null,
    current_top: top,
    goal_progress_delta,
    deferred_due: extras.deferred_due,
    completed_awaiting_outcome: extras.completed_awaiting_outcome,
  }
}

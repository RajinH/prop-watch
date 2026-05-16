import type { PortfolioSnapshotInsert, GoalProgress } from './types'
import { round2 } from './money'

export function computeGoalProgress(
  snap: PortfolioSnapshotInsert,
  target: number
): GoalProgress {
  const current = snap.monthly_cashflow
  const progress_pct = target > 0 ? round2((current / target) * 100) : 0
  return {
    target,
    current,
    progress_pct: Math.min(progress_pct, 100),
    monthly_gap: round2(target - current),
  }
}

import { Newspaper } from 'lucide-react'
import type { RunChanges } from '@/lib/propwatch/decision/types'

const FIELD_LABELS: Record<string, string> = {
  total_value: 'portfolio value',
  total_debt: 'total debt',
  total_equity: 'equity',
  monthly_cashflow: 'monthly cashflow',
  weighted_lvr: 'LVR',
  gross_yield: 'gross yield',
}

/** "Since your last brief" — rendered only when there is something to say. */
export default function DecisionBriefCard({ changes }: { changes: RunChanges | null }) {
  if (!changes) return null

  const lines: string[] = []
  if (changes.data_changed.length > 0) {
    lines.push(
      `Your ${changes.data_changed
        .map((f) => FIELD_LABELS[f] ?? f.replaceAll('_', ' '))
        .join(', ')} changed since the last check.`
    )
  }
  if (changes.next_action_changed) {
    lines.push(
      changes.current_top
        ? 'Your next best action has changed.'
        : 'Your previous next best action no longer applies.'
    )
  }
  if (changes.goal_progress_delta !== null && changes.goal_progress_delta !== 0) {
    lines.push(
      changes.goal_progress_delta > 0
        ? `You moved ${changes.goal_progress_delta.toFixed(0)} points closer to your goal.`
        : `You moved ${Math.abs(changes.goal_progress_delta).toFixed(0)} points further from your goal.`
    )
  }
  if (changes.deferred_due.length > 0) {
    lines.push(
      `${changes.deferred_due.length} deferred action${changes.deferred_due.length === 1 ? ' is' : 's are'} due for another look.`
    )
  }
  if (changes.completed_awaiting_outcome.length > 0) {
    lines.push(
      `${changes.completed_awaiting_outcome.length} completed action${changes.completed_awaiting_outcome.length === 1 ? '' : 's'} can record an actual outcome.`
    )
  }

  if (lines.length === 0) return null

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Newspaper size={15} />
        </span>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Since your last brief
        </p>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {lines.map((line) => (
          <li key={line} className="text-sm text-slate-600">
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}

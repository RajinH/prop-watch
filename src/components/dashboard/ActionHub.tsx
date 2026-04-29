'use client'

interface InsightRow {
  id: string
  type: string
  severity: string
  title: string
  description: string
  impact: number | null
  metadata: Record<string, unknown>
}

interface Props {
  insights: InsightRow[]
  onTabChange: (tab: string) => void
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, positive: 2, info: 3 }

const ACTION_MAP: Record<string, { label: string; tab: string; bg: string }> = {
  cashflow_negative: { label: 'Review risk profile', tab: 'risk', bg: 'bg-amber-50 border-amber-200' },
  cashflow_positive: { label: 'See portfolio', tab: 'portfolio', bg: 'bg-green-50 border-green-200' },
  lvr_high: { label: 'Review risk profile', tab: 'risk', bg: 'bg-red-50 border-red-200' },
  lvr_moderate: { label: 'Review risk profile', tab: 'risk', bg: 'bg-amber-50 border-amber-200' },
  rate_sensitivity: { label: 'Run a scenario', tab: 'scenarios', bg: 'bg-red-50 border-red-200' },
  concentration_risk: { label: 'See insights', tab: 'insights', bg: 'bg-amber-50 border-amber-200' },
  gap_all_negative: { label: 'See insights', tab: 'insights', bg: 'bg-amber-50 border-amber-200' },
  yield_low: { label: 'See insights', tab: 'insights', bg: 'bg-slate-50 border-slate-200' },
}

export default function ActionHub({ insights, onTabChange }: Props) {
  const topInsights = [...insights]
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
    .filter((i) => i.severity === 'critical' || i.severity === 'warning')
    .slice(0, 3)

  if (topInsights.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Action required</p>
      <div className="flex flex-col gap-2">
        {topInsights.map((insight) => {
          const action = ACTION_MAP[insight.type]
          const bg = action?.bg ?? 'bg-slate-50 border-slate-200'
          const tab = action?.tab ?? 'insights'
          const label = action?.label ?? 'View details'
          return (
            <div
              key={insight.id}
              className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${bg}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`shrink-0 rounded-full w-2 h-2 ${insight.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <p className="text-sm font-medium text-slate-800 truncate">{insight.title}</p>
              </div>
              <button
                onClick={() => onTabChange(tab)}
                className="shrink-0 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap"
              >
                {label} →
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

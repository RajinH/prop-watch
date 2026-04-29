const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  positive: 'bg-green-100 text-green-700',
  info: 'bg-slate-100 text-slate-500',
}

interface InsightRow {
  id: string
  type: string
  severity: string
  title: string
  description: string
  impact: string | null
}

interface Props {
  insights: InsightRow[]
}

export default function InsightsList({ insights }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {insights.map((insight) => (
        <div
          key={insight.id}
          className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col gap-1"
        >
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${SEVERITY_STYLES[insight.severity] ?? 'bg-slate-100 text-slate-500'}`}
            >
              {insight.severity}
            </span>
            <p className="font-semibold text-slate-800 text-sm">{insight.title}</p>
          </div>
          <p className="text-sm text-slate-500">{insight.description}</p>
          {insight.impact && (
            <p className="text-xs text-slate-400 mt-0.5">{insight.impact}</p>
          )}
        </div>
      ))}
    </div>
  )
}

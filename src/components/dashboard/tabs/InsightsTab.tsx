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
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-50 border-red-200',
  warning: 'bg-amber-50 border-amber-200',
  positive: 'bg-green-50 border-green-200',
  info: 'bg-slate-50 border-slate-200',
}

const BADGE_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  positive: 'bg-green-100 text-green-700',
  info: 'bg-slate-100 text-slate-500',
}

const OPPORTUNITY_TYPES = new Set(['opportunity_yield', 'opportunity_refinance'])
const GAP_TYPES = new Set(['gap_all_negative', 'concentration_risk'])

function InsightCard({ insight }: { insight: InsightRow }) {
  return (
    <div className={`rounded-xl border px-4 py-3 flex flex-col gap-1 ${SEVERITY_STYLES[insight.severity] ?? 'bg-slate-50 border-slate-200'}`}>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${BADGE_STYLES[insight.severity] ?? 'bg-slate-100 text-slate-500'}`}>
          {insight.severity}
        </span>
        <p className="text-sm font-semibold text-slate-800">{insight.title}</p>
      </div>
      <p className="text-sm text-slate-500">{insight.description}</p>
      {insight.metadata?.gross_yield !== undefined && (
        <p className="text-xs text-slate-400 mt-0.5">
          Current yield: {((insight.metadata.gross_yield as number) * 100).toFixed(1)}%
        </p>
      )}
    </div>
  )
}

function Section({ title, insights, empty }: { title: string; insights: InsightRow[]; empty: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {insights.length === 0
        ? <p className="text-sm text-slate-400 italic">{empty}</p>
        : insights.map((i) => <InsightCard key={i.id} insight={i} />)
      }
    </div>
  )
}

export default function InsightsTab({ insights }: Props) {
  const opportunities = insights.filter((i) => OPPORTUNITY_TYPES.has(i.type))
  const gaps = insights.filter((i) => GAP_TYPES.has(i.type))
  const optimisation = insights.filter((i) => !OPPORTUNITY_TYPES.has(i.type) && !GAP_TYPES.has(i.type))

  return (
    <div className="flex flex-col gap-8">
      <Section
        title="Opportunities"
        insights={opportunities}
        empty="No yield or refinancing opportunities detected."
      />
      <Section
        title="Portfolio gaps"
        insights={gaps}
        empty="No structural gaps detected."
      />
      <Section
        title="Optimisation"
        insights={optimisation}
        empty="No additional optimisation suggestions."
      />
    </div>
  )
}

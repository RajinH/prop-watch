import type { DecisionDimension, DecisionDimensionKey } from './types'

/**
 * Maps an insight `type` (emitted by generateInsights) to one of the five
 * portfolio-level decision dimensions. Only portfolio-level financial-health
 * concerns are mapped — positive insights and operational loan/insurance/calendar
 * alerts are intentionally omitted so the Portfolio Home surface stays focused.
 */
const TYPE_TO_DIMENSION: Record<string, DecisionDimensionKey> = {
  // Performance — yield & capital growth
  yield_low: 'performance',
  opportunity_yield: 'performance',
  capital_growth_underperforming: 'performance',
  // Leverage / equity
  lvr_high: 'leverage',
  lvr_moderate: 'leverage',
  equity_locked: 'leverage',
  // Cashflow
  cashflow_negative: 'cashflow',
  gap_all_negative: 'cashflow',
  rate_sensitivity: 'cashflow',
  // Concentration
  concentration_risk: 'concentration',
  // Data quality / confidence
  data_quality: 'data_quality',
}

const DIMENSION_LABELS: Record<DecisionDimensionKey, string> = {
  performance: 'Performance',
  leverage: 'Leverage & equity',
  cashflow: 'Cashflow',
  concentration: 'Concentration',
  data_quality: 'Data quality',
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 }

// Lower rank = surfaced first.
const DIMENSION_ORDER: DecisionDimensionKey[] = [
  'cashflow',
  'leverage',
  'performance',
  'concentration',
  'data_quality',
]

type SurfaceableInsight = {
  type: string
  // Accepts the wider `string` severity used by the serialised insight rows
  // passed from the dashboard; non-portfolio/positive values are filtered out.
  severity: string
  title: string
  description: string
}

/**
 * Groups raw insights into the five decision dimensions, returning only the
 * dimensions that have at least one active (non-positive) concern. The full
 * threshold logic lives in generateInsights — this is a pure categorisation layer.
 */
export function buildDecisionSurface(insights: SurfaceableInsight[]): DecisionDimension[] {
  const grouped = new Map<DecisionDimensionKey, SurfaceableInsight[]>()

  for (const insight of insights) {
    if (insight.severity === 'positive') continue
    const key = TYPE_TO_DIMENSION[insight.type]
    if (!key) continue
    const bucket = grouped.get(key)
    if (bucket) bucket.push(insight)
    else grouped.set(key, [insight])
  }

  const dimensions: DecisionDimension[] = []

  for (const [key, items] of grouped) {
    const sorted = [...items].sort(
      (a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)
    )
    const top = sorted[0]
    const severity = top.severity as DecisionDimension['severity']
    dimensions.push({
      key,
      label: DIMENSION_LABELS[key],
      status: severity === 'info' ? 'watch' : 'attention',
      severity,
      count: sorted.length,
      headline: { title: top.title, description: top.description },
      insightTypes: sorted.map((i) => i.type),
    })
  }

  return dimensions.sort((a, b) => {
    const sev = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)
    if (sev !== 0) return sev
    return DIMENSION_ORDER.indexOf(a.key) - DIMENSION_ORDER.indexOf(b.key)
  })
}

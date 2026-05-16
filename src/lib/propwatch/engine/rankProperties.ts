import type { Property, PropertySnapshot, PropertyGrowth, PropertyRank } from './types'
import { round2 } from './money'

export function rankProperties(
  properties: Property[],
  snapshots: Record<string, PropertySnapshot>,
  growthData: PropertyGrowth[]
): PropertyRank[] {
  const growthMap = new Map(growthData.map((g) => [g.property_id, g]))

  const scored = properties.map((p) => {
    const snap = snapshots[p.id]
    const growth = growthMap.get(p.id)

    const yield_score = snap?.yield ?? 0
    const cashflow_efficiency = snap && snap.equity > 0
      ? round2(snap.monthly_cashflow / snap.equity)
      : null
    const lvr = snap?.lvr ?? null
    const cagr = growth?.annualised_growth_rate ?? null

    const lvrFactor = lvr !== null ? Math.max(0, 1 - lvr) : 0.5
    const cagrFactor = cagr !== null ? Math.min(Math.max(cagr, -0.1), 0.2) / 0.2 : 0.5
    const cfFactor = cashflow_efficiency !== null
      ? Math.min(Math.max(cashflow_efficiency * 100, -1), 1) / 1 * 0.5 + 0.5
      : 0.5

    const composite_score = round2(
      (yield_score / 0.10) * 0.40 +
      cfFactor * 0.30 +
      lvrFactor * 0.20 +
      cagrFactor * 0.10
    )

    return { property_id: p.id, property_name: p.name, yield_score, cashflow_efficiency, lvr, cagr, composite_score }
  })

  return scored
    .sort((a, b) => b.composite_score - a.composite_score)
    .map((p, i) => ({ ...p, rank: i + 1 }))
}

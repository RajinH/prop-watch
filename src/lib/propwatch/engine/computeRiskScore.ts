import type { Property, PortfolioSnapshotInsert, RiskProfile } from './types'

function lvrScore(lvr: number | null): number {
  if (lvr === null) return 10
  if (lvr >= 0.8) return 90
  if (lvr >= 0.65) return 60
  if (lvr >= 0.5) return 30
  return 10
}

function cashflowScore(snap: PortfolioSnapshotInsert): number {
  if (snap.monthly_cashflow > 0) return 10
  if (snap.total_value === 0) return 50
  const ratio = Math.abs(snap.monthly_cashflow) / snap.total_value
  if (ratio < 0.005) return 40
  if (ratio < 0.01) return 70
  return 90
}

function concentrationScore(properties: Property[], totalValue: number): number {
  if (properties.length === 0 || totalValue === 0) return 10
  const maxValue = Math.max(...properties.map((p) => p.current_value))
  const ratio = maxValue / totalValue
  if (ratio > 0.8) return 90
  if (ratio > 0.6) return 60
  if (ratio > 0.4) return 30
  return 10
}

function labelFromScore(score: number): RiskProfile['label'] {
  if (score >= 76) return 'critical'
  if (score >= 51) return 'high'
  if (score >= 26) return 'moderate'
  return 'low'
}

export function computeRiskScore(
  snap: PortfolioSnapshotInsert,
  properties: Property[]
): RiskProfile {
  const ir = lvrScore(snap.weighted_lvr)
  const cf = cashflowScore(snap)
  const conc = concentrationScore(properties, snap.total_value)
  const liq = lvrScore(snap.weighted_lvr)

  const overall = Math.round(ir * 0.30 + cf * 0.35 + conc * 0.20 + liq * 0.15)

  return {
    overall,
    label: labelFromScore(overall),
    interest_rate: ir,
    cashflow: cf,
    concentration: conc,
    liquidity: liq,
  }
}

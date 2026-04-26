import type { RiskResult, RiskFactor, RiskLevel, EquityResult, CashflowResult, YieldResult } from './types'

export interface RiskInput {
  equity: EquityResult
  cashflow: CashflowResult
  yieldResult: YieldResult
  isTenanted: boolean
}

export function computeRisk(input: RiskInput): RiskResult {
  const { equity, cashflow, yieldResult, isTenanted } = input
  const factors: RiskFactor[] = []
  let score = 0

  if (equity.lvr > 80) {
    score += 30
    factors.push({
      label: 'High LVR',
      severity: 'critical',
      description: `LVR of ${equity.lvr.toFixed(1)}% is above the 80% lending threshold, limiting refinancing options.`,
    })
  } else if (equity.lvr < 60) {
    score -= 10
    factors.push({
      label: 'Strong equity position',
      severity: 'positive',
      description: `LVR of ${equity.lvr.toFixed(1)}% gives you solid equity buffer and refinancing flexibility.`,
    })
  }

  if (cashflow.monthlyCashflow < 0) {
    const deficit = Math.abs(cashflow.monthlyCashflow)
    const points = Math.min(40, Math.floor(deficit / 500) * 20)
    score += points
    const severity = deficit > 1000 ? 'critical' : 'warning'
    factors.push({
      label: 'Negative cashflow',
      severity,
      description: `This property costs $${deficit.toFixed(0)}/month out of pocket after rent, expenses, and mortgage.`,
    })
  } else if (cashflow.monthlyCashflow > 0) {
    factors.push({
      label: 'Positive cashflow',
      severity: 'positive',
      description: `Property generates $${cashflow.monthlyCashflow.toFixed(0)}/month surplus — self-funding with buffer.`,
    })
  }

  if (!isTenanted) {
    score += 15
    factors.push({
      label: 'Vacancy risk',
      severity: 'warning',
      description: 'Property is not currently tenanted, meaning full holding costs with no rental income.',
    })
  }

  if (isTenanted && yieldResult.netYield < 2 && yieldResult.netYield > 0) {
    score += 15
    factors.push({
      label: 'Low net yield',
      severity: 'warning',
      description: `Net yield of ${yieldResult.netYield.toFixed(1)}% is below 2% — returns are thin relative to holding costs.`,
    })
  }

  if (isTenanted && yieldResult.grossYield > 6) {
    score -= 10
    factors.push({
      label: 'Strong gross yield',
      severity: 'positive',
      description: `Gross yield of ${yieldResult.grossYield.toFixed(1)}% is above 6% — strong income performance.`,
    })
  }

  const clampedScore = Math.max(0, Math.min(100, score))

  let level: RiskLevel
  if (clampedScore <= 25) {
    level = 'low'
  } else if (clampedScore <= 50) {
    level = 'moderate'
  } else if (clampedScore <= 75) {
    level = 'high'
  } else {
    level = 'critical'
  }

  return { level, score: clampedScore, factors }
}

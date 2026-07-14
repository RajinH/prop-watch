import { describe, it, expect } from 'vitest'
import { buildDecisionSurface } from '../decisionSurface'

type Insight = {
  type: string
  severity: string
  title: string
  description: string
}

const ins = (type: string, severity: string): Insight => ({
  type,
  severity,
  title: `${type} title`,
  description: `${type} description`,
})

describe('buildDecisionSurface', () => {
  it('returns nothing when there are no insights', () => {
    expect(buildDecisionSurface([])).toEqual([])
  })

  it('ignores positive insights and unmapped (loan/insurance) types', () => {
    const result = buildDecisionSurface([
      ins('cashflow_positive', 'positive'),
      ins('equity_unlockable', 'positive'),
      ins('loan_fixed_expiry_soon', 'warning'),
      ins('insurance_renewal_soon', 'critical'),
      ins('rate_above_market', 'warning'),
    ])
    expect(result).toEqual([])
  })

  it('maps insight types to the correct dimensions', () => {
    const result = buildDecisionSurface([
      ins('cashflow_negative', 'warning'),
      ins('lvr_high', 'critical'),
      ins('yield_low', 'info'),
      ins('concentration_risk', 'warning'),
      ins('data_quality', 'info'),
    ])
    const byKey = Object.fromEntries(result.map((d) => [d.key, d]))
    expect(Object.keys(byKey).sort()).toEqual(
      ['cashflow', 'concentration', 'data_quality', 'leverage', 'performance'].sort()
    )
    expect(byKey.cashflow.label).toBe('Cashflow')
    expect(byKey.leverage.severity).toBe('critical')
  })

  it('derives status: attention for warning/critical, watch for info-only', () => {
    const [perf] = buildDecisionSurface([ins('yield_low', 'info')])
    expect(perf.status).toBe('watch')

    const [cashflow] = buildDecisionSurface([ins('cashflow_negative', 'warning')])
    expect(cashflow.status).toBe('attention')
  })

  it('rolls up multiple insights in one dimension: highest severity headline + count', () => {
    const result = buildDecisionSurface([
      ins('yield_low', 'info'),
      ins('opportunity_yield', 'warning'),
      ins('capital_growth_underperforming', 'info'),
    ])
    expect(result).toHaveLength(1)
    const perf = result[0]
    expect(perf.key).toBe('performance')
    expect(perf.count).toBe(3)
    expect(perf.severity).toBe('warning')
    expect(perf.headline.title).toBe('opportunity_yield title')
  })

  it('sorts dimensions by severity (critical first)', () => {
    const result = buildDecisionSurface([
      ins('data_quality', 'info'),
      ins('cashflow_negative', 'warning'),
      ins('lvr_high', 'critical'),
    ])
    expect(result.map((d) => d.key)).toEqual(['leverage', 'cashflow', 'data_quality'])
  })
})

import type { Property, PortfolioSnapshotInsert } from './types'
import { safeDiv, round2 } from './money'

export function computePortfolioSnapshot(
  portfolioId: string,
  properties: Property[],
  snapshotDate: string
): PortfolioSnapshotInsert {
  const total_value = properties.reduce((s, p) => s + p.current_value, 0)
  const total_debt = properties.reduce((s, p) => s + p.current_debt, 0)
  const total_equity = total_value - total_debt
  const monthly_cashflow = properties.reduce(
    (s, p) => s + p.monthly_rent - p.monthly_repayment - p.annual_expenses / 12,
    0
  )
  const weighted_lvr = safeDiv(total_debt, total_value)
  const totalAnnualRent = properties.reduce((s, p) => s + p.monthly_rent * 12, 0)
  const portfolioYield = safeDiv(totalAnnualRent, total_value)

  return {
    portfolio_id: portfolioId,
    snapshot_date: snapshotDate,
    total_value,
    total_debt,
    total_equity: round2(total_equity),
    monthly_cashflow: round2(monthly_cashflow),
    weighted_lvr: weighted_lvr !== null ? round2(weighted_lvr) : null,
    yield: portfolioYield !== null ? round2(portfolioYield) : null,
  }
}

import type { Property, PortfolioSnapshotInsert, SensitivityResult } from './types'
import { round2 } from './money'

export function computeSensitivity(
  snap: PortfolioSnapshotInsert,
  properties: Property[]
): SensitivityResult {
  const cf = snap.monthly_cashflow

  // Rate breakeven: how many additional % points of interest rate flip CF negative
  let rate_breakeven_pct: number | null = null
  if (cf > 0 && snap.total_debt > 0) {
    const costPerPct = snap.total_debt * 0.01 / 12
    rate_breakeven_pct = round2(Math.min(cf / costPerPct, 10))
  }

  // Vacancy breakeven: how many weeks of zero rent until CF goes negative
  let vacancy_breakeven_weeks: number | null = null
  const totalMonthlyRent = properties.reduce((s, p) => s + p.monthly_rent, 0)
  if (cf > 0 && totalMonthlyRent > 0) {
    const weeksPerMonth = 52 / 12
    vacancy_breakeven_weeks = round2(Math.min((cf / totalMonthlyRent) * weeksPerMonth, 52))
  }

  // Expense shock: % increase in annual expenses needed to flip CF negative
  let expense_shock_pct: number | null = null
  const totalMonthlyExpenses = properties.reduce((s, p) => s + p.annual_expenses / 12, 0)
  if (cf > 0 && totalMonthlyExpenses > 0) {
    expense_shock_pct = round2(Math.min((cf / totalMonthlyExpenses) * 100, 500))
  }

  return { rate_breakeven_pct, vacancy_breakeven_weeks, expense_shock_pct }
}

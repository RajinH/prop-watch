import type { Property, PortfolioSnapshotInsert, AfterTaxCashflow } from './types'
import { round2 } from './money'

export function computeAfterTaxCashflow(
  snap: PortfolioSnapshotInsert,
  properties: Property[],
  tax_bracket: number
): AfterTaxCashflow {
  const annual_tax_deductible = properties.reduce((s, p) => {
    const interest = p.interest_rate !== null
      ? p.current_debt * p.interest_rate
      : p.monthly_repayment * 12 * 0.7
    return s + interest + p.annual_expenses
  }, 0)

  const annual_tax_saving = round2(annual_tax_deductible * tax_bracket)
  const monthly_tax_saving = round2(annual_tax_saving / 12)
  const after_tax_monthly_cashflow = round2(snap.monthly_cashflow + monthly_tax_saving)

  return {
    gross_monthly_cashflow: snap.monthly_cashflow,
    annual_tax_deductible: round2(annual_tax_deductible),
    annual_tax_saving,
    monthly_tax_saving,
    after_tax_monthly_cashflow,
    tax_bracket,
  }
}

import type { Property, PropertySnapshotInsert } from './types'
import { safeDiv, round2 } from './money'

export function computePropertySnapshot(
  property: Property,
  snapshotDate: string
): PropertySnapshotInsert {
  const equity = property.current_value - property.current_debt
  const monthly_cashflow =
    property.monthly_rent - property.monthly_repayment - property.annual_expenses / 12
  const lvr = safeDiv(property.current_debt, property.current_value)
  const grossYield = safeDiv(property.monthly_rent * 12, property.current_value)

  return {
    property_id: property.id,
    snapshot_date: snapshotDate,
    value: property.current_value,
    debt: property.current_debt,
    equity: round2(equity),
    monthly_cashflow: round2(monthly_cashflow),
    lvr: lvr !== null ? round2(lvr) : null,
    yield: grossYield !== null ? round2(grossYield) : null,
  }
}

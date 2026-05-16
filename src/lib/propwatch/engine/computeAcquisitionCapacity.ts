import type { Property, AcquisitionCapacity } from './types'
import { round2 } from './money'

export function computeAcquisitionCapacity(properties: Property[]): AcquisitionCapacity {
  const usable_equity_80 = round2(
    properties.reduce((s, p) => s + Math.max(0, p.current_value * 0.80 - p.current_debt), 0)
  )
  const usable_equity_70 = round2(
    properties.reduce((s, p) => s + Math.max(0, p.current_value * 0.70 - p.current_debt), 0)
  )
  return {
    usable_equity_80,
    usable_equity_70,
    max_purchase_price_80: round2(usable_equity_80 / 0.20),
    max_purchase_price_70: round2(usable_equity_70 / 0.30),
  }
}

import type { Property, PropertyGrowth, CapitalGrowthSummary } from './types'
import { round2 } from './money'

export function computeCapitalGrowth(properties: Property[]): CapitalGrowthSummary {
  const today = new Date()
  const props: PropertyGrowth[] = properties.map((p) => {
    if (p.purchase_price === null || p.purchase_date === null) {
      return {
        property_id: p.id, property_name: p.name, purchase_price: null,
        years_held: null, unrealised_gain: null, unrealised_gain_pct: null, annualised_growth_rate: null,
      }
    }
    const purchaseMs = new Date(p.purchase_date).getTime()
    const years_held = round2((today.getTime() - purchaseMs) / (365.25 * 24 * 3600 * 1000))
    const unrealised_gain = round2(p.current_value - p.purchase_price)
    const unrealised_gain_pct = round2(unrealised_gain / p.purchase_price)
    const annualised_growth_rate = years_held > 0
      ? round2(Math.pow(p.current_value / p.purchase_price, 1 / years_held) - 1)
      : null
    return {
      property_id: p.id, property_name: p.name, purchase_price: p.purchase_price,
      years_held, unrealised_gain, unrealised_gain_pct, annualised_growth_rate,
    }
  })

  const withData = props.filter((p) => p.unrealised_gain !== null)
  const total_unrealised_gain = round2(withData.reduce((s, p) => s + (p.unrealised_gain ?? 0), 0))
  const cagrList = withData.filter((p) => p.annualised_growth_rate !== null)
  const portfolio_annualised_growth = cagrList.length > 0
    ? round2(cagrList.reduce((s, p) => s + (p.annualised_growth_rate ?? 0), 0) / cagrList.length)
    : null
  const best = [...cagrList].sort((a, b) => (b.annualised_growth_rate ?? 0) - (a.annualised_growth_rate ?? 0))[0]

  return {
    total_unrealised_gain,
    portfolio_annualised_growth,
    best_performer: best?.property_name ?? null,
    best_performer_cagr: best?.annualised_growth_rate ?? null,
    properties: props,
  }
}

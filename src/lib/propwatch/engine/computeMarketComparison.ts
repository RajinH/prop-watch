import type { Property } from './types'
import { round2, safeDiv } from './money'

/**
 * Growth figures are fractions, so `round2` would quantise them to whole
 * percentage points — enough to make "+140% vs +135%" render a difference of
 * +6%. Four places keeps a tenth of a percent, which is what the UI displays.
 */
const roundRate = (v: number) => Math.round(v * 10000) / 10000

/**
 * Comparing a property against its own suburb — the one thing the engine cannot
 * do from the user's facts alone, because it needs an external market series.
 *
 * Pure and date-injected, like the rest of the engine: no fetch, no clock.
 */

/** A month of locality market data, as loaded from `market_trends`. */
export interface MarketSeriesPoint {
  /** 'YYYY-MM' */
  month: string
  typical_price: number | null
  /** Weekly AUD, as HTAG reports it. Optional: rent series can be shallower. */
  median_rent?: number | null
  /** Fraction, e.g. 0.0332. */
  gross_yield?: number | null
}

export interface LocalityMarket {
  area_id: string
  /** Ascending by month. */
  series: MarketSeriesPoint[]
}

/**
 * Growth over a window shorter than this is dominated by transaction noise and
 * valuation lag, so we decline to compare rather than publish a number that
 * looks precise and means nothing. (A property bought four months ago can show
 * a 50% "gain" purely from how its purchase price was recorded.)
 */
export const MIN_MONTHS_FOR_COMPARISON = 12

export type ComparisonStatus =
  | 'comparable'
  | 'held_too_briefly'
  | 'no_purchase_data'
  | 'no_market_data'

export interface PropertyMarketComparison {
  property_id: string
  property_name: string
  area_id: string | null
  status: ComparisonStatus
  months_held: number | null
  /** Fractions, e.g. 0.14 for +14%. Null unless status is 'comparable'. */
  property_growth: number | null
  market_growth: number | null
  /** property_growth - market_growth, in fraction points. */
  divergence: number | null
  value_gain: number | null
  /** Portion of the gain explained by the suburb moving, in dollars. */
  market_driven_gain: number | null
  /** The remainder — what this property did that its market did not. */
  property_driven_gain: number | null
}

function monthsBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`)
  const b = new Date(`${to}T00:00:00Z`)
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
}

/** Nearest available month at or before `month`, so a gap doesn't void a comparison. */
function priceAtOrBefore(series: MarketSeriesPoint[], month: string): number | null {
  let best: number | null = null
  for (const p of series) {
    if (p.month <= month && p.typical_price != null) best = p.typical_price
    if (p.month > month) break
  }
  return best
}

export function computeMarketComparison(
  properties: Property[],
  markets: LocalityMarket[],
  /** area_id per property id — from properties.htag_loc_pid. */
  areaByProperty: Record<string, string | null>,
  asOf: string
): PropertyMarketComparison[] {
  const byArea = new Map(markets.map((m) => [m.area_id, m.series]))

  return properties.map((p) => {
    const areaId = areaByProperty[p.id] ?? null
    const base: PropertyMarketComparison = {
      property_id: p.id,
      property_name: p.name,
      area_id: areaId,
      status: 'comparable',
      months_held: null,
      property_growth: null,
      market_growth: null,
      divergence: null,
      value_gain: null,
      market_driven_gain: null,
      property_driven_gain: null,
    }

    if (p.purchase_price === null || p.purchase_date === null || p.purchase_price <= 0) {
      return { ...base, status: 'no_purchase_data' }
    }

    const monthsHeld = monthsBetween(p.purchase_date, asOf)
    if (monthsHeld < MIN_MONTHS_FOR_COMPARISON) {
      return { ...base, status: 'held_too_briefly', months_held: monthsHeld }
    }

    const series = areaId ? byArea.get(areaId) : undefined
    if (!series || series.length === 0) {
      return { ...base, status: 'no_market_data', months_held: monthsHeld }
    }

    const then = priceAtOrBefore(series, p.purchase_date.slice(0, 7))
    const now = priceAtOrBefore(series, asOf.slice(0, 7))
    if (then === null || now === null || then <= 0) {
      return { ...base, status: 'no_market_data', months_held: monthsHeld }
    }

    const propertyGrowth = safeDiv(p.current_value - p.purchase_price, p.purchase_price)
    const marketGrowth = safeDiv(now - then, then)
    if (propertyGrowth === null || marketGrowth === null) {
      return { ...base, status: 'no_market_data', months_held: monthsHeld }
    }

    // Attribution: what the suburb's move alone would have done to the purchase
    // price, with the remainder attributed to the property itself.
    const valueGain = p.current_value - p.purchase_price
    const marketDriven = p.purchase_price * marketGrowth

    return {
      ...base,
      status: 'comparable',
      months_held: monthsHeld,
      property_growth: roundRate(propertyGrowth),
      market_growth: roundRate(marketGrowth),
      divergence: roundRate(propertyGrowth - marketGrowth),
      value_gain: round2(valueGain),
      market_driven_gain: round2(marketDriven),
      property_driven_gain: round2(valueGain - marketDriven),
    }
  })
}

export interface MarketConcentrationBucket {
  key: string
  label: string
  property_count: number
  value: number
  /** Share of total portfolio value, as a fraction. */
  share: number
}

/**
 * Concentration by *market* rather than by value share.
 *
 * `computeRiskScore` already flags when one property dominates a portfolio, but
 * it cannot see that two separate properties sit in the same market and will
 * therefore rise and fall together. Grouping by postcode surfaces exactly that.
 */
export function computeMarketConcentration(
  properties: Property[],
  /** postcode per property id, from the stored address. */
  postcodeByProperty: Record<string, string | null>
): MarketConcentrationBucket[] {
  const total = properties.reduce((t, p) => t + p.current_value, 0)
  const buckets = new Map<string, MarketConcentrationBucket>()

  for (const p of properties) {
    const key = postcodeByProperty[p.id] ?? 'unknown'
    const existing = buckets.get(key) ?? {
      key,
      label: key === 'unknown' ? 'No postcode' : key,
      property_count: 0,
      value: 0,
      share: 0,
    }
    existing.property_count += 1
    existing.value += p.current_value
    buckets.set(key, existing)
  }

  return [...buckets.values()]
    .map((b) => ({ ...b, value: round2(b.value), share: roundRate(safeDiv(b.value, total) ?? 0) }))
    .sort((a, b) => b.value - a.value)
}

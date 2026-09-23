import type { LocalityMarket } from './computeMarketComparison'

/**
 * Multi-horizon growth for a locality's prices and rents.
 *
 * The pair matters more than either alone: when prices outrun rents, yields
 * compress and the market is getting more expensive relative to the income it
 * produces. That is the signal an investor acts on, and it is invisible if you
 * only chart price.
 *
 * Pure and date-injected, like the rest of the engine.
 */

const roundRate = (v: number) => Math.round(v * 10000) / 10000

export type Horizon = { months: number | 'max'; label: string }

export interface GrowthWindow {
  /** Actual months spanned — for a 'max' window this is whatever existed. */
  months: number
  label: string
  from_month: string | null
  to_month: string | null
  /** Fractions over the whole window, e.g. 0.34 for +34%. */
  price_growth: number | null
  rent_growth: number | null
  /** Compounded to a yearly rate, so windows of different lengths compare. */
  price_growth_annualised: number | null
  rent_growth_annualised: number | null
  yield_start: number | null
  yield_end: number | null
  /** Change in gross yield, in fraction points. Negative = compressing. */
  yield_change: number | null
  /**
   * Rent growth minus price growth. Positive means rents outpaced prices and
   * the market got cheaper relative to income; negative means the opposite.
   */
  rent_vs_price: number | null
}

export interface LocalityGrowth {
  area_id: string
  /** Months of data actually available, whatever was requested. */
  months_available: number
  windows: GrowthWindow[]
}

/**
 * A fixed long horizon is a trap: ask for 36 months against a 36-point series
 * and every row comes back empty, because 36 points is only 35 intervals. The
 * 'max' window instead spans whatever history exists and reports the span it
 * actually used, so the table is never silently blank.
 */
export const DEFAULT_HORIZONS: Horizon[] = [
  { months: 12, label: '1 year' },
  { months: 'max', label: 'Full history' },
]

function growth(from: number | null, to: number | null): number | null {
  if (from === null || to === null || from <= 0) return null
  return (to - from) / from
}

/** Compound a whole-window growth rate to a yearly one. */
function annualise(total: number | null, months: number): number | null {
  if (total === null || months <= 0) return null
  if (total <= -1) return null
  return Math.pow(1 + total, 12 / months) - 1
}

export function computeMarketGrowth(
  markets: LocalityMarket[],
  horizons: Horizon[] = DEFAULT_HORIZONS
): LocalityGrowth[] {
  return markets.map((m) => {
    // Only months with a price are usable as endpoints; a gap at either end
    // would otherwise silently shorten the window without saying so.
    const series = [...m.series].sort((a, b) => a.month.localeCompare(b.month))
    const priced = series.filter((p) => p.typical_price != null)
    const latest = priced.at(-1) ?? null

    const windows = horizons.map(({ months: requested, label }) => {
      const maxSpan = Math.max(0, priced.length - 1)
      const months = requested === 'max' ? maxSpan : requested
      const empty: GrowthWindow = {
        months,
        label,
        from_month: null,
        to_month: latest?.month ?? null,
        price_growth: null,
        rent_growth: null,
        price_growth_annualised: null,
        rent_growth_annualised: null,
        yield_start: null,
        yield_end: null,
        yield_change: null,
        rent_vs_price: null,
      }
      // A zero-length window has no interval to measure: reporting 0% there
      // would read as "flat market" rather than "no data".
      if (!latest || months <= 0) return empty

      // Step back `months` entries rather than by calendar date: the series is
      // already a monthly grid, and this keeps a gap from silently extending
      // the window.
      const endIdx = priced.length - 1
      const startIdx = endIdx - months
      if (startIdx < 0) return empty
      const start = priced[startIdx]

      const priceGrowth = growth(start.typical_price, latest.typical_price)
      // Rent may be shallower than price (a deeper price pull is cheap, rent
      // is not), so resolve rent endpoints independently and allow them to be
      // null without voiding the price figure.
      const rentGrowth = growth(start.median_rent ?? null, latest.median_rent ?? null)

      return {
        months,
        label,
        from_month: start.month,
        to_month: latest.month,
        price_growth: priceGrowth === null ? null : roundRate(priceGrowth),
        rent_growth: rentGrowth === null ? null : roundRate(rentGrowth),
        price_growth_annualised: (() => {
          const a = annualise(priceGrowth, months)
          return a === null ? null : roundRate(a)
        })(),
        rent_growth_annualised: (() => {
          const a = annualise(rentGrowth, months)
          return a === null ? null : roundRate(a)
        })(),
        yield_start: start.gross_yield ?? null,
        yield_end: latest.gross_yield ?? null,
        yield_change:
          start.gross_yield != null && latest.gross_yield != null
            ? roundRate(latest.gross_yield - start.gross_yield)
            : null,
        rent_vs_price:
          rentGrowth !== null && priceGrowth !== null
            ? roundRate(rentGrowth - priceGrowth)
            : null,
      }
    })

    return { area_id: m.area_id, months_available: Math.max(0, priced.length - 1), windows }
  })
}

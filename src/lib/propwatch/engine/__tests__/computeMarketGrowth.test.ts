import { describe, it, expect } from 'vitest'
import { computeMarketGrowth, DEFAULT_HORIZONS } from '../computeMarketGrowth'
import type { LocalityMarket, MarketSeriesPoint } from '../computeMarketComparison'

/** Builds an n-month grid where price and rent each grow by a fixed step. */
function series(
  months: number,
  opts: { price0: number; priceStep: number; rent0?: number; rentStep?: number }
): MarketSeriesPoint[] {
  const out: MarketSeriesPoint[] = []
  for (let i = 0; i < months; i++) {
    const y = 2020 + Math.floor(i / 12)
    const m = String((i % 12) + 1).padStart(2, '0')
    const price = opts.price0 + opts.priceStep * i
    const rent = opts.rent0 != null ? opts.rent0 + (opts.rentStep ?? 0) * i : null
    out.push({
      month: `${y}-${m}`,
      typical_price: price,
      median_rent: rent,
      gross_yield: rent != null ? (rent * 52) / price : null,
    })
  }
  return out
}

const market = (s: MarketSeriesPoint[]): LocalityMarket => ({ area_id: 'QLD218', series: s })

describe('computeMarketGrowth', () => {
  it('computes price growth over the window', () => {
    // 13 points so a 12-month step back is available: 400k -> 520k = +30%
    const m = market(series(13, { price0: 400000, priceStep: 10000 }))
    const [r] = computeMarketGrowth([m], [{ months: 12, label: '1 year' }])
    expect(r.windows[0].price_growth).toBe(0.3)
  })

  it('computes rent growth independently of price growth', () => {
    const m = market(series(13, { price0: 400000, priceStep: 10000, rent0: 500, rentStep: 5 }))
    const [r] = computeMarketGrowth([m], [{ months: 12, label: '1 year' }])
    expect(r.windows[0].price_growth).toBe(0.3)
    expect(r.windows[0].rent_growth).toBe(0.12) // 500 -> 560
  })

  it('reports rent_vs_price negative when prices outran rents', () => {
    const m = market(series(13, { price0: 400000, priceStep: 10000, rent0: 500, rentStep: 5 }))
    const [r] = computeMarketGrowth([m], [{ months: 12, label: '1 year' }])
    // rents +12%, prices +30% -> the market got more expensive per dollar of rent
    expect(r.windows[0].rent_vs_price).toBeCloseTo(-0.18, 4)
  })

  it('reports rent_vs_price positive when rents outran prices', () => {
    const m = market(series(13, { price0: 400000, priceStep: 1000, rent0: 500, rentStep: 20 }))
    const [r] = computeMarketGrowth([m], [{ months: 12, label: '1 year' }])
    expect(r.windows[0].rent_vs_price!).toBeGreaterThan(0)
  })

  it('shows yield compressing when prices outrun rents', () => {
    const m = market(series(13, { price0: 400000, priceStep: 10000, rent0: 500, rentStep: 5 }))
    const [r] = computeMarketGrowth([m], [{ months: 12, label: '1 year' }])
    expect(r.windows[0].yield_change!).toBeLessThan(0)
  })

  it('annualises a multi-year window back to a yearly rate', () => {
    // 37 points: +100% over 36 months annualises to ~26%/yr
    const m = market(series(37, { price0: 400000, priceStep: 400000 / 36 }))
    const [r] = computeMarketGrowth([m], [{ months: 36, label: '3 years' }])
    expect(r.windows[0].price_growth).toBeCloseTo(1, 3)
    expect(r.windows[0].price_growth_annualised).toBeCloseTo(0.2599, 3)
  })

  it('leaves a window empty when there is not enough history', () => {
    const m = market(series(6, { price0: 400000, priceStep: 10000 }))
    const [r] = computeMarketGrowth([m], [{ months: 36, label: '3 years' }])
    expect(r.windows[0].price_growth).toBeNull()
    expect(r.windows[0].from_month).toBeNull()
  })

  it('still reports price growth when the rent series is missing', () => {
    const m = market(series(13, { price0: 400000, priceStep: 10000 }))
    const [r] = computeMarketGrowth([m], [{ months: 12, label: '1 year' }])
    expect(r.windows[0].price_growth).toBe(0.3)
    expect(r.windows[0].rent_growth).toBeNull()
    expect(r.windows[0].rent_vs_price).toBeNull()
  })

  it('ignores months with no price rather than treating them as endpoints', () => {
    const s = series(13, { price0: 400000, priceStep: 10000 })
    s.push({ month: '2021-03', typical_price: null, median_rent: null, gross_yield: null })
    const [r] = computeMarketGrowth([market(s)], [{ months: 12, label: '1 year' }])
    expect(r.windows[0].to_month).toBe(s[12].month)
  })

  it('reports how much history is actually available', () => {
    const m = market(series(25, { price0: 400000, priceStep: 1000 }))
    const [r] = computeMarketGrowth([m])
    expect(r.months_available).toBe(24)
  })

  it('defaults to a 1-year and 3-year horizon', () => {
    const [r] = computeMarketGrowth([market(series(40, { price0: 1, priceStep: 1 }))])
    expect(r.windows.map((w) => w.label)).toEqual(DEFAULT_HORIZONS.map((h) => h.label))
  })
})

describe("the 'max' horizon", () => {
  const build = (months: number) =>
    ({ area_id: 'A', series: series(months, { price0: 100, priceStep: 10, rent0: 10, rentStep: 1 }) })

  it('spans the whole series instead of coming back empty', () => {
    // 36 points is only 35 intervals, so a fixed 36-month window finds nothing.
    const m = build(36)
    const [fixed] = computeMarketGrowth([m], [{ months: 36, label: '3 years' }])
    expect(fixed.windows[0].price_growth).toBeNull()

    const [max] = computeMarketGrowth([m], [{ months: 'max', label: 'Full history' }])
    expect(max.windows[0].price_growth).not.toBeNull()
    expect(max.windows[0].months).toBe(35)
  })

  it('reports the span it actually used', () => {
    const [r] = computeMarketGrowth([build(25)], [{ months: 'max', label: 'Full history' }])
    expect(r.windows[0].months).toBe(24)
    expect(r.windows[0].from_month).toBe('2020-01')
  })

  it('is empty for a single-point series, having no interval to measure', () => {
    const [r] = computeMarketGrowth([build(1)], [{ months: 'max', label: 'Full history' }])
    expect(r.windows[0].price_growth).toBeNull()
  })
})

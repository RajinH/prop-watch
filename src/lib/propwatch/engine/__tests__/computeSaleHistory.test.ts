import { describe, it, expect } from 'vitest'
import { computeSaleHistoryGrowth, buildSaleTimeline } from '../computeSaleHistory'

describe('computeSaleHistoryGrowth', () => {
  it('computes a compound rate between the first and last priced sale', () => {
    // A doubling over 10 years is ~7.18%/yr.
    const r = computeSaleHistoryGrowth([
      { event_date: '2010-01-01', price: 100000 },
      { event_date: '2020-01-01', price: 200000 },
    ])
    expect(r.years).toBeCloseTo(10, 1)
    expect(r.cagr).toBeCloseTo(0.0718, 3)
    expect(r.total_growth).toBe(1)
  })

  it('uses the extremes, not the adjacent pair, when there are several sales', () => {
    const r = computeSaleHistoryGrowth([
      { event_date: '2009-07-06', price: 340000 },
      { event_date: '1981-08-17', price: 9000 },
      { event_date: '2021-08-06', price: 520000 },
      { event_date: '2001-08-28', price: 84000 },
    ])
    expect(r.first_date).toBe('1981-08-17')
    expect(r.last_date).toBe('2021-08-06')
    expect(r.priced_sales).toBe(4)
    expect(r.cagr).toBeGreaterThan(0.1)
  })

  it('ignores undisclosed prices rather than treating them as zero', () => {
    const r = computeSaleHistoryGrowth([
      { event_date: '2010-01-01', price: 100000 },
      { event_date: '2024-01-01', price: null },
      { event_date: '2020-01-01', price: 200000 },
    ])
    expect(r.priced_sales).toBe(2)
    expect(r.last_date).toBe('2020-01-01')
  })

  it('returns nothing computable from a single priced sale', () => {
    const r = computeSaleHistoryGrowth([{ event_date: '2020-01-01', price: 200000 }])
    expect(r.priced_sales).toBe(1)
    expect(r.cagr).toBeNull()
  })

  it('returns nothing computable from an empty history', () => {
    expect(computeSaleHistoryGrowth([]).cagr).toBeNull()
  })

  it('does not divide by zero when two sales share a date', () => {
    const r = computeSaleHistoryGrowth([
      { event_date: '2020-01-01', price: 100000 },
      { event_date: '2020-01-01', price: 120000 },
    ])
    expect(r.cagr).toBeNull()
    expect(r.first_price).toBe(100000)
  })

  it('reports a negative rate when a property sold for less than before', () => {
    const r = computeSaleHistoryGrowth([
      { event_date: '2010-01-01', price: 200000 },
      { event_date: '2020-01-01', price: 100000 },
    ])
    expect(r.cagr!).toBeLessThan(0)
    expect(r.total_growth).toBe(-0.5)
  })
})

describe('buildSaleTimeline', () => {
  const GOODNA = [
    { event_date: '2026-05-25', price: 921000 },
    { event_date: '2016-09-20', price: 347000 },
    { event_date: '2009-12-01', price: 360000 },
    { event_date: '2007-10-01', price: 160000 },
  ]

  it('returns newest first regardless of input order', () => {
    const t = buildSaleTimeline(GOODNA)
    expect(t.map((e) => e.event_date)).toEqual([
      '2026-05-25', '2016-09-20', '2009-12-01', '2007-10-01',
    ])
  })

  it('annotates each sale with the change since the one before it', () => {
    const t = buildSaleTimeline(GOODNA)
    const y2009 = t.find((e) => e.event_date === '2009-12-01')!
    expect(y2009.change_since_previous).toBeCloseTo(1.25, 2) // 160k -> 360k
    expect(y2009.years_since_previous).toBeCloseTo(2.2, 1)
  })

  it('surfaces a decline between sales rather than hiding it in a list', () => {
    const t = buildSaleTimeline(GOODNA)
    const y2016 = t.find((e) => e.event_date === '2016-09-20')!
    expect(y2016.change_since_previous!).toBeLessThan(0) // 360k -> 347k
  })

  it('leaves the earliest sale with no change to report', () => {
    const t = buildSaleTimeline(GOODNA)
    expect(t[t.length - 1].change_since_previous).toBeNull()
  })

  it('keeps undisclosed sales as events but measures across them', () => {
    const t = buildSaleTimeline([
      { event_date: '2010-01-01', price: 100000 },
      { event_date: '2015-01-01', price: null },
      { event_date: '2020-01-01', price: 200000 },
    ])
    expect(t).toHaveLength(3)
    expect(t.find((e) => e.event_date === '2015-01-01')!.undisclosed).toBe(true)
    // 2020 compares against 2010, the last sale with a price.
    expect(t[0].change_since_previous).toBe(1)
    expect(t[0].years_since_previous).toBeCloseTo(10, 1)
  })

  it('returns an empty timeline for no sales', () => {
    expect(buildSaleTimeline([])).toEqual([])
  })
})

describe('undisclosed sales are distinguishable from the earliest sale', () => {
  it('marks an undisclosed sale as undisclosed, not as the first on record', () => {
    const t = buildSaleTimeline([
      { event_date: '2010-01-01', price: 100000 },
      { event_date: '2026-05-19', price: null },
    ])
    const newest = t[0]
    const oldest = t[1]
    // Both have a null change, but for different reasons — the UI needs to tell
    // them apart to avoid labelling a recent undisclosed sale "first on record".
    expect(newest.undisclosed).toBe(true)
    expect(newest.change_since_previous).toBeNull()
    expect(oldest.undisclosed).toBe(false)
    expect(oldest.change_since_previous).toBeNull()
  })

  it('reports a flat resale as zero change rather than as no data', () => {
    const t = buildSaleTimeline([
      { event_date: '1992-12-01', price: 176000 },
      { event_date: '1993-01-15', price: 176000 },
    ])
    expect(t[0].change_since_previous).toBe(0)
  })
})

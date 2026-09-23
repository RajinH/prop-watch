/**
 * Long-run growth from a property's own recorded sales.
 *
 * Unlike the reconstructed snapshot series, these are observed transactions —
 * so the rate they imply is fact rather than derivation. It is also the only
 * growth figure available for a property the current owner has held briefly:
 * they may have owned it two months, but the dwelling itself has a price history
 * going back decades.
 *
 * Pure: no clock, no I/O.
 */

const roundRate = (v: number) => Math.round(v * 10000) / 10000

export interface SaleRecord {
  event_date: string
  /** Null when the sale price was not disclosed. */
  price: number | null
}

export interface SaleHistoryGrowth {
  /** Sales with a disclosed price — the only ones that can anchor a rate. */
  priced_sales: number
  first_date: string | null
  first_price: number | null
  last_date: string | null
  last_price: number | null
  years: number | null
  /** Compound annual growth rate between the first and last priced sale. */
  cagr: number | null
  total_growth: number | null
}

const EMPTY: SaleHistoryGrowth = {
  priced_sales: 0,
  first_date: null,
  first_price: null,
  last_date: null,
  last_price: null,
  years: null,
  cagr: null,
  total_growth: null,
}

export function computeSaleHistoryGrowth(sales: SaleRecord[]): SaleHistoryGrowth {
  // Undisclosed prices are common and cannot anchor a rate, so they are counted
  // out rather than treated as zero.
  const priced = sales
    .filter((s) => s.price != null && s.price > 0 && !!s.event_date)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))

  if (priced.length < 2) {
    return { ...EMPTY, priced_sales: priced.length }
  }

  const first = priced[0]
  const last = priced[priced.length - 1]
  const ms = Date.parse(last.event_date) - Date.parse(first.event_date)
  const years = ms / (365.25 * 24 * 60 * 60 * 1000)

  // Two sales on the same day imply no elapsed time; a rate would divide by zero.
  if (!(years > 0)) {
    return {
      ...EMPTY,
      priced_sales: priced.length,
      first_date: first.event_date,
      first_price: first.price,
      last_date: last.event_date,
      last_price: last.price,
    }
  }

  const totalGrowth = (last.price! - first.price!) / first.price!

  return {
    priced_sales: priced.length,
    first_date: first.event_date,
    first_price: first.price,
    last_date: last.event_date,
    last_price: last.price,
    years: Math.round(years * 10) / 10,
    cagr: roundRate(Math.pow(last.price! / first.price!, 1 / years) - 1),
    total_growth: roundRate(totalGrowth),
  }
}

export interface SaleTimelineEntry {
  event_date: string
  price: number | null
  /** Growth since the previous priced sale, as a fraction. Null on the first. */
  change_since_previous: number | null
  /** Years between this sale and the previous priced one — the owner's hold. */
  years_since_previous: number | null
  annualised_since_previous: number | null
  /** True when the price was not disclosed, so this event anchors nothing. */
  undisclosed: boolean
}

/**
 * A property's sales as a timeline, newest first, each annotated with what
 * happened since the previous sale.
 *
 * A bare list of dates and prices hides the interesting part: a property can
 * double, then go backwards for seven years, then double again, and a reader
 * scanning four numbers will not see it. Attaching the interval and the change
 * to each row makes the shape of the history legible.
 *
 * Undisclosed sales are kept as events — they happened, and omitting them would
 * misstate how often the property trades — but they cannot anchor a growth
 * figure, so changes are measured against the previous *priced* sale.
 */
export function buildSaleTimeline(sales: SaleRecord[]): SaleTimelineEntry[] {
  const ordered = sales
    .filter((s) => !!s.event_date)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))

  const out: SaleTimelineEntry[] = []
  let previousPriced: SaleRecord | null = null

  for (const sale of ordered) {
    const priced = sale.price != null && sale.price > 0
    const entry: SaleTimelineEntry = {
      event_date: sale.event_date,
      price: sale.price,
      change_since_previous: null,
      years_since_previous: null,
      annualised_since_previous: null,
      undisclosed: !priced,
    }

    if (priced && previousPriced) {
      const years =
        (Date.parse(sale.event_date) - Date.parse(previousPriced.event_date)) /
        (365.25 * 24 * 60 * 60 * 1000)
      const change = (sale.price! - previousPriced.price!) / previousPriced.price!
      entry.change_since_previous = roundRate(change)
      entry.years_since_previous = Math.round(years * 10) / 10
      entry.annualised_since_previous =
        years > 0 && change > -1
          ? roundRate(Math.pow(sale.price! / previousPriced.price!, 1 / years) - 1)
          : null
    }

    if (priced) previousPriced = sale
    out.push(entry)
  }

  return out.reverse()
}

import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import MarketShell from '@/components/market/MarketShell'
import {
  computeMarketComparison,
  computeMarketConcentration,
  type LocalityMarket,
} from '@/lib/propwatch/engine/computeMarketComparison'
import { computeMarketGrowth } from '@/lib/propwatch/engine/computeMarketGrowth'
import type { Property } from '@/lib/propwatch/engine/types'

export const metadata = { title: 'Market' }

interface PropertyRow extends Property {
  city: string | null
  state: string | null
  postcode: string | null
  htag_loc_pid: string | null
}

export default async function MarketPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: portfolio } = await supabase
    .from('portfolios').select('id').eq('user_id', user.id)
    .order('created_at').limit(1).maybeSingle()
  if (!portfolio) return <MarketShell {...EMPTY} />

  const { data: propertyRows } = await supabase
    .from('properties').select('*').eq('portfolio_id', portfolio.id).order('created_at')
  const properties = (propertyRows ?? []) as PropertyRow[]
  if (properties.length === 0) return <MarketShell {...EMPTY} />

  const areaIds = [...new Set(properties.map((p) => p.htag_loc_pid).filter(Boolean))] as string[]

  const [{ data: trendRows }, { data: factRows }, { data: txnRows }, { data: snapRows }] =
    await Promise.all([
    areaIds.length
      ? supabase
          .from('market_trends')
          .select('area_id,period_end,typical_price,median_rent,gross_yield')
          .eq('property_type', 'house')
          .in('area_id', areaIds)
          .order('period_end', { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase
      .from('property_market_facts')
      .select('*')
      .in('property_id', properties.map((p) => p.id)),
    supabase
      .from('property_transactions')
      .select('property_id,kind,event_date,price,bedrooms,bathrooms,land_area')
      .in('property_id', properties.map((p) => p.id))
      .order('event_date', { ascending: false }),
    areaIds.length
      ? supabase.from('market_snapshots').select('*').in('area_id', areaIds).eq('property_type', 'house')
      : Promise.resolve({ data: [] }),
  ])

  type TrendRow = {
    area_id: string; period_end: string
    typical_price: number | null; median_rent: number | null; gross_yield: number | null
  }
  const trends = (trendRows ?? []) as TrendRow[]

  const markets: LocalityMarket[] = areaIds.map((id) => ({
    area_id: id,
    series: trends
      .filter((t) => t.area_id === id)
      .map((t) => ({
        month: t.period_end.slice(0, 7),
        typical_price: t.typical_price,
        median_rent: t.median_rent,
        gross_yield: t.gross_yield,
      })),
  }))

  const asOf = new Date().toISOString().slice(0, 10)
  const comparisons = computeMarketComparison(
    properties,
    markets,
    Object.fromEntries(properties.map((p) => [p.id, p.htag_loc_pid])),
    asOf
  )
  const concentration = computeMarketConcentration(
    properties,
    Object.fromEntries(properties.map((p) => [p.id, p.postcode]))
  )

  // A table exists to compare rows, so every row must span the same window.
  // One locality has a far deeper price series than the others, and letting it
  // use its own full history would put +210% next to +69% in the same column as
  // though they were the same measurement. Use the span common to every market,
  // and only months where both price and rent exist so the two columns agree.
  const monthsPerArea = areaIds.map(
    (id) =>
      new Set(
        trends
          .filter((t) => t.area_id === id && t.typical_price != null && t.median_rent != null)
          .map((t) => t.period_end.slice(0, 7))
      )
  )
  const commonMonths = monthsPerArea.length
    ? [...monthsPerArea[0]].filter((m) => monthsPerArea.every((s) => s.has(m))).sort()
    : []
  const commonSpan = Math.max(0, commonMonths.length - 1)
  const spanLabel =
    commonSpan >= 12
      ? `${(commonSpan / 12).toFixed(commonSpan % 12 === 0 ? 0 : 1)} years`
      : `${commonSpan} months`

  const growth = computeMarketGrowth(
    markets,
    commonSpan > 12
      ? [
          { months: 12, label: '1 year' },
          { months: commonSpan, label: spanLabel },
        ]
      : [{ months: Math.max(1, commonSpan), label: spanLabel }]
  )

  // Rebase every suburb to 100 so markets at very different price levels can
  // share one axis and be read as performance rather than price.
  //
  // The baseline is the latest month at which EVERY market has data, not each
  // market's own first month: one locality has a deeper price series than the
  // others, and rebasing it to its own start would have it enter the chart
  // already well above 100, implying an outperformance that is really just a
  // longer run-up.
  function rebase(metric: 'typical_price' | 'median_rent') {
    const firstByArea = areaIds.map((id) => {
      const rows = trends.filter((t) => t.area_id === id && t[metric] != null)
      return rows[0]?.period_end.slice(0, 7)
    })
    if (firstByArea.some((m) => !m)) return { baseline: null, rows: [] as Record<string, string | number>[] }
    const baseline = firstByArea.sort().at(-1)!

    const valueAt = (id: string, month: string) =>
      trends.find((t) => t.area_id === id && t.period_end.slice(0, 7) === month)?.[metric] ?? null

    const base = Object.fromEntries(areaIds.map((id) => [id, valueAt(id, baseline)]))
    const rows = [...new Set(trends.map((t) => t.period_end.slice(0, 7)))]
      .filter((m) => m >= baseline)
      .sort()
      .map((month) => {
        const row: Record<string, string | number> = { month }
        for (const id of areaIds) {
          const at = valueAt(id, month)
          const b = base[id]
          if (at != null && b) row[id] = Math.round((at / b) * 1000) / 10
        }
        return row
      })
    return { baseline, rows }
  }

  const priceIndex = rebase('typical_price')
  const rentIndex = rebase('median_rent')

  return (
    <MarketShell
      properties={properties.map((p) => ({
        id: p.id, name: p.name, city: p.city, state: p.state, postcode: p.postcode,
        area_id: p.htag_loc_pid, current_value: p.current_value,
        monthly_rent: p.monthly_rent, purchase_date: p.purchase_date,
        latitude: p.latitude ?? null, longitude: p.longitude ?? null,
      }))}
      comparisons={comparisons}
      concentration={concentration}
      priceIndex={priceIndex.rows}
      rentIndex={rentIndex.rows}
      indexBaseline={priceIndex.baseline}
      growth={growth}
      snapshots={(snapRows ?? []) as never[]}
      facts={(factRows ?? []) as never[]}
      transactions={(txnRows ?? []) as never[]}
      totalValue={properties.reduce((t, p) => t + p.current_value, 0)}
    />
  )
}

const EMPTY = {
  properties: [], comparisons: [], concentration: [],
  priceIndex: [], rentIndex: [], indexBaseline: null, growth: [], snapshots: [],
  facts: [], transactions: [], totalValue: 0,
}

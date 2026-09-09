'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Area, AreaChart } from 'recharts'
import {
  Globe2, Info, TrendingUp, TrendingDown, Minus,
  Clock, DoorOpen, Layers, Tag,
  Bed, Bath, Car, LandPlot, Hammer, Banknote, Users, Timer, Ruler, Droplets, Flame,
} from 'lucide-react'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import PageHero from '@/components/ui/PageHero'
import InfoTooltip from '@/components/ui/InfoTooltip'
import StaticMap from '@/components/properties/StaticMap'
import { formatCurrencyShort } from '@/lib/formatters'
import { SUBURB_ZOOM } from '@/lib/propwatch/map/tiles'
import { computeSaleHistoryGrowth, buildSaleTimeline } from '@/lib/propwatch/engine/computeSaleHistory'
import type {
  PropertyMarketComparison,
  MarketConcentrationBucket,
} from '@/lib/propwatch/engine/computeMarketComparison'
import type { LocalityGrowth } from '@/lib/propwatch/engine/computeMarketGrowth'

interface PropertyLite {
  id: string
  name: string
  city: string | null
  state: string | null
  postcode: string | null
  area_id: string | null
  current_value: number
  monthly_rent: number
  purchase_date: string | null
  latitude: number | null
  longitude: number | null
}

interface MarketSnapshot {
  area_id: string
  confidence: string | null
  days_on_market: number | null
  vacancy_rate: number | null
  discounting: number | null
  clearance_rate: number | null
  inventory_months: number | null
  cycle_position: string | null
  projected_growth_low: number | null
  projected_growth_high: number | null
  projected_rent_increase: number | null
  score_overall: number | null
  volatility_index: number | null
  years_to_own: number | null
  price_growth_1y: number | null
  price_growth_3y: number | null
  price_growth_5y: number | null
  price_growth_10y: number | null
  rent_growth_1y: number | null
  rent_growth_3y: number | null
  rent_growth_5y: number | null
  rent_growth_10y: number | null
}

interface MarketFact {
  property_id: string
  beds: number | null
  baths: number | null
  parking: number | null
  lot_size: number | null
  build_reno_date: string | null
  own_status: string | null
  flood: boolean | null
  bushfire: boolean | null
  zoning: string | null
  rent_estimate_weekly: number | null
  last_sold_price: number | null
  last_sold_date: string | null
  rental_percentage: number | null
  years_to_own: number | null
  hold_period: number | null
}

interface Transaction {
  property_id: string
  kind: 'sale' | 'rental'
  event_date: string
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  land_area: number | null
}

interface Props {
  properties: PropertyLite[]
  comparisons: PropertyMarketComparison[]
  concentration: MarketConcentrationBucket[]
  priceIndex: Record<string, string | number>[]
  rentIndex: Record<string, string | number>[]
  indexBaseline: string | null
  growth: LocalityGrowth[]
  snapshots: MarketSnapshot[]
  facts: MarketFact[]
  transactions: Transaction[]
  totalValue: number
}

// Four suburbs is the realistic ceiling before a multi-series line chart stops
// being readable; the palette maps onto the brand chart ramp in globals.css.
const SERIES_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

/**
 * How far annualised growth must diverge from its longer-run average before we
 * call it a change in direction. Below this, a median-based series is just
 * noisy — labelling +17% against an +18% average as "cooling" over-reads it.
 */
const MOMENTUM_BAND = 0.015

/** "May 2026" reads faster than an ISO date in a list of them. */
const formatSaleDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

const pct = (v: number | null, digits = 1) =>
  v === null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`

const STATUS_COPY: Record<PropertyMarketComparison['status'], string> = {
  comparable: '',
  held_too_briefly: 'Held too briefly to compare — a full year of ownership is needed before growth means anything.',
  no_purchase_data: 'Add a purchase price and date to compare this against its suburb.',
  no_market_data: 'No market series for this locality yet.',
}

export default function MarketShell({
  properties,
  comparisons,
  concentration,
  priceIndex,
  rentIndex,
  indexBaseline,
  growth,
  snapshots,
  facts,
  transactions,
  totalValue,
}: Props) {
  const [activeArea, setActiveArea] = useState<string | null>(null)
  const [metric, setMetric] = useState<'price' | 'rent'>('price')
  const indexedSeries = metric === 'price' ? priceIndex : rentIndex

  const areaLabel = (areaId: string | null) =>
    properties.find((p) => p.area_id === areaId)?.city ?? areaId ?? 'Unknown'

  const areaIds = [...new Set(properties.map((p) => p.area_id).filter(Boolean))] as string[]

  const chartConfig = Object.fromEntries(
    areaIds.map((id, i) => [id, { label: areaLabel(id), color: SERIES_COLORS[i % SERIES_COLORS.length] }])
  ) satisfies ChartConfig

  const multiProperty = concentration.filter((c) => c.property_count > 1)

  if (properties.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHero
          icon={Globe2}
          eyebrow="Intelligence"
          title="Market"
          description="How your properties are performing against the suburbs they sit in."
        />
        <div className="rounded-2xl border border-dashed border-slate-200 py-20 text-center">
          <p className="text-sm text-slate-400">Add a property to see its market context.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        icon={Globe2}
        eyebrow="Intelligence"
        title="Market"
        description="How your properties are performing against the suburbs they sit in."
        callout={
          <>
            <Info size={15} className="mt-0.5 shrink-0 text-slate-400" />
            <span>
              Suburb figures come from recorded sales in each locality — they measure the market,
              not your property. The gap between the two is the part you control.
            </span>
          </>
        }
      />

      {/* Market concentration — the risk a value-share view cannot see. */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-bold text-slate-900">Market concentration</h2>
          <p className="text-xs text-slate-500">
            Properties in the same postcode rise and fall together, however different they look.
          </p>
        </div>

        <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
          {concentration.map((c, i) => (
            <div
              key={c.key}
              className="h-full transition-opacity hover:opacity-80"
              style={{
                width: `${c.share * 100}%`,
                background: SERIES_COLORS[i % SERIES_COLORS.length],
              }}
              title={`${c.label}: ${formatCurrencyShort(c.value)}`}
            />
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {concentration.map((c, i) => (
            <div key={c.key} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
                />
                <span className="text-xs font-semibold text-slate-700">{c.label}</span>
              </div>
              <p className="text-sm font-semibold tabular-nums text-slate-900">
                {(c.share * 100).toFixed(0)}%
                <span className="ml-1.5 text-xs font-normal text-slate-400">
                  {formatCurrencyShort(c.value)} · {c.property_count}{' '}
                  {c.property_count === 1 ? 'property' : 'properties'}
                </span>
              </p>
            </div>
          ))}
        </div>

        {multiProperty.length > 0 && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <Info size={15} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-900">
              {multiProperty.map((m) => (
                <span key={m.key}>
                  <strong>{m.property_count} properties</strong> sit in postcode{' '}
                  <strong>{m.label}</strong>, together {(m.share * 100).toFixed(0)}% of portfolio
                  value ({formatCurrencyShort(m.value)}).{' '}
                </span>
              ))}
              Your risk score measures concentration by value share alone, so it does not see this.
            </p>
          </div>
        )}
      </section>

      {/* Suburb performance, rebased so different price levels share an axis. */}
      {indexedSeries.length > 1 && (
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-bold text-slate-900">Suburb performance</h2>
              <p className="text-xs text-slate-500">
                Each market indexed to 100 at {indexBaseline ?? String(indexedSeries[0].month)} — the
                lines compare growth, not {metric === 'price' ? 'price' : 'rent'} level.
              </p>
            </div>
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              {(['price', 'rent'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    metric === m ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <ChartContainer config={chartConfig} className="mt-4 h-64 w-full select-none">
            <LineChart data={indexedSeries} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                minTickGap={48}
                tickFormatter={(v: string) => v.slice(0, 4)}
                className="text-[10px]"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={34}
                className="text-[10px] tabular-nums"
              />
              {/* 100 is the rebase point: above it the market grew, below it fell. */}
              <ReferenceLine y={100} stroke="var(--color-border)" strokeDasharray="3 3" />
              <ChartTooltip content={<ChartTooltipContent />} />
              {areaIds.map((id, i) => (
                <Line
                  key={id}
                  dataKey={id}
                  type="monotone"
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={activeArea === id ? 2.5 : 1.5}
                  strokeOpacity={activeArea === null || activeArea === id ? 1 : 0.2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ChartContainer>

          {/* Area-level maps double as the legend: clicking one isolates that
              market in the chart above. Deliberately pinless and zoomed out —
              these stand for a whole suburb, not an address. */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {areaIds.map((id, i) => {
              const anchor = properties.find((p) => p.area_id === id)
              const g = growth.find((x) => x.area_id === id)
              const window = [...(g?.windows ?? [])].reverse().find((w) => w.price_growth !== null)
              const isActive = activeArea === id
              return (
                <button
                  key={id}
                  onClick={() => setActiveArea(isActive ? null : id)}
                  className={`group overflow-hidden rounded-xl border text-left transition-all ${
                    isActive
                      ? 'border-slate-300 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {anchor?.latitude != null && anchor?.longitude != null ? (
                    <StaticMap
                      latitude={anchor.latitude}
                      longitude={anchor.longitude}
                      label={`${areaLabel(id)} area`}
                      zoom={SUBURB_ZOOM}
                      showMarker={false}
                      className={`h-24 w-full transition-opacity ${isActive ? '' : 'opacity-90 group-hover:opacity-100'}`}
                    />
                  ) : (
                    <div className="h-24 w-full bg-slate-100" />
                  )}
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
                      />
                      <span className="truncate text-xs font-semibold text-slate-700">
                        {areaLabel(id)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">
                      {pct(window?.price_growth ?? null, 0)}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}



      {/* Conditions and outlook. Everything else on this page looks backwards;
          the projections here are the only forward-looking figures available. */}
      {snapshots.length > 0 && (
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-bold text-slate-900">Market conditions</h2>
            <p className="text-xs text-slate-500">
              How quickly stock moves, where each market sits in its cycle, and what growth is
              projected from here.
            </p>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {snapshots.map((snap) => {
              const held = properties.filter((p) => p.area_id === snap.area_id)
              const slow = (snap.days_on_market ?? 0) >= 50
              const tight = snap.vacancy_rate != null && snap.vacancy_rate < 0.02

              // One plain sentence instead of a caption under every metric —
              // four fragments read as noise, a sentence reads as a finding.
              const readout = [
                snap.days_on_market != null && (slow ? 'slow to sell' : 'sells quickly'),
                snap.vacancy_rate != null && (tight ? 'tight rentals' : 'easing rentals'),
              ].filter(Boolean)

              const horizons = ['1y', '3y', '5y', '10y'] as const
              const priceRow = [
                snap.price_growth_1y, snap.price_growth_3y,
                snap.price_growth_5y, snap.price_growth_10y,
              ]
              const rentRow = [
                snap.rent_growth_1y, snap.rent_growth_3y,
                snap.rent_growth_5y, snap.rent_growth_10y,
              ]

              return (
                <div key={snap.area_id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {areaLabel(snap.area_id)}
                      </span>
                      <span className="text-xs text-slate-400">
                        {held.length} {held.length === 1 ? 'property' : 'properties'}
                      </span>
                    </div>
                    {snap.cycle_position && (
                      <InfoTooltip
                        align="end"
                        content={
                          <>
                            <span className="mb-0.5 block font-semibold text-white">
                              Growth-rate cycle
                            </span>
                            Where this market sits in its growth cycle. &ldquo;Peak&rdquo; means
                            growth is at its fastest and has further to fall than to rise;
                            &ldquo;Decreasing&rdquo; means it is still growing but more slowly than
                            it was.
                          </>
                        }
                      >
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                          {snap.cycle_position.replace(/^\(\+\)/, '')}
                        </span>
                      </InfoTooltip>
                    )}
                  </div>

                  {/* Icons carry the label so the values can be read in one
                      pass; the full name stays available on hover. */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <Stat
                      icon={Clock}
                      title="Days on market"
                      align="start"
                      explain="Median time a listing takes to sell here. Under ~40 days means buyers are competing; higher means you would wait to exit, which matters more than the price if you ever need to sell quickly."
                      tone={slow ? 'negative' : 'positive'}
                    >
                      {snap.days_on_market != null ? `${Math.round(snap.days_on_market)}d` : '—'}
                    </Stat>
                    <Stat
                      icon={DoorOpen}
                      title="Rental vacancy"
                      explain="Share of rental stock sitting empty. Below 2% is a landlord's market and supports raising rent; above 3% means tenants have choice and re-letting takes longer."
                    >
                      {snap.vacancy_rate != null ? `${(snap.vacancy_rate * 100).toFixed(2)}%` : '—'}
                    </Stat>
                    <Stat
                      icon={Layers}
                      title="Stock on market"
                      explain="Months it would take to clear every current listing at the recent sale rate. Under ~3 months favours sellers; rising stock is usually the first sign a market is turning."
                    >
                      {snap.inventory_months != null ? `${snap.inventory_months.toFixed(1)} mo` : '—'}
                    </Stat>
                    <Stat
                      icon={Tag}
                      title="Vendor discounting"
                      align="end"
                      explain="Average gap between asking price and the price achieved. Widening discounting means sellers are conceding, and it usually moves before median prices do."
                    >
                      {snap.discounting != null ? `${(snap.discounting * 100).toFixed(1)}%` : '—'}
                    </Stat>
                  </div>

                  {readout.length > 0 && (
                    <p className="-mt-1 text-xs text-slate-400">
                      {readout.join(', ').replace(/^./, (c) => c.toUpperCase())}
                    </p>
                  )}

                  {/* Aligned columns rather than a run of text: the horizon
                      labels appear once, and price sits directly above rent so
                      the two can be compared by eye. */}
                  <table className="w-full border-t border-slate-100 pt-1 text-xs">
                    <thead>
                      <tr>
                        <th className="w-12" />
                        {horizons.map((h) => (
                          <th key={h} className="pb-0.5 pt-2 text-right font-normal text-slate-400">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                          <InfoTooltip
                            align="start"
                            content={
                              <>
                                <span className="mb-0.5 block font-semibold text-white">
                                  Price growth
                                </span>
                                Total change in the suburb&rsquo;s typical house price over each
                                period — not annualised, so +44% over 10 years is roughly 3.7% a
                                year. Compare it against the rent row below: prices growing faster
                                than rents means yields are compressing.
                              </>
                            }
                          >
                            Price
                          </InfoTooltip>
                        </td>
                        {priceRow.map((v, i) => (
                          <td key={horizons[i]} className="py-0.5 text-right tabular-nums text-slate-700">
                            {pct(v, 0)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                          <InfoTooltip
                            align="start"
                            content={
                              <>
                                <span className="mb-0.5 block font-semibold text-white">
                                  Rent growth
                                </span>
                                Total change in the suburb&rsquo;s median weekly rent over each
                                period. When this outpaces the price row, the market is getting
                                cheaper relative to the income it produces — the rarer and more
                                favourable of the two directions for a holder.
                              </>
                            }
                          >
                            Rent
                          </InfoTooltip>
                        </td>
                        {rentRow.map((v, i) => (
                          <td key={horizons[i]} className="py-0.5 text-right tabular-nums text-slate-500">
                            {pct(v, 0)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>

                  {snap.projected_growth_low != null && snap.projected_growth_high != null && (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <InfoTooltip
                        align="start"
                        content={
                          <>
                            <span className="mb-0.5 block font-semibold text-white">
                              Projected range
                            </span>
                            HTAG&rsquo;s modelled range for the next twelve months
                            {snap.confidence ? ` (${snap.confidence.toLowerCase()} confidence)` : ''}.
                            A forecast, not a measurement — the width of the range is itself the
                            signal, and a range spanning zero means the direction is genuinely
                            uncertain.
                          </>
                        }
                      >
                        <span className="text-slate-400 underline decoration-dotted underline-offset-2">
                          Next year
                        </span>
                      </InfoTooltip>{' '}
                      <strong className="tabular-nums text-slate-800">
                        {pct(snap.projected_growth_low, 0)} to {pct(snap.projected_growth_high, 0)}
                      </strong>
                      {snap.projected_rent_increase != null && (
                        <>
                          <span className="text-slate-400"> · rents</span>{' '}
                          <strong className="tabular-nums text-slate-800">
                            {pct(snap.projected_rent_increase, 1)}
                          </strong>
                        </>
                      )}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Price against rent. Charting price alone hides whether a market is
          getting more expensive relative to the income it produces. */}
      {growth.length > 0 && (
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-bold text-slate-900">Price against rent</h2>
            <p className="text-xs text-slate-500">
              When prices outrun rents, yield compresses — the market costs more per dollar of rent
              it produces.
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="pb-2 pr-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    Suburb
                  </th>
                  {(growth[0]?.windows ?? []).map((w) => (
                    <th
                      key={w.label}
                      colSpan={2}
                      className="pb-2 px-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-400"
                    >
                      {w.label}
                    </th>
                  ))}
                  <th className="pb-2 pl-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    Yield
                  </th>
                </tr>
                <tr className="border-b border-slate-100 text-left">
                  <th />
                  {(growth[0]?.windows ?? []).flatMap((w) => [
                    <th key={`${w.label}-p`} className="pb-2 px-3 text-right text-[10px] font-normal text-slate-400">
                      price
                    </th>,
                    <th key={`${w.label}-r`} className="pb-2 px-3 text-right text-[10px] font-normal text-slate-400">
                      rent
                    </th>,
                  ])}
                  <th />
                </tr>
              </thead>
              <tbody>
                {growth.map((g) => {
                  // Longest window that actually resolved, so a short series
                  // still gets a yield reading rather than an empty cell.
                  const longest = [...g.windows].reverse().find((w) => w.yield_change !== null)
                    ?? g.windows[g.windows.length - 1]
                  const compressing = longest?.yield_change !== null && longest.yield_change < 0
                  return (
                    <tr key={g.area_id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-slate-700">
                        {areaLabel(g.area_id)}
                      </td>
                      {g.windows.flatMap((w) => [
                        <td key={`${w.label}-p`} className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                          {pct(w.price_growth)}
                        </td>,
                        <td key={`${w.label}-r`} className="py-2.5 px-3 text-right tabular-nums text-slate-500">
                          {pct(w.rent_growth)}
                        </td>,
                      ])}
                      <td className="py-2.5 pl-3 text-right">
                        {longest?.yield_start != null && longest?.yield_end != null ? (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium tabular-nums ${
                              compressing ? 'text-red-600' : 'text-green-700'
                            }`}
                          >
                            {compressing ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                            {(longest.yield_start * 100).toFixed(2)}%&nbsp;&rarr;&nbsp;
                            {(longest.yield_end * 100).toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {(() => {
            const expanding = growth.filter((g) => {
              const w = [...g.windows].reverse().find((x) => x.rent_vs_price !== null)
              return w?.rent_vs_price != null && w.rent_vs_price > 0
            })
            if (expanding.length === 0) return null
            return (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <TrendingUp size={15} className="mt-0.5 shrink-0 text-green-700" />
                <p className="text-sm text-green-900">
                  Rents outpaced prices in{' '}
                  <strong>{expanding.map((g) => areaLabel(g.area_id)).join(', ')}</strong> — the only
                  {expanding.length === 1 ? ' market' : ' markets'} here getting cheaper relative to
                  the income produced.
                </p>
              </div>
            )
          })()}
        </section>
      )}

      {/* Per-property: the comparison that needs external data to exist at all. */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-bold text-slate-900">Your properties vs their markets</h2>
        <div className="grid gap-4 xl:grid-cols-2">
          {properties.map((p) => {
            const cmp = comparisons.find((c) => c.property_id === p.id)
            const fact = facts.find((f) => f.property_id === p.id)
            const marketRent = fact?.rent_estimate_weekly
              ? (fact.rent_estimate_weekly * 52) / 12
              : null
            const rentGap = marketRent !== null ? marketRent - p.monthly_rent : null
            const beat = cmp?.divergence !== null && cmp?.divergence !== undefined && cmp.divergence > 0

            const areaIdx = areaIds.indexOf(p.area_id ?? '')
            const seriesColor = SERIES_COLORS[(areaIdx < 0 ? 0 : areaIdx) % SERIES_COLORS.length]
            const spark = p.area_id
              ? priceIndex
                  .map((row) => ({ month: String(row.month), v: row[p.area_id!] as number | undefined }))
                  .filter((r) => typeof r.v === 'number')
              : []

            // Momentum: the last year against the whole window, both annualised.
            // A market can be up a long way overall and still be cooling.
            const g = growth.find((x) => x.area_id === p.area_id)
            const shortWin = g?.windows.find((w) => w.months === 12)
            const longWin = [...(g?.windows ?? [])].reverse().find(
              (w) => w.price_growth_annualised !== null && w.months !== 12
            )
            const momentum =
              shortWin?.price_growth_annualised != null && longWin?.price_growth_annualised != null
                ? shortWin.price_growth_annualised - longWin.price_growth_annualised
                : null

            // Growth from this dwelling's own recorded sales — observed fact,
            // and the only long-run figure available for a recent purchase.
            const timeline = buildSaleTimeline(
              transactions
                .filter((t) => t.property_id === p.id && t.kind === 'sale')
                .map((t) => ({ event_date: t.event_date, price: t.price }))
            )
            const history = computeSaleHistoryGrowth(
              transactions
                .filter((t) => t.property_id === p.id && t.kind === 'sale')
                .map((t) => ({ event_date: t.event_date, price: t.price }))
            )

            return (
              <div
                key={p.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
              >
                <div className="flex gap-4 border-b border-slate-100 p-5">
                  {p.latitude !== null && p.longitude !== null && (
                    <StaticMap
                      latitude={p.latitude}
                      longitude={p.longitude}
                      label={p.name}
                      className="h-36 w-36 shrink-0 rounded-xl border border-slate-200"
                    />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate font-semibold text-slate-800">{p.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {[p.city, p.state, p.postcode].filter(Boolean).join(' ')}
                    </p>
                    <p className="mt-1.5 text-lg font-bold tabular-nums text-slate-900">
                      {formatCurrencyShort(p.current_value)}
                    </p>

                    {/* The suburb's own trajectory, so the card carries a trend
                        and not just a pair of end points. */}
                    {spark.length > 1 && (
                      <div className="mt-auto pt-2">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                          {areaLabel(p.area_id)} price index
                        </p>
                        {/* Decorative: no tooltip, no hover dot, and not
                            selectable — clicking it was highlighting the SVG as
                            text and popping a stray active dot. */}
                        <ChartContainer
                          config={{ v: { label: 'Price index', color: seriesColor } }}
                          className="pointer-events-none mt-1 h-12 w-full select-none"
                        >
                          <AreaChart
                            data={spark}
                            margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
                          >
                            <defs>
                              <linearGradient id={`spark-${p.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={seriesColor} stopOpacity={0.28} />
                                <stop offset="100%" stopColor={seriesColor} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Area
                              dataKey="v"
                              type="monotone"
                              stroke={seriesColor}
                              strokeWidth={1.5}
                              fill={`url(#spark-${p.id})`}
                              dot={false}
                              activeDot={false}
                              isAnimationActive={false}
                            />
                          </AreaChart>
                        </ChartContainer>
                      </div>
                    )}
                  </div>
                </div>

                {/* Physical attributes and environmental overlays: things the
                    user never entered, and which change the reading of every
                    figure above them. Flood in particular bears on insurance
                    and resale, not just comfort. */}
                {fact && (fact.beds != null || fact.flood != null) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 px-5 py-3">
                    {fact.beds != null && (
                      <Spec icon={Bed} title="Bedrooms">{fact.beds}</Spec>
                    )}
                    {fact.baths != null && (
                      <Spec icon={Bath} title="Bathrooms">{fact.baths}</Spec>
                    )}
                    {fact.parking != null && (
                      <Spec icon={Car} title="Car spaces">{fact.parking}</Spec>
                    )}
                    {fact.lot_size != null && (
                      <Spec
                        icon={LandPlot}
                        title="Land size"
                        explain="Total lot size. Land is the part of a property that appreciates — a large lot in a low-density zone is where redevelopment value sits."
                      >
                        {Math.round(fact.lot_size).toLocaleString('en-AU')} m²
                      </Spec>
                    )}
                    {fact.build_reno_date && (
                      <Spec
                        icon={Hammer}
                        title="Built or last renovated"
                        explain="Older stock carries higher maintenance and capital-expenditure risk, and tends to attract lower rent for the same land."
                      >
                        {fact.build_reno_date.slice(0, 4)}
                      </Spec>
                    )}

                    {/* Warnings keep their chip: these are flags, not specs. */}
                    <span className="ml-auto flex flex-wrap items-center gap-1.5">
                      {fact.flood && (
                        <InfoTooltip
                          align="end"
                          content={
                            <>
                              <span className="mb-0.5 block font-semibold text-white">
                                Flood affected
                              </span>
                              This address sits in a mapped flood overlay. It raises insurance
                              premiums, can make cover harder to obtain, and narrows the buyer pool
                              on resale — worth checking against your current policy.
                            </>
                          }
                        >
                          <Chip tone="warning">
                            <Droplets size={12} className="mr-1 inline align-[-2px]" />
                            flood affected
                          </Chip>
                        </InfoTooltip>
                      )}
                      {fact.bushfire && (
                        <InfoTooltip
                          align="end"
                          content={
                            <>
                              <span className="mb-0.5 block font-semibold text-white">
                                Bushfire risk
                              </span>
                              This address falls within a mapped bushfire-prone area, which affects
                              insurance cost and any rebuilding standard that would apply.
                            </>
                          }
                        >
                          <Chip tone="warning">
                            <Flame size={12} className="mr-1 inline align-[-2px]" />
                            bushfire risk
                          </Chip>
                        </InfoTooltip>
                      )}
                      {fact.zoning && <Chip tone="muted">{fact.zoning}</Chip>}
                    </span>
                  </div>
                )}

                {cmp?.status === 'comparable' ? (
                  <div className="flex flex-col gap-4 p-5">
                    <div className="grid grid-cols-3 gap-3">
                      <Metric label="This property" value={pct(cmp.property_growth)} strong />
                      <Metric label={areaLabel(p.area_id)} value={pct(cmp.market_growth)} />
                      <Metric
                        label="Difference"
                        value={pct(cmp.divergence)}
                        tone={beat ? 'positive' : cmp.divergence === 0 ? 'neutral' : 'negative'}
                        icon={
                          beat ? TrendingUp : cmp.divergence === 0 ? Minus : TrendingDown
                        }
                      />
                    </div>

                    {/* Attribution — the split between what the market did and
                        what this property did on top of it. */}
                    {cmp.value_gain !== null && cmp.value_gain > 0 && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                            Where the {formatCurrencyShort(cmp.value_gain)} gain came from
                          </span>
                        </div>
                        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full bg-[var(--color-chart-2)]"
                            style={{
                              width: `${Math.max(0, Math.min(100, ((cmp.market_driven_gain ?? 0) / cmp.value_gain) * 100))}%`,
                            }}
                          />
                          <div className="h-full flex-1 bg-[var(--color-chart-5)]" />
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">
                            Market{' '}
                            <strong className="tabular-nums text-slate-700">
                              {formatCurrencyShort(cmp.market_driven_gain ?? 0)}
                            </strong>
                          </span>
                          <span className="text-slate-500">
                            This property{' '}
                            <strong className="tabular-nums text-slate-700">
                              {formatCurrencyShort(cmp.property_driven_gain ?? 0)}
                            </strong>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="px-5 py-4">
                    <p className="text-xs text-slate-400">
                      {STATUS_COPY[cmp?.status ?? 'no_market_data']}
                    </p>
                  </div>
                )}

                {/* Two trends that stand up even when the owner has held the
                    property for weeks: what the dwelling itself has done across
                    its recorded sales, and whether its market is speeding up. */}
                {(history.cagr !== null || momentum !== null) && (
                  <div className="mx-5 mb-4 flex flex-col gap-2.5 rounded-xl bg-slate-50 px-4 py-3">
                    {history.cagr !== null && (
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-xs text-slate-500">
                          Since {history.first_date?.slice(0, 4)} ({history.years} yrs, own sales)
                        </span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-800">
                          {pct(history.cagr)}/yr
                          <span className="ml-1.5 font-normal text-slate-400">
                            {formatCurrencyShort(history.first_price ?? 0)} &rarr;{' '}
                            {formatCurrencyShort(history.last_price ?? 0)}
                          </span>
                        </span>
                      </div>
                    )}
                    {momentum !== null && (
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-xs text-slate-500">Suburb momentum</span>
                        <span
                          className={`flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums ${
                            momentum > MOMENTUM_BAND
                              ? 'text-green-700'
                              : momentum < -MOMENTUM_BAND
                                ? 'text-red-600'
                                : 'text-slate-600'
                          }`}
                        >
                          {momentum > MOMENTUM_BAND ? (
                            <TrendingUp size={12} />
                          ) : momentum < -MOMENTUM_BAND ? (
                            <TrendingDown size={12} />
                          ) : (
                            <Minus size={12} />
                          )}
                          {momentum > MOMENTUM_BAND
                            ? 'accelerating'
                            : momentum < -MOMENTUM_BAND
                              ? 'cooling'
                              : 'steady'}
                          <span className="font-normal text-slate-400">
                            {pct(shortWin?.price_growth_annualised ?? null, 0)} last year vs{' '}
                            {pct(longWin?.price_growth_annualised ?? null, 0)} average
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Market facts and observed history — things the user never entered. */}
                <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-slate-100 px-5 py-4">
                  <Stat
                    icon={Banknote}
                    title="Market rent"
                    align="start"
                    explain="What this property should rent for at today's local rates. Compare it against what you actually collect — the gap is the clearest, fastest lever you control."
                  >
                    {marketRent ? `${formatCurrencyShort(marketRent)}/mo` : '—'}
                  </Stat>
                  <Stat
                    icon={Users}
                    title="Rented nearby"
                    explain="Share of dwellings around this address that are rented rather than owner-occupied. A high share means a deep tenant pool but more competing stock when you re-let."
                  >
                    {fact?.rental_percentage != null ? `${fact.rental_percentage.toFixed(0)}%` : '—'}
                  </Stat>
                  <Stat
                    icon={Timer}
                    title="Typical hold"
                    explain="How long owners around here keep a property before selling. Short holds suggest a transient, more volatile market; long holds mean tightly held stock that rarely trades."
                  >
                    {fact?.hold_period != null ? `${fact.hold_period.toFixed(1)} yrs` : '—'}
                  </Stat>
                  <Stat
                    icon={Ruler}
                    title="Land rate"
                    align="end"
                    explain="Current value divided by land size. Useful for comparing two properties in the same suburb: a low rate on a large lot can mean the dwelling, not the land, is dragging the valuation."
                  >
                    {fact?.lot_size
                      ? `${formatCurrencyShort(p.current_value / fact.lot_size)}/m²`
                      : '—'}
                  </Stat>
                  {rentGap !== null && Math.abs(rentGap) >= 20 && (
                    <span
                      className={`text-xs font-medium ${rentGap > 0 ? 'text-amber-700' : 'text-slate-400'}`}
                    >
                      {rentGap > 0
                        ? `${formatCurrencyShort(rentGap)}/mo below market`
                        : `${formatCurrencyShort(-rentGap)}/mo above market`}
                    </span>
                  )}
                </div>

                {timeline.length > 0 && (
                  <div className="border-t border-slate-100 px-5 py-4">
                    <div className="flex items-baseline justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        Sale history
                      </p>
                      {history.priced_sales > 1 && (
                        <p className="text-[10px] text-slate-400">
                          {history.priced_sales} sales since {history.first_date?.slice(0, 4)}
                        </p>
                      )}
                    </div>

                    {/* A timeline rather than a list: each row carries what
                        happened since the sale below it, so a flat patch or a
                        fall between two sales is visible instead of buried in a
                        column of numbers. */}
                    <ol className="mt-3 flex flex-col">
                      {timeline.map((e, i) => {
                        const last = i === timeline.length - 1
                        const up = (e.change_since_previous ?? 0) > 0
                        return (
                          <li key={`${e.event_date}-${i}`} className="flex gap-3">
                            {/* Rail: dot per sale, line spanning the gap. */}
                            <span className="flex flex-col items-center" aria-hidden>
                              <span
                                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                                  last ? 'bg-slate-300' : 'bg-green-700'
                                }`}
                              />
                              {!last && <span className="w-px flex-1 bg-slate-200" />}
                            </span>

                            <div
                              className={`flex flex-1 flex-wrap items-baseline justify-between gap-x-3 ${
                                last ? '' : 'pb-3'
                              }`}
                            >
                              <span className="text-xs text-slate-500">
                                {formatSaleDate(e.event_date)}
                              </span>
                              <span className="flex items-baseline gap-2">
                                <span className="text-xs font-semibold tabular-nums text-slate-800">
                                  {e.price ? formatCurrencyShort(e.price) : 'undisclosed'}
                                </span>
                                {/* Three distinct states, previously collapsed
                                    into two: an undisclosed sale has no change
                                    because there is no price, which is not the
                                    same as being the earliest sale on record. */}
                                {e.undisclosed ? null : e.change_since_previous !== null ? (
                                  <span
                                    className={`text-[11px] font-medium tabular-nums ${
                                      e.change_since_previous === 0
                                        ? 'text-slate-500'
                                        : up
                                          ? 'text-green-700'
                                          : 'text-red-600'
                                    }`}
                                    title={
                                      e.annualised_since_previous !== null
                                        ? `${pct(e.annualised_since_previous)} a year over ${e.years_since_previous} years`
                                        : undefined
                                    }
                                  >
                                    {pct(e.change_since_previous, 0)}
                                    <span className="ml-1 font-normal text-slate-400">
                                      in {e.years_since_previous}y
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">first on record</span>
                                )}
                              </span>
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <p className="text-xs text-slate-400">
        Market data from HTAG across {areaIds.length}{' '}
        {areaIds.length === 1 ? 'locality' : 'localities'} · portfolio value{' '}
        {formatCurrencyShort(totalValue)}
      </p>
    </div>
  )
}

/** An icon-labelled figure. The icon carries the meaning; the name is on hover. */
function Stat({
  icon: Icon,
  title,
  explain,
  align = 'center',
  tone = 'neutral',
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  /** How to read the number — the reason the tooltip exists. */
  explain: string
  align?: 'center' | 'start' | 'end'
  tone?: 'positive' | 'negative' | 'neutral'
  children: React.ReactNode
}) {
  return (
    <InfoTooltip
      align={align}
      content={
        <>
          <span className="mb-0.5 block font-semibold text-white">{title}</span>
          {explain}
        </>
      }
    >
      <span className="flex items-center gap-1.5">
        <Icon size={14} className="shrink-0 text-slate-400" />
        <span
          className={`text-sm font-semibold tabular-nums ${
            tone === 'positive'
              ? 'text-green-700'
              : tone === 'negative'
                ? 'text-red-600'
                : 'text-slate-800'
          }`}
        >
          {children}
        </span>
        <span className="sr-only">{title}</span>
      </span>
    </InfoTooltip>
  )
}

/**
 * A physical attribute: icon plus value, no border. These are specs rather than
 * findings, so they should read as a quiet row and not compete with the figures
 * below them. Only the ones needing interpretation carry a tooltip.
 */
function Spec({
  icon: Icon,
  title,
  explain,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  explain?: string
  children: React.ReactNode
}) {
  const body = (
    <span className="flex items-center gap-1.5">
      <Icon size={14} className="shrink-0 text-slate-400" />
      <span className="text-xs font-medium tabular-nums text-slate-600">{children}</span>
      <span className="sr-only">{title}</span>
    </span>
  )
  if (!explain) return body
  return (
    <InfoTooltip
      align="start"
      content={
        <>
          <span className="mb-0.5 block font-semibold text-white">{title}</span>
          {explain}
        </>
      }
    >
      {body}
    </InfoTooltip>
  )
}

function Chip({
  children,
  tone = 'default',
}: {
  children: React.ReactNode
  tone?: 'default' | 'warning' | 'muted'
}) {
  const cls =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : tone === 'muted'
        ? 'border-slate-200 bg-white text-slate-500'
        : 'border-slate-200 bg-slate-50 text-slate-600'
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>
  )
}

function Metric({
  label,
  value,
  sub,
  strong,
  tone = 'neutral',
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  strong?: boolean
  tone?: 'positive' | 'negative' | 'neutral'
  icon?: React.ComponentType<{ size?: number; className?: string }>
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-green-700'
      : tone === 'negative'
        ? 'text-red-600'
        : 'text-slate-900'
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p
        className={`mt-0.5 flex items-center gap-1 text-sm tabular-nums ${toneClass} ${
          strong ? 'font-bold' : 'font-semibold'
        }`}
      >
        {Icon && <Icon size={13} className="shrink-0" />}
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-[10px] text-slate-400">{sub}</p>}
    </div>
  )
}

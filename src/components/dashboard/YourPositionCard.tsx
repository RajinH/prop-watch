'use client'

import { useId, useMemo, useState } from 'react'
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { computeRunway } from '@/lib/propwatch/engine/computeRunway'
import {
  RATE_SHOCK_PCT,
  RUNWAY_CRITICAL_MONTHS,
  RUNWAY_WARNING_MONTHS,
} from '@/lib/propwatch/engine/thresholds'
import type {
  Property,
  PortfolioSnapshotInsert,
  RunwayScenario,
} from '@/lib/propwatch/engine/types'
import { formatCurrency, formatDollars } from '@/lib/formatters'

interface Props {
  portfolioSnapshot: PortfolioSnapshotInsert
  properties: Property[]
}

// Colours encode state (how long the cash lasts), not identity, so they come
// from the status tokens rather than the series palette.
const chartConfig = {
  good: { label: 'Comfortable', color: 'var(--color-status-good)' },
  warning: { label: 'Under 12 months', color: 'var(--color-status-warning)' },
  critical: { label: 'Under 6 months', color: 'var(--color-status-critical)' },
} satisfies ChartConfig

type Tone = keyof typeof chartConfig

function toneFor(s: RunwayScenario): Tone {
  if (s.status !== 'finite' || s.runway_months === null) return 'good'
  if (s.runway_months < RUNWAY_CRITICAL_MONTHS) return 'critical'
  if (s.runway_months < RUNWAY_WARNING_MONTHS) return 'warning'
  return 'good'
}

/** Chart label: 1 decimal under 12 months, whole months above. */
function chartMonths(s: RunwayScenario): string {
  if (s.status === 'self_funding') return 'Self-funding'
  if (s.status === 'unknown_reserve' || s.runway_months === null) return 'Add cash to see runway'
  if (s.runway_capped) return '10+ years'
  const m = s.runway_months
  return `${m < 12 ? m.toFixed(1) : Math.round(m)} months`
}

/** The calculation panel always shows 1 decimal. */
function panelMonths(m: number): string {
  return `${m.toFixed(1)} months`
}

function signed(n: number): string {
  return `${n < 0 ? '−' : ''}${formatDollars(n, 2)}`
}

/** Digits and commas only; anything else (negatives, text, decimals) is invalid. */
function parseReserve(raw: string): { value: number | null; valid: boolean } {
  const trimmed = raw.trim()
  if (trimmed === '') return { value: null, valid: true }
  if (!/^[\d,]+$/.test(trimmed) || !/\d/.test(trimmed)) return { value: null, valid: false }
  return { value: Number(trimmed.replace(/,/g, '')), valid: true }
}

export default function YourPositionCard({ portfolioSnapshot: snap, properties }: Props) {
  const inputId = useId()
  const [raw, setRaw] = useState('')
  // Last valid reserve: invalid input shows an error but leaves the chart alone.
  const [reserve, setReserve] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runway = useMemo(
    () => computeRunway(snap, properties, reserve),
    [snap, properties, reserve]
  )

  if (properties.length === 0) return null

  const [current, vacancy, ratePlus2] = runway.scenarios
  const vacantProperty = properties.find((p) => p.id === runway.vacancy_property_id) ?? null
  const vacantName = vacantProperty?.name ?? 'none'

  const rowLabels: Record<RunwayScenario['key'], string> = {
    current: 'Today',
    vacancy: `Largest rent vacant (${vacantName})`,
    rate_plus_2: 'Rates +2%',
  }

  // Scale to the longest finite runway, but never tighter than the warning line,
  // so a short runway still reads as short. Self-funding rows span the full width.
  const finiteMonths = runway.scenarios
    .filter((s) => s.status === 'finite')
    .map((s) => s.runway_months ?? 0)
  const xMax = Math.max(RUNWAY_WARNING_MONTHS, ...finiteMonths)

  const chartData = runway.scenarios.map((s) => ({
    key: s.key,
    rowLabel: rowLabels[s.key],
    valueLabel: chartMonths(s),
    value:
      s.status === 'self_funding' ? xMax : s.status === 'finite' ? (s.runway_months ?? 0) : 0,
    tone: toneFor(s),
    status: s.status,
  }))

  function handleChange(next: string) {
    setRaw(next)
    const parsed = parseReserve(next)
    if (!parsed.valid) {
      setError('Enter a positive dollar amount')
      return
    }
    setError(null)
    setReserve(parsed.value)
  }

  // Observation, not advice: only stress scenarios that actually draw on cash.
  const observations: string[] = []
  if (vacancy.status === 'finite' && vacancy.runway_months !== null) {
    observations.push(
      `about ${vacancy.runway_capped ? '10+ years' : panelMonths(vacancy.runway_months)} if ${vacantName} sat vacant`
    )
  }
  if (ratePlus2.status === 'finite' && ratePlus2.runway_months !== null) {
    observations.push(
      `about ${ratePlus2.runway_capped ? '10+ years' : panelMonths(ratePlus2.runway_months)} if rates rose 2 points`
    )
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Your position
      </h2>

      {current.status === 'self_funding' ? (
        <p className="mt-2 text-2xl font-black text-green-700">
          Self-funding: rent covers costs (+{formatDollars(current.monthly_cashflow)}/month)
        </p>
      ) : (
        <>
          <p className="mt-1 text-4xl font-black leading-none text-slate-900">
            {formatCurrency(current.monthly_out_of_pocket)}
          </p>
          <p className="mt-1 text-sm text-slate-500">Monthly out-of-pocket after rent</p>
        </>
      )}

      <div className="mt-5 max-w-sm">
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          Cash available (savings + offset balances)
        </label>
        <div className="relative mt-1.5">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
            $
          </span>
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={raw}
            onChange={(e) => handleChange(e.target.value)}
            aria-invalid={error !== null}
            aria-describedby={`${inputId}-help`}
            className={`w-full rounded-lg border bg-white py-2 pl-7 pr-3 text-sm tabular-nums text-slate-900 outline-none focus:ring-2 ${
              error
                ? 'border-red-500 focus:ring-red-200'
                : 'border-slate-200 focus:border-green-600 focus:ring-green-100'
            }`}
          />
        </div>
        <p id={`${inputId}-help`} className="mt-1 text-xs">
          {error ? (
            <span className="text-red-600">{error}</span>
          ) : (
            <span className="text-slate-400">Not saved yet. Used only for this view.</span>
          )}
        </p>
      </div>

      <ChartContainer
        config={chartConfig}
        className="mt-5 aspect-auto w-full"
        style={{ height: 180 }}
        aria-label="Months of runway by scenario"
      >
        <BarChart
          accessibilityLayer
          data={chartData}
          layout="vertical"
          margin={{ top: 20, right: 150, bottom: 0, left: 0 }}
          barSize={14}
        >
          <XAxis type="number" domain={[0, xMax]} hide />
          <YAxis type="category" dataKey="key" hide />
          {/* minPointSize keeps zero-length rows (no cash yet, or 0 months) in the
              layout: Recharts drops a zero-width bar and its labels with it. */}
          <Bar
            dataKey="value"
            radius={4}
            isAnimationActive={false}
            minPointSize={2}
            background={{ fill: 'var(--color-slate-100)', radius: 4 }}
          >
            {chartData.map((d) => (
              <Cell
                key={d.key}
                fill={`var(--color-${d.tone})`}
                fillOpacity={
                  d.status === 'unknown_reserve' ? 0 : d.status === 'self_funding' ? 0.3 : 1
                }
              />
            ))}
            {/* Row name above each bar. */}
            <LabelList
              dataKey="rowLabel"
              content={(p) => (
                <text
                  x={Number(p.x ?? 0)}
                  y={Number(p.y ?? 0) - 6}
                  className="fill-slate-500 text-xs"
                >
                  {p.value}
                </text>
              )}
            />
            {/* Direct value label past the bar end: the meaning never rests on colour. */}
            <LabelList
              dataKey="valueLabel"
              content={(p) => (
                <text
                  x={Number(p.x ?? 0) + Number(p.width ?? 0) + 8}
                  y={Number(p.y ?? 0) + Number(p.height ?? 0) / 2}
                  dominantBaseline="central"
                  className="fill-slate-800 text-xs font-semibold"
                >
                  {p.value}
                </text>
              )}
            />
          </Bar>
        </BarChart>
      </ChartContainer>

      {observations.length > 0 && (
        <p className="mt-2 text-sm text-slate-600">
          Your cash covers {observations.join(', and ')}.
        </p>
      )}

      <details className="group mt-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          How this is calculated
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs tabular-nums">
            <thead className="text-slate-400">
              <tr>
                <th className="py-1.5 pr-3 font-semibold">Scenario</th>
                <th className="py-1.5 pr-3 font-semibold">Monthly cashflow</th>
                <th className="py-1.5 pr-3 font-semibold">Adjustment</th>
                <th className="py-1.5 pr-3 font-semibold">Out-of-pocket</th>
                <th className="py-1.5 pr-3 font-semibold">Cash ÷ out-of-pocket</th>
                <th className="py-1.5 font-semibold">Runway</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {runway.scenarios.map((s) => {
                // The adjustment is the difference the scenario applies to today's cashflow.
                const adjustment = current.monthly_cashflow - s.monthly_cashflow
                const adjustmentText =
                  s.key === 'current'
                    ? 'None'
                    : s.key === 'vacancy'
                      ? vacantProperty
                        ? `One month's rent, ${vacantProperty.name}: ${formatDollars(adjustment, 2)}`
                        : 'None'
                      : `${RATE_SHOCK_PCT * 100}% × ${formatDollars(snap.total_debt)} ÷ 12 = ${formatDollars(adjustment, 2)}`
                const cashflowText =
                  s.key === 'current'
                    ? signed(s.monthly_cashflow)
                    : `${signed(current.monthly_cashflow)} − ${formatDollars(adjustment, 2)} = ${signed(s.monthly_cashflow)}`
                const divisionText =
                  s.status === 'finite' && runway.cash_reserve !== null
                    ? `${formatDollars(runway.cash_reserve)} ÷ ${formatDollars(s.monthly_out_of_pocket, 2)} = ${panelMonths(runway.cash_reserve / s.monthly_out_of_pocket)}`
                    : s.status === 'unknown_reserve'
                      ? 'Needs cash available'
                      : 'Not drawn down'
                const runwayText =
                  s.status === 'self_funding'
                    ? 'Self-funding'
                    : s.status === 'unknown_reserve' || s.runway_months === null
                      ? '—'
                      : s.runway_capped
                        ? '10+ years (capped at 120 months)'
                        : panelMonths(s.runway_months)
                return (
                  <tr key={s.key} className="border-t border-slate-200 align-top">
                    <td className="py-2 pr-3 font-medium">{rowLabels[s.key]}</td>
                    <td className="py-2 pr-3">{cashflowText}</td>
                    <td className="py-2 pr-3">{adjustmentText}</td>
                    <td className="py-2 pr-3">{formatDollars(s.monthly_out_of_pocket, 2)}</td>
                    <td className="py-2 pr-3">{divisionText}</td>
                    <td className="py-2">{runwayText}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Rates +2% assumes interest on all debt rises 2 points; repayments may differ for
          principal-and-interest loans. Vacancy removes one month of rent from the
          highest-rent property.
        </p>
      </details>
    </section>
  )
}

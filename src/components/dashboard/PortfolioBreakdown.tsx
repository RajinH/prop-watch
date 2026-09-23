'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, ArrowRight } from 'lucide-react'
import type {
  Property,
  PortfolioSnapshotInsert,
  PropertySnapshot,
  PropertyRank,
} from '@/lib/propwatch/engine/types'

interface Props {
  portfolioSnapshot: PortfolioSnapshotInsert
  properties: Property[]
  propertySnapshots: Record<string, PropertySnapshot>
  rankedProperties: PropertyRank[]
}

/*
 * Two views, not four.
 *
 * Value, debt and exposure were never independent metrics: per property
 * `debt + equity = value`, so one stacked bar carries all three at once — the
 * bar's length is the value, its split is the LVR, and its share of the widest
 * row is the exposure. Toggling between them showed one at a time and asked the
 * reader to hold the other two in their head.
 *
 * Cashflow is the one measure that genuinely does not belong in that stack: it
 * is signed and unrelated to the value axis, so it gets a diverging view.
 */
type Metric = 'composition' | 'cashflow'

const METRICS: { id: Metric; label: string; caption: string }[] = [
  {
    id: 'composition',
    label: 'Composition',
    caption: 'What each property is worth, split into what you owe and what you own.',
  },
  {
    id: 'cashflow',
    label: 'Cashflow/mo',
    caption: 'Net monthly cashflow per property — rent less repayments and expenses.',
  },
]

// Debt and equity are two parts of one whole, so they take categorical slots —
// debt is not an error state, and colouring it as one would misread a healthy
// 38% LVR as a warning.
const DEBT_COLOR = 'var(--color-series-2)'
const EQUITY_COLOR = 'var(--color-series-1)'

const RANK_BADGES: Record<number, string> = {
  1: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  2: 'bg-slate-100 text-slate-600 border border-slate-200',
  3: 'bg-orange-100 text-orange-600 border border-orange-200',
}

function fmt(n: number) {
  return '$' + Math.abs(n).toLocaleString('en-AU', { maximumFractionDigits: 0 })
}

function pct(n: number | null) {
  return n !== null ? (n * 100).toFixed(1) + '%' : '—'
}

export default function PortfolioBreakdown({
  portfolioSnapshot: snap,
  properties,
  propertySnapshots,
  rankedProperties,
}: Props) {
  const [metric, setMetric] = useState<Metric>('composition')
  const [showTable, setShowTable] = useState(false)

  if (properties.length === 0) return null

  const rankMap = new Map(rankedProperties.map((r) => [r.property_id, r]))

  // One stable order for both views. Sorting by the active metric meant the
  // rows reshuffled every time you switched, so you lost your place.
  const rows = properties
    .map((p) => {
      const s = propertySnapshots[p.id]
      const equity = p.current_value - p.current_debt
      return {
        id: p.id,
        name: p.name,
        value: p.current_value,
        debt: p.current_debt,
        equity,
        lvr: s?.lvr ?? (p.current_value > 0 ? p.current_debt / p.current_value : null),
        cashflow: s?.monthly_cashflow ?? 0,
        exposure: snap.total_value > 0 ? p.current_value / snap.total_value : 0,
      }
    })
    .sort((a, b) => b.value - a.value)

  const activeMetric = METRICS.find((m) => m.id === metric)!

  // Bars are measured against the widest row, so the longest bar fills the
  // track and every other row reads as a share of it.
  const maxValue = Math.max(...rows.map((r) => r.value), 0)
  const maxAbsCashflow = Math.max(...rows.map((r) => Math.abs(r.cashflow)), 1)

  return (
    <div className="flex flex-col gap-4">
      {/* Header + metric toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-slate-700">Portfolio breakdown</p>
          <p className="text-xs text-slate-500">{activeMetric.caption}</p>
        </div>
        <div className="flex shrink-0 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {METRICS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMetric(m.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                metric === m.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rows are HTML, not SVG. The property name can then be a real link to
          that property rather than SVG <text> with an onClick — the old labels
          were unreachable by keyboard and every one of them navigated to the
          same page. The numbers live in the row, so the bars are decorative and
          nothing is readable only by hovering. */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        {metric === 'composition' && (
          <div className="mb-4 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: DEBT_COLOR }}
              />
              Debt
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: EQUITY_COLOR }}
              />
              Equity
            </span>
          </div>
        )}

        <ul className="flex flex-col">
          {rows.map((r) => {
            const share = maxValue > 0 ? r.value / maxValue : 0
            const debtShare = r.value > 0 ? Math.min(1, Math.max(0, r.debt / r.value)) : 0
            const underwater = r.equity < 0
            const cashflowShare = Math.min(1, Math.abs(r.cashflow) / maxAbsCashflow)

            return (
              <li key={r.id}>
                <Link
                  href={`/properties/${r.id}/edit`}
                  className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-slate-50 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto]"
                >
                  <span className="truncate text-sm font-medium text-slate-800 group-hover:text-green-800">
                    {r.name}
                  </span>

                  {metric === 'composition' ? (
                    <span className="col-span-2 col-start-1 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1 flex h-5 overflow-hidden rounded bg-slate-100" aria-hidden>
                      <span className="flex h-full" style={{ width: `${share * 100}%` }}>
                        <span
                          className="h-full"
                          style={{ width: `${debtShare * 100}%`, background: DEBT_COLOR }}
                        />
                        {debtShare > 0 && debtShare < 1 && (
                          <span className="h-full w-0.5 shrink-0 bg-white" />
                        )}
                        <span className="h-full flex-1" style={{ background: EQUITY_COLOR }} />
                      </span>
                    </span>
                  ) : (
                    // Diverging around zero: the centre line is the baseline, so
                    // direction carries the sign as well as colour.
                    <span className="col-span-2 col-start-1 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1 relative flex h-5 items-center" aria-hidden>
                      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-200" />
                      <span className="flex h-full w-1/2 justify-end">
                        {r.cashflow < 0 && (
                          <span
                            className="h-full rounded-l"
                            style={{
                              width: `${cashflowShare * 100}%`,
                              background: 'var(--color-chart-negative)',
                            }}
                          />
                        )}
                      </span>
                      <span className="flex h-full w-1/2">
                        {r.cashflow >= 0 && (
                          <span
                            className="h-full rounded-r"
                            style={{
                              width: `${cashflowShare * 100}%`,
                              background: 'var(--color-chart-positive)',
                            }}
                          />
                        )}
                      </span>
                    </span>
                  )}

                  {metric === 'composition' ? (
                    <span className="col-start-2 row-start-1 sm:col-start-3 flex flex-col items-end">
                      <span className="text-sm font-semibold tabular-nums text-slate-800">
                        {fmt(r.value)}
                      </span>
                      <span
                        className={`text-xs tabular-nums ${underwater ? 'text-red-600' : 'text-slate-400'}`}
                      >
                        {underwater ? 'Debt > value' : `LVR ${pct(r.lvr)}`}
                      </span>
                    </span>
                  ) : (
                    <span className="col-start-2 row-start-1 sm:col-start-3 flex flex-col items-end">
                      <span
                        className={`text-sm font-semibold tabular-nums ${r.cashflow < 0 ? 'text-red-600' : 'text-green-700'}`}
                      >
                        {r.cashflow >= 0 ? '+' : '-'}
                        {fmt(r.cashflow)}
                      </span>
                      <span className="text-xs tabular-nums text-slate-400">
                        {pct(r.exposure)} of value
                      </span>
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Expandable detail table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => setShowTable((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50"
        >
          <span className="text-sm font-semibold text-slate-700">
            {showTable ? 'Hide detailed table' : 'Show detailed table'}
          </span>
          {showTable ? (
            <ChevronDown size={16} className="text-slate-400" />
          ) : (
            <ChevronRight size={16} className="text-slate-400" />
          )}
        </button>
        {showTable && (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                    #
                  </th>
                  {['Name', 'Value', 'Debt', 'LVR', 'Equity', 'Rent/mo', 'Cashflow/mo', 'Yield', 'Exposure'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                  <th className="hidden md:table-cell px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => {
                  const s = propertySnapshots[p.id]
                  const cf = s?.monthly_cashflow ?? 0
                  const rank = rankMap.get(p.id)
                  const exposure = snap.total_value > 0 ? p.current_value / snap.total_value : null
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {rank && (
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${RANK_BADGES[rank.rank] ?? 'bg-slate-50 text-slate-500 border border-slate-200'}`}
                          >
                            {rank.rank}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {fmt(p.current_value)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {fmt(p.current_debt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`font-medium ${s?.lvr !== null && s?.lvr !== undefined && s.lvr >= 0.8 ? 'text-red-600' : s?.lvr !== null && s?.lvr !== undefined && s.lvr >= 0.65 ? 'text-amber-600' : 'text-slate-600'}`}
                        >
                          {pct(s?.lvr ?? null)}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 whitespace-nowrap ${s && s.equity < 0 ? 'text-red-600' : 'text-slate-600'}`}
                      >
                        {/* fmt() prints the absolute value, so the sign has to be
                            restored here — equity goes negative when debt
                            exceeds value. */}
                        {s ? (s.equity < 0 ? '-' : '') + fmt(s.equity) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {fmt(p.monthly_rent)}
                      </td>
                      <td
                        className={`px-4 py-3 font-medium whitespace-nowrap ${cf < 0 ? 'text-red-600' : 'text-green-700'}`}
                      >
                        {cf >= 0 ? '+' : '-'}
                        {fmt(cf)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {pct(s?.yield ?? null)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{pct(exposure)}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-slate-500 whitespace-nowrap">
                        {rank ? rank.composite_score.toFixed(2) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CTA to Plan */}
      <Link
        href="/plan"
        className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
      >
        Analyse next move
        <ArrowRight size={16} />
      </Link>
    </div>
  )
}

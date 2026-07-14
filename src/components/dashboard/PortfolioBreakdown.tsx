'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  LabelList,
  ResponsiveContainer,
} from 'recharts'
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

type Metric = 'value' | 'debt' | 'cashflow' | 'exposure'

const METRICS: { id: Metric; label: string; tooltipLabel: string; caption: string }[] = [
  {
    id: 'value',
    label: 'Value',
    tooltipLabel: 'Value',
    caption: 'Estimated current market value of each property.',
  },
  {
    id: 'debt',
    label: 'Debt',
    tooltipLabel: 'Debt',
    caption: 'Outstanding loan balance owing on each property.',
  },
  {
    id: 'cashflow',
    label: 'Cashflow/mo',
    tooltipLabel: 'Cashflow/mo',
    caption: 'Net monthly cashflow per property — rent less repayments and expenses.',
  },
  {
    id: 'exposure',
    label: 'Exposure',
    tooltipLabel: 'Exposure',
    caption: "Each property's share of total portfolio value.",
  },
]

const BAR_COLOR = '#16a34a'
const BAR_COLOR_NEG = '#dc2626'

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

// Pronounced, clickable property name rendered above each bar. Navigates to the
// properties page on click. Rendered as a LabelList content element so recharts
// treats it as a real component (hooks are valid here).
function BarNameLabel(props: { x?: number; y?: number; value?: string | number }) {
  const { x = 0, y = 0, value } = props
  const router = useRouter()
  return (
    <text
      x={x}
      y={y}
      dy={-7}
      textAnchor="start"
      role="link"
      onClick={() => router.push('/properties')}
      className="cursor-pointer fill-slate-800 text-[13px] font-semibold transition-colors hover:fill-green-700 hover:underline"
    >
      {value}
    </text>
  )
}

export default function PortfolioBreakdown({
  portfolioSnapshot: snap,
  properties,
  propertySnapshots,
  rankedProperties,
}: Props) {
  const [metric, setMetric] = useState<Metric>('value')
  const [showTable, setShowTable] = useState(false)

  if (properties.length === 0) return null

  const rankMap = new Map(rankedProperties.map((r) => [r.property_id, r]))

  const rows = properties.map((p) => {
    const s = propertySnapshots[p.id]
    const exposure = snap.total_value > 0 ? p.current_value / snap.total_value : 0
    return {
      id: p.id,
      name: p.name,
      value: p.current_value,
      debt: p.current_debt,
      cashflow: s?.monthly_cashflow ?? 0,
      exposure,
    }
  })

  const isExposure = metric === 'exposure'
  const isCashflow = metric === 'cashflow'

  const chartData = [...rows]
    .sort((a, b) => b[metric] - a[metric])
    .map((r) => ({
      name: r.name.length > 20 ? r.name.slice(0, 20) + '…' : r.name,
      metricValue: isExposure ? r.exposure * 100 : r[metric],
    }))

  const activeMetric = METRICS.find((m) => m.id === metric)!
  const formatAxis = (v: number) => (isExposure ? `${v.toFixed(0)}%` : fmt(v))
  const formatTooltip = (v: number) =>
    isExposure ? `${Number(v).toFixed(1)}%` : fmt(Number(v))
  const chartHeight = Math.max(180, chartData.length * 56 + 28)

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

      {/* Unified horizontal bar chart */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 18, right: 16, bottom: 4, left: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={formatAxis}
              tick={{ fontSize: 11, fill: '#475569' }}
              stroke="#94a3b8"
            />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip
              formatter={(v) => [formatTooltip(Number(v)), activeMetric.tooltipLabel]}
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{
                padding: '5px 9px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
              }}
              labelStyle={{ fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 1 }}
              itemStyle={{ fontSize: 12, padding: 0, color: '#475569' }}
            />
            {isCashflow && <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="4 4" />}
            <Bar dataKey="metricValue" radius={[0, 4, 4, 0]} barSize={18}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={isCashflow && entry.metricValue < 0 ? BAR_COLOR_NEG : BAR_COLOR}
                />
              ))}
              <LabelList dataKey="name" content={<BarNameLabel />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
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
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {s ? fmt(s.equity) : '—'}
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

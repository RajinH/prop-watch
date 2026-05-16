'use client'

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts'
import type { Property, PortfolioSnapshotInsert, PropertySnapshot, AfterTaxCashflow, PropertyRank } from '@/lib/propwatch/engine/types'

interface Props {
  portfolioSnapshot: PortfolioSnapshotInsert
  properties: Property[]
  propertySnapshots: Record<string, PropertySnapshot>
  afterTaxCashflow: AfterTaxCashflow | null
  rankedProperties: PropertyRank[]
}

const PIE_COLORS = ['#166534', '#15803d', '#16a34a', '#22c55e', '#86efac', '#bbf7d0']

function fmt(n: number) {
  return '$' + Math.abs(n).toLocaleString('en-AU', { maximumFractionDigits: 0 })
}

function pct(n: number | null) {
  return n !== null ? (n * 100).toFixed(1) + '%' : '—'
}

const RANK_BADGES: Record<number, string> = {
  1: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  2: 'bg-slate-100 text-slate-600 border border-slate-200',
  3: 'bg-orange-100 text-orange-600 border border-orange-200',
}

export default function PortfolioTab({ portfolioSnapshot: snap, properties, propertySnapshots, afterTaxCashflow, rankedProperties }: Props) {
  const rankMap = new Map(rankedProperties.map((r) => [r.property_id, r]))
  const pieData = properties.map((p) => ({
    name: p.name,
    value: p.current_value,
  }))

  const barData = properties.map((p) => {
    const s = propertySnapshots[p.id]
    return {
      name: p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name,
      cashflow: s?.monthly_cashflow ?? 0,
    }
  })

  const snapshotCards = [
    { label: 'Total Value', value: fmt(snap.total_value), sub: null },
    {
      label: 'Total Equity',
      value: fmt(snap.total_equity),
      sub: snap.total_value > 0 ? `${((snap.total_equity / snap.total_value) * 100).toFixed(0)}% of value` : null,
    },
    {
      label: 'Monthly Cashflow',
      value: (snap.monthly_cashflow >= 0 ? '+' : '-') + fmt(snap.monthly_cashflow),
      negative: snap.monthly_cashflow < 0,
      sub: afterTaxCashflow && snap.monthly_cashflow < 0
        ? `After-tax: -${fmt(afterTaxCashflow.after_tax_monthly_cashflow)} (~${fmt(afterTaxCashflow.monthly_tax_saving)}/mo tax saving at ${(afterTaxCashflow.tax_bracket * 100).toFixed(0)}%)`
        : snap.monthly_cashflow < 0 ? 'Out of pocket' : 'Surplus',
    },
    {
      label: 'Gross Yield',
      value: pct(snap.yield),
      sub: snap.yield !== null && snap.yield >= 0.04 ? 'Above 4% target' : 'Below 4% target',
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      {/* Snapshot cards */}
      <div className="grid grid-cols-2 gap-3">
        {snapshotCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{card.label}</p>
            <p className={`mt-1 text-2xl font-black ${(card as { negative?: boolean }).negative ? 'text-red-600' : 'text-slate-900'}`}>
              {card.value}
            </p>
            {card.sub && <p className="text-xs text-slate-400 mt-0.5">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* Charts */}
      {properties.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Pie chart */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-700 mb-3">Value by property</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  label={false}
                  labelLine={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex flex-col gap-1 mt-2">
              {pieData.map((entry, i) => {
                const pctVal = snap.total_value > 0 ? ((entry.value / snap.total_value) * 100).toFixed(0) : '0'
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="shrink-0 w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-slate-600 truncate flex-1">{entry.name}</span>
                    <span className="text-xs font-semibold text-slate-500 shrink-0">{pctVal}%</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bar chart */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-700 mb-3">Monthly cashflow by property</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`$${Number(v).toFixed(0)}`, 'Cashflow']} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                <Bar dataKey="cashflow" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.cashflow >= 0 ? '#16a34a' : '#dc2626'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Property table */}
      {properties.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-700">Property breakdown</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">#</th>
                  {['Name', 'Value', 'LVR', 'Equity', 'Rent/mo', 'Cashflow/mo', 'Yield'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                  <th className="hidden md:table-cell px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Score</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => {
                  const s = propertySnapshots[p.id]
                  const cf = s?.monthly_cashflow ?? 0
                  const rank = rankMap.get(p.id)
                  return (
                    <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {rank && (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${RANK_BADGES[rank.rank] ?? 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                            {rank.rank}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{p.name}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmt(p.current_value)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`font-medium ${s?.lvr !== null && s?.lvr !== undefined && s.lvr >= 0.8 ? 'text-red-600' : s?.lvr !== null && s?.lvr !== undefined && s.lvr >= 0.65 ? 'text-amber-600' : 'text-slate-600'}`}>
                          {pct(s?.lvr ?? null)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{s ? fmt(s.equity) : '—'}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmt(p.monthly_rent)}</td>
                      <td className={`px-4 py-3 font-medium whitespace-nowrap ${cf < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {cf >= 0 ? '+' : '-'}{fmt(cf)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{pct(s?.yield ?? null)}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-slate-500 whitespace-nowrap">
                        {rank ? rank.composite_score.toFixed(2) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

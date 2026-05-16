'use client'

import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import type { CapitalGrowthSummary, AcquisitionCapacity, PortfolioHistoryPoint } from '@/lib/propwatch/engine/types'

interface Props {
  capitalGrowth: CapitalGrowthSummary
  acquisitionCapacity: AcquisitionCapacity
  portfolioHistory: PortfolioHistoryPoint[]
}

type HistoryMetric = 'total_equity' | 'weighted_lvr' | 'monthly_cashflow' | 'yield'

const HISTORY_METRICS: { id: HistoryMetric; label: string; format: (v: number) => string }[] = [
  { id: 'total_equity', label: 'Equity', format: (v) => '$' + Math.round(v).toLocaleString('en-AU') },
  { id: 'weighted_lvr', label: 'LVR', format: (v) => (v * 100).toFixed(1) + '%' },
  { id: 'monthly_cashflow', label: 'Cashflow', format: (v) => '$' + Math.round(v).toLocaleString('en-AU') + '/mo' },
  { id: 'yield', label: 'Yield', format: (v) => (v * 100).toFixed(2) + '%' },
]

function fmt(n: number) {
  return '$' + Math.abs(n).toLocaleString('en-AU', { maximumFractionDigits: 0 })
}

function pct(n: number | null) {
  return n !== null ? (n * 100).toFixed(1) + '%' : '—'
}

export default function GrowthTab({ capitalGrowth, acquisitionCapacity, portfolioHistory }: Props) {
  const [activeMetric, setActiveMetric] = useState<HistoryMetric>('total_equity')

  const metric = HISTORY_METRICS.find((m) => m.id === activeMetric)!
  const showRefLine = activeMetric === 'monthly_cashflow' || activeMetric === 'weighted_lvr'

  const propsWithData = capitalGrowth.properties.filter((p) => p.purchase_price !== null)

  const totalGainPct = propsWithData.length > 0 && propsWithData[0].purchase_price !== null
    ? capitalGrowth.total_unrealised_gain /
      propsWithData.reduce((s, p) => s + (p.purchase_price ?? 0), 0)
    : null

  return (
    <div className="flex flex-col gap-8">
      {/* Capital Growth summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Unrealised Gain</p>
          <p className={`mt-1 text-2xl font-black ${capitalGrowth.total_unrealised_gain >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {capitalGrowth.total_unrealised_gain >= 0 ? '+' : '-'}{fmt(capitalGrowth.total_unrealised_gain)}
          </p>
          {totalGainPct !== null && (
            <p className="text-xs text-slate-400 mt-0.5">
              {totalGainPct >= 0 ? '+' : ''}{(totalGainPct * 100).toFixed(1)}% on purchase cost
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Portfolio CAGR</p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {capitalGrowth.portfolio_annualised_growth !== null
              ? (capitalGrowth.portfolio_annualised_growth * 100).toFixed(1) + '%/yr'
              : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Avg annualised growth rate</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Best Performer</p>
          <p className="mt-1 text-lg font-black text-slate-900 truncate">
            {capitalGrowth.best_performer ?? '—'}
          </p>
          {capitalGrowth.best_performer_cagr !== null && (
            <p className="text-xs text-slate-400 mt-0.5">
              {(capitalGrowth.best_performer_cagr * 100).toFixed(1)}% CAGR
            </p>
          )}
        </div>
      </div>

      {/* Property growth table */}
      {capitalGrowth.properties.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-700">Property growth breakdown</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Name', 'Purchase Price', 'Current Value', 'Gain $', 'Gain %', 'CAGR', 'Held'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {capitalGrowth.properties.map((p) => (
                  <tr key={p.property_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{p.property_name}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {p.purchase_price !== null ? fmt(p.purchase_price) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">—</td>
                    <td className={`px-4 py-3 font-medium whitespace-nowrap ${p.unrealised_gain !== null ? (p.unrealised_gain >= 0 ? 'text-green-700' : 'text-red-600') : 'text-slate-400'}`}>
                      {p.unrealised_gain !== null ? (p.unrealised_gain >= 0 ? '+' : '-') + fmt(p.unrealised_gain) : '—'}
                    </td>
                    <td className={`px-4 py-3 font-medium whitespace-nowrap ${p.unrealised_gain_pct !== null ? (p.unrealised_gain_pct >= 0 ? 'text-green-700' : 'text-red-600') : 'text-slate-400'}`}>
                      {pct(p.unrealised_gain_pct)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {p.annualised_growth_rate !== null ? (p.annualised_growth_rate * 100).toFixed(1) + '%' : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {p.years_held !== null ? p.years_held.toFixed(1) + ' yrs' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {propsWithData.length < capitalGrowth.properties.length && (
            <p className="px-4 py-2 text-xs text-slate-400 border-t border-slate-50">
              {capitalGrowth.properties.length - propsWithData.length} propert{capitalGrowth.properties.length - propsWithData.length === 1 ? 'y is' : 'ies are'} missing purchase data — add purchase price and date to unlock growth tracking.
            </p>
          )}
        </div>
      )}

      {/* Equity Release */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-slate-700">Equity release capacity</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Usable Equity (at 80% LVR)</p>
            <p className={`mt-1 text-2xl font-black ${acquisitionCapacity.usable_equity_80 > 0 ? 'text-green-700' : 'text-slate-400'}`}>
              {acquisitionCapacity.usable_equity_80 > 0 ? fmt(acquisitionCapacity.usable_equity_80) : '$0'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Available to release without exceeding 80% LVR</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Max Next Purchase</p>
            <p className={`mt-1 text-2xl font-black ${acquisitionCapacity.max_purchase_price_80 > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
              {acquisitionCapacity.max_purchase_price_80 > 0 ? 'up to ' + fmt(acquisitionCapacity.max_purchase_price_80) : '—'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Based on 20% deposit from usable equity</p>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Usable equity is the amount you could release from your portfolio while keeping LVR at 80% or below. Consult your lender for exact borrowing capacity.
        </p>
      </div>

      {/* Portfolio history chart */}
      {portfolioHistory.length >= 2 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Portfolio history</p>
              <p className="text-xs text-slate-400">Since {portfolioHistory[0].snapshot_date}</p>
            </div>
            <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {HISTORY_METRICS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActiveMetric(m.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    activeMetric === m.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={portfolioHistory} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="snapshot_date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tickFormatter={(v) => metric.format(Number(v))} tick={{ fontSize: 10 }} width={60} />
              <Tooltip formatter={(v) => [metric.format(Number(v)), metric.label]} />
              {showRefLine && <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />}
              <Line type="monotone" dataKey={activeMetric} stroke="#166534" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

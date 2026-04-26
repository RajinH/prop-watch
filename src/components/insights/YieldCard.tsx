'use client'

import type { YieldResult } from '@/engine/types'
import { formatPercent } from '@/lib/formatters'

interface Props {
  yieldResult: YieldResult
  isTenanted: boolean
  style?: React.CSSProperties
}

export default function YieldCard({ yieldResult, isTenanted, style }: Props) {
  if (!isTenanted) {
    return (
      <div
        className="animate-slide-up rounded-2xl border border-slate-100 bg-white p-5 flex flex-col gap-4 shadow-sm"
        style={style}
      >
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Rental Yield</h3>
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-bold text-slate-300">N/A</span>
          <span className="text-sm text-slate-400">Property is not currently tenanted</span>
        </div>
      </div>
    )
  }

  const grossGood = yieldResult.grossYield >= 5
  const netGood = yieldResult.netYield >= 3

  return (
    <div
      className="animate-slide-up rounded-2xl border border-slate-100 bg-white p-5 flex flex-col gap-4 shadow-sm"
      style={style}
    >
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Rental Yield</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-400">Gross yield</span>
          <span className={`text-2xl font-bold ${grossGood ? 'text-green-800' : 'text-slate-700'}`}>
            {formatPercent(yieldResult.grossYield)}
          </span>
          <span className="text-xs text-slate-400">before expenses</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-400">Net yield</span>
          <span className={`text-2xl font-bold ${netGood ? 'text-green-800' : 'text-slate-700'}`}>
            {formatPercent(yieldResult.netYield)}
          </span>
          <span className="text-xs text-slate-400">after expenses</span>
        </div>
      </div>

      <p className="text-xs text-slate-400 border-t border-slate-50 pt-2">
        {yieldResult.grossYield >= 6
          ? 'Strong yield — this property earns well relative to its value.'
          : yieldResult.grossYield >= 4
          ? 'Moderate yield — typical for most Australian investment properties.'
          : 'Below-average yield — consider if capital growth offsets lower income.'}
      </p>
    </div>
  )
}

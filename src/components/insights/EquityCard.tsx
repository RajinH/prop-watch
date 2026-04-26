'use client'

import type { EquityResult } from '@/engine/types'
import { formatCurrencyShort, formatLVR } from '@/lib/formatters'

interface Props {
  equity: EquityResult
  style?: React.CSSProperties
}

const categoryLabel = {
  low: 'Strong',
  medium: 'Moderate',
  high: 'High LVR',
}

const categoryColor = {
  low: 'text-green-800',
  medium: 'text-amber-700',
  high: 'text-red-700',
}

const barColor = {
  low: 'bg-green-600',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
}

export default function EquityCard({ equity, style }: Props) {
  return (
    <div
      className="animate-slide-up rounded-2xl border border-slate-100 bg-white p-5 flex flex-col gap-4 shadow-sm"
      style={style}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Equity & LVR</h3>
        <span className={`text-xs font-semibold ${categoryColor[equity.lvrCategory]}`}>
          {categoryLabel[equity.lvrCategory]}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-3xl font-bold text-slate-900">
          {formatCurrencyShort(equity.equityAmount)}
        </span>
        <span className="text-sm text-slate-400">equity held</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>LVR</span>
          <span className="font-medium text-slate-700">{formatLVR(equity.lvr)}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor[equity.lvrCategory]}`}
            style={{ width: `${Math.min(100, equity.lvr)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-300">
          <span>0%</span>
          <span className="text-amber-400">80%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  )
}

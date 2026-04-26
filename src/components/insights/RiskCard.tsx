'use client'

import type { RiskResult } from '@/engine/types'

interface Props {
  risk: RiskResult
  style?: React.CSSProperties
}

const levelConfig = {
  low: { label: 'Low Risk', bg: 'bg-green-50', border: 'border-green-100', badge: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  moderate: { label: 'Moderate Risk', bg: 'bg-amber-50', border: 'border-amber-100', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  high: { label: 'High Risk', bg: 'bg-orange-50', border: 'border-orange-100', badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  critical: { label: 'Critical Risk', bg: 'bg-red-50', border: 'border-red-100', badge: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
}

const severityDot = {
  positive: 'bg-green-500',
  neutral: 'bg-slate-300',
  warning: 'bg-amber-400',
  critical: 'bg-red-500',
}

export default function RiskCard({ risk, style }: Props) {
  const config = levelConfig[risk.level]

  return (
    <div
      className={`animate-slide-up rounded-2xl border p-5 flex flex-col gap-4 shadow-sm ${config.bg} ${config.border}`}
      style={style}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Risk Assessment</h3>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${config.badge}`}>
          {config.label}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {risk.factors.map((factor) => (
          <div key={factor.label} className="flex gap-3">
            <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${severityDot[factor.severity]}`} />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-slate-800">{factor.label}</span>
              <span className="text-xs text-slate-500">{factor.description}</span>
            </div>
          </div>
        ))}
        {risk.factors.length === 0 && (
          <p className="text-sm text-slate-500">No significant risk factors detected.</p>
        )}
      </div>
    </div>
  )
}

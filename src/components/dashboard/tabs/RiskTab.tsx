'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import type { RiskProfile, SensitivityResult, PortfolioSnapshotInsert } from '@/lib/propwatch/engine/types'

interface InsightRow {
  id: string
  type: string
  severity: string
  title: string
  description: string
  impact: number | null
  metadata: Record<string, unknown>
}

interface Props {
  riskProfile: RiskProfile
  sensitivity: SensitivityResult
  portfolioSnapshot: PortfolioSnapshotInsert
  insights: InsightRow[]
}

const LABEL_STYLES: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  moderate: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
  critical: 'bg-red-200 text-red-800',
}

const SCORE_COLOR = (score: number) => {
  if (score >= 76) return 'bg-red-500'
  if (score >= 51) return 'bg-red-400'
  if (score >= 26) return 'bg-amber-400'
  return 'bg-green-500'
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  interest_rate: 'Sensitivity to rate rises based on portfolio LVR',
  cashflow: 'Depth of negative gearing relative to portfolio size',
  concentration: 'Exposure to a single dominant property',
  liquidity: 'Ability to service debt or refinance at current LVR',
}

const STRESS_TYPES = new Set(['rate_sensitivity', 'lvr_high', 'cashflow_negative', 'lvr_moderate'])

export default function RiskTab({ riskProfile, sensitivity, portfolioSnapshot: snap, insights }: Props) {
  const stressInsights = insights.filter((i) => STRESS_TYPES.has(i.type))

  // Generate sensitivity line chart data (client-side, no API)
  const lineData = Array.from({ length: 11 }, (_, i) => {
    const rateDelta = i * 0.5
    const additionalCost = snap.total_debt * (rateDelta / 100) / 12
    const projected = snap.monthly_cashflow - additionalCost
    return { rate: `+${rateDelta.toFixed(1)}%`, cashflow: Math.round(projected) }
  })

  const categories: { key: keyof RiskProfile; label: string }[] = [
    { key: 'interest_rate', label: 'Interest Rate Risk' },
    { key: 'cashflow', label: 'Cashflow Risk' },
    { key: 'concentration', label: 'Concentration Risk' },
    { key: 'liquidity', label: 'Liquidity Risk' },
  ]

  return (
    <div className="flex flex-col gap-8">
      {/* Risk score hero */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Overall Risk Score</p>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-6xl font-black text-slate-900">{riskProfile.overall}</span>
              <span className="text-2xl text-slate-400 font-light">/100</span>
            </div>
          </div>
          <span className={`rounded-full px-4 py-1.5 text-sm font-bold capitalize ${LABEL_STYLES[riskProfile.label] ?? 'bg-slate-100 text-slate-600'}`}>
            {riskProfile.label}
          </span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${SCORE_COLOR(riskProfile.overall)}`}
            style={{ width: `${riskProfile.overall}%` }}
          />
        </div>
        <p className="text-xs text-slate-400">Lower is better. Scored across rate exposure, cashflow, concentration, and liquidity.</p>
      </div>

      {/* Risk category cards */}
      <div className="grid grid-cols-2 gap-3">
        {categories.map(({ key, label }) => {
          const score = riskProfile[key] as number
          return (
            <div key={key} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col gap-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-slate-900">{score}</span>
                <span className="text-xs text-slate-400">/100</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${SCORE_COLOR(score)}`} style={{ width: `${score}%` }} />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{CATEGORY_DESCRIPTIONS[key]}</p>
            </div>
          )
        })}
      </div>

      {/* Sensitivity stat cards */}
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-3">Sensitivity thresholds</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SensitivityCard
            label="Rate breakeven"
            value={sensitivity.rate_breakeven_pct !== null ? `+${sensitivity.rate_breakeven_pct.toFixed(2)}%` : null}
            description="Interest rate rise to turn cash flow negative"
          />
          <SensitivityCard
            label="Vacancy breakeven"
            value={sensitivity.vacancy_breakeven_weeks !== null ? `${sensitivity.vacancy_breakeven_weeks.toFixed(1)} weeks` : null}
            description="Weeks of vacancy until portfolio goes negative"
          />
          <SensitivityCard
            label="Expense shock"
            value={sensitivity.expense_shock_pct !== null ? `+${sensitivity.expense_shock_pct.toFixed(0)}%` : null}
            description="Expense increase to turn cash flow negative"
          />
        </div>
      </div>

      {/* Sensitivity line chart */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-1">Cashflow vs interest rate</p>
        <p className="text-xs text-slate-400 mb-4">How your monthly cashflow changes as rates rise from current levels</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={lineData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="rate" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [`$${Number(v).toFixed(0)}/mo`, 'Cashflow']} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Break-even', position: 'right', fontSize: 10, fill: '#ef4444' }} />
            <Line type="monotone" dataKey="cashflow" stroke="#166534" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stress indicators */}
      {stressInsights.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-slate-700">Stress indicators</p>
          {stressInsights.map((i) => (
            <div key={i.id} className={`rounded-xl border px-4 py-3 flex flex-col gap-0.5 ${i.severity === 'critical' ? 'bg-red-50 border-red-200' : i.severity === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-sm font-semibold text-slate-800">{i.title}</p>
              <p className="text-sm text-slate-500">{i.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SensitivityCard({ label, value, description }: { label: string; value: string | null; description: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col gap-1">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-black ${value === null ? 'text-red-600' : 'text-slate-900'}`}>
        {value ?? 'Already negative'}
      </p>
      <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
    </div>
  )
}

'use client'

import {
  Building2,
  Landmark,
  PiggyBank,
  Gauge,
  Banknote,
  Percent,
  type LucideIcon,
} from 'lucide-react'
import type {
  Property,
  PortfolioSnapshotInsert,
  PropertySnapshot,
  AfterTaxCashflow,
  PropertyRank,
} from '@/lib/propwatch/engine/types'
import { buildDecisionSurface } from '@/lib/propwatch/engine/decisionSurface'
import type { InvestorGoal, RunChanges } from '@/lib/propwatch/decision/types'
import DecisionSurface from '@/components/dashboard/DecisionSurface'
import PortfolioBreakdown from '@/components/dashboard/PortfolioBreakdown'
import NextBestActionCard from '@/components/decision/NextBestActionCard'
import AlternativeActionRow from '@/components/decision/AlternativeActionRow'
import GoalPromptCard from '@/components/decision/GoalPromptCard'
import DecisionBriefCard from '@/components/decision/DecisionBriefCard'
import type { RecommendationRow } from '@/components/decision/types'

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
  portfolioSnapshot: PortfolioSnapshotInsert
  properties: Property[]
  propertySnapshots: Record<string, PropertySnapshot>
  afterTaxCashflow: AfterTaxCashflow | null
  rankedProperties: PropertyRank[]
  insights: InsightRow[]
  goal: InvestorGoal | null
  recommendations: RecommendationRow[]
  brief: RunChanges | null
}

function fmt(n: number) {
  return '$' + Math.abs(n).toLocaleString('en-AU', { maximumFractionDigits: 0 })
}

function pct(n: number | null) {
  return n !== null ? (n * 100).toFixed(1) + '%' : '—'
}

type HealthCard = {
  label: string
  value: string
  icon: LucideIcon
  tone: 'neutral' | 'good' | 'warn' | 'bad'
  sub: string | null
}

const TONE_STYLES: Record<HealthCard['tone'], { value: string; icon: string }> = {
  neutral: { value: 'text-slate-900', icon: 'bg-slate-100 text-slate-500' },
  good: { value: 'text-green-700', icon: 'bg-green-100 text-green-600' },
  warn: { value: 'text-amber-600', icon: 'bg-amber-100 text-amber-600' },
  bad: { value: 'text-red-600', icon: 'bg-red-100 text-red-600' },
}

export default function PortfolioTab({
  portfolioSnapshot: snap,
  properties,
  propertySnapshots,
  afterTaxCashflow,
  rankedProperties,
  insights,
  goal,
  recommendations,
  brief,
}: Props) {
  const lvr = snap.weighted_lvr
  const lvrTone: HealthCard['tone'] =
    lvr === null ? 'neutral' : lvr >= 0.8 ? 'bad' : lvr >= 0.65 ? 'warn' : 'good'
  const cashflowNegative = snap.monthly_cashflow < 0
  const yieldGood = snap.yield !== null && snap.yield >= 0.04

  const healthCards: HealthCard[] = [
    {
      label: 'Estimated Value',
      value: fmt(snap.total_value),
      icon: Building2,
      tone: 'neutral',
      sub: null,
    },
    {
      label: 'Total Debt',
      value: fmt(snap.total_debt),
      icon: Landmark,
      tone: 'neutral',
      sub: null,
    },
    {
      label: 'Estimated Equity',
      value: fmt(snap.total_equity),
      icon: PiggyBank,
      tone: 'good',
      sub:
        snap.total_value > 0
          ? `${((snap.total_equity / snap.total_value) * 100).toFixed(0)}% of value`
          : null,
    },
    {
      label: 'Portfolio LVR',
      value: pct(lvr),
      icon: Gauge,
      tone: lvrTone,
      sub:
        lvr === null
          ? null
          : lvr >= 0.8
            ? 'Above 80% — high'
            : lvr >= 0.65
              ? 'Elevated'
              : 'Comfortable',
    },
    {
      label: 'Monthly Cashflow',
      value: (snap.monthly_cashflow >= 0 ? '+' : '-') + fmt(snap.monthly_cashflow),
      icon: Banknote,
      tone: cashflowNegative ? 'bad' : 'good',
      sub:
        afterTaxCashflow && cashflowNegative
          ? `After-tax: -${fmt(afterTaxCashflow.after_tax_monthly_cashflow)} (~${fmt(afterTaxCashflow.monthly_tax_saving)}/mo tax saving at ${(afterTaxCashflow.tax_bracket * 100).toFixed(0)}%)`
          : cashflowNegative
            ? 'Out of pocket'
            : 'Surplus',
    },
    {
      label: 'Gross Yield',
      value: pct(snap.yield),
      icon: Percent,
      tone: yieldGood ? 'good' : 'neutral',
      sub: yieldGood ? 'Above 4% target' : 'Below 4% target',
    },
  ]

  const dimensions = buildDecisionSurface(insights)

  // The primary recommendation is rank 1 only when the engine marked it
  // eligible to lead; blocked/low-confidence actions stay in alternatives.
  const primary = recommendations.find((rec) => rec.payload?.primary_eligible) ?? null
  const alternatives = recommendations
    .filter((rec) => rec.id !== primary?.id)
    .slice(0, 2)

  return (
    <div className="flex flex-col gap-8">
      {/* Section 1 — Portfolio health cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {healthCards.map((card) => {
          const tone = TONE_STYLES[card.tone]
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {card.label}
                </p>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone.icon}`}
                >
                  <Icon size={15} />
                </span>
              </div>
              <p className={`mt-1.5 text-2xl font-black ${tone.value}`}>{card.value}</p>
              {card.sub && <p className="mt-0.5 text-xs text-slate-400">{card.sub}</p>}
            </div>
          )
        })}
      </div>

      {/* Section 2 — Decision intelligence: brief, next best action, alternatives */}
      <DecisionBriefCard changes={brief} />
      {!goal && <GoalPromptCard />}
      {primary && <NextBestActionCard key={primary.id} recommendation={primary} />}
      {alternatives.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {primary ? 'Alternatives' : 'Actions needing input'}
          </p>
          {alternatives.map((rec) => (
            <AlternativeActionRow key={rec.id} recommendation={rec} />
          ))}
        </div>
      )}

      {/* Section 3 — Portfolio breakdown */}
      <PortfolioBreakdown
        portfolioSnapshot={snap}
        properties={properties}
        propertySnapshots={propertySnapshots}
        rankedProperties={rankedProperties}
      />

      {/* Section 4 — Supporting signals (demoted decision dimensions) */}
      {dimensions.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Supporting signals
          </p>
          <DecisionSurface dimensions={dimensions} />
        </div>
      )}
    </div>
  )
}

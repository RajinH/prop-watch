'use client'

import { useState } from 'react'
import { ChevronDown, Hourglass } from 'lucide-react'
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
import YourPositionCard from '@/components/dashboard/YourPositionCard'
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
  const cashflowNegative = snap.monthly_cashflow < 0
  const yieldGood = snap.yield !== null && snap.yield >= 0.04

  // Debt and equity are two parts of one bar, so the split IS the LVR. Clamped
  // because a property can be worth less than it owes, which would otherwise
  // push the debt segment past the end of the track.
  const debtShare =
    snap.total_value > 0 ? Math.min(1, Math.max(0, snap.total_debt / snap.total_value)) : 0
  const equityShare = 1 - debtShare
  const underwater = snap.total_equity < 0
  const hasSplit = snap.total_value > 0 && debtShare > 0 && equityShare > 0

  const lvrCaption =
    lvr === null
      ? 'No value on record yet.'
      : lvr >= 0.8
        ? `LVR ${pct(lvr)} — above the 80% ceiling.`
        : lvr >= 0.65
          ? `LVR ${pct(lvr)} — elevated, but under the 80% ceiling.`
          : `LVR ${pct(lvr)} — comfortable, well under the 80% ceiling.`

  // Yield meter: a ratio against a limit, so the 4% target is drawn on the
  // track rather than described in words underneath it.
  const YIELD_TARGET = 0.04
  const yieldPct = snap.yield !== null ? snap.yield * 100 : null
  const yieldMax = Math.max(6, yieldPct !== null ? Math.ceil(yieldPct + 1) : 6)

  const dimensions = buildDecisionSurface(insights)

  // Runway is a drill-down from the cashflow tile: it answers "how long can
  // my cash cover this?", so it opens from the number it explains.
  const [showRunway, setShowRunway] = useState(false)
  const canShowRunway = properties.length > 0

  // The primary recommendation is rank 1 only when the engine marked it
  // eligible to lead; blocked/low-confidence actions stay in alternatives.
  const primary = recommendations.find((rec) => rec.payload?.primary_eligible) ?? null
  const alternatives = recommendations
    .filter((rec) => rec.id !== primary?.id)
    .slice(0, 2)

  return (
    <div className="flex flex-col gap-8">
      {/* Section 1a — Position. Value, debt, equity and LVR are one balance
          sheet (equity = value - debt, LVR = debt / value); as four separate
          tiles the reader had to reassemble that arithmetic. Drawn as a single
          split bar the relationship is the picture, and the view gets the one
          hero figure it was missing. */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Estimated value
        </p>
        <p className="mt-1 text-5xl font-black leading-none text-slate-900">
          {fmt(snap.total_value)}
        </p>

        {snap.total_value > 0 ? (
          <>
            {/* A 2px surface gap separates the segments — never a stroke. */}
            <div className="mt-5 flex h-7 overflow-hidden rounded-lg bg-slate-100">
              <div
                className="h-full bg-[var(--color-series-2)]"
                style={{ width: `${debtShare * 100}%` }}
              />
              {hasSplit && <div className="h-full w-0.5 shrink-0 bg-white" />}
              <div className="h-full flex-1 bg-[var(--color-series-1)]" />
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-4 text-sm">
              <span className="flex items-center gap-2 text-slate-500">
                {/* The swatch is a key to a segment — don't show one for a
                    segment the bar isn't drawing. */}
                {debtShare > 0 && (
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-[var(--color-series-2)]" />
                )}
                Debt
                <span className="font-semibold tabular-nums text-slate-700">
                  {fmt(snap.total_debt)}
                </span>
              </span>
              <span className="flex items-center gap-2 text-slate-500">
                Equity
                <span
                  className={`font-semibold tabular-nums ${underwater ? 'text-red-600' : 'text-slate-700'}`}
                >
                  {underwater ? '-' : ''}
                  {fmt(snap.total_equity)}
                </span>
                {equityShare > 0 && (
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-[var(--color-series-1)]" />
                )}
              </span>
            </div>

            <p
              className={`mt-3 text-xs ${
                underwater || (lvr !== null && lvr >= 0.8)
                  ? 'text-red-600'
                  : lvr !== null && lvr >= 0.65
                    ? 'text-amber-600'
                    : 'text-slate-400'
              }`}
            >
              {underwater ? 'Debt exceeds estimated value.' : lvrCaption}
            </p>
          </>
        ) : (
          <p className="mt-3 text-xs text-slate-400">
            Add a property value to see how your debt and equity split.
          </p>
        )}
      </section>

      {/* Section 1b — Performance. The two numbers that are not part of the
          balance sheet, each shown against the benchmark it is judged by. */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Monthly cashflow
              </p>
              {canShowRunway && (
                <button
                  type="button"
                  onClick={() => setShowRunway((v) => !v)}
                  aria-expanded={showRunway}
                  aria-controls="runway-panel"
                  className={`-mr-1.5 -mt-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors ${
                    showRunway
                      ? 'bg-green-50 text-green-800'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <Hourglass className="h-3.5 w-3.5" aria-hidden />
                  Runway
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${showRunway ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </button>
              )}
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className={`text-2xl font-black ${cashflowNegative ? 'text-red-600' : 'text-green-700'}`}
              >
                {snap.monthly_cashflow >= 0 ? '+' : '-'}
                {fmt(snap.monthly_cashflow)}
              </span>
              <span className="text-xs text-slate-400">gross</span>
            </div>
            {afterTaxCashflow ? (
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={`text-lg font-black ${
                    afterTaxCashflow.after_tax_monthly_cashflow >= 0
                      ? 'text-green-700'
                      : 'text-red-600'
                  }`}
                >
                  {afterTaxCashflow.after_tax_monthly_cashflow >= 0 ? '+' : '-'}
                  {fmt(afterTaxCashflow.after_tax_monthly_cashflow)}
                </span>
                <span className="text-xs text-slate-400">
                  after tax, at {(afterTaxCashflow.tax_bracket * 100).toFixed(0)}%
                </span>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">
                {cashflowNegative ? 'Out of pocket' : 'Surplus'}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Gross yield
            </p>
            <p
              className={`mt-1.5 text-2xl font-black ${yieldGood ? 'text-green-700' : 'text-slate-900'}`}
            >
              {pct(snap.yield)}
            </p>
            {yieldPct !== null ? (
              <>
                <div className="relative mt-3 h-2 rounded-full bg-slate-100">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-seq-3)]"
                    style={{ width: `${Math.min(100, (yieldPct / yieldMax) * 100)}%` }}
                  />
                  <div
                    className="absolute -top-1 -bottom-1 w-0.5 bg-slate-400"
                    style={{ left: `${((YIELD_TARGET * 100) / yieldMax) * 100}%` }}
                    aria-hidden
                  />
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {yieldGood
                    ? `${(yieldPct - YIELD_TARGET * 100).toFixed(1)} points above the 4% target`
                    : `${(YIELD_TARGET * 100 - yieldPct).toFixed(1)} points below the 4% target`}
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-400">Needs rent and value on record.</p>
            )}
          </div>
        </div>

        {/* Kept mounted while collapsed so the cash amount the user typed survives
            closing and reopening the panel. */}
        {canShowRunway && (
          <div id="runway-panel" hidden={!showRunway}>
            <YourPositionCard portfolioSnapshot={snap} properties={properties} />
          </div>
        )}
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

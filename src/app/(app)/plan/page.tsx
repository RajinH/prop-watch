import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import type {
  PortfolioSnapshotInsert,
  ScenarioPropertyOverride,
} from '@/lib/propwatch/engine/types'
import type { RecommendationRow } from '@/components/decision/types'
import ScenariosTab, {
  type ScenarioPreset,
} from '@/components/dashboard/tabs/ScenariosTab'
import PageHero from '@/components/ui/PageHero'
import { CalendarCheck, Info } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Plan',
}

/**
 * Maps a persisted recommendation onto per-property scenario overrides.
 * Values come from the recommendation's stored evidence, assumptions, and
 * impact — no fresh financial modelling happens here.
 */
function presetFromRecommendation(rec: RecommendationRow): ScenarioPreset | null {
  const { assumptions, evidence, impact, copy } = rec.payload
  const propertyId = rec.property_id
  if (!propertyId) return null

  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null

  let override: ScenarioPropertyOverride | null = null
  switch (rec.action_type) {
    case 'review_refinance': {
      const targetRate = num(assumptions.target_rate)
      const repayment = num(evidence.monthly_repayment)
      const monthlyDelta = num(impact.monthly_cashflow_delta)
      if (targetRate === null) return null
      override = {
        interest_rate: targetRate,
        // The refinance cashflow delta is exactly the repayment reduction
        ...(repayment !== null && monthlyDelta !== null
          ? { monthly_repayment: Math.max(0, repayment - monthlyDelta) }
          : {}),
      }
      break
    }
    case 'review_rent': {
      const comparable = num(assumptions.comparable_monthly_rent)
      const current = num(evidence.monthly_rent)
      const capture = num(assumptions.uplift_capture_pct) ?? 1
      if (comparable === null || current === null || comparable <= current) return null
      override = { monthly_rent: current + (comparable - current) * capture }
      break
    }
    case 'pay_down_debt': {
      const lump = num(assumptions.lump_sum)
      const debt = num(evidence.current_debt)
      if (lump === null || debt === null) return null
      override = { current_debt: Math.max(0, debt - lump) }
      break
    }
  }

  return override ? { label: copy.title, propertyOverrides: { [propertyId]: override } } : null
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ rec?: string }>
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!portfolio) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-black text-slate-900">Plan</h1>
        <div className="flex flex-col items-center gap-4 py-20 text-center rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-500">No portfolio yet — add a property to run scenarios.</p>
          <Link
            href="/properties/new"
            className="rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Add your first property →
          </Link>
        </div>
      </div>
    )
  }

  const { data: portfolioSnapRow } = await supabase
    .from('portfolio_snapshots')
    .select('*')
    .eq('portfolio_id', portfolio.id)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const portfolioSnapshot = portfolioSnapRow as PortfolioSnapshotInsert | null

  if (!portfolioSnapshot) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-black text-slate-900">Plan</h1>
        <div className="flex flex-col items-center gap-4 py-20 text-center rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-500">No snapshot data yet — add a property to run scenarios.</p>
          <Link
            href="/properties/new"
            className="rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Add your first property →
          </Link>
        </div>
      </div>
    )
  }

  // Preconfigured launch from a recommendation ("Model in Plan")
  const { rec: recId } = await searchParams
  let initialPreset: ScenarioPreset | null = null
  if (recId) {
    const { data: recommendation } = await supabase
      .from('recommendations')
      .select('*')
      .eq('id', recId)
      .eq('portfolio_id', portfolio.id)
      .maybeSingle()
    if (recommendation) {
      initialPreset = presetFromRecommendation(recommendation as RecommendationRow)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHero
        icon={CalendarCheck}
        eyebrow="Scenarios"
        title="Plan"
        description="Model what-if scenarios to stress-test and shape your next move"
        callout={
          <>
            <Info size={15} className="shrink-0 text-slate-400 mt-0.5" />
            <span>
              Scenarios run live — adjust the inputs below to model how rate hikes, rent shifts, or market corrections affect your portfolio.
            </span>
          </>
        }
      />
      <ScenariosTab portfolioSnapshot={portfolioSnapshot} initialPreset={initialPreset} />
    </div>
  )
}

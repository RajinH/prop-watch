import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { computeRiskScore } from '@/lib/propwatch/engine/computeRiskScore'
import { computeSensitivity } from '@/lib/propwatch/engine/computeSensitivity'
import { generateInsights } from '@/lib/propwatch/engine/generateInsights'
import { computeDebtProjection } from '@/lib/propwatch/engine/computeDebtProjection'
import type {
  Property,
  PortfolioSnapshotInsert,
  PropertySnapshot,
  PropertyDebtProjection,
} from '@/lib/propwatch/engine/types'
import RiskTab from '@/components/dashboard/tabs/RiskTab'
import InsightsTab from '@/components/dashboard/tabs/InsightsTab'
import PageHero from '@/components/ui/PageHero'
import { ShieldAlert } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Risk',
}

export default async function RiskPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id, name')
    .eq('user_id', user.id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!portfolio) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-black text-slate-900">Risk</h1>
        <div className="flex flex-col items-center gap-4 py-20 text-center rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-500">No portfolio yet — add a property to see your risk profile.</p>
          <Link
            href="/onboarding"
            className="rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Add your first property →
          </Link>
        </div>
      </div>
    )
  }

  const [{ data: portfolioSnapRow }, { data: propertiesRaw }] = await Promise.all([
    supabase
      .from('portfolio_snapshots')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('properties')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .order('created_at'),
  ])

  const properties = (propertiesRaw ?? []) as Property[]
  const portfolioSnapshot = portfolioSnapRow as PortfolioSnapshotInsert | null

  let propertySnapshots: Record<string, PropertySnapshot> = {}
  if (properties.length > 0) {
    const { data: propSnaps } = await supabase
      .from('property_snapshots')
      .select('*')
      .in('property_id', properties.map((p) => p.id))
      .order('snapshot_date', { ascending: false })
    for (const snap of propSnaps ?? []) {
      if (!propertySnapshots[snap.property_id]) {
        propertySnapshots[snap.property_id] = snap as PropertySnapshot
      }
    }
  }

  const noData = !portfolioSnapshot || properties.length === 0

  if (noData) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-black text-slate-900">Risk</h1>
        <div className="flex flex-col items-center gap-4 py-20 text-center rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-500">No data yet — add a property to see your risk profile.</p>
          <Link
            href="/onboarding"
            className="rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Add your first property →
          </Link>
        </div>
      </div>
    )
  }

  const riskProfile = computeRiskScore(portfolioSnapshot, properties)
  const sensitivity = computeSensitivity(portfolioSnapshot, properties)
  const debtProjections: PropertyDebtProjection[] = computeDebtProjection(properties)

  const rawInsights = generateInsights(portfolio.id, portfolioSnapshot, properties)
  const insights = rawInsights.map((insight, i) => ({
    id: `live-${i}`,
    type: insight.type,
    severity: insight.severity,
    title: insight.title,
    description: insight.description,
    impact: insight.impact ?? null,
    metadata: insight.metadata ?? {},
  }))

  const RISK_BADGE: Record<string, string> = {
    low: 'bg-green-100 text-green-700',
    moderate: 'bg-amber-100 text-amber-700',
    high: 'bg-red-100 text-red-700',
    critical: 'bg-red-200 text-red-800',
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHero
        icon={ShieldAlert}
        eyebrow="Analysis"
        title="Risk"
        description="Your portfolio's risk exposure, sensitivity, and actionable insights"
        badge={{
          label: `${riskProfile.label.charAt(0).toUpperCase()}${riskProfile.label.slice(1)} Risk`,
          className: RISK_BADGE[riskProfile.label] ?? 'bg-slate-100 text-slate-600',
        }}
        callout={
          <>
            <ShieldAlert size={15} className="shrink-0 text-slate-400 mt-0.5" />
            <span>
              Risk score <strong>{riskProfile.overall}/100</strong> — calculated from LVR, cashflow, interest rate sensitivity, and asset concentration.
            </span>
          </>
        }
      />
      <RiskTab
        riskProfile={riskProfile}
        sensitivity={sensitivity}
        portfolioSnapshot={portfolioSnapshot}
        insights={insights}
        debtProjections={debtProjections}
      />
      <div className="border-t border-slate-200 pt-8">
        <InsightsTab insights={insights} />
      </div>
    </div>
  )
}

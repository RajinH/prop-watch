import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { computeCapitalGrowth } from '@/lib/propwatch/engine/computeCapitalGrowth'
import { computeAcquisitionCapacity } from '@/lib/propwatch/engine/computeAcquisitionCapacity'
import type {
  Property,
  PortfolioSnapshotInsert,
  CapitalGrowthSummary,
  AcquisitionCapacity,
  PortfolioHistoryPoint,
} from '@/lib/propwatch/engine/types'
import GrowthTab from '@/components/dashboard/tabs/GrowthTab'
import PageHero from '@/components/ui/PageHero'
import { TrendingUp } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Growth',
}

export default async function GrowthPage() {
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

  const emptyState = (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-black text-slate-900">Growth</h1>
      <div className="flex flex-col items-center gap-4 py-20 text-center rounded-2xl border border-dashed border-slate-200">
        <p className="text-slate-500">No data yet — add a property to track capital growth.</p>
        <Link
          href="/onboarding"
          className="rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
        >
          Add your first property →
        </Link>
      </div>
    </div>
  )

  if (!portfolio) return emptyState

  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  const sinceDate = twelveMonthsAgo.toISOString().slice(0, 10)

  const [{ data: portfolioSnapRow }, { data: propertiesRaw }, { data: historyRaw }] =
    await Promise.all([
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
      supabase
        .from('portfolio_snapshots')
        .select('snapshot_date,total_value,total_debt,total_equity,monthly_cashflow,weighted_lvr,yield')
        .eq('portfolio_id', portfolio.id)
        .gte('snapshot_date', sinceDate)
        .order('snapshot_date', { ascending: true }),
    ])

  const properties = (propertiesRaw ?? []) as Property[]
  const portfolioSnapshot = portfolioSnapRow as PortfolioSnapshotInsert | null
  const portfolioHistory = (historyRaw ?? []) as PortfolioHistoryPoint[]

  if (!portfolioSnapshot || properties.length === 0) return emptyState

  const capitalGrowth: CapitalGrowthSummary = computeCapitalGrowth(properties)
  const acquisitionCapacity: AcquisitionCapacity = computeAcquisitionCapacity(properties)

  return (
    <div className="flex flex-col gap-8">
      <PageHero
        icon={TrendingUp}
        eyebrow="Analysis"
        title="Growth"
        description="Capital growth, unrealised gains, and equity release capacity"
      />
      <GrowthTab
        capitalGrowth={capitalGrowth}
        acquisitionCapacity={acquisitionCapacity}
        portfolioHistory={portfolioHistory}
      />
    </div>
  )
}

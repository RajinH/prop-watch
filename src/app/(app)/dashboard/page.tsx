import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { generateInsights } from '@/lib/propwatch/engine/generateInsights'
import { computeCapitalGrowth } from '@/lib/propwatch/engine/computeCapitalGrowth'
import { computeAcquisitionCapacity } from '@/lib/propwatch/engine/computeAcquisitionCapacity'
import { computeAfterTaxCashflow } from '@/lib/propwatch/engine/computeAfterTaxCashflow'
import { computeGoalProgress } from '@/lib/propwatch/engine/computeGoalProgress'
import { rankProperties } from '@/lib/propwatch/engine/rankProperties'
import type {
  Property, PortfolioSnapshotInsert, PropertySnapshot,
  CapitalGrowthSummary, AcquisitionCapacity,
  AfterTaxCashflow, GoalProgress, PropertyRank, PortfolioHistoryPoint,
} from '@/lib/propwatch/engine/types'
import DashboardShell from '@/components/dashboard/DashboardShell'

export const metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  await supabase
    .from('profiles')
    .upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true })

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id, name, passive_income_target, income_tax_bracket')
    .eq('user_id', user.id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!portfolio) {
    return (
      <DashboardShell
        user={user}
        portfolioSnapshot={null}
        properties={[]}
        propertySnapshots={{}}
        insights={[]}
        hasPortfolio={false}
        capitalGrowth={null}
        acquisitionCapacity={null}
        afterTaxCashflow={null}
        goalProgress={null}
        taxBracket={0.325}
        rankedProperties={[]}
        portfolioHistory={[]}
      />
    )
  }

  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  const sinceDate = twelveMonthsAgo.toISOString().slice(0, 10)

  const [
    { data: portfolioSnapRow },
    { data: propertiesRaw },
    { data: historyRaw },
  ] = await Promise.all([
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
  const portfolioHistory = (historyRaw ?? []) as PortfolioHistoryPoint[]

  let propertySnapshots: Record<string, PropertySnapshot> = {}
  if (properties.length > 0) {
    const propertyIds = properties.map((p) => p.id)
    const { data: propSnaps } = await supabase
      .from('property_snapshots')
      .select('*')
      .in('property_id', propertyIds)
      .order('snapshot_date', { ascending: false })
    for (const snap of propSnaps ?? []) {
      if (!propertySnapshots[snap.property_id]) {
        propertySnapshots[snap.property_id] = snap as PropertySnapshot
      }
    }
  }

  const portfolioSnapshot = portfolioSnapRow as PortfolioSnapshotInsert | null

  const rawInsights = portfolioSnapshot
    ? generateInsights(portfolio.id, portfolioSnapshot, properties)
    : []
  const insights = rawInsights.map((insight, i) => ({
    id: `live-${i}`,
    type: insight.type,
    severity: insight.severity,
    title: insight.title,
    description: insight.description,
    impact: insight.impact ?? null,
    metadata: insight.metadata ?? {},
  }))

  const capitalGrowth: CapitalGrowthSummary = computeCapitalGrowth(properties)
  const acquisitionCapacity: AcquisitionCapacity = computeAcquisitionCapacity(properties)
  const taxBracket = (portfolio.income_tax_bracket as number | null) ?? 0.325
  const afterTaxCashflow: AfterTaxCashflow | null = portfolioSnapshot
    ? computeAfterTaxCashflow(portfolioSnapshot, properties, taxBracket)
    : null
  const goalProgress: GoalProgress | null = (portfolioSnapshot && portfolio.passive_income_target)
    ? computeGoalProgress(portfolioSnapshot, portfolio.passive_income_target as number)
    : null
  const rankedProperties: PropertyRank[] = rankProperties(properties, propertySnapshots, capitalGrowth.properties)

  return (
    <DashboardShell
      user={user}
      portfolioSnapshot={portfolioSnapshot}
      properties={properties}
      propertySnapshots={propertySnapshots}
      insights={insights}
      hasPortfolio={true}
      capitalGrowth={capitalGrowth}
      acquisitionCapacity={acquisitionCapacity}
      afterTaxCashflow={afterTaxCashflow}
      goalProgress={goalProgress}
      taxBracket={taxBracket}
      rankedProperties={rankedProperties}
      portfolioHistory={portfolioHistory}
    />
  )
}

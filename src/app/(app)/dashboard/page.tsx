import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { generateInsights } from '@/lib/propwatch/engine/generateInsights'
import { computeCapitalGrowth } from '@/lib/propwatch/engine/computeCapitalGrowth'
import { computeAfterTaxCashflow } from '@/lib/propwatch/engine/computeAfterTaxCashflow'
import { rankProperties } from '@/lib/propwatch/engine/rankProperties'
import { rerunDecisionEngineForPortfolio } from '@/lib/propwatch/db/decisionHelpers'
import { DECISION_CONFIG } from '@/lib/propwatch/decision/config'
import type { InvestorGoal, RunChanges } from '@/lib/propwatch/decision/types'
import type {
  Property, PortfolioSnapshotInsert, PropertySnapshot,
  CapitalGrowthSummary,
  AfterTaxCashflow, PropertyRank,
} from '@/lib/propwatch/engine/types'
import type { RecommendationRow } from '@/components/decision/types'
import DashboardShell from '@/components/dashboard/DashboardShell'

/**
 * On-load staleness check (there is no cron infra): run the decision engine
 * when no run exists, the last one is older than the configured window, or a
 * calendar month has rolled over since — the "monthly decision brief" cadence.
 */
function runIsStale(lastRunAt: string | null): boolean {
  if (!lastRunAt) return true
  const last = new Date(lastRunAt)
  const now = new Date()
  const ageHours = (now.getTime() - last.getTime()) / 3_600_000
  if (ageHours > DECISION_CONFIG.stale_run_hours) return true
  return (
    last.getUTCFullYear() !== now.getUTCFullYear() ||
    last.getUTCMonth() !== now.getUTCMonth()
  )
}

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
    .select('id, name, income_tax_bracket')
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
        afterTaxCashflow={null}
        rankedProperties={[]}
        goal={null}
        recommendations={[]}
        brief={null}
      />
    )
  }

  const { data: latestRun } = await supabase
    .from('decision_engine_runs')
    .select('id, created_at, changes')
    .eq('portfolio_id', portfolio.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let brief = (latestRun?.changes as RunChanges | null) ?? null
  if (runIsStale(latestRun?.created_at ?? null)) {
    const { changes } = await rerunDecisionEngineForPortfolio(
      supabase,
      portfolio.id,
      'scheduled'
    )
    if (changes) brief = changes
  }

  const [
    { data: portfolioSnapRow },
    { data: propertiesRaw },
    { data: goalRow },
    { data: recommendationRows },
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
      .from('investor_goals')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .maybeSingle(),
    supabase
      .from('recommendations')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .in('status', ['new', 'viewed', 'investigating'])
      .order('rank', { ascending: true }),
  ])

  const properties = (propertiesRaw ?? []) as Property[]

  const propertySnapshots: Record<string, PropertySnapshot> = {}
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
  const taxBracket = (portfolio.income_tax_bracket as number | null) ?? 0.325
  const afterTaxCashflow: AfterTaxCashflow | null = portfolioSnapshot
    ? computeAfterTaxCashflow(portfolioSnapshot, properties, taxBracket)
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
      afterTaxCashflow={afterTaxCashflow}
      rankedProperties={rankedProperties}
      goal={(goalRow as InvestorGoal | null) ?? null}
      recommendations={(recommendationRows ?? []) as RecommendationRow[]}
      brief={brief}
    />
  )
}

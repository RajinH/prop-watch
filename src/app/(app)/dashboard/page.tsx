import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { computeRiskScore } from '@/lib/propwatch/engine/computeRiskScore'
import { computeSensitivity } from '@/lib/propwatch/engine/computeSensitivity'
import type { Property, PortfolioSnapshotInsert, PropertySnapshot } from '@/lib/propwatch/engine/types'
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
    .select('id, name')
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
        riskProfile={null}
        sensitivity={null}
        hasPortfolio={false}
      />
    )
  }

  const [
    { data: portfolioSnapRow },
    { data: propertiesRaw },
    { data: insightsRaw },
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
      .from('insights')
      .select('id, type, severity, title, description, impact, metadata')
      .eq('portfolio_id', portfolio.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  ])

  const properties = (propertiesRaw ?? []) as Property[]

  // Fetch latest property snapshots for each property
  let propertySnapshots: Record<string, PropertySnapshot> = {}
  if (properties.length > 0) {
    const propertyIds = properties.map((p) => p.id)
    const today = new Date().toISOString().slice(0, 10)
    const { data: propSnaps } = await supabase
      .from('property_snapshots')
      .select('*')
      .in('property_id', propertyIds)
      .eq('snapshot_date', today)
    for (const snap of propSnaps ?? []) {
      propertySnapshots[snap.property_id] = snap as PropertySnapshot
    }
  }

  const portfolioSnapshot = portfolioSnapRow as PortfolioSnapshotInsert | null
  const insights = insightsRaw ?? []

  const riskProfile = portfolioSnapshot
    ? computeRiskScore(portfolioSnapshot, properties)
    : null

  const sensitivity = portfolioSnapshot
    ? computeSensitivity(portfolioSnapshot, properties)
    : null

  return (
    <DashboardShell
      user={user}
      portfolioSnapshot={portfolioSnapshot}
      properties={properties}
      propertySnapshots={propertySnapshots}
      insights={insights}
      riskProfile={riskProfile}
      sensitivity={sensitivity}
      hasPortfolio={true}
    />
  )
}

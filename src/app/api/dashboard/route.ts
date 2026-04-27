import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { resolvePortfolio } from '@/lib/propwatch/db/resolvePortfolio'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getAuthUser } from '@/lib/propwatch/api/getAuthUser'

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 0,
  warning: 1,
  positive: 2,
  info: 3,
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const user = await getAuthUser(supabase, request)
  if (!user) return err('Unauthorized', 401)

  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('Failed to resolve portfolio', 500)

  // Fetch all data in parallel
  const [portfolioSnapResult, propertiesResult, insightsResult] = await Promise.all([
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
      .order('created_at', { ascending: true }),
    supabase
      .from('insights')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  ])

  const properties = propertiesResult.data ?? []
  const propertyIds = properties.map((p) => p.id)

  // Fetch latest snapshot per property (deduplicated in JS)
  let propertySnapshots: Record<string, unknown> = {}
  if (propertyIds.length > 0) {
    const { data: allSnaps } = await supabase
      .from('property_snapshots')
      .select('*')
      .in('property_id', propertyIds)
      .order('snapshot_date', { ascending: false })

    // Keep first (latest) snapshot per property_id
    for (const snap of allSnaps ?? []) {
      if (!(snap.property_id in propertySnapshots)) {
        propertySnapshots[snap.property_id] = snap
      }
    }
  }

  // Sort insights by severity priority
  const insights = (insightsResult.data ?? []).sort(
    (a, b) =>
      (SEVERITY_WEIGHT[a.severity] ?? 99) - (SEVERITY_WEIGHT[b.severity] ?? 99)
  )

  return ok({
    portfolio: { id: portfolio.id, name: portfolio.name },
    portfolioSnapshot: portfolioSnapResult.data ?? null,
    properties,
    propertySnapshots,
    insights,
  })
}

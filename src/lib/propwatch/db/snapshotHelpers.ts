import type { SupabaseClient } from '@supabase/supabase-js'
import type { Property, PropertySnapshotInsert, PortfolioSnapshotInsert, InsightInsert } from '../engine/types'
import { computePropertySnapshot } from '../engine/computePropertySnapshot'
import { computePortfolioSnapshot } from '../engine/computePortfolioSnapshot'
import { generateInsights } from '../engine/generateInsights'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function upsertPropertySnapshot(
  supabase: SupabaseClient,
  property: Property
): Promise<void> {
  const snap: PropertySnapshotInsert = computePropertySnapshot(property, today())
  await supabase
    .from('property_snapshots')
    .upsert(snap, { onConflict: 'property_id,snapshot_date' })
}

export async function upsertPortfolioSnapshot(
  supabase: SupabaseClient,
  portfolioId: string,
  properties: Property[]
): Promise<PortfolioSnapshotInsert> {
  const snap = computePortfolioSnapshot(portfolioId, properties, today())
  await supabase
    .from('portfolio_snapshots')
    .upsert(snap, { onConflict: 'portfolio_id,snapshot_date' })
  return snap
}

export async function refreshInsights(
  supabase: SupabaseClient,
  portfolioId: string,
  portfolioSnap: PortfolioSnapshotInsert,
  properties: Property[]
): Promise<void> {
  const insights: InsightInsert[] = generateInsights(portfolioId, portfolioSnap, properties)

  await supabase
    .from('insights')
    .delete()
    .eq('portfolio_id', portfolioId)
    .eq('status', 'active')

  if (insights.length > 0) {
    await supabase.from('insights').insert(
      insights.map((i) => ({ ...i, metadata: i.metadata ?? {} }))
    )
  }
}

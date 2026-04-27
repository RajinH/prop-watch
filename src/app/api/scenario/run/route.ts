import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { resolvePortfolio } from '@/lib/propwatch/db/resolvePortfolio'
import { runScenario } from '@/lib/propwatch/engine/runScenario'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getAuthUser } from '@/lib/propwatch/api/getAuthUser'
import type { Property, PortfolioSnapshotInsert } from '@/lib/propwatch/engine/types'

const scenarioRunSchema = z.object({
  assumptions: z.object({
    interestRateDeltaPercent: z.number().min(-10).max(10).optional(),
    rentDeltaPercent: z.number().min(-50).max(50).optional(),
    expenseDeltaPercent: z.number().min(-50).max(50).optional(),
    valueDeltaPercent: z.number().min(-50).max(50).optional(),
  }),
})

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const user = await getAuthUser(supabase, request)
  if (!user) return err('Unauthorized', 401)

  const body = await request.json()
  const parsed = scenarioRunSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('Failed to resolve portfolio', 500)

  // Fetch latest portfolio snapshot
  const { data: portfolioSnap } = await supabase
    .from('portfolio_snapshots')
    .select('*')
    .eq('portfolio_id', portfolio.id)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!portfolioSnap) return err('No portfolio snapshot found. Add properties first.', 404)

  // Fetch all current properties
  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .eq('portfolio_id', portfolio.id)

  const { result, delta, insights } = runScenario(
    portfolioSnap as PortfolioSnapshotInsert,
    (properties ?? []) as Property[],
    parsed.data.assumptions
  )

  return ok({ result, delta, insights })
}

import { resolvePortfolio } from '@/lib/propwatch/db/resolvePortfolio'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('Failed to resolve portfolio', 500)

  const [{ data: run }, { data: deferred }] = await Promise.all([
    supabase
      .from('decision_engine_runs')
      .select('id, engine_version, snapshot_date, trigger, changes, baseline, created_at')
      .eq('portfolio_id', portfolio.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('recommendations')
      .select('id, action_type, property_id, status, deferred_until, payload')
      .eq('portfolio_id', portfolio.id)
      .eq('status', 'deferred')
      .order('deferred_until', { ascending: true }),
  ])

  return ok({
    run: run ?? null,
    changes: run?.changes ?? null,
    deferred: deferred ?? [],
  })
}

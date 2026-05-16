import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'
import { ok, err } from '@/lib/propwatch/api/respond'

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const { data: portfolio } = await supabase
    .from('portfolios').select('id').eq('user_id', user.id)
    .order('created_at').limit(1).maybeSingle()
  if (!portfolio) return err('No portfolio', 404)

  const url = new URL(request.url)
  const months = Math.min(parseInt(url.searchParams.get('months') ?? '12'), 60)

  const since = new Date()
  since.setMonth(since.getMonth() - months)

  const { data: history } = await supabase
    .from('portfolio_snapshots')
    .select('snapshot_date,total_value,total_debt,total_equity,monthly_cashflow,weighted_lvr,yield')
    .eq('portfolio_id', portfolio.id)
    .gte('snapshot_date', since.toISOString().slice(0, 10))
    .order('snapshot_date', { ascending: true })

  return ok({ history: history ?? [] })
}

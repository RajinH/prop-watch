import { resolvePortfolio } from '@/lib/propwatch/db/resolvePortfolio'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'

const VALID_STATUSES = new Set([
  'new',
  'viewed',
  'investigating',
  'deferred',
  'dismissed',
  'completed',
  'expired',
])

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('Failed to resolve portfolio', 500)

  const statusParam = new URL(request.url).searchParams.get('status')
  if (statusParam && !VALID_STATUSES.has(statusParam)) return err('Invalid status', 400)

  let query = supabase
    .from('recommendations')
    .select('*')
    .eq('portfolio_id', portfolio.id)

  if (statusParam) {
    query = query.eq('status', statusParam)
  }

  const { data: recommendations } = await query.order('rank', {
    ascending: true,
    nullsFirst: false,
  })

  return ok({ recommendations: recommendations ?? [] })
}

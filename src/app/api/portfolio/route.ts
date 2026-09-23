import { resolvePortfolio } from '@/lib/propwatch/db/resolvePortfolio'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithPaidUser } from '@/lib/propwatch/access/getAccess'

export async function GET(request: Request) {
  const { supabase, user, access } = await getSupabaseWithPaidUser(request)
  if (!user) return err('Unauthorized', 401)
  if (!access.hasAccess) return err('Subscription required', 402)

  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('Failed to resolve portfolio', 500)

  return ok({ portfolio })
}

import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { resolvePortfolio } from '@/lib/propwatch/db/resolvePortfolio'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getAuthUser } from '@/lib/propwatch/api/getAuthUser'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const user = await getAuthUser(supabase, request)
  if (!user) return err('Unauthorized', 401)

  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('Failed to resolve portfolio', 500)

  return ok({ portfolio })
}

import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithPaidUser } from '@/lib/propwatch/access/getAccess'
import { htagPropertyEstimates } from '@/lib/propwatch/htag/server'

export async function GET(request: Request) {
  const { user, access } = await getSupabaseWithPaidUser(request)
  if (!user) return err('Unauthorized', 401)
  if (!access.hasAccess) return err('Subscription required', 402)

  const address_key = new URL(request.url).searchParams.get('address_key')?.trim() ?? ''
  if (!address_key) return err('address_key is required', 400)

  try {
    return ok(await htagPropertyEstimates(address_key))
  } catch {
    return err('Estimates lookup failed', 502)
  }
}

import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithPaidUser } from '@/lib/propwatch/access/getAccess'
import { htagPropertyEstimates } from '@/lib/propwatch/htag/server'
import { metered, usageDenied } from '@/lib/propwatch/usage/server'

export async function GET(request: Request) {
  const { user, access } = await getSupabaseWithPaidUser(request)
  if (!user) return err('Unauthorized', 401)
  if (!access.hasAccess) return err('Subscription required', 402)

  const address_key = new URL(request.url).searchParams.get('address_key')?.trim() ?? ''
  if (!address_key) return err('address_key is required', 400)

  try {
    const result = await metered(user.id, 'htag', '/property/estimates', () =>
      htagPropertyEstimates(address_key)
    )
    return result.ok ? ok(result.data) : usageDenied(result.reason)
  } catch {
    return err('Estimates lookup failed', 502)
  }
}

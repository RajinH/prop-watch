import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithPaidUser } from '@/lib/propwatch/access/getAccess'
import { htagGeocodeAddress } from '@/lib/propwatch/htag/server'
import { metered, usageDenied } from '@/lib/propwatch/usage/server'

export async function GET(request: Request) {
  const { user, access } = await getSupabaseWithPaidUser(request)
  if (!user) return err('Unauthorized', 401)
  if (!access.hasAccess) return err('Subscription required', 402)

  const address = new URL(request.url).searchParams.get('address')?.trim() ?? ''
  if (!address) return err('address is required', 400)

  try {
    const result = await metered(user.id, 'htag', '/address/geocode', () =>
      htagGeocodeAddress(address)
    )
    return result.ok ? ok(result.data) : usageDenied(result.reason)
  } catch {
    return err('Address resolution failed', 502)
  }
}

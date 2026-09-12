import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithPaidUser } from '@/lib/propwatch/access/getAccess'
import { checkifyAutocomplete, type CheckifyCountry } from '@/lib/propwatch/checkify/server'

export async function GET(request: Request) {
  const { user, access } = await getSupabaseWithPaidUser(request)
  if (!user) return err('Unauthorized', 401)
  if (!access.hasAccess) return err('Subscription required', 402)

  const searchParams = new URL(request.url).searchParams
  const query = (searchParams.get('query') ?? '').trim()
  const country = (searchParams.get('country') === 'nz' ? 'nz' : 'au') as CheckifyCountry

  // Checkify requires at least 3 characters; return an empty map below that.
  if (query.length < 3) return ok({})

  try {
    return ok(await checkifyAutocomplete(query, country))
  } catch {
    return err('Address lookup failed', 502)
  }
}

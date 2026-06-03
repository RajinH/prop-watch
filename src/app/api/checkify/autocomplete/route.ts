import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'
import { checkifyAutocomplete, type CheckifyCountry } from '@/lib/propwatch/checkify/server'

export async function GET(request: Request) {
  const { user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

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

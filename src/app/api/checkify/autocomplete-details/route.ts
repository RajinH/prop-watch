import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithPaidUser } from '@/lib/propwatch/access/getAccess'
import { checkifyAutocompleteDetails, type CheckifyCountry } from '@/lib/propwatch/checkify/server'

export async function GET(request: Request) {
  const { user, access } = await getSupabaseWithPaidUser(request)
  if (!user) return err('Unauthorized', 401)
  if (!access.hasAccess) return err('Subscription required', 402)

  const searchParams = new URL(request.url).searchParams
  const id = (searchParams.get('id') ?? '').trim()
  const country = (searchParams.get('country') === 'nz' ? 'nz' : 'au') as CheckifyCountry

  if (!id) return err('id is required', 400)

  try {
    return ok(await checkifyAutocompleteDetails(id, country))
  } catch {
    return err('Address lookup failed', 502)
  }
}

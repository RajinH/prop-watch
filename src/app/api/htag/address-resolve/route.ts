import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'
import { htagGeocodeAddress } from '@/lib/propwatch/htag/server'

export async function GET(request: Request) {
  const { user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const address = new URL(request.url).searchParams.get('address')?.trim() ?? ''
  if (!address) return err('address is required', 400)

  try {
    return ok(await htagGeocodeAddress(address))
  } catch {
    return err('Address resolution failed', 502)
  }
}

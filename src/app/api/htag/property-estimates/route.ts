import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'
import { htagPropertyEstimates } from '@/lib/propwatch/htag/server'

export async function GET(request: Request) {
  const { user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const address_key = new URL(request.url).searchParams.get('address_key')?.trim() ?? ''
  if (!address_key) return err('address_key is required', 400)

  try {
    return ok(await htagPropertyEstimates(address_key))
  } catch {
    return err('Estimates lookup failed', 502)
  }
}

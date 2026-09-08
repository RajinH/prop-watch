import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'
import { geocodeAddress } from '@/lib/propwatch/osm/server'

/**
 * Backfill a property's coordinates from its stored address.
 *
 * Properties added through the wizard get coordinates from Checkify at address
 * selection, so this only serves rows saved before that existed. It writes
 * latitude/longitude and nothing else — coordinates are display-only, so
 * unlike the other property writes this deliberately does NOT re-run snapshots,
 * insights, or the decision engine.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const { id } = await params

  // RLS scopes this to the caller's own portfolios, so a foreign id reads as
  // missing rather than leaking that it exists.
  const { data: property } = await supabase
    .from('properties')
    .select('id, unit, street, city, postcode, state, latitude, longitude')
    .eq('id', id)
    .maybeSingle()

  if (!property) return err('Property not found', 404)

  // Already resolved — hand back what we have instead of spending a request.
  if (property.latitude != null && property.longitude != null) {
    return ok({ latitude: property.latitude, longitude: property.longitude })
  }

  let point
  try {
    point = await geocodeAddress(property)
  } catch {
    return err('Geocoding failed', 502)
  }

  // No match is an ordinary outcome for new estates and rural addresses. Report
  // it as success-with-no-result so the card can settle into its placeholder
  // rather than treating it as an error worth retrying.
  if (!point) return ok(null)

  const { error: updateErr } = await supabase
    .from('properties')
    .update({ latitude: point.latitude, longitude: point.longitude })
    .eq('id', id)

  if (updateErr) return err('Failed to save coordinates', 500)

  return ok({ latitude: point.latitude, longitude: point.longitude })
}

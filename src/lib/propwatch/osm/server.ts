// Server-only: Nominatim requires an identifying User-Agent and enforces a
// strict rate limit, neither of which can be honoured from the browser. Only
// route handlers import this.
//
// Scope note: this exists solely to backfill coordinates for properties saved
// before we captured them from Checkify. It is NOT an autocomplete backend —
// Nominatim's usage policy explicitly prohibits type-ahead search, and address
// suggestions stay with Checkify, whose AU/NZ dataset also resolves the unit
// numbers OSM often lacks.
//
// Policy: https://operations.osmfoundation.org/policies/nominatim/

const BASE_URL = 'https://nominatim.openstreetmap.org'

/**
 * Nominatim requires a genuine contact address in the User-Agent so they can
 * reach the operator of a misbehaving client. Configurable so deployments
 * identify themselves rather than inheriting a stale default.
 */
function userAgent(): string {
  const contact = process.env.NOMINATIM_CONTACT_EMAIL
  return contact ? `PropWatch/1.0 (${contact})` : 'PropWatch/1.0'
}

/**
 * Nominatim allows at most one request per second, and a portfolio of
 * un-geocoded properties renders many cards at once — each firing a backfill.
 * Every outbound call is funnelled through this promise chain so they queue
 * instead of arriving as a burst.
 *
 * This is per-process, so it holds for a single server instance but not across
 * horizontally-scaled ones. That is an acceptable bound: backfills are one-shot
 * per property and stop entirely once coordinates are stored.
 */
const MIN_REQUEST_INTERVAL_MS = 1100
let gate: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0

function throttle<T>(task: () => Promise<T>): Promise<T> {
  const run = gate.then(async () => {
    const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastRequestAt = Date.now()
    return task()
  })
  // Keep the chain alive even if this task rejects, so one failure doesn't
  // wedge every queued caller behind it.
  gate = run.catch(() => undefined)
  return run
}

export interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

export interface GeocodedPoint {
  latitude: number
  longitude: number
  displayName: string
}

/** Address parts as stored on a property row. */
export interface AddressParts {
  unit?: string | null
  street?: string | null
  city?: string | null
  postcode?: string | null
  state?: string | null
}

/**
 * Build a free-text query from the stored address parts.
 *
 * The unit number is deliberately left out: OSM rarely holds sub-dwelling
 * detail, and including it tends to fail the match outright rather than
 * degrade to the building. The street-level point is what the map wants anyway.
 */
export function buildQuery(parts: AddressParts): string | null {
  const segments = [parts.street, parts.city, parts.state, parts.postcode]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)

  // A bare suburb or postcode geocodes to something plausible but meaningless
  // for a specific dwelling, so require a street before spending the request.
  if (!parts.street?.trim() || segments.length < 2) return null

  return [...segments, 'Australia'].join(', ')
}

/**
 * Forward-geocode a single address. Returns null when Nominatim has no match,
 * which is a normal outcome for newer estates and rural addresses.
 */
export async function geocodeAddress(parts: AddressParts): Promise<GeocodedPoint | null> {
  const query = buildQuery(parts)
  if (!query) return null

  const url = new URL(`${BASE_URL}/search`)
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('addressdetails', '0')
  // Bias to AU/NZ, matching the markets the product serves.
  url.searchParams.set('countrycodes', 'au,nz')

  const res = await throttle(() =>
    fetch(url, {
      headers: {
        'User-Agent': userAgent(),
        'Accept-Language': 'en-AU',
      },
      // Nominatim asks that results be cached rather than re-queried. We persist
      // the coordinates on the property row, so this only ever runs once per
      // property; the fetch cache is a second line of defence.
      next: { revalidate: 60 * 60 * 24 * 30 },
    })
  )

  if (!res.ok) throw new Error(`Nominatim request failed (${res.status})`)

  const results = (await res.json()) as NominatimResult[]
  const first = results[0]
  if (!first) return null

  const latitude = Number(first.lat)
  const longitude = Number(first.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  return { latitude, longitude, displayName: first.display_name }
}

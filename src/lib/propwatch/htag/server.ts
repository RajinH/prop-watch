// Server-only: this module reads HTAG_API_KEY and is only imported by route handlers.
// HTAG_API_KEY is intentionally not NEXT_PUBLIC_, so it is never bundled into client code.

const BASE_URL = 'https://api.htagai.com/v1'

export interface HtagGeocodedAddress {
  address_key: string
  address_label: string
  /**
   * Documented as a similarity score, but /address/geocode returns null for
   * every candidate in practice. Match structurally instead — see
   * `htag/matchAddress.ts`.
   */
  score: number | null
}

export interface HtagGeocodeResult {
  results: HtagGeocodedAddress[]
  total: number
}

export interface HtagPropertyEstimates {
  address_key: string
  price_estimate: number | null
  rent_estimate: number | null
  last_sold_price: number | null
  last_sold_date: string | null
  last_rented_price: number | null
  last_rented_date: string | null
}

export interface HtagEstimatesResult {
  results: HtagPropertyEstimates[]
}

function getApiKey(): string {
  const key = process.env.HTAG_API_KEY
  if (!key) throw new Error('HTAG_API_KEY is not set')
  return key
}

/**
 * Query params for an HTAG call. Array values are repeated rather than joined —
 * the market endpoints take `area_id` as an array, and one request covering many
 * localities is billed identically to many requests (billing is per row).
 */
export type HtagParams = Record<string, string | string[]>

/** Per-call billing and timing, parsed from the response headers HTAG returns. */
export interface HtagCallMeta {
  path: string
  /** Amount charged for this request, in AUD. */
  cost: number | null
  /** Account balance in AUD after this deduction. */
  balance: number | null
  /** Billable units counted — rows, addresses or properties, endpoint-dependent. */
  units: number | null
  tier: string | null
  freeRemaining: number | null
  freeGranted: number | null
  ms: number
}

function num(v: string | null): number | null {
  if (v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function htagRequest<T>(
  path: string,
  params: HtagParams
): Promise<{ data: T; meta: HtagCallMeta }> {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) for (const item of v) url.searchParams.append(k, item)
    else url.searchParams.set(k, v)
  }

  const startedAt = Date.now()
  const res = await fetch(url, {
    headers: { 'x-api-key': getApiKey() },
  })
  const ms = Date.now() - startedAt

  if (!res.ok) {
    // Non-2xx responses are not charged, so a failed call costs nothing but the
    // round trip. Surface the status so callers can tell a bad request from an
    // outage.
    throw new Error(`HTAG request failed (${res.status})`)
  }

  const meta: HtagCallMeta = {
    path,
    cost: num(res.headers.get('x-billing-cost')),
    balance: num(res.headers.get('x-billing-balance')),
    units: num(res.headers.get('x-billing-units')),
    tier: res.headers.get('x-billing-tier'),
    freeRemaining: num(res.headers.get('x-billing-free-remaining')),
    freeGranted: num(res.headers.get('x-billing-free-granted')),
    ms,
  }
  // Serialised into the message rather than passed as a second argument: Next's
  // dev file logger only captures the first console argument, so an object
  // payload reaches the terminal but is written to the log as `{}`.
  console.log(`[htag:billing] ${JSON.stringify(meta)}`)

  return { data: (await res.json()) as T, meta }
}

/**
 * Call any HTAG endpoint and get its billing metadata back alongside the body.
 * Use this when you need to account for spend; shipping features that just need
 * the data should prefer a typed wrapper below.
 */
export async function htagGetWithMeta<T>(
  path: string,
  params: HtagParams
): Promise<{ data: T; meta: HtagCallMeta }> {
  return htagRequest<T>(path, params)
}

async function htagGet<T>(path: string, params: HtagParams): Promise<T> {
  return (await htagRequest<T>(path, params)).data
}

/** Geocode a free-text address to get candidate address_keys with similarity scores. */
export function htagGeocodeAddress(address: string): Promise<HtagGeocodeResult> {
  return htagGet<HtagGeocodeResult>('/address/geocode', { address })
}

/** Fetch price/rent estimates and transaction history for a resolved address_key. */
export function htagPropertyEstimates(address_key: string): Promise<HtagEstimatesResult> {
  return htagGet<HtagEstimatesResult>('/property/estimates', { address_key })
}

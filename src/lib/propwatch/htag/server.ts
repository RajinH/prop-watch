// Server-only: this module reads HTAG_API_KEY and is only imported by route handlers.
// HTAG_API_KEY is intentionally not NEXT_PUBLIC_, so it is never bundled into client code.

const BASE_URL = 'https://api.htagai.com/v1'

export interface HtagGeocodedAddress {
  address_key: string
  address_label: string
  score: number
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

async function htagGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url, {
    headers: { 'x-api-key': getApiKey() },
  })

  if (!res.ok) {
    throw new Error(`HTAG request failed (${res.status})`)
  }

  const billing = {
    cost: res.headers.get('x-billing-cost'),
    balance: res.headers.get('x-billing-balance'),
    units: res.headers.get('x-billing-units'),
    tier: res.headers.get('x-billing-tier'),
    freeRemaining: res.headers.get('x-billing-free-remaining'),
    freeGranted: res.headers.get('x-billing-free-granted'),
  }
  console.log('[htag:billing]', { path, ...billing })

  return res.json() as Promise<T>
}

/** Geocode a free-text address to get candidate address_keys with similarity scores. */
export function htagGeocodeAddress(address: string): Promise<HtagGeocodeResult> {
  return htagGet<HtagGeocodeResult>('/address/geocode', { address })
}

/** Fetch price/rent estimates and transaction history for a resolved address_key. */
export function htagPropertyEstimates(address_key: string): Promise<HtagEstimatesResult> {
  return htagGet<HtagEstimatesResult>('/property/estimates', { address_key })
}

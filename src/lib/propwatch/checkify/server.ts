// Server-only: this module reads CHECKIFY_API_KEY and is only imported by route handlers.
// CHECKIFY_API_KEY is intentionally not NEXT_PUBLIC, so it is never bundled into client code.

const BASE_URL = 'https://checkify.com.au/api/v1'

export type CheckifyCountry = 'au' | 'nz'

/** Map of stable address IDs -> highlighted HTML strings, as returned by /autocomplete. */
export type CheckifySuggestions = Record<string, string>

/** Full structured record from /autocomplete-details. */
export interface CheckifyAddressDetails {
  unit: string | null
  level: string | null
  unitLevel: string | null
  streetNumber: string | null
  streetName: string | null
  streetType: string | null
  street: string | null
  city: string | null
  postcode: string | null
  state: string | null
  stateFull: string | null
  region: string | null
  country: string | null
  countryFull: string | null
  latitude: number | null
  longitude: number | null
  meshBlockCode: string | null
  buildingName: string | null
}

function getApiKey(): string {
  const key = process.env.CHECKIFY_API_KEY
  if (!key) throw new Error('CHECKIFY_API_KEY is not set')
  return key
}

async function checkifyGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  })

  if (!res.ok) {
    throw new Error(`Checkify request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

/** Type-ahead address search. `query` must be at least 3 characters. */
export function checkifyAutocomplete(
  query: string,
  country: CheckifyCountry = 'au'
): Promise<CheckifySuggestions> {
  return checkifyGet<CheckifySuggestions>('/autocomplete', { query, country })
}

/** Fetch the full structured record for an address ID returned by autocomplete. */
export function checkifyAutocompleteDetails(
  id: string,
  country: CheckifyCountry = 'au'
): Promise<CheckifyAddressDetails> {
  return checkifyGet<CheckifyAddressDetails>('/autocomplete-details', { id, country })
}

// Pure address-matching helpers for HTAG geocode results.
//
// Deliberately free of server-only imports (no API key, no fetch) so the client
// wizard and any server route can share one definition of "is this the right
// property".

/** A candidate row from HTAG's /address/geocode `results` array. */
export interface HtagAddressCandidate {
  address_key: string
  address_label: string
  /**
   * HTAG documents a similarity score but returns null for every candidate in
   * practice. Never gate on it — see matchesAddress.
   */
  score?: number | null
  number_first?: string | null
  street_name?: string | null
  locality_name?: string | null
  postcode?: string | null
  loc_pid?: string | null
  lga_pid?: string | null
  sa2_code21?: string | null
}

/** The address we are trying to match against, as held on a property. */
export interface AddressLike {
  street: string
  city: string
  postcode: string
}

const norm = (v: string | null | undefined) =>
  (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Splits "4 FOURTH AVENUE" into its leading number and the remainder. */
export function splitStreet(street: string): { number: string; name: string } {
  const trimmed = (street ?? '').trim()
  const number = trimmed.match(/^(\d+[A-Za-z]?)/)?.[1] ?? ''
  return { number, name: trimmed.replace(/^\d+[A-Za-z]?\s*/, '') }
}

/**
 * Whether an HTAG candidate is the same dwelling as `address`.
 *
 * Structural rather than score-based: /address/geocode returns `score: null` on
 * every candidate, so the documented `score >= 0.8` test can never pass and
 * would reject even an exact match. Comparing the structured fields is both
 * reliable and stricter — HTAG returns ten same-street candidates for a typical
 * query, and only one has the right street number.
 *
 * HTAG splits "FOURTH AVENUE" into street_name "Fourth" + street_type "Avenue",
 * so the stored street is matched by prefix rather than equality.
 */
export function matchesAddress(
  candidate: HtagAddressCandidate | undefined,
  address: AddressLike
): boolean {
  if (!candidate) return false
  const { number, name } = splitStreet(address.street)
  if (number === '' || name === '') return false
  return (
    norm(candidate.postcode) === norm(address.postcode) &&
    norm(candidate.locality_name) === norm(address.city) &&
    norm(candidate.number_first) === norm(number) &&
    norm(name).startsWith(norm(candidate.street_name)) &&
    norm(candidate.street_name).length > 0
  )
}

/**
 * Pick the unambiguous match from a candidate list, or null when there isn't
 * one. Returns null if two candidates both match, so the caller can ask the user
 * rather than guessing.
 */
export function resolveAddressMatch(
  candidates: HtagAddressCandidate[],
  address: AddressLike
): HtagAddressCandidate | null {
  const matches = candidates.filter((c) => matchesAddress(c, address))
  return matches.length === 1 ? matches[0] : null
}

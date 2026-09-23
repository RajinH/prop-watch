// Offline stand-ins for the two HTAG endpoints the product calls, so the property
// wizard can be exercised in development without spending credit.
//
// Enabled with HTAG_MOCK=1, and never in production (see isHtagMockEnabled).
// Pure: no fetch, no API key, so it is unit-testable alongside matchAddress.
//
// The geocode mock echoes the address it is given back as a structured
// candidate, plus a decoy on the same street, the way real HTAG returns several
// same-street rows. Addresses it can't parse return no candidates, the same as
// an address HTAG doesn't know.

import type { HtagAddressCandidate } from './matchAddress'

export function isHtagMockEnabled(): boolean {
  return process.env.HTAG_MOCK === '1' && process.env.NODE_ENV !== 'production'
}

// Last word of an Australian street name. Used to find where the street ends
// and the suburb begins in free text, since both can be several words long.
const STREET_TYPES = new Set([
  'STREET', 'ST', 'ROAD', 'RD', 'AVENUE', 'AVE', 'AV', 'DRIVE', 'DR', 'COURT', 'CT',
  'CRESCENT', 'CRES', 'PLACE', 'PL', 'LANE', 'LN', 'PARADE', 'PDE', 'WAY', 'CLOSE',
  'CL', 'TERRACE', 'TCE', 'BOULEVARD', 'BVD', 'HIGHWAY', 'HWY', 'CIRCUIT', 'CCT',
  'GROVE', 'GR', 'ESPLANADE', 'ESP', 'SQUARE', 'SQ', 'RISE', 'VIEW', 'WALK',
])

interface ParsedAddress {
  number: string
  streetName: string
  streetType: string
  locality: string
  state: string
  postcode: string
}

const key = (...parts: string[]) => parts.join('').toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * Parses the wizard's address text: `[unit/ ]<number> <street> <type> <suburb>
 * <STATE> <postcode> Australia`. Returns null when the shape doesn't fit.
 */
export function parseMockAddress(text: string): ParsedAddress | null {
  const tokens = text.trim().split(/\s+/).filter((t) => !/^[^/]*\/$/.test(t))
  if (tokens.at(-1)?.toUpperCase() === 'AUSTRALIA') tokens.pop()

  const postcode = tokens.pop() ?? ''
  const state = tokens.pop() ?? ''
  const number = tokens.shift() ?? ''
  if (!/^\d{4}$/.test(postcode) || !/^\d+[A-Za-z]?$/.test(number)) return null

  let typeIdx = -1
  tokens.forEach((t, i) => {
    if (STREET_TYPES.has(t.toUpperCase()) && i > 0 && i < tokens.length - 1) typeIdx = i
  })
  if (typeIdx === -1) return null

  return {
    number,
    streetName: tokens.slice(0, typeIdx).join(' '),
    streetType: tokens[typeIdx],
    locality: tokens.slice(typeIdx + 1).join(' '),
    state: state.toUpperCase(),
    postcode,
  }
}

// score is always present (as null) on real responses, matching HtagGeocodedAddress.
type MockCandidate = HtagAddressCandidate & { score: null }

function candidateFor(a: ParsedAddress, number: string): MockCandidate {
  const upper = (s: string) => s.toUpperCase()
  return {
    address_key: key(number, a.streetName, a.streetType, a.locality, a.state, a.postcode),
    address_label: `${number} ${upper(a.streetName)} ${upper(a.streetType)}, ${upper(a.locality)} ${a.state} ${a.postcode}`,
    score: null,
    number_first: number,
    street_name: a.streetName,
    locality_name: a.locality,
    postcode: a.postcode,
    // Prefixed so mock rows are obvious if they end up in a local database.
    loc_pid: `MOCK-${a.state}${a.postcode}`,
  }
}

export function mockGeocode(address: string): { results: MockCandidate[]; total: number } {
  const parsed = parseMockAddress(address)
  if (!parsed) return { results: [], total: 0 }

  const decoy = candidateFor(parsed, `${parsed.number}0`)
  const results = [candidateFor(parsed, parsed.number), decoy]
  return { results, total: results.length }
}

/** Deterministic 0..1 from a string, so the same property always gets the same figures. */
function unit(seed: string): number {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return (h >>> 0) / 0xffffffff
}

export function mockEstimates(address_key: string) {
  const u = unit(address_key)
  const price = Math.round((600_000 + u * 600_000) / 1000) * 1000
  const soldYear = 2012 + Math.floor(u * 10)
  return {
    results: [
      {
        address_key,
        price_estimate: price,
        // Weekly, as HTAG reports rent.
        rent_estimate: Math.round((price * 0.038) / 52 / 5) * 5,
        last_sold_price: Math.round((price * 0.7) / 1000) * 1000,
        last_sold_date: `${soldYear}-06-15`,
        last_rented_price: null,
        last_rented_date: null,
      },
    ],
  }
}

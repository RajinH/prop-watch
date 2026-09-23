import { describe, it, expect, afterEach, vi } from 'vitest'
import { isHtagMockEnabled, mockEstimates, mockGeocode, parseMockAddress } from '../mock'
import { resolveAddressMatch } from '../matchAddress'

// The wizard's buildAddressText output for a form holding these fields.
const WIZARD_TEXT = '4 Fourth Avenue Toukley NSW 2263 Australia'
const FIELDS = { street: '4 Fourth Avenue', city: 'Toukley', postcode: '2263' }

describe('mockGeocode', () => {
  it('returns a candidate the wizard auto-matches, plus a same-street decoy', () => {
    const { results } = mockGeocode(WIZARD_TEXT)
    expect(results).toHaveLength(2)
    const match = resolveAddressMatch(results, FIELDS)
    expect(match?.address_key).toBe('4FOURTHAVENUETOUKLEYNSW2263')
    expect(match?.loc_pid).toBe('MOCK-NSW2263')
  })

  it('handles multi-word streets and suburbs and ignores the unit prefix', () => {
    const { results } = mockGeocode('12/ 7 Mount Street North Sydney NSW 2060 Australia')
    const match = resolveAddressMatch(results, {
      street: '7 Mount Street',
      city: 'North Sydney',
      postcode: '2060',
    })
    expect(match?.locality_name).toBe('North Sydney')
  })

  it('returns nothing for text it cannot parse', () => {
    expect(parseMockAddress('somewhere vague')).toBeNull()
    expect(mockGeocode('somewhere vague').results).toEqual([])
  })
})

describe('mockEstimates', () => {
  it('is deterministic per address and plausible', () => {
    const a = mockEstimates('4FOURTHAVENUETOUKLEYNSW2263').results[0]
    expect(mockEstimates('4FOURTHAVENUETOUKLEYNSW2263').results[0]).toEqual(a)
    expect(a.price_estimate).toBeGreaterThanOrEqual(600_000)
    expect(a.price_estimate).toBeLessThanOrEqual(1_200_000)
    expect(a.last_sold_price).toBeLessThan(a.price_estimate)
  })
})

describe('isHtagMockEnabled', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is on only when HTAG_MOCK=1 outside production', () => {
    vi.stubEnv('HTAG_MOCK', '1')
    vi.stubEnv('NODE_ENV', 'development')
    expect(isHtagMockEnabled()).toBe(true)
    vi.stubEnv('NODE_ENV', 'production')
    expect(isHtagMockEnabled()).toBe(false)
    vi.stubEnv('HTAG_MOCK', '')
    vi.stubEnv('NODE_ENV', 'development')
    expect(isHtagMockEnabled()).toBe(false)
  })
})

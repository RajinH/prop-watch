import { describe, it, expect } from 'vitest'
import {
  normaliseCode,

  generateAccessCode,
  hashAccessCode,
  isPlausibleCode,
} from '../codes'

const PEPPER = 'test-pepper'

describe('normaliseCode', () => {
  it('strips formatting and uppercases', () => {
    expect(normaliseCode('k7pq-3m9x-rt2vw')).toBe('K7PQ3M9XRT2VW')
    expect(normaliseCode('  K7PQ 3M9X RT2VW  ')).toBe('K7PQ3M9XRT2VW')
  })

  it('maps visually ambiguous characters to their intended digit', () => {
    expect(normaliseCode('IL0O1')).toBe('11001')
  })

  it('is idempotent', () => {
    const once = normaliseCode('k7pq-3m9x-rt2vw')
    expect(normaliseCode(once)).toBe(once)
  })
})

describe('generateAccessCode', () => {
  it('produces 13 alphabet characters, formatted 4-4-5', () => {
    const code = generateAccessCode()
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{5}$/)
    expect(normaliseCode(code)).toHaveLength(13)
  })

  it('never emits the excluded letters I, L, O or U', () => {
    const codes = Array.from({ length: 500 }, generateAccessCode).join('')
    expect(codes).not.toMatch(/[ILOU]/)
  })

  it('does not repeat across many draws', () => {
    const codes = new Set(Array.from({ length: 1000 }, generateAccessCode))
    expect(codes.size).toBe(1000)
  })
})

describe('hashAccessCode', () => {
  it('is stable across equivalent spellings of the same code', () => {
    const a = hashAccessCode('k7pq-3m9x-rt2vw', PEPPER)
    const b = hashAccessCode('K7PQ3M9XRT2VW', PEPPER)
    expect(a).toBe(b)
  })

  it('returns hex, as the redeem function expects', () => {
    expect(hashAccessCode('K7PQ3M9XRT2VW', PEPPER)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('differs under a different pepper', () => {
    const a = hashAccessCode('K7PQ3M9XRT2VW', PEPPER)
    const b = hashAccessCode('K7PQ3M9XRT2VW', 'other-pepper')
    expect(a).not.toBe(b)
  })

  it('refuses to hash when no pepper is configured', () => {
    expect(() => hashAccessCode('K7PQ3M9XRT2VW', undefined)).toThrow(/ACCESS_CODE_PEPPER/)
  })
})

describe('isPlausibleCode', () => {
  it('accepts a generated code', () => {
    expect(isPlausibleCode(generateAccessCode())).toBe(true)
  })

  it('rejects wrong lengths and out-of-alphabet characters', () => {
    expect(isPlausibleCode('TOO-SHORT')).toBe(false)
    expect(isPlausibleCode('K7PQ3M9XRT2VWEXTRA')).toBe(false)
    expect(isPlausibleCode('UUUUUUUUUUUUU')).toBe(false)
  })
})

describe('hash golden vector', () => {
  // Pins the exact normalisation + HMAC construction. scripts/mint-access-code.mjs
  // reimplements this by hand (it is not bundled, so it cannot import from src/).
  // If this test fails, that script must be updated in lockstep or previously
  // minted codes stop matching.
  it('matches the recorded digest', () => {
    expect(hashAccessCode('ilo1-2345-6789A', 'golden-pepper')).toBe(
      'ae6b59508672e7bbf361915024d5a566af894d38ecc04ae5e2af32f29d76d4c0'
    )
  })
})

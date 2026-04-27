import { describe, it, expect } from 'vitest'
import { round2, safeDiv, formatMoney } from '../money'

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    // 1.005 is stored as 1.00499... in IEEE 754, so it rounds down — use a stable example
    expect(round2(1.555)).toBe(1.56)
    expect(round2(1.554)).toBe(1.55)
    expect(round2(100)).toBe(100)
  })

  it('handles negative numbers', () => {
    expect(round2(-1.005)).toBe(-1)
    expect(round2(-1.006)).toBe(-1.01)
  })
})

describe('safeDiv', () => {
  it('divides normally', () => {
    expect(safeDiv(10, 2)).toBe(5)
    expect(safeDiv(1, 3)).toBeCloseTo(0.333, 3)
  })

  it('returns null when denominator is 0', () => {
    expect(safeDiv(0, 0)).toBeNull()
    expect(safeDiv(100, 0)).toBeNull()
  })

  it('handles numerator of 0', () => {
    expect(safeDiv(0, 5)).toBe(0)
  })
})

describe('formatMoney', () => {
  it('formats as AUD currency', () => {
    const result = formatMoney(1000)
    expect(result).toContain('1,000')
  })

  it('handles zero', () => {
    const result = formatMoney(0)
    expect(result).toContain('0')
  })
})

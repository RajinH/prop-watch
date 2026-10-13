import { describe, it, expect } from 'vitest'
import {
  hashString,
  modelHeight,
  modelVariant,
  seededRandom,
  DOOR_COLOURS,
  ROOF_COLOURS,
  UNIT_TRIM_COLOURS,
  WALL_COLOURS,
  type HouseVariant,
} from '../variants'

const ids = Array.from(
  { length: 200 },
  (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
)

describe('seeding', () => {
  it('hashes deterministically', () => {
    expect(hashString('abc')).toBe(hashString('abc'))
    expect(hashString('abc')).not.toBe(hashString('abd'))
  })

  it('produces a repeatable sequence in [0, 1)', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    for (let i = 0; i < 100; i++) {
      const x = a()
      expect(x).toBe(b())
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })
})

describe('modelVariant', () => {
  it('gives a property the same look every time', () => {
    for (const type of ['house', 'townhouse', 'unit', 'land'] as const) {
      expect(modelVariant(type, ids[7])).toEqual(modelVariant(type, ids[7]))
    }
  })

  it('varies houses across a portfolio', () => {
    const houses = ids.map((id) => modelVariant('house', id) as HouseVariant)
    expect(new Set(houses.map((h) => h.form)).size).toBe(3)
    expect(new Set(houses.map((h) => h.wall)).size).toBeGreaterThan(3)
    expect(houses.some((h) => h.garage)).toBe(true)
    expect(houses.some((h) => !h.garage)).toBe(true)
  })

  it('assumes a single-storey house when no storeys are given', () => {
    for (const id of ids) {
      const h = modelVariant('house', id) as HouseVariant
      expect(h.storeys).toBe(1)
      expect(h.form).not.toBe('multiStorey')
    }
  })

  it('builds the storeys given, capped so a tower still fits the island', () => {
    expect(modelVariant('house', ids[0], 1)).toMatchObject({ storeys: 1 })
    expect((modelVariant('house', ids[0], 1) as HouseVariant).form).not.toBe('multiStorey')
    expect(modelVariant('house', ids[0], 2)).toMatchObject({ storeys: 2, form: 'multiStorey' })
    expect(modelVariant('house', ids[0], 9)).toMatchObject({ storeys: 3 })
    expect(modelVariant('townhouse', ids[0], 3)).toMatchObject({ storeys: 3 })
    expect(modelVariant('unit', ids[0], 30)).toMatchObject({ floors: 8 })
    expect(modelVariant('unit', ids[0], 1)).toMatchObject({ floors: 2 })
  })

  it('stands taller with more storeys', () => {
    const h = (n: number) => modelHeight(modelVariant('unit', ids[3], n))
    expect(h(6)).toBeGreaterThan(h(3))
  })

  it('never puts a garage on an L-shaped house', () => {
    for (const id of ids) {
      const h = modelVariant('house', id) as HouseVariant
      if (h.form === 'lShape') expect(h.garage).toBe(false)
    }
  })

  it('only picks colours that exist', () => {
    for (const id of ids) {
      const h = modelVariant('house', id)
      if (h.kind !== 'house') throw new Error('expected a house')
      expect(WALL_COLOURS[h.wall]).toBeDefined()
      expect(ROOF_COLOURS[h.roof]).toBeDefined()
      expect(DOOR_COLOURS[h.door]).toBeDefined()

      const t = modelVariant('townhouse', id)
      if (t.kind !== 'townhouse') throw new Error('expected a townhouse')
      expect(t.walls).toHaveLength(t.units)
      for (const w of t.walls) expect(WALL_COLOURS[w]).toBeDefined()

      const u = modelVariant('unit', id)
      if (u.kind !== 'unit') throw new Error('expected a unit')
      expect(UNIT_TRIM_COLOURS[u.trim]).toBeDefined()
      expect([3, 4, 5, 6]).toContain(u.floors)
    }
  })

  it('keeps shrubs inside the fenced lot', () => {
    for (const id of ids) {
      const l = modelVariant('land', id)
      if (l.kind !== 'land') throw new Error('expected land')
      for (const [x, z] of l.shrubs) {
        expect(Math.abs(x)).toBeLessThanOrEqual(0.8)
        expect(Math.abs(z)).toBeLessThanOrEqual(0.8)
      }
    }
  })
})

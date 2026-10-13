import { describe, it, expect } from 'vitest'
import { coastline, growOutline, insidePolygon } from '../outline'

describe('coastline', () => {
  const sizes: [number, number][] = [
    [0.8, 0.8],
    [1.6, 0.9],
    [2.4, 2.4],
    [3.1, 1.4],
  ]

  it('keeps the whole dry rectangle inside the coast, whatever the seed', () => {
    for (const [w, d] of sizes) {
      for (let seed = 0; seed < 40; seed++) {
        const { points } = coastline(w, d, seed)
        for (const corner of [
          [w, d],
          [-w, d],
          [w, -d],
          [-w, -d],
        ] as [number, number][]) {
          // A hair inside the corner: the base curve passes exactly through it.
          expect(insidePolygon([corner[0] * 0.995, corner[1] * 0.995], points)).toBe(true)
        }
      }
    }
  })

  it('gives the same coast for the same seed, and a different one otherwise', () => {
    expect(coastline(1, 1, 7)).toEqual(coastline(1, 1, 7))
    expect(coastline(1, 1, 7).points).not.toEqual(coastline(1, 1, 8).points)
  })

  it('is not a plain rounded rectangle: the coast wanders', () => {
    const { points } = coastline(1.5, 1.5, 3)
    const radii = points.map(([x, y]) => Math.hypot(x, y))
    // On the axes of a square the base radius is equal; noise must break that.
    const axes = [0, 24, 48, 72].map((i) => radii[i])
    expect(Math.max(...axes) - Math.min(...axes)).toBeGreaterThan(0.01)
  })

  it('reports the furthest reach of the coast', () => {
    const c = coastline(2, 1, 5)
    for (const [x, y] of c.points) expect(Math.hypot(x, y)).toBeLessThanOrEqual(c.radius + 1e-9)
  })

  it('puts trees on dry land outside the plots', () => {
    for (const [w, d] of sizes) {
      const c = coastline(w, d, 11)
      for (const t of c.trees) {
        expect(insidePolygon(t, c.points)).toBe(true)
        expect(Math.abs(t[0]) > w || Math.abs(t[1]) > d).toBe(true)
      }
    }
  })
})

describe('growOutline', () => {
  it('surrounds the outline it grows from, by at least the margin', () => {
    for (let seed = 0; seed < 20; seed++) {
      const coast = coastline(1.6, 1.1, seed)
      const sea = growOutline(coast.points, 0.5, 0.4, seed + 1)
      coast.points.forEach(([x, y], i) => {
        expect(insidePolygon([x, y], sea.points)).toBe(true)
        const [sx, sy] = sea.points[i]
        expect(Math.hypot(sx, sy) - Math.hypot(x, y)).toBeGreaterThanOrEqual(0.5 - 1e-9)
      })
    }
  })

  it('wobbles rather than tracing the coast at a fixed distance', () => {
    const coast = coastline(1.5, 1.5, 4)
    const sea = growOutline(coast.points, 0.5, 0.4, 9)
    const gaps = coast.points.map(([x, y], i) => Math.hypot(...sea.points[i]) - Math.hypot(x, y))
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(0.1)
  })
})

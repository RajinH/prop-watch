import { describe, it, expect } from 'vitest'
import {
  buildIslandScene,
  plotHalf,
  DEFAULT_PLOT_HALF,
  MAX_PLOT_HALF,
  MIN_PLOT_HALF,
  type IslandPropertyInput,
} from '../scene'
import { insidePolygon } from '../outline'
import { toPropertyType } from '../../propertyType'

function prop(
  id: string,
  value: number,
  type: IslandPropertyInput['type'] = 'house',
  debt = 0,
  storeys: number | null = null,
  landArea: number | null = null
): IslandPropertyInput {
  return { id, name: id, address: null, type, storeys, landArea, value, debt, monthlyCashflow: 0 }
}

describe('buildIslandScene', () => {
  it('derives equity and LVR from the facts', () => {
    const [p] = buildIslandScene([prop('a', 800_000, 'house', 600_000)]).plots
    expect(p.equity).toBe(200_000)
    expect(p.lvr).toBeCloseTo(0.75)
  })

  it('has no LVR when there is no value on record', () => {
    const [p] = buildIslandScene([prop('a', 0, 'house', 100_000)]).plots
    expect(p.lvr).toBeNull()
    expect(p.equity).toBe(-100_000)
  })

  it('draws a property of unknown type as a house', () => {
    const [p] = buildIslandScene([prop('a', 500_000, null)]).plots
    expect(p.type).toBe('house')
  })

  it('builds the storeys the owner gave', () => {
    const [p] = buildIslandScene([prop('a', 500_000, 'house', 0, 2)]).plots
    expect(p.variant).toMatchObject({ kind: 'house', storeys: 2, form: 'multiStorey' })
    const [u] = buildIslandScene([prop('b', 500_000, 'unit', 0, 7)]).plots
    expect(u.variant).toMatchObject({ kind: 'unit', floors: 7 })
  })

  it('reports the tallest model, so the camera can frame it', () => {
    const scene = buildIslandScene([prop('a', 1, 'house', 0, 1), prop('b', 1, 'unit', 0, 8)])
    expect(scene.maxHeight).toBe(Math.max(...scene.plots.map((p) => p.height)))
    expect(scene.plots[0].id).toBe('b')
  })

  it('returns an empty island for an empty portfolio', () => {
    const scene = buildIslandScene([])
    expect(scene.plots).toEqual([])
    expect(scene.coast.radius).toBeGreaterThan(0)
  })
})

describe('layout', () => {
  const sizes = Array.from({ length: 14 }, (_, i) => i + 1)

  it('never lets two lawns touch, for any portfolio size', () => {
    for (const n of sizes) {
      const { plots } = buildIslandScene(
        Array.from({ length: n }, (_, i) => prop(`p${i}`, 1_000_000 - i))
      )
      for (let i = 0; i < plots.length; i++) {
        for (let j = i + 1; j < plots.length; j++) {
          const gap = Math.max(Math.abs(plots[i].x - plots[j].x), Math.abs(plots[i].z - plots[j].z))
          expect(gap, `n=${n}`).toBeGreaterThan(plots[i].half + plots[j].half)
        }
      }
    }
  })

  it('puts taller models in the back rows, so none is hidden', () => {
    const types = ['land', 'house', 'unit', 'townhouse'] as const
    for (const n of sizes) {
      const { plots } = buildIslandScene(
        Array.from({ length: n }, (_, i) => prop(`p${i}`, 900_000, types[i % 4]))
      )
      for (const back of plots) {
        for (const front of plots) {
          if (front.cell[0] + front.cell[1] > back.cell[0] + back.cell[1]) {
            expect(front.height, `n=${n}`).toBeLessThanOrEqual(back.height)
          }
        }
      }
    }
  })

  it('keeps every lawn, edge to edge, on dry land', () => {
    for (const n of [1, 3, 7, 12]) {
      const { plots, centre, coast } = buildIslandScene(
        Array.from({ length: n }, (_, i) =>
          prop(`p${i}`, 500_000, 'house', 0, null, [300, 2000, null, 900][i % 4])
        )
      )
      for (const p of plots) {
        for (const [lx, lz] of p.lawn) {
          const point: [number, number] = [p.x + lx - centre[0], p.z + lz - centre[1]]
          expect(insidePolygon(point, coast.points), `n=${n}`).toBe(true)
        }
      }
    }
  })

  it('wraps each square lot in its lawn, so the model never sits on bare ground', () => {
    const { plots } = buildIslandScene(
      [300, 600, 1500, 5000, null].map((a, i) => prop(`p${i}`, 1, 'house', 0, null, a))
    )
    for (const p of plots) {
      for (const [dx, dz] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        expect(insidePolygon([dx * p.half, dz * p.half], p.lawn)).toBe(true)
      }
    }
  })

  it("keeps a portfolio's coastline stable across renders", () => {
    const inputs = [prop('a', 1), prop('b', 2)]
    expect(buildIslandScene(inputs).coast).toEqual(buildIslandScene([...inputs].reverse()).coast)
  })

  it('keeps a stable layout regardless of input order', () => {
    const inputs = [prop('a', 1), prop('b', 3, 'unit'), prop('c', 2), prop('d', 2, 'land')]
    const layout = (list: IslandPropertyInput[]) =>
      buildIslandScene(list).plots.map((p) => [p.id, p.x, p.z])
    expect(layout([...inputs].reverse())).toEqual(layout(inputs))
  })
})

describe('plot size from land area', () => {
  it('draws a typical 600 m² block at the default size', () => {
    expect(plotHalf(600)).toBeCloseTo(DEFAULT_PLOT_HALF)
    expect(plotHalf(null)).toBe(DEFAULT_PLOT_HALF)
  })

  it('scales plot area with land area, within the clamp', () => {
    // Area ratio 1000/700 → side ratio sqrt(1000/700).
    expect(plotHalf(1000) / plotHalf(700)).toBeCloseTo(Math.sqrt(1000 / 700))
    expect(plotHalf(50)).toBe(MIN_PLOT_HALF)
    expect(plotHalf(40_000)).toBe(MAX_PLOT_HALF)
  })

  it('keeps the lawns of mixed plot sizes apart', () => {
    const areas = [300, 4000, 650, 1200, null, 900, 20_000]
    const { plots } = buildIslandScene(
      areas.map((a, i) => prop(`p${i}`, 900_000 - i, 'house', 0, null, a))
    )
    for (let i = 0; i < plots.length; i++) {
      for (let j = i + 1; j < plots.length; j++) {
        const gap = Math.max(Math.abs(plots[i].x - plots[j].x), Math.abs(plots[i].z - plots[j].z))
        expect(gap).toBeGreaterThan(plots[i].half + plots[j].half)
      }
    }
  })
})

describe('toPropertyType', () => {
  it('maps outside classifications onto ours', () => {
    expect(toPropertyType('House')).toBe('house')
    expect(toPropertyType('apartment')).toBe('unit')
    expect(toPropertyType(' townhouse ')).toBe('townhouse')
    expect(toPropertyType('land')).toBe('land')
    expect(toPropertyType('villa')).toBeNull()
    expect(toPropertyType(null)).toBeNull()
  })
})

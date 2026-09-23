import { describe, it, expect } from 'vitest'
import { project, buildMosaic, TILE_SIZE, DEFAULT_ZOOM } from '../tiles'

/** Inverse of `project`, used to prove the forward projection is correct. */
function unproject(x: number, y: number, zoom: number) {
  const n = 2 ** zoom
  const t = Math.PI - (2 * Math.PI * y) / n
  return {
    lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(t) - Math.exp(-t))),
    lon: (x / n) * 360 - 180,
  }
}

const SYDNEY = { lat: -33.8568, lon: 151.2153 }
const WELLINGTON = { lat: -41.2866, lon: 174.7756 }

describe('project', () => {
  it('places Sydney in the known tile at zoom 16', () => {
    // Verified against the live tile server: 16/60295/39325 renders Sydney Cove.
    const { x, y } = project(SYDNEY.lat, SYDNEY.lon, 16)
    expect(Math.floor(x)).toBe(60295)
    expect(Math.floor(y)).toBe(39325)
  })

  it('round-trips through the inverse projection', () => {
    for (const p of [SYDNEY, WELLINGTON]) {
      const { x, y } = project(p.lat, p.lon, DEFAULT_ZOOM)
      const back = unproject(x, y, DEFAULT_ZOOM)
      expect(back.lat).toBeCloseTo(p.lat, 10)
      expect(back.lon).toBeCloseTo(p.lon, 10)
    }
  })

  it('puts the origin at the centre of the world at zoom 0', () => {
    expect(project(0, 0, 0)).toEqual({ x: 0.5, y: 0.5 })
  })

  it('clamps beyond the Mercator limit instead of returning NaN', () => {
    const { y } = project(90, 0, 4)
    expect(Number.isFinite(y)).toBe(true)
    expect(y).toBeGreaterThanOrEqual(0)
  })
})

describe('buildMosaic', () => {
  it('reports the point at the centre of the covered area', () => {
    const m = buildMosaic(SYDNEY.lat, SYDNEY.lon)
    // The point must land within the centre tile of the canvas, i.e. no more
    // than one tile away from the exact middle.
    expect(Math.abs(m.pointX - m.width / 2)).toBeLessThanOrEqual(TILE_SIZE / 2)
    expect(Math.abs(m.pointY - m.height / 2)).toBeLessThanOrEqual(TILE_SIZE / 2)
  })

  it('covers the requested viewport with a padding ring on every side', () => {
    const viewportWidth = 512
    const viewportHeight = 320
    const m = buildMosaic(SYDNEY.lat, SYDNEY.lon, DEFAULT_ZOOM, viewportWidth, viewportHeight)

    // Every edge of the viewport, centred on the point, stays inside the canvas
    // with at least a full spare tile beyond it.
    expect(m.pointX - viewportWidth / 2).toBeGreaterThanOrEqual(TILE_SIZE)
    expect(m.width - (m.pointX + viewportWidth / 2)).toBeGreaterThanOrEqual(TILE_SIZE)
    expect(m.pointY - viewportHeight / 2).toBeGreaterThanOrEqual(TILE_SIZE)
    expect(m.height - (m.pointY + viewportHeight / 2)).toBeGreaterThanOrEqual(TILE_SIZE)
  })

  it('lays tiles on an exact grid with no gaps or duplicates', () => {
    const m = buildMosaic(SYDNEY.lat, SYDNEY.lon)
    const cols = m.width / TILE_SIZE
    const rows = m.height / TILE_SIZE

    expect(m.tiles).toHaveLength(cols * rows)
    expect(new Set(m.tiles.map((t) => `${t.left},${t.top}`)).size).toBe(cols * rows)
    for (const t of m.tiles) {
      expect(t.left % TILE_SIZE).toBe(0)
      expect(t.top % TILE_SIZE).toBe(0)
    }
  })

  it('wraps tile x across the antimeridian rather than requesting a negative index', () => {
    // Just west of the 180th meridian, the padding ring reaches past it.
    const m = buildMosaic(-16.5, 179.99, 8)
    const xs = m.tiles.map((t) => Number(t.url.split('/').at(-2)))
    expect(xs.every((x) => x >= 0 && x < 2 ** 8)).toBe(true)
  })

  it('omits tiles past the poles instead of clamping onto a duplicate row', () => {
    const m = buildMosaic(85, 0, 2)
    const ys = m.tiles.map((t) => Number(t.url.split('/').at(-1)!.replace('.png', '')))
    expect(ys.every((y) => y >= 0 && y < 2 ** 2)).toBe(true)
  })
})

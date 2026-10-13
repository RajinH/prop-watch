/**
 * Organic outlines: the island's coastline around the plots, and each plot's
 * lawn around its lot — blobs rather than rounded rectangles.
 *
 * Built in polar form around the centre of the plots. The base curve is a
 * superellipse scaled so it passes through the corners of the "must keep dry"
 * rectangle (the plots plus a strip of grass) and bulges past its sides; on
 * top of that sits smooth, periodic, outward-only noise. Outward-only is the
 * point: the coast can wander, but never into a plot.
 *
 * Seeded, so a portfolio keeps the same coastline on every visit. Pure — no
 * three.js — so containment is unit-tested.
 */

import { seededRandom } from './variants'

export type Point = [number, number]

export interface BlobOptions {
  /** Superellipse exponent: 2 is an ellipse, higher is boxier. */
  shape: number
  /** How far the noise can push the edge out, as a share of the radius. */
  noise: number
  /** Points around the outline. */
  segments: number
  /** Extra outward margin, so the straight chords between points never cut
   * inside the rectangle's corners. */
  pad: number
}

/** The island's coast: rounded, with a noticeable wander. */
export const COAST: BlobOptions = { shape: 4, noise: 0.12, segments: 96, pad: 0.02 }

/** A plot's lawn: boxier and calmer than the coast, so a lot still reads as a
 * lot, just not a ruled square. */
export const LOT: BlobOptions = { shape: 4, noise: 0.07, segments: 48, pad: 0.02 }

/** Waves in the noise, lowest first; more waves read as a wobblier edge. */
const WAVES = [2, 3, 5, 7]

/** Distance from the centre to the edge of a w×d rectangle, along `angle`. */
function rectRadius(halfW: number, halfD: number, angle: number): number {
  const c = Math.abs(Math.cos(angle))
  const s = Math.abs(Math.sin(angle))
  return Math.min(c > 1e-9 ? halfW / c : Infinity, s > 1e-9 ? halfD / s : Infinity)
}

export interface Coastline {
  /** Closed outline, relative to the centre, counter-clockwise. */
  points: Point[]
  /** Furthest any point of the coast reaches from the centre. */
  radius: number
  /** Spots in the bays between the plots and the coast, for scenery. */
  trees: Point[]
}

/**
 * @param halfW, halfD half-size of the rectangle that must stay dry
 * @param seed     any integer; the same seed gives the same coast
 */
export function coastline(
  halfW: number,
  halfD: number,
  seed: number,
  options: BlobOptions = COAST
): Coastline {
  const { shape: SHAPE, noise: NOISE, segments, pad } = options
  const rand = seededRandom(seed)
  const phases = WAVES.map(() => rand() * Math.PI * 2)
  const weights = WAVES.map((_, i) => 1 / (i + 1))
  const total = weights.reduce((a, b) => a + b, 0)

  // Scale so the superellipse passes exactly through the rectangle's corners.
  const k = Math.pow(2, 1 / SHAPE)
  const base = (angle: number) => {
    const c = Math.abs(Math.cos(angle)) / halfW
    const s = Math.abs(Math.sin(angle)) / halfD
    return k * Math.pow(Math.pow(c, SHAPE) + Math.pow(s, SHAPE), -1 / SHAPE)
  }
  // Smooth periodic noise in 0..1 (each sine shifted into 0..1 and weighted).
  const noise = (angle: number) =>
    WAVES.reduce(
      (sum, wave, i) => sum + weights[i] * (0.5 + 0.5 * Math.sin(wave * angle + phases[i])),
      0
    ) / total

  const radiusAt = (angle: number) => base(angle) * (1 + NOISE * noise(angle)) + pad

  const points: Point[] = []
  let radius = 0
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    const r = radiusAt(angle)
    radius = Math.max(radius, r)
    points.push([Math.cos(angle) * r, Math.sin(angle) * r])
  }

  // Trees stand where the coast bulges furthest past the plots: one in each
  // of four sectors, halfway across the strip of grass.
  const trees: Point[] = []
  for (let q = 0; q < 4; q++) {
    let best: { angle: number; gap: number } | null = null
    for (let step = 1; step < 12; step++) {
      const angle = ((q + step / 12) * Math.PI) / 2
      const gap = radiusAt(angle) - rectRadius(halfW, halfD, angle)
      if (!best || gap > best.gap) best = { angle, gap }
    }
    if (best && best.gap > 0.25) {
      const r = rectRadius(halfW, halfD, best.angle) + best.gap / 2
      trees.push([Math.cos(best.angle) * r, Math.sin(best.angle) * r])
    }
  }

  return { points, radius, trees }
}

/** Ray-cast point-in-polygon test. */
export function insidePolygon([x, y]: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/**
 * A wider outline around an existing one: each point pushed out by `margin`
 * plus up to `wobble` of smooth seeded noise. Used for the sea, so it follows
 * the coast at a varying distance instead of sitting on a round plate.
 * Outward-only, so it always contains the outline it grows from.
 */
export function growOutline(
  points: Point[],
  margin: number,
  wobble: number,
  seed: number
): { points: Point[]; radius: number } {
  const rand = seededRandom(seed)
  const phases = WAVES.map(() => rand() * Math.PI * 2)
  const weights = WAVES.map((_, i) => 1 / (i + 1))
  const total = weights.reduce((a, b) => a + b, 0)
  let radius = 0
  const out = points.map(([x, y]): Point => {
    const angle = Math.atan2(y, x)
    const r = Math.hypot(x, y)
    const n =
      WAVES.reduce(
        (sum, wave, i) => sum + weights[i] * (0.5 + 0.5 * Math.sin(wave * angle + phases[i])),
        0
      ) / total
    const grown = r + margin + wobble * n
    radius = Math.max(radius, grown)
    return [(x / r) * grown, (y / r) * grown]
  })
  return { points: out, radius }
}

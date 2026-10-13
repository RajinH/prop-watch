/**
 * Scene model for the Portfolio Island: the properties you own, drawn as
 * small buildings on one island — a house as a house, a unit as a block, and
 * so on.
 *
 * It is a picture of the portfolio, not a chart: buildings are not scaled by
 * value. The figures (address, value, debt, cashflow) are read on hover. A
 * building's storeys come from the property's `storeys` fact, and its plot is
 * sized by its `land_area` (m²) when known.
 *
 * Everything here is pure — no React, no three.js — so layout is unit-tested
 * and the renderer only paints it.
 */

import type { PropertyType } from '@/lib/propwatch/propertyType'
import { hashString, modelHeight, modelVariant, type ModelVariant } from './variants'
import { coastline, LOT, type Coastline, type Point } from './outline'

export interface IslandPropertyInput {
  id: string
  name: string
  /** One-line address, or null when none is on record. */
  address: string | null
  type: PropertyType | null
  /** Storeys in the building, when the owner has said. */
  storeys: number | null
  /** Land area in m², when known. */
  landArea: number | null
  value: number
  debt: number
  monthlyCashflow: number
}

export interface IslandPlot {
  id: string
  name: string
  address: string | null
  /** The model drawn. Falls back to a house when the type isn't known. */
  type: PropertyType
  /** The model's look: shape, storeys, colours (see variants.ts). */
  variant: ModelVariant
  /** How tall the model stands, roof included, in world units. */
  height: number
  landArea: number | null
  /** Half the lot's side, in world units. The model keeps within this square. */
  half: number
  /** The lawn: an organic outline around the square lot, relative to the
   * plot's centre. Always contains the whole square. */
  lawn: Point[]
  /** Furthest the lawn reaches from the plot's centre. */
  reach: number
  value: number
  debt: number
  equity: number
  /** debt / value, or null when there is no value to measure against. */
  lvr: number | null
  monthlyCashflow: number
  /** Grid cell [column, row]. Rows further back (smaller column + row) hold
   * the taller models, so none hides a shorter one in the default view. */
  cell: [number, number]
  /** Centre of the plot on the island's ground plane. */
  x: number
  z: number
}

export interface IslandScene {
  /** Plots in back-to-front order. */
  plots: IslandPlot[]
  /** Centre of the plots on the ground plane; the coast is drawn around it. */
  centre: [number, number]
  /** The island's coastline (relative to `centre`) and its tree spots. */
  coast: Coastline
  /** Height of the tallest model, so the camera can frame it. */
  maxHeight: number
}

/**
 * Plot size. A typical 600 m² block is drawn at DEFAULT_PLOT_HALF, and the
 * side scales with the square root of the area, so plot area tracks land
 * area. Clamped: below the minimum a house would no longer fit its plot, and
 * above the maximum one acreage would swallow the island — past the cap a
 * plot simply reads as "large".
 */
export const DEFAULT_PLOT_HALF = 0.45
export const MIN_PLOT_HALF = 0.41
export const MAX_PLOT_HALF = 0.8
const TYPICAL_LOT_M2 = 600

/** Lane of grass between neighbouring lawns (their rounded edges add more). */
const PLOT_GAP = 0.12
/** Strip of grass kept dry around the plots; the coast wanders beyond it. */
const DRY_MARGIN = 0.06

export function plotHalf(landArea: number | null): number {
  if (landArea === null || !(landArea > 0)) return DEFAULT_PLOT_HALF
  const half = DEFAULT_PLOT_HALF * Math.sqrt(landArea / TYPICAL_LOT_M2)
  return Math.min(MAX_PLOT_HALF, Math.max(MIN_PLOT_HALF, half))
}

/**
 * Cells of the smallest near-square grid that fits `count` plots, ordered
 * from the back of the island to the front (and, within a row of equal depth,
 * from the centre line outwards).
 */
function cellsBackToFront(count: number): [number, number][] {
  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)
  const cells: [number, number][] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c, r])
  return cells
    .sort(
      ([c1, r1], [c2, r2]) =>
        c1 + r1 - (c2 + r2) || Math.abs(c1 - r1) - Math.abs(c2 - r2) || c1 - c2
    )
    .slice(0, count)
}

export function buildIslandScene(inputs: IslandPropertyInput[]): IslandScene {
  const modelled = inputs.map((p) => {
    const type = p.type ?? 'house'
    const variant = modelVariant(type, p.id, p.storeys)
    const half = plotHalf(p.landArea)
    const lawn = coastline(half, half, hashString(`lot:${p.id}`), LOT)
    return { p, type, variant, height: modelHeight(variant), half, lawn }
  })
  // Tallest models first — so none hides behind a taller one in front of it —
  // then most valuable, then by id so the layout never reshuffles.
  const ranked = modelled.sort(
    (a, b) => b.height - a.height || b.p.value - a.p.value || a.p.id.localeCompare(b.p.id)
  )
  const cells = cellsBackToFront(ranked.length)

  // Each column is as wide, and each row as deep, as the largest lawn in it,
  // so plots of any size line up with at least a lane of grass between lawns.
  const colSize: number[] = []
  const rowSize: number[] = []
  ranked.forEach(({ lawn }, i) => {
    const [c, r] = cells[i]
    colSize[c] = Math.max(colSize[c] ?? 0, 2 * lawn.radius)
    rowSize[r] = Math.max(rowSize[r] ?? 0, 2 * lawn.radius)
  })
  const centres = (sizes: number[]) => {
    const out: number[] = []
    let at = 0
    for (const size of sizes) {
      out.push(at + size / 2)
      at += size + PLOT_GAP
    }
    return out
  }
  const colX = centres(colSize)
  const rowZ = centres(rowSize)

  const plots: IslandPlot[] = ranked.map(({ p, type, variant, height, half, lawn }, i) => {
    const [c, r] = cells[i]
    return {
      id: p.id,
      name: p.name,
      address: p.address,
      type,
      variant,
      height,
      landArea: p.landArea,
      half,
      lawn: lawn.points,
      reach: lawn.radius,
      value: p.value,
      debt: p.debt,
      equity: p.value - p.debt,
      lvr: p.value > 0 ? p.debt / p.value : null,
      monthlyCashflow: p.monthlyCashflow,
      cell: [c, r],
      x: colX[c],
      z: rowZ[r],
    }
  })

  // Keep every lawn — not just every lot — on dry land.
  const minX = plots.length ? Math.min(...plots.map((p) => p.x - p.reach)) : -DEFAULT_PLOT_HALF
  const maxX = plots.length ? Math.max(...plots.map((p) => p.x + p.reach)) : DEFAULT_PLOT_HALF
  const minZ = plots.length ? Math.min(...plots.map((p) => p.z - p.reach)) : -DEFAULT_PLOT_HALF
  const maxZ = plots.length ? Math.max(...plots.map((p) => p.z + p.reach)) : DEFAULT_PLOT_HALF
  // Seeded by who's on the island, so a portfolio keeps its coastline and
  // only reshapes when a property is added or removed.
  const seed = hashString(
    plots
      .map((p) => p.id)
      .sort()
      .join('|')
  )
  return {
    plots,
    centre: [(minX + maxX) / 2, (minZ + maxZ) / 2],
    coast: coastline((maxX - minX) / 2 + DRY_MARGIN, (maxZ - minZ) / 2 + DRY_MARGIN, seed),
    maxHeight: Math.max(0, ...plots.map((p) => p.height)),
  }
}

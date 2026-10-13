/**
 * Per-property look for the Portfolio Island models.
 *
 * Every property of a type would otherwise be drawn identically, so each one
 * gets a variant — shape, extras, colours — picked by a PRNG seeded from its
 * id. Seeding (rather than Math.random) keeps a property looking the same on
 * every visit and on every device, and never ties the look to list order.
 *
 * The variants are decoration only: nothing here encodes a figure.
 */

import type { PropertyType } from '@/lib/propwatch/propertyType'

/** FNV-1a: a small, well-spread 32-bit hash of a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: a seeded PRNG returning floats in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Light-theme colours; the renderer darkens them for the dark theme. Kept
// muted and close in value so the island reads as one place, not confetti.
export const WALL_COLOURS = [
  '#f6f1e7',
  '#e9dcc6',
  '#dfe6ea',
  '#efe3d3',
  '#d9d4c7',
  '#f2e6dc',
] as const
export const ROOF_COLOURS = ['#c96f4a', '#5b6575', '#8a5a44', '#4f6b5a', '#a4553c'] as const
export const DOOR_COLOURS = ['#3f5a73', '#7a3b2e', '#2f4f3e', '#4a4a52', '#9a6b3b'] as const
export const UNIT_TRIM_COLOURS = ['#5b6575', '#8a7f72', '#3f4756', '#6d7b72'] as const

export type HouseForm = 'cottage' | 'hip' | 'lShape' | 'multiStorey'
export type Yard = 'hedge' | 'picket' | 'garden' | 'tree'

export interface HouseVariant {
  kind: 'house'
  form: HouseForm
  /** 1..HOUSE_MAX_STOREYS. Above one storey the form is always 'multiStorey'. */
  storeys: number
  wall: number
  roof: number
  door: number
  garage: boolean
  porch: boolean
  chimney: boolean
  yard: Yard
  /** Draw mirrored left-to-right, so garages and wings fall on either side. */
  mirrored: boolean
}

export interface TownhouseVariant {
  kind: 'townhouse'
  units: 2 | 3 | 4
  /** 1..TOWNHOUSE_MAX_STOREYS */
  storeys: number
  /** Wall colour per unit, left to right. */
  walls: number[]
  roof: number
  door: number
  balconies: boolean
}

export interface UnitVariant {
  kind: 'unit'
  /** UNIT_MIN_FLOORS..UNIT_MAX_FLOORS */
  floors: number
  wall: number
  trim: number
  balconies: boolean
  rooftopGarden: boolean
}

export interface LandVariant {
  kind: 'land'
  /** Shrub positions within the lot, each in -1..1 of the fenced extent. */
  shrubs: [number, number][]
  sign: boolean
}

export type ModelVariant = HouseVariant | TownhouseVariant | UnitVariant | LandVariant

/*
 * Storeys come from the property's `storeys` fact when the owner has given
 * it. Otherwise a house is one storey, a townhouse two, and a unit block is
 * picked like any other variant. Drawn heights are
 * capped so a 30-storey tower still fits the island: past the cap every
 * building reads as "tall", which is all a picture this size can say.
 */
export const HOUSE_MAX_STOREYS = 3
export const TOWNHOUSE_MAX_STOREYS = 3
export const UNIT_MIN_FLOORS = 2
export const UNIT_MAX_FLOORS = 8

/** Storey heights and roof allowances, in world units, shared with models.tsx. */
export const HOUSE_STOREY = 0.27
export const TOWNHOUSE_STOREY = 0.23
export const UNIT_STOREY = 0.19

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)))

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]
}

function index(rand: () => number, length: number): number {
  return Math.floor(rand() * length)
}

export function modelVariant(
  type: PropertyType,
  id: string,
  storeys: number | null = null
): ModelVariant {
  const rand = seededRandom(hashString(`${type}:${id}`))
  const given = storeys !== null && Number.isFinite(storeys) && storeys > 0 ? storeys : null
  switch (type) {
    case 'house': {
      const single = pick(rand, ['cottage', 'hip', 'lShape'] as const)
      // Most houses are single storey, so that's the assumption until the
      // owner says otherwise.
      const levels = given !== null ? clamp(given, 1, HOUSE_MAX_STOREYS) : 1
      const form: HouseForm = levels > 1 ? 'multiStorey' : single
      return {
        kind: 'house',
        form,
        storeys: levels,
        wall: index(rand, WALL_COLOURS.length),
        roof: index(rand, ROOF_COLOURS.length),
        door: index(rand, DOOR_COLOURS.length),
        // An L-shaped house already fills its plot; a garage would crowd it.
        garage: form !== 'lShape' && rand() < 0.55,
        porch: rand() < 0.5,
        chimney: rand() < 0.6,
        yard: pick(rand, ['hedge', 'picket', 'garden', 'tree'] as const),
        mirrored: rand() < 0.5,
      }
    }
    case 'townhouse': {
      const units = pick(rand, [2, 3, 3, 4] as const)
      return {
        kind: 'townhouse',
        units,
        storeys: given !== null ? clamp(given, 1, TOWNHOUSE_MAX_STOREYS) : 2,
        walls: Array.from({ length: units }, () => index(rand, WALL_COLOURS.length)),
        roof: index(rand, ROOF_COLOURS.length),
        door: index(rand, DOOR_COLOURS.length),
        balconies: rand() < 0.5,
      }
    }
    case 'unit':
      return {
        kind: 'unit',
        floors:
          given !== null
            ? clamp(given, UNIT_MIN_FLOORS, UNIT_MAX_FLOORS)
            : pick(rand, [3, 4, 5, 6] as const),
        wall: index(rand, WALL_COLOURS.length),
        trim: index(rand, UNIT_TRIM_COLOURS.length),
        balconies: rand() < 0.65,
        rooftopGarden: rand() < 0.4,
      }
    case 'land':
      return {
        kind: 'land',
        shrubs: Array.from({ length: 2 + index(rand, 3) }, () => [
          rand() * 1.6 - 0.8,
          rand() * 1.6 - 0.8,
        ]),
        sign: rand() < 0.7,
      }
  }
}

/** How tall a model stands, roof included, in world units. */
export function modelHeight(v: ModelVariant): number {
  switch (v.kind) {
    case 'house':
      return HOUSE_STOREY * v.storeys + 0.2
    case 'townhouse':
      return TOWNHOUSE_STOREY * v.storeys + 0.14
    case 'unit':
      return UNIT_STOREY * v.floors + 0.16
    case 'land':
      return 0.26
  }
}

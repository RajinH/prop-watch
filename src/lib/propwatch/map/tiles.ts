/**
 * Slippy-map tile maths for the static property map.
 *
 * We render a small mosaic of raster tiles rather than pulling in a full map
 * library: the property card needs a fixed, non-interactive thumbnail, and a
 * pannable map widget per grid cell would cost far more JS than the picture is
 * worth. Everything here is pure — no I/O, no framework.
 *
 * Reference: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
 */

/** Edge length of an OSM raster tile, in CSS pixels. */
export const TILE_SIZE = 256

/**
 * Street-level zoom: close enough to read the surrounding block, wide enough
 * that a slightly-off geocode still lands the viewer in the right place.
 *
 * Closer zooms were tried and rejected. OSM has building footprints but no
 * property boundaries, so going closer adds no information an owner doesn't
 * already have, while costing the surrounding context that makes the location
 * recognisable. It also exposes OSM's uneven AU building coverage: Edmondson
 * Park is fully mapped, but Toukley has no footprints at all, and at z18 that
 * card empties out to a single street label.
 *
 * Override per usage via PropertyMap's `zoom` prop when the context is known
 * (a full-page map of one property can afford to go closer).
 */
export const DEFAULT_ZOOM = 16

/**
 * Tile endpoint, overridable so a paid/self-hosted provider can be dropped in
 * without touching component code. openstreetmap.org's tiles are a donated
 * service — fine at this scale with attribution, but its usage policy rules out
 * heavy commercial traffic, so production traffic should point elsewhere.
 */
const TILE_URL_TEMPLATE =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export function tileUrl(z: number, x: number, y: number): string {
  return TILE_URL_TEMPLATE.replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
}

/** Fractional tile coordinates (Web Mercator) for a lat/lon at a given zoom. */
export function project(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom
  // Mercator y is undefined at the poles; clamp to the standard web-map limit
  // so an absurd coordinate degrades to an edge tile instead of NaN.
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const latRad = (clampedLat * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  return {
    x: ((lon + 180) / 360) * n,
    // At the clamp limit the maths lands a hair outside [0, n] on floating
    // point, which would floor to tile -1. Pin it back inside the world.
    y: Math.min(Math.max(y, 0), n),
  }
}

export interface MosaicTile {
  key: string
  url: string
  /** Offset from the mosaic's top-left corner, in CSS pixels. */
  left: number
  top: number
}

export interface Mosaic {
  tiles: MosaicTile[]
  /** Size of the tile canvas, which is larger than the visible viewport. */
  width: number
  height: number
  /**
   * Where the exact coordinate sits on the canvas, in CSS pixels from its
   * top-left. Pinning the canvas at the container's 50%/50% and translating it
   * by the negation of these puts the point dead centre at any container size,
   * so the component never has to measure itself.
   */
  pointX: number
  pointY: number
}

/**
 * Build the set of tiles needed to fill a `viewportWidth` x `viewportHeight`
 * box centred on `lat`/`lon`.
 *
 * The mosaic is deliberately padded by one tile on every side: the card is
 * responsive, so we cannot know the exact rendered width ahead of time, and a
 * spare ring of tiles keeps the edges covered instead of showing background.
 */
export function buildMosaic(
  lat: number,
  lon: number,
  zoom: number = DEFAULT_ZOOM,
  viewportWidth = 512,
  viewportHeight = 320
): Mosaic {
  const n = 2 ** zoom
  const { x, y } = project(lat, lon, zoom)

  // Which tile the point falls in, and where inside that tile it sits.
  const centreTileX = Math.floor(x)
  const centreTileY = Math.floor(y)

  // Tiles needed either side of the centre tile to cover the viewport, plus the
  // one-tile padding ring described above.
  const spanX = Math.ceil(viewportWidth / TILE_SIZE / 2) + 1
  const spanY = Math.ceil(viewportHeight / TILE_SIZE / 2) + 1

  const tiles: MosaicTile[] = []
  for (let dy = -spanY; dy <= spanY; dy++) {
    for (let dx = -spanX; dx <= spanX; dx++) {
      const tx = centreTileX + dx
      const ty = centreTileY + dy
      // Vertical wrap is meaningless (no tiles above the pole), horizontal wrap
      // is real — a map near the antimeridian pulls tiles from the far side.
      if (ty < 0 || ty >= n) continue
      const wrappedX = ((tx % n) + n) % n
      tiles.push({
        key: `${zoom}/${tx}/${ty}`,
        url: tileUrl(zoom, wrappedX, ty),
        left: (dx + spanX) * TILE_SIZE,
        top: (dy + spanY) * TILE_SIZE,
      })
    }
  }

  const width = (spanX * 2 + 1) * TILE_SIZE
  const height = (spanY * 2 + 1) * TILE_SIZE

  return {
    tiles,
    width,
    height,
    pointX: (spanX + (x - centreTileX)) * TILE_SIZE,
    pointY: (spanY + (y - centreTileY)) * TILE_SIZE,
  }
}

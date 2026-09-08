'use client'

import { buildMosaic, DEFAULT_ZOOM } from '@/lib/propwatch/map/tiles'
import { cn } from '@/lib/utils'

interface Props {
  latitude: number
  longitude: number
  /** Used for the accessible description of what the map is showing. */
  label: string
  /** Tile zoom. Defaults to the portfolio-safe level; raise for a larger map. */
  zoom?: number
  className?: string
}

/**
 * The location marker.
 *
 * Hand-rolled rather than lucide's MapPin, which is a stroked outline icon: it
 * draws a teardrop *and* an inner circle, so any stroke colour outlines both,
 * ringing the pin in a hard border and hollowing its centre. A marker wants the
 * opposite — a solid body and a cleanly punched-out centre.
 *
 * The teardrop geometry is lucide's (ISC), filled instead of stroked so it sits
 * consistently with the rest of the icon set.
 */
const PIN_TEARDROP =
  'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0'

// Centre opening, as constants so the path below stays readable.
const HOLE_CX = 12
const HOLE_CY = 10
const HOLE_R = 2.75
const HOLE_PATH =
  `M${HOLE_CX} ${HOLE_CY - HOLE_R}` +
  `a${HOLE_R} ${HOLE_R} 0 1 0 0 ${HOLE_R * 2}` +
  `a${HOLE_R} ${HOLE_R} 0 1 0 0 -${HOLE_R * 2}Z`

// Teardrop and centre dot as one path so `evenodd` punches the dot clean
// through the body, letting the map show inside the pin instead of a solid
// disc sitting on top of it.
const PIN_BODY = `${PIN_TEARDROP} ${HOLE_PATH}`

// The drawn tip bottoms out at ~22.4 of the 24-unit viewBox, not at its edge.
// Shifting by that fraction lands the point of the pin exactly on the
// coordinate, instead of leaving it floating a couple of pixels high.
const TIP_OFFSET = `${(22.4 / 24) * 100}%`

function Marker() {
  return (
    <div
      className="absolute left-1/2 top-1/2"
      style={{ transform: `translate(-50%, -${TIP_OFFSET})` }}
      aria-hidden
    >
      {/* One shape, one colour, no outline: borders and shadows were each tried
          here and every one of them read as noise at 30px. The pin carries the
          tenancy pill's dark green, and the knocked-out centre is what gives it
          form rather than a stroke. */}
      <svg width={30} height={30} viewBox="0 0 24 24">
        <path d={PIN_BODY} fillRule="evenodd" className="fill-green-800" />
      </svg>
    </div>
  )
}

/**
 * A non-interactive OSM map centred on one coordinate.
 *
 * Purely presentational — it takes coordinates it can trust and draws them.
 * Resolving missing coordinates belongs to the caller: the property card backfills
 * via the geocode route, while the wizard already has them from Checkify.
 */
export default function StaticMap({
  latitude,
  longitude,
  label,
  zoom = DEFAULT_ZOOM,
  className,
}: Props) {
  const mosaic = buildMosaic(latitude, longitude, zoom)

  return (
    <div className={cn('relative overflow-hidden bg-slate-100', className)}>
      {/* The canvas is pinned at the container centre and pulled back by the
          point's own offset, so the property lands dead centre at any size. */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: mosaic.width,
          height: mosaic.height,
          transform: `translate(${-mosaic.pointX}px, ${-mosaic.pointY}px)`,
        }}
        aria-hidden
      >
        {mosaic.tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={t.key}
            src={t.url}
            alt=""
            width={256}
            height={256}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute max-w-none select-none"
            style={{ left: t.left, top: t.top }}
          />
        ))}
      </div>

      {/* Desaturate slightly so the map recedes behind the surrounding surface.
          A stronger grayscale filter was tried here and drained the map of the
          parks, water and road hierarchy that make a location recognisable. */}
      <div className="absolute inset-0 bg-slate-500/5 mix-blend-multiply" aria-hidden />

      <Marker />

      <span className="sr-only">Map showing the location of {label}</span>

      {/* ODbL requires visible attribution wherever OSM tiles are displayed. */}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-0 right-0 rounded-tl-md bg-white/80 px-1.5 py-0.5 text-[9px] leading-none text-slate-500 backdrop-blur-sm hover:text-slate-700"
      >
        © OpenStreetMap
      </a>
    </div>
  )
}

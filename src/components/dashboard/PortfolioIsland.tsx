'use client'

import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import type { Property, PropertySnapshot } from '@/lib/propwatch/engine/types'
import { buildIslandScene, type IslandPlot } from '@/lib/propwatch/island/scene'
import { PROPERTY_TYPE_LABELS, toPropertyType } from '@/lib/propwatch/propertyType'
import { formatAddress, formatCashflow, formatDollars } from '@/lib/formatters'

interface Props {
  properties: Property[]
  propertySnapshots: Record<string, PropertySnapshot>
}

/*
 * The Portfolio Island: the properties you own, each drawn as its type — a
 * house, a townhouse row, a unit block or a fenced block of land — on one
 * island. A picture of the portfolio rather than a chart; see
 * lib/propwatch/island/scene.ts for the layout and island/IslandScene3D.tsx
 * for the drawing.
 *
 * A property's figures appear in a tooltip: beside the pointer when hovering
 * the island, above the chip when hovering or focusing the list below it.
 *
 * three.js is a large dependency, so the scene is its own chunk, fetched only
 * on the client once WebGL is confirmed. A loader holds the space meanwhile.
 */

const SCENE_HEIGHT = 'h-[360px]'
const TOOLTIP_WIDTH = 240
/**
 * How long a hover outlives the pointer leaving. Long enough to cross the
 * grass between two plots, or the gap between two chips, without the scene
 * fading back in and the tooltip blinking off and on again.
 */
const HOVER_GRACE_MS = 140

function IslandLoader() {
  return (
    <div
      className={`flex ${SCENE_HEIGHT} w-full items-center justify-center gap-2 text-xs text-slate-400`}
      role="status"
    >
      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
      Building your island…
    </div>
  )
}

const IslandScene3D = dynamic(() => import('@/components/dashboard/island/IslandScene3D'), {
  ssr: false,
  loading: IslandLoader,
})

// WebGL support never changes during a session, so probe once and cache.
let webglSupport: boolean | null = null
function hasWebGL() {
  if (webglSupport === null) {
    try {
      const canvas = document.createElement('canvas')
      webglSupport = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
    } catch {
      webglSupport = false
    }
  }
  return webglSupport
}
const noSubscribe = () => () => {}

function PropertyTooltip({ p }: { p: IslandPlot }) {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg"
      style={{ width: TOOLTIP_WIDTH }}
    >
      <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
      <p className="mt-0.5 line-clamp-2 text-slate-500">
        {PROPERTY_TYPE_LABELS[p.type]} · {p.address ?? 'No address on record'}
      </p>
      <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums">
        <dt className="text-slate-500">Land size</dt>
        <dd
          className={`text-right font-medium ${p.landArea !== null ? 'text-slate-800' : 'text-slate-400'}`}
        >
          {p.landArea !== null
            ? `${Math.round(p.landArea).toLocaleString('en-AU')} m²`
            : 'Not recorded'}
        </dd>
        <dt className="text-slate-500">Value</dt>
        <dd className="text-right font-medium text-slate-800">{formatDollars(p.value)}</dd>
        <dt className="text-slate-500">Debt</dt>
        <dd className="text-right font-medium text-slate-800">{formatDollars(p.debt)}</dd>
        <dt className="text-slate-500">Equity</dt>
        <dd
          className={`text-right font-medium ${p.equity < 0 ? 'text-red-600' : 'text-slate-800'}`}
        >
          {p.equity < 0 ? '-' : ''}
          {formatDollars(p.equity)}
        </dd>
        {p.lvr !== null && (
          <>
            <dt className="text-slate-500">LVR</dt>
            <dd className="text-right font-medium text-slate-800">{(p.lvr * 100).toFixed(1)}%</dd>
          </>
        )}
        <dt className="text-slate-500">Cashflow</dt>
        <dd
          className={`text-right font-medium ${p.monthlyCashflow < 0 ? 'text-red-600' : 'text-green-700'}`}
        >
          {formatCashflow(p.monthlyCashflow)}
        </dd>
      </dl>
    </div>
  )
}

type Hover =
  | { plot: IslandPlot; from: 'scene'; left: number; top: number }
  | { plot: IslandPlot; from: 'chip' }

export default function PortfolioIsland({ properties, propertySnapshots }: Props) {
  const router = useRouter()
  const box = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const leaving = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showHover = (h: Hover) => {
    if (leaving.current) clearTimeout(leaving.current)
    leaving.current = null
    setHover(h)
  }
  /** Clears the hover after the grace period, if it still matches. */
  const hideHover = (matches: (h: Hover) => boolean) => {
    if (leaving.current) clearTimeout(leaving.current)
    leaving.current = setTimeout(() => {
      leaving.current = null
      setHover((h) => (h && matches(h) ? null : h))
    }, HOVER_GRACE_MS)
  }
  // null on the server and during hydration (show the loader), then the
  // real answer on the client.
  const webgl = useSyncExternalStore<boolean | null>(noSubscribe, hasWebGL, () => null)

  const scene = useMemo(
    () =>
      buildIslandScene(
        properties.map((p) => ({
          id: p.id,
          name: p.name,
          address: formatAddress(p) || null,
          type: toPropertyType(p.property_type),
          storeys: p.storeys ?? null,
          landArea: p.land_area ?? null,
          value: p.current_value,
          debt: p.current_debt,
          // The persisted snapshot, as the breakdown below reads, so the two
          // views on this page never disagree.
          monthlyCashflow:
            propertySnapshots[p.id]?.monthly_cashflow ??
            p.monthly_rent - p.monthly_repayment - p.annual_expenses / 12,
        }))
      ),
    [properties, propertySnapshots]
  )

  if (scene.plots.length === 0) return null

  const onSceneHover = (plot: IslandPlot | null, clientX?: number, clientY?: number) => {
    const rect = box.current?.getBoundingClientRect()
    if (!plot || !rect || clientX === undefined || clientY === undefined) {
      hideHover((h) => h.from === 'scene')
      return
    }
    // Beside the pointer, flipped to its left near the right edge so it never
    // runs off the card.
    const x = clientX - rect.left
    const y = clientY - rect.top
    showHover({
      plot,
      from: 'scene',
      left: x + 16 + TOOLTIP_WIDTH > rect.width ? x - 16 - TOOLTIP_WIDTH : x + 16,
      top: Math.max(0, y - 24),
    })
  }

  // A stable order — most valuable first, as in the breakdown below — rather
  // than screen order, which changes as the island turns.
  const chips = [...scene.plots].sort((a, b) => b.value - a.value || a.id.localeCompare(b.id))

  return (
    <div>
      <div ref={box} className="relative">
        {webgl === null ? (
          <IslandLoader />
        ) : webgl ? (
          <IslandScene3D
            scene={scene}
            active={hover?.plot.id ?? null}
            onHover={onSceneHover}
            onOpen={(p) => router.push(`/properties/${p.id}/edit`)}
          />
        ) : (
          <div
            className={`flex ${SCENE_HEIGHT} w-full items-center justify-center rounded-xl bg-slate-50 px-6 text-center text-xs text-slate-400`}
          >
            Your browser can&apos;t draw the 3D island. Your properties are listed below.
          </div>
        )}

        {hover?.from === 'scene' && (
          <div
            className="pointer-events-none absolute z-20"
            style={{ left: hover.left, top: hover.top }}
            aria-hidden
          >
            <PropertyTooltip p={hover.plot} />
          </div>
        )}
      </div>

      {/* Each chip is also the keyboard and screen-reader route to its property. */}
      <ul className="mt-3 flex flex-wrap justify-center gap-2">
        {chips.map((p) => {
          const show = () => showHover({ plot: p, from: 'chip' })
          const hide = () => hideHover((h) => h.from === 'chip' && h.plot.id === p.id)
          return (
            <li key={p.id} className="relative">
              <Link
                href={`/properties/${p.id}/edit`}
                onMouseEnter={show}
                onMouseLeave={hide}
                onFocus={show}
                onBlur={hide}
                aria-label={`${p.name}, ${PROPERTY_TYPE_LABELS[p.type].toLowerCase()}${p.address ? ` at ${p.address}` : ''}: worth ${formatDollars(p.value)}, owes ${formatDollars(p.debt)}, ${formatCashflow(p.monthlyCashflow)}. Open property.`}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-700 ${
                  hover?.plot.id === p.id
                    ? 'border-slate-300 bg-slate-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <span className="max-w-[12rem] truncate font-medium text-slate-700">{p.name}</span>
                <span className="text-slate-400">{PROPERTY_TYPE_LABELS[p.type]}</span>
              </Link>
              {hover?.from === 'chip' && hover.plot.id === p.id && (
                <div
                  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2"
                  aria-hidden
                >
                  <PropertyTooltip p={p} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

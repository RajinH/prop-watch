'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { apiPost } from '@/lib/propwatch/api/client'
import { cn } from '@/lib/utils'
import StaticMap from './StaticMap'

interface Props {
  /** Property id, used to persist coordinates when a backfill is needed. */
  propertyId: string
  latitude: number | null
  longitude: number | null
  /** Human-readable address, shown when there is no map to draw. */
  addressLabel: string
  /** True when the property has enough address detail to be worth geocoding. */
  canGeocode: boolean
  /** Fired once a backfill resolves, so the parent can hold the new coords. */
  onResolved?: (coords: { latitude: number; longitude: number }) => void
  /** Tile zoom. Defaults to the portfolio-safe level; raise for a larger map. */
  zoom?: number
  className?: string
}

type Status = 'ready' | 'geocoding' | 'unavailable'

/**
 * A saved property's map, with the coordinate-resolution behaviour the card
 * needs: properties added before Checkify's coordinates were captured have none
 * stored, so the first render backfills them via the geocode route.
 *
 * Drawing is delegated to StaticMap — anything that already holds coordinates
 * (the add/edit wizard, say) should use that directly.
 */
export default function PropertyMap({
  propertyId,
  latitude,
  longitude,
  addressLabel,
  canGeocode,
  onResolved,
  zoom,
  className,
}: Props) {
  const hasCoords = latitude != null && longitude != null
  const [status, setStatus] = useState<Status>(
    hasCoords ? 'ready' : canGeocode ? 'geocoding' : 'unavailable'
  )
  // Guards against a second backfill for the same card — React can remount or
  // re-run effects, and Nominatim's policy is emphatic about repeat queries.
  const attempted = useRef(false)

  useEffect(() => {
    if (hasCoords || !canGeocode || attempted.current) return
    attempted.current = true

    let cancelled = false
    ;(async () => {
      try {
        const res = await apiPost<{ latitude: number; longitude: number } | null>(
          `/api/properties/${propertyId}/geocode`,
          {}
        )
        if (cancelled) return
        if (res && res.latitude != null && res.longitude != null) {
          onResolved?.({ latitude: res.latitude, longitude: res.longitude })
          setStatus('ready')
        } else {
          setStatus('unavailable')
        }
      } catch {
        if (!cancelled) setStatus('unavailable')
      }
    })()

    return () => {
      cancelled = true
    }
    // onResolved is intentionally omitted: the parent recreates it each render,
    // and re-running this effect would re-issue the geocode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, hasCoords, canGeocode])

  if (!hasCoords) {
    return (
      <div className={cn('relative overflow-hidden bg-slate-100', className)}>
        {status === 'geocoding' ? (
          <div className="absolute inset-0 animate-pulse bg-slate-100" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-50 px-4 text-center">
            <MapPin size={18} className="text-slate-300" />
            <p className="text-xs text-slate-400">
              {addressLabel || 'No address on record'}
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <StaticMap
      latitude={latitude}
      longitude={longitude}
      label={addressLabel}
      zoom={zoom}
      className={className}
    />
  )
}

/**
 * Categorical series colours.
 *
 * The slots are declared in `globals.css` (`--color-series-*`) and validated
 * there; this module is only about *assignment* — which entity gets which slot.
 *
 * Two rules the charts kept breaking, both enforced here:
 *
 *  1. **Colour follows the entity, never its rank.** Assigning by array index
 *     (`colors[i % colors.length]`) means re-sorting a list repaints every
 *     series, so a reader who learned "Bondi is green" is misled. `assignSeriesColors`
 *     keys off a stable id instead, so display order and colour are independent.
 *
 *  2. **Never cycle.** A 7th series reusing slot 1 is indistinguishable from it.
 *     `foldToSeriesCap` folds the tail into a single "Other" bucket instead.
 *
 * It also holds the couple of presentation constants that have to match across
 * every chart, so they are set once rather than per call site.
 */

export const SERIES_SLOTS = [
  'var(--color-series-1)',
  'var(--color-series-2)',
  'var(--color-series-3)',
  'var(--color-series-4)',
  'var(--color-series-5)',
  'var(--color-series-6)',
] as const

/** Colour reserved for the folded tail — deliberately neutral, not a 7th hue. */
export const SERIES_OTHER = 'var(--color-muted-foreground)'

export const MAX_SERIES = SERIES_SLOTS.length

/**
 * Map ids to slots by canonical (sorted) id order, so a given entity keeps its
 * hue no matter what order the caller happens to render in. Ids beyond the slot
 * count get the neutral "Other" colour; callers that care should fold first.
 */
export function assignSeriesColors(ids: string[]): Record<string, string> {
  const canonical = [...new Set(ids)].sort()
  const out: Record<string, string> = {}
  canonical.forEach((id, i) => {
    out[id] = i < MAX_SERIES ? SERIES_SLOTS[i] : SERIES_OTHER
  })
  return out
}

/**
 * Split items into the ones that get their own colour and the tail to fold.
 * `weight` decides which survive — the biggest lines are the ones worth naming.
 */
export function foldToSeriesCap<T>(
  items: T[],
  weight: (item: T) => number
): { kept: T[]; folded: T[] } {
  if (items.length <= MAX_SERIES) return { kept: items, folded: [] }
  const ranked = [...items].sort((a, b) => weight(b) - weight(a))
  return { kept: ranked.slice(0, MAX_SERIES - 1), folded: ranked.slice(MAX_SERIES - 1) }
}

/**
 * The hover crosshair for line and area charts.
 *
 * A line chart without one leaves the reader guessing which x the tooltip is
 * describing, so it is on by default everywhere rather than opt-in. Hairline
 * and one step off the surface: it locates the reading without competing with
 * the series.
 */
export const CHART_CROSSHAIR = { stroke: 'var(--color-border)', strokeWidth: 1 } as const

// Pure date arithmetic over 'YYYY-MM-DD' strings. The decision layer never
// reads the clock — `today` always arrives via context so runs are reproducible.

const MS_PER_DAY = 86_400_000

function toUtcMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`)
}

/** Whole days from `from` to `to` (negative when `to` is in the past). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY)
}

/** Fractional years from `from` to `to`. */
export function yearsBetween(from: string, to: string): number {
  return daysBetween(from, to) / 365.25
}

/** Fractional months from `from` to `to`. */
export function monthsBetween(from: string, to: string): number {
  return daysBetween(from, to) / 30.44
}

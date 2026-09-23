// THROWAWAY SPIKE — delete after the HTAG evaluation. Not covered by tests, not
// called by any UI, and 404s outside development. `rm -rf src/app/api/dev`
// removes the whole thing.
//
// Purpose: pull a broad slice of HTAG data for the signed-in user's real
// portfolio and dump every raw response to disk, so we can decide what is worth
// productising by looking at actual payloads rather than at the API docs.
//
// Auth note: this deliberately runs as the logged-in user rather than through a
// service-role key. RLS then scopes the property read for free, and no
// RLS-bypassing credential has to exist for a throwaway.

import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'
import { resolvePortfolio } from '@/lib/propwatch/db/resolvePortfolio'
import { htagGetWithMeta, type HtagCallMeta, type HtagParams } from '@/lib/propwatch/htag/server'

export const runtime = 'nodejs'

/** AUD per billable row, from HTAG's published pricing. Used only to estimate. */
const TIER_PRICE = {
  reference: 0.001,
  standard: 0.034,
  enhanced: 0.057,
  premium: 0.081,
  restricted: 0.111,
} as const
type Tier = keyof typeof TIER_PRICE

/**
 * Per-address features. All Standard tier, and all describing things that do not
 * change month to month — if any of these prove useful they are a one-off cost
 * per property, never a refresh.
 */
const ADDRESS_FEATURES = [
  '/address/walkability',
  '/address/transport',
  '/address/cbd-proximity',
  '/address/coastal',
  '/address/green-space',
  '/address/amenities',
  '/address/essentials',
  '/address/hazards',
  '/address/nuisance',
  '/address/safety',
  '/address/aviation',
  '/address/road-infrastructure',
] as const

/** Locality endpoints returning a single current row per area. */
const LOCALITY_SNAPSHOTS: { path: string; tier: Tier }[] = [
  { path: '/markets/summary', tier: 'standard' },
  { path: '/markets/growth/cumulative', tier: 'enhanced' },
  { path: '/markets/growth/annualised', tier: 'enhanced' },
  { path: '/markets/supply', tier: 'enhanced' },
  { path: '/markets/demand', tier: 'enhanced' },
  { path: '/markets/scores', tier: 'premium' },
  { path: '/markets/fundamentals', tier: 'premium' },
  { path: '/markets/risk', tier: 'premium' },
  { path: '/markets/cycle', tier: 'premium' },
  { path: '/markets/supply/ls', tier: 'premium' },
  { path: '/markets/supply/ss', tier: 'premium' },
  { path: '/markets/demand/ls', tier: 'premium' },
  { path: '/markets/demand/ss', tier: 'premium' },
]

/** Locality monthly series. Reference tier, so depth is essentially free. */
const LOCALITY_SERIES = ['/markets/trends/price', '/markets/trends/rent', '/markets/trends/yield']

interface PropertyRow {
  id: string
  name: string
  unit: string | null
  street: string | null
  city: string | null
  state: string | null
  postcode: string | null
  current_value: number
  purchase_price: number | null
  purchase_date: string | null
}

interface GeocodeCandidate {
  address_key: string
  address_label: string
  /** HTAG returns null here in practice — see isConfidentMatch. */
  score: number | null
  loc_pid?: string
  lga_pid?: string
  sa2_code21?: string
  number_first?: string
  street_name?: string
  locality_name?: string
  postcode?: string
  [k: string]: unknown
}

/** Mirrors PropertyWizard.buildAddressText so we geocode the same string the UI does. */
function buildAddressText(p: PropertyRow): string {
  return [
    p.unit ? `${p.unit}/` : '',
    p.street,
    p.city,
    p.state,
    p.postcode,
    'Australia',
  ]
    .filter(Boolean)
    .join(' ')
}

const norm = (v: string | null | undefined) => (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * Decide whether HTAG's top hit really is this property.
 *
 * The wizard gates on `score >= 0.8`, but /address/geocode returns `score: null`
 * for every candidate, so that test can never pass. Results do come back
 * relevance-ordered with the exact match first, so instead of trusting an
 * ordering we verify the structured fields against what we stored: street
 * number, street name, suburb and postcode must all agree.
 *
 * This matters because nobody is watching — a wrong loc_pid would silently
 * back-index the property against the wrong suburb and nothing downstream
 * would reveal it.
 */
function isConfidentMatch(c: GeocodeCandidate | undefined, p: PropertyRow): boolean {
  if (!c) return false
  const street = (p.street ?? '').trim()
  const streetNumber = street.match(/^\s*(\d+[A-Za-z]?)/)?.[1] ?? ''
  const streetName = street.replace(/^\s*\d+[A-Za-z]?\s*/, '')
  return (
    norm(c.postcode) === norm(p.postcode) &&
    norm(c.locality_name) === norm(p.city) &&
    norm(c.number_first) === norm(streetNumber) &&
    // HTAG splits "FOURTH AVENUE" into street_name "Fourth" + street_type
    // "Avenue", so check the stored street starts with the returned name.
    streetName.length > 0 &&
    norm(streetName).startsWith(norm(c.street_name))
  )
}

interface CallRecord {
  stage: string
  path: string
  params: HtagParams
  ok: boolean
  error?: string
  meta?: HtagCallMeta
  rowCount?: number
  response?: unknown
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    // 404 rather than 403 so the route does not announce that it exists.
    return new Response(null, { status: 404 })
  }

  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const url = new URL(request.url)
  const months = Math.min(Number(url.searchParams.get('months') ?? 36), 120)
  const apply = url.searchParams.get('apply') === '1'
  const budget = Number(url.searchParams.get('budget') ?? 12)
  const only = (url.searchParams.get('stages') ?? '').split(',').filter(Boolean)
  const wanted = (stage: string) => only.length === 0 || only.includes(stage)

  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('No portfolio', 404)

  const { data: properties } = await supabase
    .from('properties')
    .select('id,name,unit,street,city,state,postcode,current_value,purchase_price,purchase_date')
    .eq('portfolio_id', portfolio.id)
    .order('created_at')

  const props = (properties ?? []) as PropertyRow[]
  if (props.length === 0) return err('No properties to probe', 400)

  // ---- Dry run: show the plan and what it should cost, spend nothing --------
  if (!apply) {
    const est = {
      geocode: props.length * TIER_PRICE.standard,
      locality_series: LOCALITY_SERIES.length * props.length * months * TIER_PRICE.reference,
      locality_snapshots: LOCALITY_SNAPSHOTS.reduce((t, e) => t + TIER_PRICE[e.tier] * props.length, 0),
      property_dynamic: 3 * props.length * TIER_PRICE.enhanced,
      property_static: (ADDRESS_FEATURES.length + 2) * props.length * TIER_PRICE.standard,
    }
    const total = Object.values(est).reduce((a, b) => a + b, 0)
    return ok({
      mode: 'dry-run',
      note: 'Re-run with ?apply=1 to actually spend. Locality counts assume one distinct locality per property (worst case).',
      months,
      budget,
      properties: props.map((p) => ({ name: p.name, address: buildAddressText(p) })),
      estimated_cost_aud: Object.fromEntries(
        Object.entries(est).map(([k, v]) => [k, Number(v.toFixed(3))])
      ),
      estimated_total_aud: Number(total.toFixed(2)),
    })
  }

  // ---- Apply -----------------------------------------------------------------
  const calls: CallRecord[] = []
  let spent = 0
  let abortedFor: string | null = null

  async function call(stage: string, p: string, params: HtagParams): Promise<unknown | null> {
    if (abortedFor) return null
    if (spent >= budget) {
      abortedFor = `budget of $${budget} reached before ${p}`
      return null
    }
    try {
      const { data, meta } = await htagGetWithMeta<Record<string, unknown>>(p, params)
      spent += meta.cost ?? 0
      const rows = Array.isArray((data as { results?: unknown })?.results)
        ? ((data as { results: unknown[] }).results).length
        : undefined
      calls.push({ stage, path: p, params, ok: true, meta, rowCount: rows, response: data })
      return data
    } catch (e) {
      calls.push({ stage, path: p, params, ok: false, error: (e as Error).message })
      return null
    }
  }

  // Stage 1 — geocode. Keeps the full candidate list: we need the scores to know
  // whether the locality we then query is actually the right one.
  const resolved: {
    property: PropertyRow
    candidates: GeocodeCandidate[]
    chosen: GeocodeCandidate | null
    confident: boolean
  }[] = []

  if (wanted('geocode')) {
    for (const p of props) {
      const data = (await call('geocode', '/address/geocode', {
        address: buildAddressText(p),
      })) as { results?: GeocodeCandidate[] } | null
      const candidates = data?.results ?? []
      const confident = isConfidentMatch(candidates[0], p)
      resolved.push({ property: p, candidates, chosen: candidates[0] ?? null, confident })
    }
  }

  const localities = [
    ...new Set(resolved.filter((r) => r.confident && r.chosen?.loc_pid).map((r) => r.chosen!.loc_pid!)),
  ]
  const addressKeys = resolved.filter((r) => r.confident && r.chosen).map((r) => r.chosen!.address_key)

  // Stage 2 — locality monthly series. Reference tier, batched across localities.
  // `limit` must be set explicitly: it defaults to 100, and months x localities
  // exceeds that quickly, which would truncate the series silently.
  if (wanted('series') && localities.length > 0) {
    const end = new Date()
    const start = new Date(end)
    start.setMonth(start.getMonth() - months)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    for (const p of LOCALITY_SERIES) {
      await call('locality_series', p, {
        level: 'suburb',
        area_id: localities,
        period_end_min: iso(start),
        period_end_max: iso(end),
        limit: '1000',
      })
    }
  }

  // Stage 3 — locality snapshots. Probe one area on the first (cheap) endpoint
  // and inspect the row count before fanning the expensive tiers across all of
  // them: billing is per row and Restricted tier is 111x Reference, so an
  // endpoint that unexpectedly returns a series is where this gets costly.
  if (wanted('snapshots') && localities.length > 0) {
    const probe = (await call('locality_snapshot_probe', LOCALITY_SNAPSHOTS[0].path, {
      level: 'suburb',
      area_id: [localities[0]],
    })) as { results?: unknown[] } | null
    const rowsPerArea = Array.isArray(probe?.results) ? probe!.results!.length : 1

    if (rowsPerArea > 5) {
      calls.push({
        stage: 'locality_snapshots',
        path: '(skipped)',
        params: {},
        ok: false,
        error: `probe returned ${rowsPerArea} rows for one area — expected ~1. Skipped fan-out to avoid unexpected spend.`,
      })
    } else {
      // Includes the probed endpoint: the probe only covered one area, so
      // skipping it here would leave every other locality without a summary.
      for (const e of LOCALITY_SNAPSHOTS) {
        await call('locality_snapshots', e.path, { level: 'suburb', area_id: localities })
      }
    }
  }

  // Stage 4 — per-property dynamic data. address_key is singular on these, so
  // one call each; this is the tier that would scale badly with user count.
  if (wanted('property')) {
    for (const key of addressKeys) {
      for (const p of ['/property/estimates', '/property/market', '/property/history']) {
        await call('property_dynamic', p, { address_key: key })
      }
    }
  }

  // Stage 5 — per-property static profile. Never changes, so if any of it proves
  // useful it is bought once per property and cached forever.
  //
  // The address-feature endpoints take `address_keys` (plural, CSV, up to 50) and
  // have no single-address mode — one call covers the whole portfolio. Only
  // /property/summary is addressed one at a time.
  if (wanted('static') && addressKeys.length > 0) {
    const keys = addressKeys.join(',')
    for (const p of [...ADDRESS_FEATURES, '/address/environment']) {
      await call('property_static', p, { address_keys: keys })
    }
    for (const key of addressKeys) {
      await call('property_static', '/property/summary', { address_key: key })
    }
  }

  const outDir =
    process.env.PROPWATCH_SPIKE_DIR ?? path.join(process.cwd(), 'tmp', 'htag-probe')
  await mkdir(outDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = path.join(outDir, `probe-${stamp}.json`)

  const payload = {
    run: { at: new Date().toISOString(), months, budget, stages: only.length ? only : 'all' },
    portfolio_id: portfolio.id,
    properties: props,
    resolved: resolved.map((r) => ({
      property_id: r.property.id,
      property_name: r.property.name,
      address_text: buildAddressText(r.property),
      confident: r.confident,
      chosen: r.chosen,
      candidates: r.candidates,
    })),
    localities,
    spend: {
      total_aud: Number(spent.toFixed(4)),
      budget_aud: budget,
      aborted_for: abortedFor,
      calls_ok: calls.filter((c) => c.ok).length,
      calls_failed: calls.filter((c) => !c.ok).length,
    },
    calls,
  }
  await writeFile(file, JSON.stringify(payload, null, 2), 'utf8')

  return ok({
    mode: 'applied',
    file,
    spend: payload.spend,
    localities,
    unconfident_geocodes: resolved.filter((r) => !r.confident).map((r) => r.property.name),
    calls: calls.map((c) => ({
      stage: c.stage,
      path: c.path,
      ok: c.ok,
      rows: c.rowCount,
      cost: c.meta?.cost,
      ms: c.meta?.ms,
      error: c.error,
    })),
  })
}

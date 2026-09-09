// THROWAWAY SPIKE — companion to /api/dev/htag-probe. Reads the JSON the probe
// wrote to disk and loads it into Postgres. Deliberately separate from the probe
// so the data can be reloaded, reshaped and reloaded again without ever
// re-spending on HTAG.
//
// Idempotent: every write is an upsert on the table's natural key, so running it
// twice changes nothing.

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'

export const runtime = 'nodejs'

interface TrendRow {
  area_id: string
  period_end: string
  property_type: string
  bedrooms: string
  typical_price?: number | null
  sales?: number | null
  median_rent?: number | null
  rentals?: number | null
  yield_val?: number | null
}

interface MergedTrend {
  area_id: string
  area_level: string
  period_end: string
  property_type: string
  bedrooms: string
  typical_price: number | null
  sales_count: number | null
  median_rent: number | null
  rentals_count: number | null
  gross_yield: number | null
}

const isTrendRow = (v: unknown): v is TrendRow =>
  !!v && typeof v === 'object' && 'area_id' in v && 'period_end' in v

/** Walks an arbitrary JSON blob and yields every trend-shaped row it contains. */
function collectTrendRows(node: unknown, out: TrendRow[]): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      if (isTrendRow(item)) out.push(item)
      else collectTrendRows(item, out)
    }
    return
  }
  if (node && typeof node === 'object') {
    for (const v of Object.values(node)) collectTrendRows(v, out)
  }
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') return new Response(null, { status: 404 })

  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const url = new URL(request.url)
  const apply = url.searchParams.get('apply') === '1'
  const dir =
    process.env.PROPWATCH_SPIKE_DIR ?? path.join(process.cwd(), 'tmp', 'htag-probe')

  let files: string[]
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()
  } catch {
    return err(`No spike directory at ${dir} — run /api/dev/htag-probe first`, 404)
  }
  if (files.length === 0) return err('No probe JSON found', 404)

  // ---- Gather ---------------------------------------------------------------
  const trends = new Map<string, MergedTrend>()
  // address_key -> the property it belongs to, learned from the probe's geocode stage
  const keyToProperty = new Map<string, { id: string; name: string; chosen: Record<string, unknown> }>()
  const facts = new Map<string, Record<string, unknown>>()
  const transactions: Record<string, unknown>[] = []
  // area_id|property_type -> merged snapshot across the 13 locality endpoints
  const snapshots = new Map<string, Record<string, unknown>>()

  /** Copy a field across only when HTAG actually returned one. */
  const put = (
    target: Record<string, unknown>,
    column: string,
    value: unknown
  ) => {
    if (value !== undefined && value !== null) target[column] = value
  }

  for (const f of files) {
    const blob = JSON.parse(await readFile(path.join(dir, f), 'utf8'))

    for (const r of (blob.resolved ?? []) as Record<string, unknown>[]) {
      const chosen = r.chosen as Record<string, unknown> | null
      if (r.confident && chosen?.address_key) {
        keyToProperty.set(String(chosen.address_key), {
          id: String(r.property_id),
          name: String(r.property_name),
          chosen,
        })
      }
    }

    // Trend rows, wherever they appear — this also picks up standalone series
    // files fetched outside the probe route.
    const rows: TrendRow[] = []
    collectTrendRows(blob, rows)
    for (const row of rows) {
      const periodEnd = String(row.period_end).slice(0, 10)
      const key = `${row.area_id}|suburb|${periodEnd}|${row.property_type}|${row.bedrooms ?? 'All'}`
      const existing = trends.get(key) ?? {
        area_id: row.area_id,
        area_level: 'suburb',
        period_end: periodEnd,
        property_type: row.property_type,
        bedrooms: row.bedrooms ?? 'All',
        typical_price: null,
        sales_count: null,
        median_rent: null,
        rentals_count: null,
        gross_yield: null,
      }
      // The three series arrive as separate calls sharing one key; merge them
      // into a single row rather than storing three near-duplicate tables.
      if (row.typical_price != null) existing.typical_price = row.typical_price
      if (row.sales != null) existing.sales_count = row.sales
      if (row.median_rent != null) existing.median_rent = row.median_rent
      if (row.rentals != null) existing.rentals_count = row.rentals
      if (row.yield_val != null) existing.gross_yield = row.yield_val
      trends.set(key, existing)
    }

    // Locality snapshots: 13 endpoints sharing (area_id, property_type), merged
    // into one row each so the UI reads a market in a single query.
    for (const c of (blob.calls ?? []) as Record<string, unknown>[]) {
      if (!c.ok) continue
      if (!String(c.path).startsWith('/markets/')) continue
      if (String(c.path).startsWith('/markets/trends/')) continue
      const results = ((c.response as Record<string, unknown>)?.results ?? []) as Record<
        string,
        unknown
      >[]
      for (const r of results) {
        if (!r.area_id || !r.property_type) continue
        const key = `${r.area_id}|suburb|${r.property_type}`
        const row = snapshots.get(key) ?? {
          area_id: r.area_id,
          area_level: 'suburb',
          property_type: r.property_type,
          period_end: String(r.period_end ?? '').slice(0, 10) || null,
          raw: {} as Record<string, unknown>,
        }
        // Keep every field verbatim so a column can be promoted later without
        // another probe run.
        Object.assign(row.raw as Record<string, unknown>, r)

        put(row, 'typical_price', r.typical_price)
        put(row, 'median_rent', r.rent)
        put(row, 'gross_yield', r.gross_yield)
        put(row, 'annual_sales_volume', r.annual_sales_volume)
        put(row, 'annual_rental_volume', r.annual_rental_volume)
        put(row, 'estimated_dwellings', r.estimated_dwellings)
        put(row, 'confidence', r.confidence)

        put(row, 'days_on_market', r.dom)
        put(row, 'vacancy_rate', r.vacancy_rate)
        put(row, 'discounting', r.discounting)
        put(row, 'clearance_rate', r.clearance_rate)
        put(row, 'buy_search_index', r.buy_si)
        put(row, 'rent_search_index', r.rent_si)

        put(row, 'inventory_months', r.inventory)
        put(row, 'building_approvals', r.building_approvals_estimated)
        put(row, 'typical_hold_period', r.hold_period)

        put(row, 'cycle_position', r.growth_rate_cycle)
        put(row, 'projected_growth_low', r.projected_annual_capital_growth_low)
        put(row, 'projected_growth_high', r.projected_annual_capital_growth_high)
        put(row, 'projected_rent_increase', r.projected_annual_rent_increase)
        put(row, 'projected_roi_low', r.projected_annual_roi_low)
        put(row, 'projected_roi_high', r.projected_annual_roi_high)

        put(row, 'score_overall', r.rcs_overall)
        put(row, 'score_cashflow', r.rcs_cashflow)
        put(row, 'score_capital_growth', r.rcs_capital_growth)
        put(row, 'score_lower_risk', r.rcs_lower_risk)
        put(row, 'volatility_index', r.volatility_index)

        put(row, 'irsad_decile', r.irsad)
        put(row, 'years_to_own', r.years_to_own)
        put(row, 'rent_own_ratio', r.ro_ratio)
        put(row, 'risk_flood', r.hrp_flood)
        put(row, 'risk_fire', r.hrp_fire)
        put(row, 'economic_diversity', r.ediv_ind)

        for (const horizon of ['1y', '3y', '5y', '10y'] as const) {
          put(row, `price_growth_${horizon}`, r[`price_${horizon}_growth`])
          put(row, `rent_growth_${horizon}`, r[`rent_${horizon}_growth`])
          put(row, `price_growth_${horizon}_annualised`, r[`price_${horizon}_growth_annualised`])
          put(row, `rent_growth_${horizon}_annualised`, r[`rent_${horizon}_growth_annualised`])
        }

        snapshots.set(key, row)
      }
    }

    // Batched per-address endpoints: one request, one row per address key.
    for (const c of (blob.calls ?? []) as Record<string, unknown>[]) {
      if (!c.ok || c.path !== '/address/environment') continue
      const results = ((c.response as Record<string, unknown>)?.results ?? []) as Record<
        string,
        unknown
      >[]
      for (const r of results) {
        const t = keyToProperty.get(String(r.address_key))
        if (!t) continue
        const prior = facts.get(t.id) ?? {
          property_id: t.id,
          address_key: String(r.address_key),
          loc_pid: t.chosen.loc_pid ?? null,
        }
        Object.assign(prior, {
          flood: r.flood ?? null,
          bushfire: r.bushfire ?? null,
          heritage: r.heritage ?? null,
          zoning: r.zoning ?? null,
        })
        facts.set(t.id, prior)
      }
    }

    for (const c of (blob.calls ?? []) as Record<string, unknown>[]) {
      if (!c.ok) continue
      const params = (c.params ?? {}) as Record<string, string>
      const addressKey = params.address_key
      const target = addressKey ? keyToProperty.get(addressKey) : undefined
      if (!target) continue
      const response = c.response as Record<string, unknown>

      if (c.path === '/property/estimates' || c.path === '/property/market') {
        const r = (response.results as Record<string, unknown>[] | undefined)?.[0]
        if (!r) continue
        const prior = facts.get(target.id) ?? {
          property_id: target.id,
          address_key: addressKey,
          loc_pid: target.chosen.loc_pid ?? null,
          lga_pid: target.chosen.lga_pid ?? null,
          sa2_code21: target.chosen.sa2_code21 ?? null,
        }
        if (c.path === '/property/estimates') {
          Object.assign(prior, {
            price_estimate: r.price_estimate ?? null,
            rent_estimate_weekly: r.rent_estimate ?? null,
            last_sold_price: r.last_sold_price ?? null,
            last_sold_date: r.last_sold_date ?? null,
            last_rented_price: r.last_rented_price ?? null,
            last_rented_date: r.last_rented_date ?? null,
            htag_last_updated: r.last_updated ?? null,
          })
        } else {
          Object.assign(prior, {
            rental_percentage: r.rental_percentage ?? null,
            years_to_own: r.years_to_own ?? null,
            hold_period: r.hold_period ?? null,
            ownership: r.ownership ?? null,
          })
        }
        facts.set(target.id, prior)
      }

      // The address-feature and environment endpoints are batched: one call
      // returns a row per address key, so they are keyed off the row rather
      // than off the request params like the single-address endpoints above.
      if (c.path === '/property/summary') {
        const r = (response.results as Record<string, unknown>[] | undefined)?.[0]
        if (r) {
          const prior = facts.get(target.id) ?? {
            property_id: target.id,
            address_key: addressKey,
            loc_pid: target.chosen.loc_pid ?? null,
          }
          Object.assign(prior, {
            property_type: r.property_type ?? null,
            beds: r.beds ?? null,
            baths: r.baths ?? null,
            parking: r.parking ?? null,
            lot_size: r.lot_size ?? null,
            floor_area: r.floor_area ?? null,
            build_reno_date: r.build_reno_date ?? null,
            own_status: r.own_status ?? null,
          })
          facts.set(target.id, prior)
        }
      }

      if (c.path === '/property/history') {
        for (const [kind, list] of [
          ['sale', response.sales],
          ['rental', response.rentals],
        ] as const) {
          for (const t of (list ?? []) as Record<string, unknown>[]) {
            const eventDate = (t.sale_date ?? t.rental_date ?? t.date) as string | undefined
            if (!eventDate) continue
            transactions.push({
              property_id: target.id,
              kind,
              event_date: String(eventDate).slice(0, 10),
              price: (t.sale_price ?? t.rental_price ?? t.price ?? null) as number | null,
              bedrooms: t.bedrooms ?? null,
              bathrooms: t.bathrooms ?? null,
              car_spaces: t.car_spaces ?? null,
              land_area: t.land_area ?? null,
              floor_area: t.floor_area ?? null,
            })
          }
        }
      }
    }
  }

  const summary = {
    files: files.length,
    market_trends: trends.size,
    market_snapshots: snapshots.size,
    property_market_facts: facts.size,
    property_transactions: transactions.length,
    properties_keyed: keyToProperty.size,
    localities: [...new Set([...trends.values()].map((t) => t.area_id))],
    period_range: (() => {
      const ds = [...trends.values()].map((t) => t.period_end).sort()
      return ds.length ? { from: ds[0], to: ds[ds.length - 1] } : null
    })(),
  }

  if (!apply) {
    return ok({ mode: 'dry-run', dir, note: 'Re-run with ?apply=1 to write.', summary })
  }

  // ---- Write ----------------------------------------------------------------
  const errors: string[] = []

  // Persist the HTAG join keys so future lookups never have to re-geocode.
  for (const [addressKey, target] of keyToProperty) {
    const { error } = await supabase
      .from('properties')
      .update({ htag_address_key: addressKey, htag_loc_pid: target.chosen.loc_pid ?? null })
      .eq('id', target.id)
    if (error) errors.push(`properties ${target.name}: ${error.message}`)
  }

  // Chunked: a 3-year series across several localities comfortably exceeds a
  // comfortable single-statement payload.
  const rows = [...trends.values()]
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from('market_trends')
      .upsert(rows.slice(i, i + 500), {
        onConflict: 'area_id,area_level,period_end,property_type,bedrooms',
      })
    if (error) errors.push(`market_trends: ${error.message}`)
  }

  if (snapshots.size > 0) {
    const { error } = await supabase
      .from('market_snapshots')
      .upsert([...snapshots.values()], { onConflict: 'area_id,area_level,property_type' })
    if (error) errors.push(`market_snapshots: ${error.message}`)
  }

  if (facts.size > 0) {
    const { error } = await supabase
      .from('property_market_facts')
      .upsert([...facts.values()], { onConflict: 'property_id' })
    if (error) errors.push(`property_market_facts: ${error.message}`)
  }

  if (transactions.length > 0) {
    const { error } = await supabase
      .from('property_transactions')
      .upsert(transactions, { onConflict: 'property_id,kind,event_date,price' })
    if (error) errors.push(`property_transactions: ${error.message}`)
  }

  return ok({ mode: 'applied', dir, summary, errors })
}

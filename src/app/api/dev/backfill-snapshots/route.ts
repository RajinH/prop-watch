// THROWAWAY SPIKE — reconstructs historical snapshots so the Growth page has a
// real series to draw. Reads market_trends from Postgres (loaded by
// /api/dev/htag-load), so it never spends on HTAG.
//
// What is honestly derived here, and what is not:
//   value  - back-indexed on the locality price series          -> derived
//   debt   - reverse-amortised from the loan facts              -> derived
//   equity - value - debt, both moving independently            -> derived
//   lvr    - debt / value, likewise                             -> derived
//   rent / repayment / expenses - held flat, no history exists  -> NOT derived
// which means backfilled cashflow is a flat line by construction, and backfilled
// yield is just the price index mirrored. Neither should be read as signal.

import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'
import { resolvePortfolio } from '@/lib/propwatch/db/resolvePortfolio'
import { upsertPropertySnapshot, upsertPortfolioSnapshot } from '@/lib/propwatch/db/snapshotHelpers'
import { reverseAmortise } from '@/lib/propwatch/engine/reverseAmortise'
import type { Property } from '@/lib/propwatch/engine/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') return new Response(null, { status: 404 })

  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const url = new URL(request.url)
  const months = Math.min(Number(url.searchParams.get('months') ?? 36), 120)
  const apply = url.searchParams.get('apply') === '1'

  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('No portfolio', 404)

  const { data: propertyRows } = await supabase
    .from('properties')
    .select('*')
    .eq('portfolio_id', portfolio.id)
  const properties = (propertyRows ?? []) as (Property & { htag_loc_pid: string | null })[]
  if (properties.length === 0) return err('No properties', 400)

  // Every read path takes the LATEST snapshot (order desc, limit 1). Writing on
  // or after the earliest real snapshot would make a reconstructed row the
  // newest one and silently change today's dashboard. So: strictly earlier.
  const { data: earliest } = await supabase
    .from('portfolio_snapshots')
    .select('snapshot_date')
    .eq('portfolio_id', portfolio.id)
    .order('snapshot_date', { ascending: true })
    .limit(1)
    .maybeSingle()
  const boundary = earliest?.snapshot_date ?? new Date().toISOString().slice(0, 10)

  const { data: trendRows } = await supabase
    .from('market_trends')
    .select('area_id,period_end,typical_price')
    .eq('property_type', 'house')
    .in('area_id', [...new Set(properties.map((p) => p.htag_loc_pid).filter(Boolean))] as string[])
    .order('period_end', { ascending: true })

  // area -> 'YYYY-MM' -> typical_price
  const index = new Map<string, Map<string, number>>()
  for (const r of (trendRows ?? []) as { area_id: string; period_end: string; typical_price: number | null }[]) {
    if (r.typical_price == null) continue
    if (!index.has(r.area_id)) index.set(r.area_id, new Map())
    index.get(r.area_id)!.set(r.period_end.slice(0, 7), r.typical_price)
  }

  // Anchor each property's back-indexing on the most recent month we hold for
  // its locality, since that is the month `current_value` corresponds to.
  const monthKey = (d: Date) => d.toISOString().slice(0, 7)
  const dayKey = (d: Date) => d.toISOString().slice(0, 10)

  type Row = {
    date: string
    property_id: string
    property_name: string
    value: number
    debt: number
    value_method: 'indexed' | 'held_flat'
    debt_method: string
    confidence: string
  }
  const rows: Row[] = []
  const perMonth = new Map<string, Property[]>()

  for (const p of properties) {
    const areaIndex = p.htag_loc_pid ? index.get(p.htag_loc_pid) : undefined
    const anchorMonth = areaIndex ? [...areaIndex.keys()].sort().at(-1) : undefined
    const anchorPrice = anchorMonth ? areaIndex!.get(anchorMonth)! : undefined

    const balances = reverseAmortise(p, months, boundary)

    for (const b of balances) {
      // Strictly before the earliest real snapshot.
      if (b.date >= boundary) continue
      const d = new Date(`${b.date}T00:00:00Z`)
      const mk = monthKey(d)

      let value = p.current_value
      let valueMethod: 'indexed' | 'held_flat' = 'held_flat'
      if (areaIndex && anchorPrice) {
        const at = areaIndex.get(mk)
        if (at != null) {
          value = Math.round((p.current_value * at) / anchorPrice)
          valueMethod = 'indexed'
        }
      }

      rows.push({
        date: dayKey(d),
        property_id: p.id,
        property_name: p.name,
        value,
        debt: b.balance,
        value_method: valueMethod,
        debt_method: b.method,
        confidence: b.confidence,
      })

      // Rent, repayment and expenses are held at today's values: no history for
      // them exists anywhere, and back-indexing rent by the locality series would
      // manufacture monthly changes that never happened.
      const synthetic: Property = { ...p, current_value: value, current_debt: b.balance }
      const bucket = perMonth.get(dayKey(d)) ?? []
      bucket.push(synthetic)
      perMonth.set(dayKey(d), bucket)
    }
  }

  const summary = {
    boundary_exclusive: boundary,
    months,
    property_rows: rows.length,
    portfolio_rows: perMonth.size,
    date_range: rows.length
      ? { from: rows.map((r) => r.date).sort()[0], to: rows.map((r) => r.date).sort().at(-1) }
      : null,
    per_property: properties.map((p) => {
      const mine = rows.filter((r) => r.property_id === p.id)
      return {
        name: p.name,
        rows: mine.length,
        earliest: mine.map((r) => r.date).sort()[0] ?? null,
        indexed: mine.filter((r) => r.value_method === 'indexed').length,
        held_flat: mine.filter((r) => r.value_method === 'held_flat').length,
        debt_methods: [...new Set(mine.map((r) => r.debt_method))],
      }
    }),
  }

  if (!apply) {
    return ok({
      mode: 'dry-run',
      note: 'Re-run with ?apply=1 to write. Cashflow will be flat and yield mirrors the price index — see the route header.',
      summary,
      sample: rows.slice(0, 5),
    })
  }

  // NOTE: refreshInsights and runDecisionEngine are deliberately NOT called.
  // Both are portfolio-wide and scoped to "now"; running them from a back-dated
  // path would overwrite the user's live insights and recommendations.
  for (const [date, snapshotProperties] of perMonth) {
    for (const sp of snapshotProperties) {
      await upsertPropertySnapshot(supabase, sp, date)
    }
    await upsertPortfolioSnapshot(supabase, portfolio.id, snapshotProperties, date)
  }

  return ok({ mode: 'applied', summary })
}

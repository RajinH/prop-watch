import { z } from 'zod'
import { resolvePortfolio } from '@/lib/propwatch/db/resolvePortfolio'
import { rerunDecisionEngineForPortfolio } from '@/lib/propwatch/db/decisionHelpers'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'

const overridesSchema = z.object({
  overrides: z.record(z.string(), z.union([z.number(), z.boolean()])),
})

// Only assumptions a strategy actually reads can be overridden.
const ALLOWED_KEYS: Record<string, Set<string>> = {
  review_refinance: new Set(['target_rate', 'remaining_term_years', 'switching_cost_total']),
  review_rent: new Set(['comparable_monthly_rent', 'management_fee_pct', 'uplift_capture_pct']),
  pay_down_debt: new Set(['lump_sum', 'reduce_repayment']),
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const { id } = await params
  const body = await request.json()
  const parsed = overridesSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('Failed to resolve portfolio', 500)

  const { data: existing } = await supabase
    .from('recommendations')
    .select('id, action_type, property_id, status, assumption_overrides')
    .eq('id', id)
    .eq('portfolio_id', portfolio.id)
    .maybeSingle()

  if (!existing) return err('Recommendation not found', 404)
  if (existing.status === 'dismissed' || existing.status === 'completed' || existing.status === 'expired') {
    return err(`Cannot edit assumptions on a ${existing.status} recommendation`, 400)
  }

  const allowed = ALLOWED_KEYS[existing.action_type]
  const invalidKey = Object.keys(parsed.data.overrides).find((key) => !allowed?.has(key))
  if (invalidKey) return err(`"${invalidKey}" is not an editable assumption for this action`, 400)

  const merged = { ...existing.assumption_overrides, ...parsed.data.overrides }

  await supabase
    .from('recommendations')
    .update({ assumption_overrides: merged, updated_at: new Date().toISOString() })
    .eq('id', id)

  // Comparable rent is a property fact, not an assumption — write it through
  // so every consumer (insights, future runs, other strategies) sees it.
  const comparable = parsed.data.overrides.comparable_monthly_rent
  if (typeof comparable === 'number' && existing.property_id) {
    await supabase
      .from('properties')
      .update({
        comparable_monthly_rent: comparable,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.property_id)
  }

  await supabase.from('recommendation_events').insert({
    portfolio_id: portfolio.id,
    recommendation_id: id,
    event_type: 'assumptions_changed',
    payload: { overrides: parsed.data.overrides },
  })

  await rerunDecisionEngineForPortfolio(supabase, portfolio.id, 'assumption_change')

  const { data: recommendation } = await supabase
    .from('recommendations')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  return ok({ recommendation })
}

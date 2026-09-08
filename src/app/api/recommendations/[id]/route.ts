import { z } from 'zod'
import { resolvePortfolio } from '@/lib/propwatch/db/resolvePortfolio'
import { rerunDecisionEngineForPortfolio } from '@/lib/propwatch/db/decisionHelpers'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'

const statusSchema = z
  .object({
    status: z.enum(['investigating', 'deferred', 'dismissed', 'completed']),
    reason: z.string().max(500).optional(),
    deferred_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .refine((obj) => obj.status !== 'deferred' || !!obj.deferred_until, {
    message: 'deferred_until is required when deferring',
  })

// User-driven transitions; the engine owns new/viewed/expired moves.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  new: ['investigating', 'deferred', 'dismissed', 'completed'],
  viewed: ['investigating', 'deferred', 'dismissed', 'completed'],
  investigating: ['deferred', 'dismissed', 'completed'],
  deferred: ['investigating', 'dismissed', 'completed'],
  dismissed: [],
  completed: [],
  expired: [],
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const { id } = await params
  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('Failed to resolve portfolio', 500)

  const { data: recommendation } = await supabase
    .from('recommendations')
    .select('*')
    .eq('id', id)
    .eq('portfolio_id', portfolio.id)
    .maybeSingle()

  if (!recommendation) return err('Recommendation not found', 404)

  if (recommendation.status === 'new') {
    await supabase
      .from('recommendations')
      .update({ status: 'viewed', updated_at: new Date().toISOString() })
      .eq('id', id)
    await supabase.from('recommendation_events').insert({
      portfolio_id: portfolio.id,
      recommendation_id: id,
      event_type: 'viewed',
      from_status: 'new',
      to_status: 'viewed',
    })
    recommendation.status = 'viewed'
  }

  const { data: outcome } = await supabase
    .from('recommendation_outcomes')
    .select('*')
    .eq('recommendation_id', id)
    .maybeSingle()

  return ok({ recommendation, outcome: outcome ?? null })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const { id } = await params
  const body = await request.json()
  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('Failed to resolve portfolio', 500)

  const { data: existing } = await supabase
    .from('recommendations')
    .select('id, status, payload')
    .eq('id', id)
    .eq('portfolio_id', portfolio.id)
    .maybeSingle()

  if (!existing) return err('Recommendation not found', 404)

  const { status, reason, deferred_until } = parsed.data
  if (!ALLOWED_TRANSITIONS[existing.status]?.includes(status)) {
    return err(`Cannot move a ${existing.status} recommendation to ${status}`, 400)
  }

  const { data: updated, error: updateErr } = await supabase
    .from('recommendations')
    .update({
      status,
      status_reason: reason ?? null,
      deferred_until: status === 'deferred' ? deferred_until : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (updateErr || !updated) return err('Failed to update recommendation', 500)

  await supabase.from('recommendation_events').insert({
    portfolio_id: portfolio.id,
    recommendation_id: id,
    event_type: 'status_changed',
    from_status: existing.status,
    to_status: status,
    reason: reason ?? null,
    // Snapshot at transition time — part of the immutable audit trail
    payload: { recommendation: existing.payload },
  })

  await rerunDecisionEngineForPortfolio(supabase, portfolio.id, 'status_change')

  return ok({ recommendation: updated })
}

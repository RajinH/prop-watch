import { z } from 'zod'
import { resolvePortfolio } from '@/lib/propwatch/db/resolvePortfolio'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'

const outcomeSchema = z.object({
  actual_monthly_delta: z.number().nullable().optional(),
  actual_one_off_cost: z.number().nonnegative().nullable().optional(),
  actual_rate: z.number().min(0).max(1).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const { id } = await params
  const body = await request.json()
  const parsed = outcomeSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('Failed to resolve portfolio', 500)

  const { data: recommendation } = await supabase
    .from('recommendations')
    .select('id, status, payload')
    .eq('id', id)
    .eq('portfolio_id', portfolio.id)
    .maybeSingle()

  if (!recommendation) return err('Recommendation not found', 404)
  if (recommendation.status !== 'completed') {
    return err('Outcomes can only be recorded on completed recommendations', 400)
  }

  const payload = recommendation.payload as { impact?: Record<string, unknown> } | null
  const { data: outcome, error: upsertErr } = await supabase
    .from('recommendation_outcomes')
    .upsert(
      {
        portfolio_id: portfolio.id,
        recommendation_id: id,
        // Freeze the estimate at completion for est-vs-actual comparison
        estimated: payload?.impact ?? {},
        ...parsed.data,
      },
      { onConflict: 'recommendation_id' }
    )
    .select('*')
    .single()

  if (upsertErr || !outcome) return err('Failed to record outcome', 500)

  await supabase.from('recommendation_events').insert({
    portfolio_id: portfolio.id,
    recommendation_id: id,
    event_type: 'outcome_recorded',
    payload: { outcome_id: outcome.id },
  })

  return ok({ outcome }, 201)
}

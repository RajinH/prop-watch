import { z } from 'zod'
import { resolvePortfolio } from '@/lib/propwatch/db/resolvePortfolio'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'

// Client-emitted analytics pings only — engine and status events are
// written server-side by their own routes.
const eventSchema = z.object({
  event_type: z.enum(['assumptions_opened']),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const { id } = await params
  const body = await request.json()
  const parsed = eventSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('Failed to resolve portfolio', 500)

  const { data: existing } = await supabase
    .from('recommendations')
    .select('id')
    .eq('id', id)
    .eq('portfolio_id', portfolio.id)
    .maybeSingle()

  if (!existing) return err('Recommendation not found', 404)

  await supabase.from('recommendation_events').insert({
    portfolio_id: portfolio.id,
    recommendation_id: id,
    event_type: parsed.data.event_type,
  })

  return ok({ success: true })
}

import { z } from 'zod'
import { resolvePortfolio } from '@/lib/propwatch/db/resolvePortfolio'
import { rerunDecisionEngineForPortfolio } from '@/lib/propwatch/db/decisionHelpers'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'

const goalSchema = z.object({
  type: z.enum(['improve_cashflow', 'prepare_next_purchase', 'reduce_debt', 'reduce_risk']),
  target_value: z.number().positive().nullable().optional(),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  max_monthly_deficit: z.number().nonnegative().nullable().optional(),
  minimum_cash_buffer: z.number().nonnegative().nullable().optional(),
  risk_tolerance: z.enum(['conservative', 'balanced', 'growth']).default('balanced'),
  available_lump_sum: z.number().nonnegative().nullable().optional(),
})

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('Failed to resolve portfolio', 500)

  const { data: goal } = await supabase
    .from('investor_goals')
    .select('*')
    .eq('portfolio_id', portfolio.id)
    .maybeSingle()

  return ok({ goal: goal ?? null })
}

export async function PUT(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const body = await request.json()
  const parsed = goalSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('Failed to resolve portfolio', 500)

  const { data: goal, error: upsertErr } = await supabase
    .from('investor_goals')
    .upsert(
      {
        portfolio_id: portfolio.id,
        ...parsed.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'portfolio_id' }
    )
    .select('*')
    .single()

  if (upsertErr || !goal) return err('Failed to save goal', 500)

  await rerunDecisionEngineForPortfolio(supabase, portfolio.id, 'goal_change')

  return ok({ goal })
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('Failed to resolve portfolio', 500)

  await supabase.from('investor_goals').delete().eq('portfolio_id', portfolio.id)
  await rerunDecisionEngineForPortfolio(supabase, portfolio.id, 'goal_change')

  return ok({ success: true })
}

import { z } from 'zod'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'
import { ok, err } from '@/lib/propwatch/api/respond'

const settingsSchema = z.object({
  passive_income_target: z.number().positive().nullable().optional(),
  income_tax_bracket: z.number().min(0).max(1).optional(),
})

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const { data } = await supabase
    .from('portfolios')
    .select('passive_income_target, income_tax_bracket')
    .eq('user_id', user.id).order('created_at').limit(1).maybeSingle()

  return ok({
    passive_income_target: data?.passive_income_target ?? null,
    income_tax_bracket: data?.income_tax_bracket ?? 0.325,
  })
}

export async function PATCH(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const body = await request.json()
  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

  const { data: portfolio } = await supabase
    .from('portfolios').select('id').eq('user_id', user.id)
    .order('created_at').limit(1).maybeSingle()
  if (!portfolio) return err('No portfolio', 404)

  await supabase.from('portfolios').update(parsed.data).eq('id', portfolio.id)
  return ok({ success: true })
}

import { z } from 'zod'
import { resolvePortfolio } from '@/lib/propwatch/db/resolvePortfolio'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'

const scenarioSaveSchema = z.object({
  name: z.string().min(1).max(200),
  config: z.record(z.string(), z.unknown()),
})

export async function POST(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const body = await request.json()
  const parsed = scenarioSaveSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('Failed to resolve portfolio', 500)

  const { data: scenario, error: insertErr } = await supabase
    .from('scenarios')
    .insert({
      portfolio_id: portfolio.id,
      name: parsed.data.name,
      config: parsed.data.config,
    })
    .select('*')
    .single()

  if (insertErr || !scenario) return err('Failed to save scenario', 500)

  return ok({ scenario }, 201)
}

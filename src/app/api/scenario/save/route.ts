import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { resolvePortfolio } from '@/lib/propwatch/db/resolvePortfolio'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getAuthUser } from '@/lib/propwatch/api/getAuthUser'

const scenarioSaveSchema = z.object({
  name: z.string().min(1).max(200),
  config: z.record(z.unknown()),
})

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const user = await getAuthUser(supabase, request)
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

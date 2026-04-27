import type { SupabaseClient } from '@supabase/supabase-js'

export type ResolvedPortfolio = {
  id: string
  user_id: string
  name: string
}

export async function resolvePortfolio(
  supabase: SupabaseClient,
  userId: string
): Promise<ResolvedPortfolio | null> {
  // Ensure profile row exists (idempotent)
  await supabase
    .from('profiles')
    .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })

  // Fetch the user's first portfolio
  const { data: existing } = await supabase
    .from('portfolios')
    .select('id, user_id, name')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existing) return existing

  // Create the default portfolio
  const { data: created, error } = await supabase
    .from('portfolios')
    .insert({ user_id: userId, name: 'My Portfolio' })
    .select('id, user_id, name')
    .single()

  if (error || !created) return null
  return created
}

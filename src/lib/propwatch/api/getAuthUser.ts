import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

// Supports both cookie-based auth (browser) and Bearer token auth (Postman/API clients).
// supabase.auth.getUser(jwt) validates the token against the Supabase Auth server.
export async function getAuthUser(
  supabase: SupabaseClient,
  request: Request
): Promise<User | null> {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data } = await supabase.auth.getUser(token)
    return data.user ?? null
  }

  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient, User } from '@supabase/supabase-js'

export type SupabaseWithUser = {
  supabase: SupabaseClient
  user: User | null
}

// Creates a Supabase client with the correct auth context for both
// cookie-based (browser) and Bearer token (Postman/API) auth.
// When a Bearer token is present it is injected into global.headers so
// auth.uid() resolves correctly in RLS policies for all DB queries.
export async function getSupabaseWithUser(request: Request): Promise<SupabaseWithUser> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  const { data } = token
    ? await supabase.auth.getUser(token)
    : await supabase.auth.getUser()

  return { supabase, user: data.user ?? null }
}

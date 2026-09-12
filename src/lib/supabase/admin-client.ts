import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client. Bypasses RLS entirely.
 *
 * Exists for one caller: the Stripe webhook, which arrives with no user cookie
 * and must write `entitlements` — a table with no write policy for anyone.
 * Never import this from a client component, from `src/proxy.ts`, or from
 * anything either transitively pulls in.
 *
 * In development this must pair with the LOCAL Supabase URL: Next loads
 * .env.development.local ahead of .env.local, so a hosted secret key in
 * .env.local would be used against the local database and fail.
 */
let client: SupabaseClient | null = null

export function getSupabaseAdminClient(): SupabaseClient {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!url || !secret) {
    throw new Error(
      'SUPABASE_SECRET_KEY / NEXT_PUBLIC_SUPABASE_URL are required for the admin client'
    )
  }

  client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return client
}

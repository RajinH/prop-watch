import type { SupabaseClient, User } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'
import { resolveAccess, type Access, type EntitlementRow } from './resolveAccess'

const ENTITLEMENT_COLUMNS =
  'stripe_status, stripe_access_until, comp_source, comp_until'

/**
 * Read the user's entitlement and resolve it. One indexed primary-key lookup —
 * no Stripe API call on the request path, ever.
 *
 * A missing row is not an error: users who signed up after the paywall have no
 * entitlement until they subscribe or redeem a code.
 */
export async function getAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<Access> {
  const { data } = await supabase
    .from('entitlements')
    .select(ENTITLEMENT_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle()

  return resolveAccess((data as EntitlementRow | null) ?? null)
}

/**
 * Gate for server components. Redirects rather than returning, so a caller
 * cannot accidentally render paid content by ignoring the result.
 *
 * Used by the `(paid)` route group layout, which covers every paid page at
 * once. `/settings` deliberately sits outside that group so an unsubscribed
 * user can still reach billing.
 */
export async function requirePaidAccess() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/signin')

  const access = await getAccess(supabase, user.id)
  if (!access.hasAccess) redirect('/pricing')

  return { supabase, user, access }
}

/**
 * Gate for API route handlers — the paid sibling of `getSupabaseWithUser`.
 * Routes stay thin: `if (!access.hasAccess) return err('Subscription required', 402)`.
 */
export async function getSupabaseWithPaidUser(
  request: Request
): Promise<
  | { supabase: SupabaseClient; user: null; access: null }
  | { supabase: SupabaseClient; user: User; access: Access }
> {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return { supabase, user: null, access: null }

  const access = await getAccess(supabase, user.id)
  return { supabase, user, access }
}

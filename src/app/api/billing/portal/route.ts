import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'
import { getStripe, isStripeConfigured } from '@/lib/propwatch/stripe/server'

/**
 * Send the user to the Stripe Customer Portal to update payment details,
 * switch plans or cancel.
 *
 * Not gated on entitlement: someone whose subscription just lapsed still needs
 * to reach the portal to fix their card.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) return err('Billing is not configured', 503)

  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const { data: entitlement } = await supabase
    .from('entitlements')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!entitlement?.stripe_customer_id) return err('No billing account yet', 404)

  const origin = request.headers.get('origin') ?? new URL(request.url).origin

  const session = await getStripe().billingPortal.sessions.create({
    customer: entitlement.stripe_customer_id,
    return_url: `${origin}/settings`,
  })

  return ok({ url: session.url })
}

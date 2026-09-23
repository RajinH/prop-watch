import { z } from 'zod'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'
import { getAccess } from '@/lib/propwatch/access/getAccess'
import { getStripe, isStripeConfigured, resolvePriceId } from '@/lib/propwatch/stripe/server'
import { FLOWS, isFlowKey } from '@/lib/propwatch/stripe/flows'

const checkoutSchema = z.object({
  flow: z.string().refine(isFlowKey, 'Unknown checkout flow'),
})

export async function POST(request: Request) {
  if (!isStripeConfigured()) return err('Billing is not configured', 503)

  // Deliberately not gated on entitlement: this is how a walled user gets out.
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const body = await request.json()
  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

  const flow = FLOWS[parsed.data.flow as keyof typeof FLOWS]

  // Stripe's own duplicate guard doesn't cover `trialing` or `incomplete`, and
  // depends on a Dashboard setting invisible from here. Check ourselves, or a
  // user who reloads the pricing page mid-trial can buy a second subscription.
  const { data: entitlement } = await supabase
    .from('entitlements')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const access = await getAccess(supabase, user.id)
  if (access.hasAccess && access.source === 'stripe') {
    return err('You already have an active subscription', 409)
  }

  const priceId = await resolvePriceId(flow.lookupKey)
  if (!priceId) return err(`No active price for ${flow.lookupKey}`, 503)

  const origin = request.headers.get('origin') ?? new URL(request.url).origin
  const stripe = getStripe()

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    // payment_method_types is deliberately omitted so Stripe serves whatever is
    // enabled in the Dashboard; hardcoding ['card'] suppresses Link, Apple Pay
    // and Google Pay, which cost nothing to support and lift conversion.
    line_items: [{ price: priceId, quantity: 1 }],

    // client_reference_id is the only way the webhook can map this back to a
    // Supabase user, since it is the sole event carrying it.
    client_reference_id: user.id,
    ...(entitlement?.stripe_customer_id
      ? { customer: entitlement.stripe_customer_id }
      : { customer_email: user.email }),

    subscription_data: {
      ...(flow.trialDays ? { trial_period_days: flow.trialDays } : {}),
      ...(flow.trialDays && !flow.collectCard
        ? { trial_settings: { end_behavior: { missing_payment_method: 'cancel' as const } } }
        : {}),
      // Session metadata does NOT propagate to the subscription; this does, so
      // later customer.subscription.* events can still find the user.
      metadata: { supabase_user_id: user.id, flow: flow.key },
    },

    payment_method_collection: flow.collectCard ? 'always' : 'if_required',
    ...(flow.allowPromotionCodes ? { allow_promotion_codes: true } : {}),

    metadata: { supabase_user_id: user.id, flow: flow.key },

    // Per-variant conversion in the Stripe Dashboard with no analytics wiring.
    integration_identifier: `pw_${flow.key}`,

    ui_mode: 'hosted_page',
    success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?checkout=cancelled`,
  })

  return ok({ url: session.url })
}

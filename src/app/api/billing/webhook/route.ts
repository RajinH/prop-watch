import type Stripe from 'stripe'
import { getStripe } from '@/lib/propwatch/stripe/server'
import { linkCheckoutSession, syncSubscription } from '@/lib/propwatch/stripe/sync'

/**
 * Stripe webhook.
 *
 * Node runtime: `constructEvent` is synchronous and uses Node crypto (the edge
 * path would need `constructEventAsync` plus a SubtleCrypto provider), and the
 * admin Supabase client belongs on the server anyway.
 *
 * No body-parser configuration exists or is needed in this router —
 * `request.text()` is the unmodified raw body, which is what signature
 * verification requires.
 */
export const runtime = 'nodejs'

const HANDLED = new Set<Stripe.Event['type']>([
  // The only events carrying client_reference_id, so the only place the
  // Supabase user can be linked to a Stripe customer.
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  // The workhorse: renewals, plan changes, cancellations and every status
  // transition arrive as `updated`.
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return new Response('Webhook not configured', { status: 503 })

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature) return new Response('Missing stripe-signature', { status: 400 })

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error'
    console.error(`[stripe] signature verification failed: ${message}`)
    return new Response(`Webhook Error: ${message}`, { status: 400 })
  }

  if (!HANDLED.has(event.type)) return Response.json({ received: true })

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        // Checkout waits up to 10s for this response before redirecting to
        // success_url, so the write happens inline rather than being queued —
        // otherwise the dashboard can load before the entitlement exists.
        await linkCheckoutSession(event.data.object.id)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object.id)
        break
    }
  } catch (e) {
    console.error(`[stripe] handler for ${event.type} failed`, e)
    // 500 tells Stripe to retry with backoff.
    return new Response('Handler error', { status: 500 })
  }

  return Response.json({ received: true })
}

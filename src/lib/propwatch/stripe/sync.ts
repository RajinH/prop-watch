import 'server-only'
import type Stripe from 'stripe'
import { getStripe } from './server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client'

/**
 * Mirrors Stripe subscription state into `entitlements`.
 *
 * Every handler takes an object ID and re-reads it from Stripe rather than
 * trusting the event payload. Stripe does not guarantee event ordering, so
 * re-reading current truth is idempotent by construction: replaying an old
 * event produces the same result as the newest one. `stripe_synced_at` then
 * drops a write from a handler that lost a race with a concurrent one.
 */

/** Extra time granted past the paid-through date, as Stripe's own guide suggests. */
const LEEWAY_SECONDS = 86_400

const toIso = (unix: number | null | undefined) =>
  typeof unix === 'number' ? new Date(unix * 1000).toISOString() : null

/**
 * Resolve the Supabase user for a subscription.
 *
 * Prefers the metadata stamped at checkout, because `customer.subscription.*`
 * events can arrive before `checkout.session.completed` has linked the customer
 * — and a subscription created outside Checkout has no link at all.
 */
/**
 * Ensure the `profiles` row exists before writing an entitlement that
 * references it.
 *
 * Profiles are created lazily by resolvePortfolio() on first page load, so a
 * webhook can easily arrive first — a user who subscribes immediately after
 * signing up has an auth.users row but no profile, and the entitlements FK
 * would reject the write.
 */
async function ensureProfile(userId: string): Promise<void> {
  const { error } = await getSupabaseAdminClient()
    .from('profiles')
    .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })

  if (error) throw new Error(`could not ensure profile ${userId}: ${error.message}`)
}

async function resolveUserId(sub: Stripe.Subscription, customerId: string): Promise<string | null> {
  const fromMetadata = sub.metadata?.supabase_user_id
  if (fromMetadata) return fromMetadata

  const { data } = await getSupabaseAdminClient()
    .from('entitlements')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  return data?.user_id ?? null
}

export async function syncSubscription(subscriptionId: string): Promise<void> {
  const sub = await getStripe().subscriptions.retrieve(subscriptionId)
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const item = sub.items.data[0]

  const userId = await resolveUserId(sub, customerId)
  if (!userId) {
    // Nothing to attach this to yet. checkout.session.completed will link the
    // customer and call back here, so this is expected, not an error.
    console.warn(`[stripe] no PropWatch user for subscription ${sub.id}; skipping`)
    return
  }

  // `current_period_end` was removed from the subscription object — it lives on
  // the subscription item now.
  const periodEnd = item?.current_period_end ?? null
  const syncedAt = new Date().toISOString()

  const db = getSupabaseAdminClient()

  await ensureProfile(userId)

  // Ensure the row exists before the guarded update below.
  const { error: upsertError } = await db
    .from('entitlements')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })

  if (upsertError) {
    throw new Error(`entitlement upsert failed for ${userId}: ${upsertError.message}`)
  }

  const { error } = await db
    .from('entitlements')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      stripe_price_id: item?.price.id ?? null,
      stripe_status: sub.status,
      stripe_access_until: periodEnd ? toIso(periodEnd + LEEWAY_SECONDS) : null,
      // With flexible billing mode (the default since 2025-09-30), a Customer
      // Portal cancellation leaves cancel_at_period_end false and sets
      // cancel_at. Reading the former would miss every portal cancellation.
      stripe_cancel_at: toIso(sub.cancel_at),
      stripe_trial_end: toIso(sub.trial_end),
      stripe_synced_at: syncedAt,
      updated_at: syncedAt,
    })
    .eq('user_id', userId)
    .or(`stripe_synced_at.is.null,stripe_synced_at.lt.${syncedAt}`)

  if (error) throw new Error(`entitlement sync failed for ${sub.id}: ${error.message}`)
}

/**
 * Establish the auth.users.id -> Stripe customer link.
 *
 * `checkout.session.completed` is the only event carrying `client_reference_id`,
 * so it is the only place this mapping can be made.
 */
export async function linkCheckoutSession(sessionId: string): Promise<void> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId)

  // A delayed-notification payment method hasn't cleared yet; the matching
  // async_payment_succeeded event will bring us back here.
  if (session.payment_status === 'unpaid') return

  const userId = session.client_reference_id ?? session.metadata?.supabase_user_id
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null

  if (!userId || !customerId) {
    console.warn(`[stripe] checkout session ${sessionId} missing user or customer link`)
    return
  }

  await ensureProfile(userId)

  const { error } = await getSupabaseAdminClient()
    .from('entitlements')
    .upsert(
      { user_id: userId, stripe_customer_id: customerId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

  if (error) throw new Error(`customer link failed for ${userId}: ${error.message}`)

  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  if (subscriptionId) await syncSubscription(subscriptionId)
}

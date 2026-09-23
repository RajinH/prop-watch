/**
 * The single answer to "does this user have access?".
 *
 * Pure and deterministic, like the engine — no I/O, no framework. Every gate in
 * the app (page, layout, API route) resolves access through this one function,
 * so a comped user and a paying user can never diverge. Gating directly on a
 * Stripe subscription status is the classic bug here: a comped user has no
 * Stripe record at all, so their status is empty and they get bounced out of
 * paid content.
 */

/** Stripe's subscription statuses, verbatim. */
export type StripeStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'

export type EntitlementRow = {
  stripe_status: string | null
  stripe_access_until: string | null
  comp_source: 'code' | 'staff' | null
  comp_until: string | null
}

export type AccessReason =
  | 'no_entitlement'
  | 'comp_forever'
  | 'comp_active'
  | 'comp_expired'
  | 'stripe_trialing'
  | 'stripe_active'
  | 'stripe_past_due'
  | 'stripe_lapsed'
  | 'no_subscription'

export type Access = {
  hasAccess: boolean
  source: 'stripe' | 'comp' | null
  reason: AccessReason
}

/**
 * Statuses that grant access.
 *
 * `past_due` grants access deliberately. Stripe's guidance is to notify on
 * `past_due` and revoke on `unpaid` — by `unpaid`, payment has already been
 * retried and exhausted. Treating `past_due` as "not subscribed" is a known
 * foot-gun: the user sees a paywall, buys a *second* subscription, and then
 * Stripe's retry succeeds on the first, leaving two active subscriptions on one
 * account.
 */
const ACCESS_STATUSES = new Set<string>(['trialing', 'active', 'past_due'])

const REASON_BY_STATUS: Record<string, AccessReason> = {
  trialing: 'stripe_trialing',
  active: 'stripe_active',
  past_due: 'stripe_past_due',
}

export function resolveAccess(
  entitlement: EntitlementRow | null | undefined,
  now: Date = new Date()
): Access {
  if (!entitlement) {
    return { hasAccess: false, source: null, reason: 'no_entitlement' }
  }

  const { comp_source, comp_until, stripe_status, stripe_access_until } = entitlement

  // Comps take precedence: a comped user who also once subscribed keeps access
  // even after that subscription lapses.
  if (comp_source) {
    if (comp_until === null) {
      return { hasAccess: true, source: 'comp', reason: 'comp_forever' }
    }
    if (new Date(comp_until) > now) {
      return { hasAccess: true, source: 'comp', reason: 'comp_active' }
    }
    // An expired comp falls through to Stripe rather than short-circuiting —
    // a comped user who later subscribed properly must keep their access.
  }

  if (stripe_status && ACCESS_STATUSES.has(stripe_status)) {
    // Belt-and-braces against a missed `customer.subscription.deleted`: if the
    // paid-through date is present and has passed, the mirror is stale and the
    // status can't be trusted. Absent the date we trust the status.
    if (stripe_access_until && new Date(stripe_access_until) <= now) {
      return { hasAccess: false, source: null, reason: 'stripe_lapsed' }
    }
    return {
      hasAccess: true,
      source: 'stripe',
      reason: REASON_BY_STATUS[stripe_status],
    }
  }

  if (comp_source && comp_until !== null) {
    return { hasAccess: false, source: null, reason: 'comp_expired' }
  }

  return { hasAccess: false, source: null, reason: 'no_subscription' }
}

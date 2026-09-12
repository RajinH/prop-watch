/**
 * Checkout flow variants.
 *
 * The point of the paywall is to compare payment journeys, and every variable
 * worth testing is a parameter on the same Checkout Session — so the variants
 * live here rather than being scattered across routes. `/pricing?flow=<key>`
 * selects one.
 *
 * Prices are referenced by `lookup_key`, never by price ID: running
 * `scripts/stripe-setup.mjs --reprice --monthly=3900` moves the key onto a new
 * Price, so new signups get the new amount with no deploy while existing
 * subscribers keep what they signed up at.
 */
export type FlowKey = 'direct_monthly' | 'direct_annual' | 'trial14_card' | 'trial14_nocard'

export type Flow = {
  key: FlowKey
  label: string
  blurb: string
  lookupKey: string
  trialDays?: number
  /**
   * `false` sets payment_method_collection: 'if_required', so no card is taken
   * up front. Pairs with trial_settings.end_behavior.missing_payment_method,
   * otherwise the trial has no way to end.
   */
  collectCard: boolean
  allowPromotionCodes: boolean
}

export const FLOWS: Record<FlowKey, Flow> = {
  direct_monthly: {
    key: 'direct_monthly',
    label: 'Monthly',
    blurb: 'A$29/month, cancel anytime',
    lookupKey: 'propwatch_pro_monthly_aud',
    collectCard: true,
    allowPromotionCodes: true,
  },
  direct_annual: {
    key: 'direct_annual',
    label: 'Annual',
    blurb: 'A$290/year — two months free',
    lookupKey: 'propwatch_pro_annual_aud',
    collectCard: true,
    allowPromotionCodes: true,
  },
  trial14_card: {
    key: 'trial14_card',
    label: '14-day trial',
    blurb: 'Card up front, first charge in 14 days',
    lookupKey: 'propwatch_pro_monthly_aud',
    trialDays: 14,
    collectCard: true,
    allowPromotionCodes: false,
  },
  trial14_nocard: {
    key: 'trial14_nocard',
    label: '14-day trial, no card',
    blurb: 'No card required — cancels automatically unless you add one',
    lookupKey: 'propwatch_pro_monthly_aud',
    trialDays: 14,
    collectCard: false,
    allowPromotionCodes: false,
  },
}

export const DEFAULT_FLOWS: FlowKey[] = ['direct_monthly', 'direct_annual']

export function isFlowKey(value: string): value is FlowKey {
  return value in FLOWS
}

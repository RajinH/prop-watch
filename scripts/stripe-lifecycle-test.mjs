#!/usr/bin/env node
/**
 * Drive a subscription through its whole lifecycle against a Stripe test clock,
 * so the webhook and entitlement mirror can be checked without waiting a month.
 *
 *   node scripts/stripe-lifecycle-test.mjs --user=<supabase-user-uuid>
 *
 * Requires the dev server running and `stripe listen --forward-to
 * localhost:3000/api/billing/webhook` forwarding events.
 *
 * Walks: trialing -> active -> past_due -> canceled, printing the status at each
 * step so you can watch the entitlements row follow along.
 *
 * Test-clock constraints worth knowing, all learned the hard way:
 *   - `test_clock` is settable ONLY at customer creation; it can never be added
 *     to an existing customer, so a real user can't be backdated onto a clock.
 *   - Advancing is asynchronous — poll until status is `ready`.
 *   - A draft invoice sits for about an hour before finalising, so reaching the
 *     first failed payment takes TWO advances: past the trial, then +2h.
 *   - At most two billing intervals per advance.
 *   - `pm_card_visa` succeeds forever and cannot exercise dunning; use
 *     `pm_card_chargeCustomerFail`, which attaches cleanly then fails at charge.
 */
import Stripe from 'stripe'
import { loadEnv, arg } from './_env.mjs'

loadEnv()

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('STRIPE_SECRET_KEY is not set.')
  process.exit(1)
}
if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) {
  console.error('Refusing to run against live mode.')
  process.exit(1)
}

const userId = arg('user')
if (!userId) {
  console.error('Usage: --user=<supabase-user-uuid> [--keep]')
  process.exit(1)
}
const keep = process.argv.includes('--keep')

const stripe = new Stripe(key)
const DAY = 86_400

async function advanceTo(clockId, unix) {
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: unix })
  for (;;) {
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId)
    if (clock.status === 'ready') return
    if (clock.status === 'internal_failure') throw new Error('test clock entered internal_failure')
    await new Promise((r) => setTimeout(r, 2000))
  }
}

async function status(subscriptionId) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  return sub.status
}

const t0 = Math.floor(Date.now() / 1000)
const clock = await stripe.testHelpers.testClocks.create({
  frozen_time: t0,
  name: `PropWatch lifecycle ${new Date(t0 * 1000).toISOString()}`,
})

const customer = await stripe.customers.create({
  email: `lifecycle-${t0}@test.local`,
  test_clock: clock.id,
  payment_method: 'pm_card_chargeCustomerFail',
  invoice_settings: { default_payment_method: 'pm_card_chargeCustomerFail' },
})

const prices = await stripe.prices.list({
  lookup_keys: ['propwatch_pro_monthly_aud'],
  active: true,
  limit: 1,
})
if (!prices.data[0]) {
  console.error('No active propwatch_pro_monthly_aud price. Run scripts/stripe-setup.mjs first.')
  process.exit(1)
}

const sub = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: prices.data[0].id }],
  trial_period_days: 14,
  metadata: { supabase_user_id: userId },
})

console.log(`\nclock ${clock.id}  subscription ${sub.id}\n`)
console.log(`  trial started        ${await status(sub.id)}`)

await advanceTo(clock.id, t0 + 14 * DAY + 60)
console.log(`  trial ended          ${await status(sub.id)}`)

await advanceTo(clock.id, t0 + 14 * DAY + 2 * 3600)
console.log(`  first charge failed  ${await status(sub.id)}   (access should be RETAINED)`)

for (const day of [30, 45, 60]) {
  await advanceTo(clock.id, t0 + 14 * DAY + day * DAY)
  const s = await status(sub.id)
  console.log(`  dunning +${String(day).padEnd(3)}         ${s}`)
  if (s === 'canceled' || s === 'unpaid') break
}

if (keep) {
  console.log(`\nLeft in place. Clean up with: stripe test_helpers test_clocks delete ${clock.id}\n`)
} else {
  await stripe.testHelpers.testClocks.del(clock.id)
  console.log('\nTest clock deleted (its customer and subscription go with it).\n')
}

#!/usr/bin/env node
/**
 * Provision the Stripe objects PropWatch needs. Idempotent — safe to re-run,
 * and it is how live mode gets configured later (same script, live key).
 *
 *   node scripts/stripe-setup.mjs
 *   node scripts/stripe-setup.mjs --monthly=3900 --annual=39000
 *
 * Creates, if missing:
 *   - Product  "PropWatch Pro"
 *   - Prices   propwatch_pro_monthly_aud / propwatch_pro_annual_aud
 *   - The Customer Portal configuration
 *
 * Prices are immutable in Stripe (only metadata, nickname and active can
 * change), so repricing is a separate operation — see --reprice below.
 */
import Stripe from 'stripe'
import { loadEnv, arg } from './_env.mjs'

loadEnv()

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('STRIPE_SECRET_KEY is not set. Add it to .env.local first.')
  process.exit(1)
}

// apiVersion intentionally omitted: stripe@22.x pins the version it was built
// against, which keeps the TypeScript types and the wire format in agreement.
const stripe = new Stripe(key, { appInfo: { name: 'PropWatch', version: '0.1.0' } })

const PRODUCT_KEY = 'propwatch_pro'
const MONTHLY_LOOKUP = 'propwatch_pro_monthly_aud'
const ANNUAL_LOOKUP = 'propwatch_pro_annual_aud'

const monthlyAmount = Number(arg('monthly', '2900'))
const annualAmount = Number(arg('annual', '29000'))
const reprice = process.argv.includes('--reprice')

const live = key.startsWith('sk_live_') || key.startsWith('rk_live_')
const fmt = (cents) => `A$${(cents / 100).toFixed(2)}`

console.log(`\nStripe setup — ${live ? 'LIVE MODE' : 'test mode'}\n`)
if (live) {
  console.log('Refusing to run against live mode without --i-mean-it.')
  if (!process.argv.includes('--i-mean-it')) process.exit(1)
}

/** Find our product by metadata, so a renamed product is still matched. */
async function ensureProduct() {
  const existing = await stripe.products.list({ active: true, limit: 100 })
  const found = existing.data.find((p) => p.metadata?.propwatch_key === PRODUCT_KEY)
  if (found) {
    console.log(`  product   ${found.id}  (existing)`)
    return found
  }
  const created = await stripe.products.create({
    name: 'PropWatch Pro',
    description: 'Portfolio intelligence for residential property investors.',
    metadata: { propwatch_key: PRODUCT_KEY },
  })
  console.log(`  product   ${created.id}  (created)`)
  return created
}

/**
 * Resolve a price by lookup_key, creating it if absent.
 *
 * With --reprice, a new Price is created and `transfer_lookup_key` moves the
 * key off the old one: new signups get the new amount on the next request with
 * no deploy, and existing subscribers keep the price they signed up at.
 */
async function ensurePrice(product, lookupKey, interval, unitAmount) {
  const found = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })
  const current = found.data[0]

  if (current && !reprice) {
    console.log(`  price     ${lookupKey}  ${fmt(current.unit_amount)}/${interval}  (existing)`)
    return current
  }
  if (current && current.unit_amount === unitAmount) {
    console.log(`  price     ${lookupKey}  ${fmt(unitAmount)}/${interval}  (unchanged)`)
    return current
  }

  const created = await stripe.prices.create({
    product: product.id,
    currency: 'aud',
    unit_amount: unitAmount,
    recurring: { interval },
    lookup_key: lookupKey,
    transfer_lookup_key: Boolean(current),
  })

  if (current) {
    await stripe.prices.update(current.id, { active: false })
    console.log(
      `  price     ${lookupKey}  ${fmt(current.unit_amount)} -> ${fmt(unitAmount)}/${interval}  (repriced; old price archived)`
    )
  } else {
    console.log(`  price     ${lookupKey}  ${fmt(unitAmount)}/${interval}  (created)`)
  }
  return created
}

/**
 * The Customer Portal needs a saved configuration or portal sessions fail.
 *
 * trial_update_behavior: 'continue_trial' matters — by default, a customer
 * modifying a trialing subscription in the portal ends the trial and is
 * invoiced immediately.
 */
async function ensurePortal(product, prices) {
  const existing = await stripe.billingPortal.configurations.list({ limit: 100 })
  const found = existing.data.find((c) => c.metadata?.propwatch_key === PRODUCT_KEY)

  const features = {
    customer_update: { enabled: true, allowed_updates: ['email', 'address'] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: 'at_period_end' },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ['price'],
      products: [{ product: product.id, prices: prices.map((p) => p.id) }],
      trial_update_behavior: 'continue_trial',
    },
  }

  const params = {
    business_profile: { headline: 'PropWatch — manage your subscription' },
    features,
    metadata: { propwatch_key: PRODUCT_KEY },
  }

  try {
    const cfg = found
      ? await stripe.billingPortal.configurations.update(found.id, params)
      : await stripe.billingPortal.configurations.create(params)
    console.log(`  portal    ${cfg.id}  (${found ? 'updated' : 'created'})`)
    await reportPortal(cfg.id)
    return cfg
  } catch (e) {
    if (/trial_update_behavior/.test(e?.message ?? '')) {
      // Older API versions don't accept the parameter; proceed without it but
      // say so loudly, because the default silently bills trialing customers.
      delete features.subscription_update.trial_update_behavior
      const cfg = found
        ? await stripe.billingPortal.configurations.update(found.id, params)
        : await stripe.billingPortal.configurations.create(params)
      console.log(`  portal    ${cfg.id}  (${found ? 'updated' : 'created'})`)
      console.log('  WARNING   trial_update_behavior unsupported on this API version.')
      console.log('            A trialing customer who edits their subscription in the')
      console.log('            portal will have the trial ended and be invoiced immediately.')
      return cfg
    }
    throw e
  }
}

/**
 * `features.subscription_update.products` is expandable, so it is absent from
 * the default response even when set. Re-read it explicitly — otherwise a
 * portal with no switchable plans looks identical to a correct one.
 */
async function reportPortal(id) {
  const cfg = await stripe.billingPortal.configurations.retrieve(id, {
    expand: ['features.subscription_update.products'],
  })
  const su = cfg.features.subscription_update
  const count = (su.products ?? []).reduce((n, p) => n + p.prices.length, 0)
  console.log(`            switchable prices: ${count}, trials on edit: ${su.trial_update_behavior ?? 'default (ends trial!)'}`)
}

const product = await ensureProduct()
const monthly = await ensurePrice(product, MONTHLY_LOOKUP, 'month', monthlyAmount)
const annual = await ensurePrice(product, ANNUAL_LOOKUP, 'year', annualAmount)
await ensurePortal(product, [monthly, annual])

console.log('\nDone. Prices are resolved at runtime by lookup_key, so repricing')
console.log('(`--reprice --monthly=3900`) needs no code change or deploy.\n')

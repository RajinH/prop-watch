import 'server-only'
import Stripe from 'stripe'

/**
 * Lazily constructed Stripe client.
 *
 * Lazy on purpose: instantiating at module scope throws during `next build`
 * when STRIPE_SECRET_KEY isn't present in the build environment.
 *
 * `apiVersion` is deliberately not passed. stripe@22.x pins the version it was
 * built against, which keeps the wire format and the TypeScript types in
 * agreement; hardcoding a literal turns every SDK upgrade into a build break,
 * because the type is a string literal rather than `string`.
 */
let stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (stripe) return stripe

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')

  stripe = new Stripe(key, { appInfo: { name: 'PropWatch', version: '0.1.0' } })
  return stripe
}

/** Whether billing is configured at all — lets the UI degrade rather than throw. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

/**
 * Resolve a Price by `lookup_key`, cached briefly.
 *
 * Prices are referenced by lookup key rather than ID so that repricing (which
 * moves the key onto a new Price) takes effect without a deploy. The cache
 * keeps that property while avoiding a Stripe round-trip per checkout click.
 */
const PRICE_CACHE_TTL_MS = 60_000
const priceCache = new Map<string, { id: string; at: number }>()

export async function resolvePriceId(lookupKey: string): Promise<string | null> {
  const hit = priceCache.get(lookupKey)
  if (hit && Date.now() - hit.at < PRICE_CACHE_TTL_MS) return hit.id

  const prices = await getStripe().prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  })
  const id = prices.data[0]?.id ?? null
  if (id) priceCache.set(lookupKey, { id, at: Date.now() })
  return id
}

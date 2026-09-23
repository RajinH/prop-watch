import { describe, it, expect } from 'vitest'
import { resolveAccess, type EntitlementRow } from '../resolveAccess'

const NOW = new Date('2026-09-12T00:00:00Z')
const PAST = '2026-09-01T00:00:00Z'
const FUTURE = '2026-10-01T00:00:00Z'

const row = (overrides: Partial<EntitlementRow> = {}): EntitlementRow => ({
  stripe_status: null,
  stripe_access_until: null,
  comp_source: null,
  comp_until: null,
  ...overrides,
})

describe('resolveAccess', () => {
  it('denies a user with no entitlement row', () => {
    expect(resolveAccess(null, NOW)).toEqual({
      hasAccess: false,
      source: null,
      reason: 'no_entitlement',
    })
  })

  it('denies a row with neither a comp nor a subscription', () => {
    expect(resolveAccess(row(), NOW).reason).toBe('no_subscription')
  })

  describe('comps', () => {
    it('grants forever when comp_until is null', () => {
      expect(resolveAccess(row({ comp_source: 'staff' }), NOW)).toEqual({
        hasAccess: true,
        source: 'comp',
        reason: 'comp_forever',
      })
    })

    it('grants while comp_until is in the future', () => {
      const r = resolveAccess(row({ comp_source: 'code', comp_until: FUTURE }), NOW)
      expect(r).toEqual({ hasAccess: true, source: 'comp', reason: 'comp_active' })
    })

    it('denies once comp_until has passed', () => {
      const r = resolveAccess(row({ comp_source: 'code', comp_until: PAST }), NOW)
      expect(r).toEqual({ hasAccess: false, source: null, reason: 'comp_expired' })
    })

    it('treats comp_until exactly equal to now as expired', () => {
      const r = resolveAccess(
        row({ comp_source: 'code', comp_until: NOW.toISOString() }),
        NOW
      )
      expect(r.hasAccess).toBe(false)
    })

    it('takes precedence over a lapsed subscription', () => {
      const r = resolveAccess(
        row({ comp_source: 'staff', stripe_status: 'canceled' }),
        NOW
      )
      expect(r).toEqual({ hasAccess: true, source: 'comp', reason: 'comp_forever' })
    })

    it('falls through to Stripe when the comp has expired but a subscription is active', () => {
      const r = resolveAccess(
        row({ comp_source: 'code', comp_until: PAST, stripe_status: 'active' }),
        NOW
      )
      expect(r).toEqual({ hasAccess: true, source: 'stripe', reason: 'stripe_active' })
    })
  })

  describe('stripe statuses', () => {
    it.each([
      ['trialing', 'stripe_trialing'],
      ['active', 'stripe_active'],
      ['past_due', 'stripe_past_due'],
    ])('grants access for %s', (status, reason) => {
      const r = resolveAccess(row({ stripe_status: status }), NOW)
      expect(r).toEqual({ hasAccess: true, source: 'stripe', reason })
    })

    it.each(['unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused'])(
      'denies access for %s',
      (status) => {
        expect(resolveAccess(row({ stripe_status: status }), NOW).hasAccess).toBe(false)
      }
    )

    it('grants past_due so a dunning user cannot buy a second subscription', () => {
      // Regression guard: treating past_due as unsubscribed shows the paywall to
      // someone who already pays, who then subscribes again before Stripe's
      // retry succeeds on the original.
      expect(resolveAccess(row({ stripe_status: 'past_due' }), NOW).hasAccess).toBe(true)
    })
  })

  describe('stale mirror protection', () => {
    it('denies an active subscription whose paid-through date has passed', () => {
      const r = resolveAccess(
        row({ stripe_status: 'active', stripe_access_until: PAST }),
        NOW
      )
      expect(r).toEqual({ hasAccess: false, source: null, reason: 'stripe_lapsed' })
    })

    it('grants an active subscription still inside its paid-through date', () => {
      const r = resolveAccess(
        row({ stripe_status: 'active', stripe_access_until: FUTURE }),
        NOW
      )
      expect(r.hasAccess).toBe(true)
    })

    it('trusts the status when no paid-through date is recorded', () => {
      expect(resolveAccess(row({ stripe_status: 'active' }), NOW).hasAccess).toBe(true)
    })
  })
})

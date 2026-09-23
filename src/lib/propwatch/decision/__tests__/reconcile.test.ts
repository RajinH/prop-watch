import { describe, it, expect } from 'vitest'
import { reconcileRecommendations, type ExistingRecommendation } from '../reconcile'
import type { RankedAction, RecommendationStatus } from '../types'

const rankedAction = (overrides: Partial<RankedAction> = {}): RankedAction =>
  ({
    id: 'review_refinance:p1',
    action_type: 'review_refinance',
    scope: 'property',
    property_id: 'p1',
    reason_codes: [],
    evidence: {},
    assumptions: {},
    required_inputs: [],
    baseline: {} as RankedAction['baseline'],
    projected: {} as RankedAction['projected'],
    impact: {},
    confidence: 'medium',
    confidence_reasons: [],
    risks: [],
    score_components: {} as RankedAction['score_components'],
    score: 0.5,
    rank: 1,
    blocked: false,
    primary_eligible: true,
    copy: { title: 't', summary: 's', why: [], caveats: [] },
    ...overrides,
  }) as RankedAction

const existingRec = (
  status: RecommendationStatus,
  overrides: Partial<ExistingRecommendation> = {}
): ExistingRecommendation => ({
  id: 'rec-1',
  action_type: 'review_refinance',
  property_id: 'p1',
  status,
  deferred_until: null,
  assumption_overrides: {},
  ...overrides,
})

const TODAY = '2026-07-18'

describe('reconcileRecommendations', () => {
  it('inserts actions with no existing row', () => {
    const result = reconcileRecommendations([], [rankedAction()], TODAY)
    expect(result.inserts).toHaveLength(1)
    expect(result.updates).toHaveLength(0)
  })

  it('refreshes new/viewed rows without preserving status', () => {
    const result = reconcileRecommendations([existingRec('viewed')], [rankedAction()], TODAY)
    expect(result.inserts).toHaveLength(0)
    expect(result.updates).toEqual([
      expect.objectContaining({ id: 'rec-1', preserve_status: false, reactivate: false }),
    ])
  })

  it('preserves investigating status across runs', () => {
    const result = reconcileRecommendations(
      [existingRec('investigating')],
      [rankedAction()],
      TODAY
    )
    expect(result.updates[0].preserve_status).toBe(true)
  })

  it('keeps an unexpired deferral but reactivates a lapsed one', () => {
    const future = reconcileRecommendations(
      [existingRec('deferred', { deferred_until: '2026-09-01' })],
      [rankedAction()],
      TODAY
    )
    expect(future.updates[0].preserve_status).toBe(true)
    expect(future.undefer).toHaveLength(0)

    const lapsed = reconcileRecommendations(
      [existingRec('deferred', { deferred_until: '2026-07-01' })],
      [rankedAction()],
      TODAY
    )
    expect(lapsed.undefer).toEqual(['rec-1'])
    expect(lapsed.updates[0].preserve_status).toBe(false)
  })

  it('never recreates dismissed or completed recommendations', () => {
    for (const status of ['dismissed', 'completed'] as const) {
      const result = reconcileRecommendations([existingRec(status)], [rankedAction()], TODAY)
      expect(result.inserts).toHaveLength(0)
      expect(result.updates).toHaveLength(0)
      expect(result.expirations).toHaveLength(0)
    }
  })

  it('expires live rows whose action is no longer eligible', () => {
    const result = reconcileRecommendations([existingRec('new')], [], TODAY)
    expect(result.expirations).toEqual(['rec-1'])
  })

  it('does not expire dismissed/completed/expired rows', () => {
    for (const status of ['dismissed', 'completed', 'expired'] as const) {
      const result = reconcileRecommendations([existingRec(status)], [], TODAY)
      expect(result.expirations).toHaveLength(0)
    }
  })

  it('reactivates an expired row when eligibility returns', () => {
    const result = reconcileRecommendations([existingRec('expired')], [rankedAction()], TODAY)
    expect(result.updates[0].reactivate).toBe(true)
  })

  it('matches identity on action_type + property_id', () => {
    const result = reconcileRecommendations(
      [existingRec('new', { property_id: 'p2' })],
      [rankedAction()],
      TODAY
    )
    // Different property → existing expires, ranked action inserts fresh
    expect(result.inserts).toHaveLength(1)
    expect(result.expirations).toEqual(['rec-1'])
  })
})

import type { AssumptionOverrides, RankedAction, RecommendationStatus } from './types'

export type ExistingRecommendation = {
  id: string
  action_type: string
  property_id: string | null
  status: RecommendationStatus
  deferred_until: string | null
  assumption_overrides: AssumptionOverrides
}

export type ReconcileResult = {
  /** Ranked actions with no live row — insert as status 'new'. */
  inserts: RankedAction[]
  /** Existing rows to refresh with the latest evaluation. */
  updates: {
    id: string
    action: RankedAction
    /** investigating/deferred keep their status; new/viewed stay as they are. */
    preserve_status: boolean
    /** expired rows whose eligibility returned — status back to 'new'. */
    reactivate: boolean
  }[]
  /** Live rows whose underlying action is no longer eligible. */
  expirations: string[]
  /** Deferred rows whose deferral has lapsed — status back to 'new'. */
  undefer: string[]
}

const identityKey = (actionType: string, propertyId: string | null | undefined) =>
  `${actionType}:${propertyId ?? 'portfolio'}`

const LIVE_STATUSES: RecommendationStatus[] = ['new', 'viewed', 'investigating', 'deferred']

/**
 * Pure recommendation carryover between engine runs. Identity is
 * (action_type, property_id): one live row per underlying decision.
 * dismissed/completed rows are never touched or recreated.
 */
export function reconcileRecommendations(
  existing: ExistingRecommendation[],
  ranked: RankedAction[],
  today: string
): ReconcileResult {
  const byKey = new Map(existing.map((rec) => [identityKey(rec.action_type, rec.property_id), rec]))
  const rankedKeys = new Set(ranked.map((action) => action.id))

  const result: ReconcileResult = { inserts: [], updates: [], expirations: [], undefer: [] }

  for (const action of ranked) {
    const match = byKey.get(action.id)
    if (!match) {
      result.inserts.push(action)
      continue
    }
    if (match.status === 'dismissed' || match.status === 'completed') continue

    const lapsedDeferral =
      match.status === 'deferred' &&
      match.deferred_until !== null &&
      match.deferred_until <= today
    if (lapsedDeferral) result.undefer.push(match.id)

    result.updates.push({
      id: match.id,
      action,
      preserve_status:
        (match.status === 'investigating' || match.status === 'deferred') && !lapsedDeferral,
      reactivate: match.status === 'expired',
    })
  }

  for (const rec of existing) {
    if (!LIVE_STATUSES.includes(rec.status)) continue
    if (!rankedKeys.has(identityKey(rec.action_type, rec.property_id))) {
      result.expirations.push(rec.id)
    }
  }

  return result
}

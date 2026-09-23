import type { SupabaseClient } from '@supabase/supabase-js'
import type { Property, PortfolioSnapshotInsert } from '../engine/types'
import { DECISION_CONFIG, DECISION_ENGINE_VERSION } from '../decision/config'
import { runDecisionPipeline } from '../decision/runDecisionPipeline'
import {
  reconcileRecommendations,
  type ExistingRecommendation,
} from '../decision/reconcile'
import { computeRunChanges, type PreviousRunSummary } from '../decision/diffRuns'
import type {
  AssumptionOverrides,
  InvestorGoal,
  RankedAction,
  RunChanges,
} from '../decision/types'

export type RunTrigger =
  | 'property_write'
  | 'goal_change'
  | 'settings_change'
  | 'assumption_change'
  | 'status_change'
  | 'scheduled'
  | 'manual'

type RecommendationRow = ExistingRecommendation & { score: number | null }

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function recommendationRowFromAction(
  portfolioId: string,
  action: RankedAction,
  runId: string
) {
  return {
    portfolio_id: portfolioId,
    property_id: action.property_id ?? null,
    action_type: action.action_type,
    rank: action.rank,
    score: action.score,
    confidence: action.confidence,
    score_components: action.score_components,
    payload: action,
    engine_version: DECISION_ENGINE_VERSION,
    last_run_id: runId,
    updated_at: new Date().toISOString(),
  }
}

/**
 * One full decision-engine pass: pipeline → persisted run (audit) →
 * recommendation reconciliation → change diff. Mirrors refreshInsights in
 * spirit, but recommendations carry user state so they are reconciled by
 * identity rather than deleted and recreated.
 */
export async function runDecisionEngine(
  supabase: SupabaseClient,
  portfolioId: string,
  portfolioSnap: PortfolioSnapshotInsert,
  properties: Property[],
  trigger: RunTrigger
): Promise<{ runId: string | null; changes: RunChanges | null }> {
  const runDate = today()

  const [{ data: goalRow }, { data: recRows }, { data: prevRun }] = await Promise.all([
    supabase.from('investor_goals').select('*').eq('portfolio_id', portfolioId).maybeSingle(),
    supabase
      .from('recommendations')
      .select('id, action_type, property_id, status, deferred_until, assumption_overrides, score')
      .eq('portfolio_id', portfolioId),
    supabase
      .from('decision_engine_runs')
      .select('id, baseline, changes, evaluations')
      .eq('portfolio_id', portfolioId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const goal = (goalRow as InvestorGoal | null) ?? null
  const existing = (recRows ?? []) as RecommendationRow[]

  // Persisted per-recommendation assumption edits keyed by candidate identity
  const overrides: Record<string, AssumptionOverrides> = {}
  for (const rec of existing) {
    if (rec.status === 'dismissed' || rec.status === 'completed') continue
    if (rec.assumption_overrides && Object.keys(rec.assumption_overrides).length > 0) {
      overrides[`${rec.action_type}:${rec.property_id ?? 'portfolio'}`] =
        rec.assumption_overrides
    }
  }

  const pipeline = runDecisionPipeline({
    portfolio_id: portfolioId,
    today: runDate,
    snapshot: portfolioSnap,
    properties,
    goal,
    config: DECISION_CONFIG,
    overrides,
  })

  const { data: runRow } = await supabase
    .from('decision_engine_runs')
    .insert({
      portfolio_id: portfolioId,
      engine_version: DECISION_ENGINE_VERSION,
      goal_id: goal?.id ?? null,
      snapshot_date: portfolioSnap.snapshot_date,
      trigger,
      config: DECISION_CONFIG,
      detected_conditions: pipeline.conditions,
      candidates: pipeline.candidates,
      evaluations: pipeline.evaluated,
      baseline: pipeline.baseline,
    })
    .select('id')
    .single()

  if (!runRow) return { runId: null, changes: null }
  const runId = runRow.id as string

  const reconciled = reconcileRecommendations(existing, pipeline.evaluated, runDate)

  const events: Record<string, unknown>[] = []

  if (reconciled.inserts.length > 0) {
    const { data: inserted } = await supabase
      .from('recommendations')
      .insert(
        reconciled.inserts.map((action) => ({
          ...recommendationRowFromAction(portfolioId, action, runId),
          status: 'new',
          assumption_overrides: {},
          first_run_id: runId,
        }))
      )
      .select('id, action_type, property_id')

    for (const row of inserted ?? []) {
      events.push({
        portfolio_id: portfolioId,
        recommendation_id: row.id,
        event_type: 'created',
        to_status: 'new',
        payload: { run_id: runId },
      })
    }
  }

  for (const update of reconciled.updates) {
    const previous = existing.find((rec) => rec.id === update.id)
    const lapsedDeferral = reconciled.undefer.includes(update.id)
    const row: Record<string, unknown> = recommendationRowFromAction(
      portfolioId,
      update.action,
      runId
    )
    if (update.reactivate || lapsedDeferral) {
      row.status = 'new'
      if (lapsedDeferral) row.deferred_until = null
    }
    await supabase.from('recommendations').update(row).eq('id', update.id)

    if (update.reactivate || lapsedDeferral) {
      events.push({
        portfolio_id: portfolioId,
        recommendation_id: update.id,
        event_type: 'status_changed',
        from_status: update.reactivate ? 'expired' : 'deferred',
        to_status: 'new',
        reason: update.reactivate ? 'eligibility_returned' : 'deferral_lapsed',
        payload: { run_id: runId },
      })
    } else if (previous && previous.score !== null && previous.score !== update.action.score) {
      events.push({
        portfolio_id: portfolioId,
        recommendation_id: update.id,
        event_type: 're_evaluated',
        payload: { run_id: runId, previous_score: previous.score, score: update.action.score },
      })
    }
  }

  if (reconciled.expirations.length > 0) {
    await supabase
      .from('recommendations')
      .update({ status: 'expired', last_run_id: runId, updated_at: new Date().toISOString() })
      .in('id', reconciled.expirations)

    for (const id of reconciled.expirations) {
      const previous = existing.find((rec) => rec.id === id)
      events.push({
        portfolio_id: portfolioId,
        recommendation_id: id,
        event_type: 'expired',
        from_status: previous?.status ?? null,
        to_status: 'expired',
        payload: { run_id: runId },
      })
    }
  }

  if (events.length > 0) {
    await supabase.from('recommendation_events').insert(events)
  }

  // Completed recommendations still waiting on an actual outcome
  const completedIds = existing
    .filter((rec) => rec.status === 'completed')
    .map((rec) => rec.id)
  let completedAwaitingOutcome: string[] = []
  if (completedIds.length > 0) {
    const { data: outcomes } = await supabase
      .from('recommendation_outcomes')
      .select('recommendation_id')
      .in('recommendation_id', completedIds)
    const recorded = new Set((outcomes ?? []).map((o) => o.recommendation_id))
    completedAwaitingOutcome = completedIds.filter((id) => !recorded.has(id))
  }

  const previousSummary: PreviousRunSummary | null = prevRun
    ? {
        top_action_id:
          (prevRun.changes as RunChanges | null)?.current_top ??
          (() => {
            const evaluations = prevRun.evaluations as RankedAction[] | null
            const first = evaluations?.[0]
            return first && first.primary_eligible ? first.id : null
          })(),
        baseline: prevRun.baseline ?? null,
      }
    : null

  const changes = computeRunChanges(previousSummary, pipeline, {
    deferred_due: reconciled.undefer,
    completed_awaiting_outcome: completedAwaitingOutcome,
  })

  await supabase.from('decision_engine_runs').update({ changes }).eq('id', runId)

  return { runId, changes }
}

/**
 * Convenience wrapper for triggers that don't already hold the snapshot and
 * properties (goal edits, status changes, assumption edits, staleness checks).
 * No-ops when the portfolio has no snapshot yet.
 */
export async function rerunDecisionEngineForPortfolio(
  supabase: SupabaseClient,
  portfolioId: string,
  trigger: RunTrigger
): Promise<{ runId: string | null; changes: RunChanges | null }> {
  const [{ data: snap }, { data: properties }] = await Promise.all([
    supabase
      .from('portfolio_snapshots')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('properties').select('*').eq('portfolio_id', portfolioId),
  ])
  if (!snap) return { runId: null, changes: null }
  return runDecisionEngine(
    supabase,
    portfolioId,
    snap as PortfolioSnapshotInsert,
    (properties ?? []) as Property[],
    trigger
  )
}

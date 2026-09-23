import { describe, it, expect } from 'vitest'
import { computeRunChanges } from '../diffRuns'
import { runDecisionPipeline } from '../runDecisionPipeline'
import { DECISION_CONFIG } from '../config'
import { PORTFOLIO_ID, TODAY, baseProp, baseSnap, baseGoal } from './fixtures'

const refinanceProp = (rate = 0.078) =>
  baseProp({
    id: 'p1',
    current_debt: 500_000,
    interest_rate: rate,
    monthly_repayment: 3_800,
    monthly_rent: 2_200,
    loan_type: 'principal_and_interest',
  })

const run = (rent = 2_200) =>
  runDecisionPipeline({
    portfolio_id: PORTFOLIO_ID,
    today: TODAY,
    snapshot: baseSnap(),
    properties: [{ ...refinanceProp(), monthly_rent: rent }],
    goal: baseGoal({ type: 'improve_cashflow', target_value: 1_000 }),
    config: DECISION_CONFIG,
  })

const NO_EXTRAS = { deferred_due: [], completed_awaiting_outcome: [] }

describe('computeRunChanges', () => {
  it('reports no data changes when baselines match', () => {
    const current = run()
    const changes = computeRunChanges(
      { top_action_id: current.evaluated[0]?.id ?? null, baseline: current.baseline },
      current,
      NO_EXTRAS
    )
    expect(changes.data_changed).toEqual([])
    expect(changes.next_action_changed).toBe(false)
  })

  it('lists changed baseline fields and goal progress delta', () => {
    const previous = run(2_200)
    const current = run(2_400)
    const changes = computeRunChanges(
      { top_action_id: previous.evaluated[0]?.id ?? null, baseline: previous.baseline },
      current,
      NO_EXTRAS
    )
    expect(changes.data_changed).toContain('monthly_cashflow')
    expect(changes.goal_progress_delta).not.toBeNull()
  })

  it('flags a change of top action', () => {
    const current = run()
    const changes = computeRunChanges(
      { top_action_id: 'pay_down_debt:p9', baseline: current.baseline },
      current,
      NO_EXTRAS
    )
    expect(changes.next_action_changed).toBe(true)
    expect(changes.current_top).toBe(current.evaluated[0].id)
  })

  it('treats a first run as having no previous comparison', () => {
    const current = run()
    const changes = computeRunChanges(null, current, NO_EXTRAS)
    expect(changes.data_changed).toEqual([])
    expect(changes.next_action_changed).toBe(false)
    expect(changes.previous_top).toBeNull()
  })

  it('passes deferred and outcome extras through', () => {
    const current = run()
    const changes = computeRunChanges(null, current, {
      deferred_due: ['rec-1'],
      completed_awaiting_outcome: ['rec-2'],
    })
    expect(changes.deferred_due).toEqual(['rec-1'])
    expect(changes.completed_awaiting_outcome).toEqual(['rec-2'])
  })
})

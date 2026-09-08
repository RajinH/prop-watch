import { describe, it, expect } from 'vitest'
import { DECISION_CONFIG } from '../config'
import {
  computeOutcome,
  diffOutcomes,
  monthlyRepaymentForLoan,
  remainingTermYears,
} from '../evaluate'
import { PORTFOLIO_ID, TODAY, baseProp, baseGoal } from './fixtures'

describe('monthlyRepaymentForLoan', () => {
  it('amortises P&I to a known value ($500k @ 6.5% over 25y ≈ $3,376/mo)', () => {
    const repayment = monthlyRepaymentForLoan(500_000, 0.065, 25, 'principal_and_interest')
    expect(repayment).toBeGreaterThan(3_375)
    expect(repayment).toBeLessThan(3_377)
  })

  it('charges interest only on the balance for IO loans', () => {
    expect(monthlyRepaymentForLoan(500_000, 0.06, 25, 'interest_only')).toBe(2_500)
  })

  it('divides principal evenly at a zero rate', () => {
    expect(monthlyRepaymentForLoan(120_000, 0, 10, 'principal_and_interest')).toBe(1_000)
  })

  it('returns 0 for a zero balance', () => {
    expect(monthlyRepaymentForLoan(0, 0.06, 25, 'principal_and_interest')).toBe(0)
  })
})

describe('remainingTermYears', () => {
  it('derives from loan term and purchase date when both exist', () => {
    const term = remainingTermYears(
      baseProp({ loan_term_years: 30, purchase_date: '2016-07-18' }),
      TODAY,
      DECISION_CONFIG
    )
    expect(term.source).toBe('derived')
    expect(term.value).toBeGreaterThan(19)
    expect(term.value).toBeLessThanOrEqual(20.1)
  })

  it('falls back to the configured default when facts are missing', () => {
    const term = remainingTermYears(baseProp({ loan_term_years: 30 }), TODAY, DECISION_CONFIG)
    expect(term).toEqual({ value: DECISION_CONFIG.default_remaining_term_years, source: 'default' })
  })

  it('never derives below one year', () => {
    const term = remainingTermYears(
      baseProp({ loan_term_years: 5, purchase_date: '2010-01-01' }),
      TODAY,
      DECISION_CONFIG
    )
    expect(term.value).toBe(1)
  })
})

describe('computeOutcome', () => {
  it('reports zero interest remaining for a debt-free portfolio', () => {
    const outcome = computeOutcome(
      PORTFOLIO_ID,
      [baseProp({ monthly_rent: 2_000 })],
      null,
      TODAY
    )
    expect(outcome.total_interest_remaining).toBe(0)
    expect(outcome.monthly_cashflow).toBe(2_000)
    expect(outcome.annual_cashflow).toBe(24_000)
    expect(outcome.goal_progress_pct).toBeNull()
  })

  it('sums amortised interest for indebted properties', () => {
    const outcome = computeOutcome(
      PORTFOLIO_ID,
      [
        baseProp({
          current_debt: 400_000,
          interest_rate: 0.06,
          monthly_repayment: 3_000,
          monthly_rent: 2_000,
        }),
      ],
      null,
      TODAY
    )
    expect(outcome.total_interest_remaining).toBeGreaterThan(0)
    expect(outcome.weighted_lvr).toBe(0.8)
  })

  it('computes goal progress only for a cashflow goal with a target', () => {
    const properties = [baseProp({ monthly_rent: 500 })]
    const withGoal = computeOutcome(
      PORTFOLIO_ID,
      properties,
      baseGoal({ type: 'improve_cashflow', target_value: 1_000 }),
      TODAY
    )
    expect(withGoal.goal_progress_pct).toBe(50)

    const debtGoal = computeOutcome(
      PORTFOLIO_ID,
      properties,
      baseGoal({ type: 'reduce_debt', target_value: 100_000 }),
      TODAY
    )
    expect(debtGoal.goal_progress_pct).toBeNull()
  })
})

describe('diffOutcomes', () => {
  it('computes signed deltas between two outcomes', () => {
    const before = computeOutcome(PORTFOLIO_ID, [baseProp({ monthly_rent: 1_000 })], null, TODAY)
    const after = computeOutcome(PORTFOLIO_ID, [baseProp({ monthly_rent: 1_200 })], null, TODAY)
    const impact = diffOutcomes(before, after)
    expect(impact.monthly_cashflow_delta).toBe(200)
    expect(impact.annual_cashflow_delta).toBe(2_400)
    expect(impact.total_equity_delta).toBe(0)
  })
})

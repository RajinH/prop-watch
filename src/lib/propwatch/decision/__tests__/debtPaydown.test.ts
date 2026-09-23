import { describe, it, expect } from 'vitest'
import { payDownDebtStrategy } from '../strategies/debtPaydown'
import { baseProp, baseGoal, makeContext } from './fixtures'

const indebtedProp = (overrides = {}) =>
  baseProp({
    current_debt: 400_000,
    interest_rate: 0.075,
    monthly_repayment: 3_000,
    monthly_rent: 2_000,
    loan_type: 'principal_and_interest',
    ...overrides,
  })

const debtGoal = (overrides = {}) =>
  baseGoal({ type: 'reduce_debt', available_lump_sum: 50_000, ...overrides })

describe('payDownDebtStrategy.detect', () => {
  it('creates a single candidate targeting the highest-rate loan', () => {
    const ctx = makeContext({
      properties: [
        indebtedProp({ id: 'p1', interest_rate: 0.06 }),
        indebtedProp({ id: 'p2', interest_rate: 0.078 }),
      ],
      goal: debtGoal(),
    })
    const candidates = payDownDebtStrategy.detect(ctx)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].property_id).toBe('p2')
    expect(candidates[0].evidence.target_selection).toBe('highest_rate')
    expect(candidates[0].reason_codes).toContain('funds_available')
  })

  it('falls back to the largest balance when no rates are recorded', () => {
    const ctx = makeContext({
      properties: [
        indebtedProp({ id: 'p1', interest_rate: null, current_debt: 200_000 }),
        indebtedProp({ id: 'p2', interest_rate: null, current_debt: 350_000 }),
      ],
      goal: debtGoal(),
    })
    const [candidate] = payDownDebtStrategy.detect(ctx)
    expect(candidate.property_id).toBe('p2')
    expect(candidate.evidence.target_selection).toBe('largest_balance')
  })

  it('requires declared funds above the minimum', () => {
    const noFunds = makeContext({
      properties: [indebtedProp()],
      goal: debtGoal({ available_lump_sum: 3_000 }),
    })
    expect(payDownDebtStrategy.detect(noFunds)).toHaveLength(0)

    const noGoal = makeContext({ properties: [indebtedProp()], goal: null })
    expect(payDownDebtStrategy.detect(noGoal)).toHaveLength(0)
  })

  it('requires a debt-reduction goal or portfolio pressure', () => {
    // Cashflow-positive, low-LVR portfolio with a cashflow goal → no candidate
    const calm = makeContext({
      properties: [
        indebtedProp({ interest_rate: 0.05, current_debt: 100_000, monthly_repayment: 600 }),
      ],
      goal: baseGoal({ type: 'improve_cashflow', available_lump_sum: 50_000 }),
    })
    expect(payDownDebtStrategy.detect(calm)).toHaveLength(0)
  })

  it('clamps the lump sum to the loan balance', () => {
    const ctx = makeContext({
      properties: [indebtedProp({ current_debt: 30_000, monthly_repayment: 900 })],
      goal: debtGoal(),
    })
    const [candidate] = payDownDebtStrategy.detect(ctx)
    expect(candidate.assumptions.lump_sum).toBe(30_000)
  })
})

describe('payDownDebtStrategy.evaluate', () => {
  it('reduces LVR and total interest for a P&I loan without changing repayment', () => {
    const ctx = makeContext({ properties: [indebtedProp()], goal: debtGoal() })
    const [candidate] = payDownDebtStrategy.detect(ctx)
    const evaluated = payDownDebtStrategy.evaluate(candidate, ctx)

    expect(evaluated.projected.total_debt).toBe(350_000)
    expect(evaluated.impact.weighted_lvr_delta).toBeLessThan(0)
    expect(evaluated.impact.total_interest_delta).toBeLessThan(0)
    // P&I default keeps the repayment, so monthly cashflow is unchanged
    expect(evaluated.impact.monthly_cashflow_delta).toBe(0)
    expect(evaluated.confidence).toBe('high')
  })

  it('reduces the repayment for an interest-only loan by default', () => {
    const ctx = makeContext({
      properties: [
        indebtedProp({
          loan_type: 'interest_only',
          interest_rate: 0.07,
          monthly_repayment: 2_333.33,
        }),
      ],
      goal: debtGoal(),
    })
    const [candidate] = payDownDebtStrategy.detect(ctx)
    expect(candidate.assumptions.reduce_repayment).toBe(true)
    const evaluated = payDownDebtStrategy.evaluate(candidate, ctx)
    // IO on $350k @7% = $2,041.67 → ~$291.66/mo freed up
    expect(evaluated.impact.monthly_cashflow_delta).toBeGreaterThan(285)
    expect(evaluated.impact.monthly_cashflow_delta).toBeLessThan(295)
  })

  it('flags opportunity cost when the loan rate is below alternative returns', () => {
    const ctx = makeContext({
      properties: [indebtedProp({ interest_rate: 0.04, monthly_repayment: 2_200 })],
      goal: debtGoal(),
    })
    const [candidate] = payDownDebtStrategy.detect(ctx)
    const evaluated = payDownDebtStrategy.evaluate(candidate, ctx)
    expect(evaluated.risks.join(' ')).toContain('offset')
  })

  it('warns when the lump sum breaches the minimum cash buffer', () => {
    const ctx = makeContext({
      properties: [indebtedProp()],
      goal: debtGoal({ minimum_cash_buffer: 20_000 }),
    })
    const [candidate] = payDownDebtStrategy.detect(ctx)
    const evaluated = payDownDebtStrategy.evaluate(candidate, ctx)
    expect(evaluated.risks.join(' ')).toContain('cash buffer')
  })

  it('drops confidence to medium when the rate is inferred', () => {
    const ctx = makeContext({
      properties: [indebtedProp({ interest_rate: null })],
      goal: debtGoal(),
    })
    const [candidate] = payDownDebtStrategy.detect(ctx)
    const evaluated = payDownDebtStrategy.evaluate(candidate, ctx)
    expect(evaluated.confidence).toBe('medium')
  })
})

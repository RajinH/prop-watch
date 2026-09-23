import { describe, it, expect } from 'vitest'
import { reverseAmortise, type LoanFacts } from '../reverseAmortise'
import { computeDebtProjection } from '../computeDebtProjection'
import type { Property } from '../types'

const ASOF = '2026-09-01'

const loan = (overrides: Partial<LoanFacts> = {}): LoanFacts => ({
  current_debt: 420000,
  monthly_repayment: 2800,
  interest_rate: 0.06,
  loan_type: 'principal_and_interest',
  loan_term_years: 30,
  purchase_price: 520000,
  purchase_date: '2021-08-06',
  fixed_rate_expiry: null,
  interest_rate_type: 'variable',
  ...overrides,
})

describe('reverseAmortise', () => {
  it('returns the current balance unchanged at months_back 0', () => {
    const r = reverseAmortise(loan(), 6, ASOF)
    expect(r[0].months_back).toBe(0)
    expect(r[0].balance).toBe(420000)
    expect(r[0].date).toBe(ASOF)
  })

  it('reports a larger balance the further back it goes', () => {
    const r = reverseAmortise(loan(), 12, ASOF)
    const balances = r.map((x) => x.balance)
    for (let i = 1; i < balances.length; i++) {
      expect(balances[i]).toBeGreaterThan(balances[i - 1])
    }
  })

  it('inverts computeDebtProjection exactly', () => {
    // Roll a balance forward 12 months with the shipping forward recursion, then
    // reverse it back and expect to land on where we started.
    const l = loan()
    const i = l.interest_rate! / 12
    let forward = l.current_debt
    for (let m = 0; m < 12; m++) forward = forward * (1 + i) - l.monthly_repayment

    const back = reverseAmortise({ ...l, current_debt: forward, purchase_date: null }, 12, ASOF)
    expect(back[12].balance).toBeCloseTo(l.current_debt, 2)
  })

  it('uses the same monthly-rate convention as computeDebtProjection', () => {
    // Guards the decimal-vs-percentage trap: interest_rate is 0.06, not 6.
    const l = loan()
    const asProperty = {
      id: 'p1', portfolio_id: 'port-1', name: 'x',
      current_value: 900000, current_debt: l.current_debt,
      monthly_rent: 0, monthly_repayment: l.monthly_repayment, annual_expenses: 0,
      purchase_price: l.purchase_price, purchase_date: l.purchase_date,
      loan_type: l.loan_type, interest_rate: l.interest_rate,
      interest_rate_type: l.interest_rate_type, loan_term_years: l.loan_term_years,
      lender: null, fixed_rate_expiry: null, insurer: null,
      annual_insurance_premium: null, insurance_policy_type: null,
      insurance_renewal_date: null, comparable_monthly_rent: null,
      last_rent_review_date: null,
    } as Property
    const fwd = computeDebtProjection([asProperty])[0]
    expect(fwd.effective_annual_rate).toBe(6)
  })

  it('holds the balance flat for an interest-only loan', () => {
    const r = reverseAmortise(loan({ loan_type: 'interest_only' }), 6, ASOF)
    expect(r.every((x) => x.balance === 420000)).toBe(true)
    expect(r.every((x) => x.method === 'interest_only_flat')).toBe(true)
  })

  it('holds flat and says so when there is no interest rate', () => {
    const r = reverseAmortise(loan({ interest_rate: null }), 6, ASOF)
    expect(r.every((x) => x.balance === 420000)).toBe(true)
    expect(r.every((x) => x.method === 'no_rate_flat')).toBe(true)
  })

  it('holds flat when there is no repayment', () => {
    const r = reverseAmortise(loan({ monthly_repayment: 0 }), 6, ASOF)
    expect(r.every((x) => x.method === 'no_rate_flat')).toBe(true)
  })

  it('stops at the purchase date rather than inventing a pre-ownership balance', () => {
    // Bought 2021-08-06; asking for 120 months back from 2026-09-01 would
    // otherwise run to 2016.
    const r = reverseAmortise(loan({ purchase_date: '2021-08-06' }), 120, ASOF)
    expect(r.length).toBeLessThan(121)
    expect(r[r.length - 1].date >= '2021-08-06').toBe(true)
  })

  it('emits every month when the property has no purchase date', () => {
    const r = reverseAmortise(loan({ purchase_date: null }), 36, ASOF)
    expect(r).toHaveLength(37)
  })

  it('clamps at the purchase price once the window implies over-borrowing', () => {
    // Walking a normal P&I loan back far enough implies an original balance
    // above what the property cost, which cannot be right.
    const r = reverseAmortise(
      loan({ purchase_price: 430000, purchase_date: null }),
      120,
      ASOF
    )
    const last = r[r.length - 1]
    expect(last.balance).toBeLessThanOrEqual(430000)
    expect(last.method).toBe('clamped')
    expect(last.confidence).toBe('low')
  })

  it('decays confidence with distance', () => {
    const r = reverseAmortise(loan({ purchase_date: null }), 36, ASOF)
    expect(r[0].confidence).toBe('high')
    expect(r[12].confidence).toBe('high')
    expect(r[18].confidence).toBe('medium')
    expect(r[30].confidence).toBe('low')
  })

  it('drops confidence to low before a fixed-rate roll-off inside the window', () => {
    const r = reverseAmortise(
      loan({ interest_rate_type: 'fixed', fixed_rate_expiry: '2026-06-01', purchase_date: null }),
      6,
      ASOF
    )
    expect(r[0].confidence).toBe('high')
    // 2026-03-01 predates the roll-off, so the repayment we hold fixed is wrong.
    expect(r[6].confidence).toBe('low')
  })

  it('returns an empty series for a negative window', () => {
    expect(reverseAmortise(loan(), -1, ASOF)).toEqual([])
  })
})

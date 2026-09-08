import { describe, it, expect } from 'vitest'
import { renderTemplate } from '../templates'
import { runDecisionPipeline } from '../runDecisionPipeline'
import { DECISION_CONFIG } from '../config'
import { PORTFOLIO_ID, TODAY, baseProp, baseSnap, baseGoal } from './fixtures'

const refinanceProp = baseProp({
  name: 'St Mary Town House',
  current_debt: 500_000,
  interest_rate: 0.076,
  monthly_repayment: 3_800,
  monthly_rent: 2_200,
  loan_type: 'principal_and_interest',
})

function pipeline(properties = [refinanceProp], goal = baseGoal()) {
  return runDecisionPipeline({
    portfolio_id: PORTFOLIO_ID,
    today: TODAY,
    snapshot: baseSnap(),
    properties,
    goal,
    config: DECISION_CONFIG,
  })
}

describe('renderTemplate', () => {
  it('renders refinance copy from recorded and modelled values only', () => {
    const [top] = pipeline().evaluated
    expect(top.action_type).toBe('review_refinance')
    expect(top.copy.title).toBe('Review refinancing St Mary Town House')
    expect(top.copy.summary).toContain('The recorded rate is 7.60%.')
    expect(top.copy.summary).toContain('Modelling a rate of 6.50%')
    expect(top.copy.summary).toContain('before switching costs')
  })

  it('includes goal alignment and highest-impact reasons in why', () => {
    const [top] = pipeline().evaluated
    expect(top.copy.why.join(' ')).toContain('highest estimated cashflow impact')
    expect(top.copy.why.join(' ')).toContain('improving your cashflow')
  })

  it('surfaces confidence reasons and risks as caveats', () => {
    const [top] = pipeline().evaluated
    const caveats = top.copy.caveats.join(' ')
    expect(caveats).toContain('benchmark')
    expect(caveats).toContain('serviceability')
  })

  it('renders an investigation prompt for a blocked rent review', () => {
    const blocked = baseProp({
      name: 'Beach Flat',
      monthly_rent: 1_200,
      comparable_monthly_rent: null,
    })
    const result = pipeline([blocked])
    const rent = result.evaluated.find((a) => a.action_type === 'review_rent')!
    expect(rent.copy.title).toBe('Investigate market rent for Beach Flat')
    expect(rent.copy.summary).toContain('Add a comparable market rent')
    expect(rent.copy.caveats.join(' ')).toContain('Blocked')
  })

  it('never leaks NaN or undefined into copy', () => {
    const result = pipeline([
      refinanceProp,
      baseProp({ id: 'p2', name: 'Beach Flat', monthly_rent: 1_200, comparable_monthly_rent: 1_400 }),
    ])
    for (const action of result.evaluated) {
      const text = [
        action.copy.title,
        action.copy.summary,
        ...action.copy.why,
        ...action.copy.caveats,
      ].join(' ')
      expect(text).not.toContain('NaN')
      expect(text).not.toContain('undefined')
      expect(text).not.toContain('null')
    }
  })

  it('is pure — same action and context render identical copy', () => {
    const [top] = pipeline().evaluated
    const ctx = { property_name: 'St Mary Town House', goal: baseGoal(), is_highest_impact: true }
    expect(renderTemplate(top, ctx)).toEqual(renderTemplate(top, ctx))
  })
})

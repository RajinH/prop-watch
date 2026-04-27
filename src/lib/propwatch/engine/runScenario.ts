import type {
  Property,
  PortfolioSnapshotInsert,
  ScenarioAssumptions,
  ScenarioResult,
  ScenarioDelta,
  ScenarioInsight,
} from './types'
import { computePortfolioSnapshot } from './computePortfolioSnapshot'
import { round2 } from './money'

export type RunScenarioOutput = {
  result: ScenarioResult
  delta: ScenarioDelta
  insights: ScenarioInsight[]
}

export function runScenario(
  baseline: PortfolioSnapshotInsert,
  properties: Property[],
  assumptions: ScenarioAssumptions
): RunScenarioOutput {
  const {
    interestRateDeltaPercent = 0,
    rentDeltaPercent = 0,
    expenseDeltaPercent = 0,
    valueDeltaPercent = 0,
  } = assumptions

  // Apply assumptions to a mutated copy of each property
  const adjusted: Property[] = properties.map((p) => ({
    ...p,
    current_value: p.current_value * (1 + valueDeltaPercent / 100),
    monthly_rent: p.monthly_rent * (1 + rentDeltaPercent / 100),
    annual_expenses: p.annual_expenses * (1 + expenseDeltaPercent / 100),
    // Interest rate delta approximated as additional debt servicing cost
    monthly_repayment:
      p.monthly_repayment + (p.current_debt * (interestRateDeltaPercent / 100)) / 12,
  }))

  const adjustedSnap = computePortfolioSnapshot(
    baseline.portfolio_id,
    adjusted,
    baseline.snapshot_date
  )

  const result: ScenarioResult = {
    total_value: adjustedSnap.total_value,
    total_debt: adjustedSnap.total_debt,
    total_equity: adjustedSnap.total_equity,
    monthly_cashflow: adjustedSnap.monthly_cashflow,
    weighted_lvr: adjustedSnap.weighted_lvr,
    yield: adjustedSnap.yield,
  }

  const delta: ScenarioDelta = {
    total_value: round2(result.total_value - baseline.total_value),
    total_equity: round2(result.total_equity - baseline.total_equity),
    monthly_cashflow: round2(result.monthly_cashflow - baseline.monthly_cashflow),
    weighted_lvr:
      result.weighted_lvr !== null && baseline.weighted_lvr !== null
        ? round2(result.weighted_lvr - baseline.weighted_lvr)
        : null,
  }

  const insights: ScenarioInsight[] = []

  if (result.monthly_cashflow < 0 && baseline.monthly_cashflow >= 0) {
    insights.push({
      type: 'scenario_cashflow_flip',
      severity: 'critical',
      title: 'Portfolio turns cashflow negative',
      description: `Under these assumptions your portfolio moves from positive to negative cashflow ($${result.monthly_cashflow.toFixed(0)}/month).`,
      impact: result.monthly_cashflow,
    })
  } else if (delta.monthly_cashflow < 0) {
    insights.push({
      type: 'scenario_cashflow_reduced',
      severity: 'warning',
      title: 'Cashflow reduced',
      description: `This scenario reduces monthly cashflow by $${Math.abs(delta.monthly_cashflow).toFixed(0)}.`,
      impact: delta.monthly_cashflow,
    })
  }

  if (result.weighted_lvr !== null && result.weighted_lvr >= 0.8) {
    insights.push({
      type: 'scenario_lvr_breach',
      severity: 'critical',
      title: 'LVR would breach 80%',
      description: `Under these assumptions weighted LVR reaches ${(result.weighted_lvr * 100).toFixed(1)}%, which may trigger lender margin calls.`,
      impact: result.weighted_lvr,
    })
  }

  return { result, delta, insights }
}

import type {
  Property,
  PortfolioSnapshotInsert,
  RunwayResult,
  RunwayScenario,
  RunwayScenarioKey,
} from './types'
import { round2, safeDiv } from './money'
import { RATE_SHOCK_PCT, RUNWAY_CAP_MONTHS } from './thresholds'

function buildScenario(
  key: RunwayScenarioKey,
  cashflow: number,
  cashReserve: number | null
): RunwayScenario {
  const monthly_cashflow = round2(cashflow)
  const monthly_out_of_pocket = round2(Math.max(0, -monthly_cashflow))

  if (monthly_out_of_pocket === 0) {
    return {
      key,
      monthly_cashflow,
      monthly_out_of_pocket,
      runway_months: null,
      runway_capped: false,
      status: 'self_funding',
    }
  }

  if (cashReserve === null) {
    return {
      key,
      monthly_cashflow,
      monthly_out_of_pocket,
      runway_months: null,
      runway_capped: false,
      status: 'unknown_reserve',
    }
  }

  // out_of_pocket is non-zero here, so safeDiv never returns null.
  const raw = safeDiv(cashReserve, monthly_out_of_pocket) ?? 0
  const runway_capped = raw >= RUNWAY_CAP_MONTHS
  return {
    key,
    monthly_cashflow,
    monthly_out_of_pocket,
    runway_months: round2(Math.min(raw, RUNWAY_CAP_MONTHS)),
    runway_capped,
    status: 'finite',
  }
}

/**
 * How many months the investor's cash covers the portfolio's shortfall, today
 * and under two stresses: the highest-rent property vacant, and rates +2 points.
 */
export function computeRunway(
  snap: PortfolioSnapshotInsert,
  properties: Property[],
  cashReserve: number | null
): RunwayResult {
  // A negative reserve is invalid input; treat it as no cash rather than debt.
  const reserve = cashReserve === null ? null : Math.max(0, cashReserve)
  const cf = snap.monthly_cashflow

  // Highest rent wins; ties keep the first in array order (strict >).
  let vacancyProperty: Property | null = null
  for (const p of properties) {
    if (vacancyProperty === null || p.monthly_rent > vacancyProperty.monthly_rent) {
      vacancyProperty = p
    }
  }
  const maxRent = vacancyProperty?.monthly_rent ?? 0

  // Same approximation as computeSensitivity: interest on all debt rises.
  const rateShockCost = (snap.total_debt * RATE_SHOCK_PCT) / 12

  return {
    cash_reserve: reserve,
    vacancy_property_id: vacancyProperty?.id ?? null,
    scenarios: [
      buildScenario('current', cf, reserve),
      buildScenario('vacancy', cf - maxRent, reserve),
      buildScenario('rate_plus_2', cf - rateShockCost, reserve),
    ],
  }
}

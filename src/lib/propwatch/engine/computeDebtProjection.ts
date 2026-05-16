import type { Property, PropertyDebtProjection, DebtProjectionPoint } from './types'
import { round2 } from './money'

export function computeDebtProjection(properties: Property[]): PropertyDebtProjection[] {
  return properties.filter((p) => p.current_debt > 0).map((p) => {
    const monthlyRate = p.interest_rate !== null
      ? p.interest_rate / 12
      : p.monthly_repayment > 0 && p.current_debt > 0
        ? Math.max(0, (p.monthly_repayment - p.current_debt / 360) / p.current_debt)
        : null

    if (monthlyRate === null || p.monthly_repayment <= 0) {
      return {
        property_id: p.id, property_name: p.name,
        months_to_payoff: null, payoff_year: null,
        effective_annual_rate: null, total_interest_cost: null, curve: [],
      }
    }

    let balance = p.current_debt
    let cumInterest = 0
    const curve: DebtProjectionPoint[] = [{ year: 0, balance: round2(balance), cumulative_interest: 0 }]
    let month = 0
    const MAX_MONTHS = 480
    let months_to_payoff: number | null = null

    while (balance > 0.01 && month < MAX_MONTHS) {
      const interestCharge = balance * monthlyRate
      const principal = Math.min(p.monthly_repayment - interestCharge, balance)
      if (principal <= 0) break
      balance -= principal
      cumInterest += interestCharge
      month++
      if (month % 12 === 0) {
        curve.push({ year: month / 12, balance: round2(Math.max(0, balance)), cumulative_interest: round2(cumInterest) })
      }
      if (balance <= 0.01 && months_to_payoff === null) months_to_payoff = month
    }

    const currentYear = new Date().getFullYear()
    return {
      property_id: p.id,
      property_name: p.name,
      months_to_payoff,
      payoff_year: months_to_payoff !== null ? currentYear + Math.floor(months_to_payoff / 12) : null,
      effective_annual_rate: p.interest_rate !== null ? round2(p.interest_rate * 100) : round2(monthlyRate * 12 * 100),
      total_interest_cost: round2(cumInterest),
      curve,
    }
  })
}

import type { CashflowResult } from './types'

const PROPERTY_MANAGEMENT_RATE = 0.09
const MAINTENANCE_RATE = 0.01
const INSURANCE_RATE = 0.003
const COUNCIL_RATE = 0.003

export function getDefaultExpenses(estimatedValue: number, monthlyRent: number | null): number {
  const maintenance = estimatedValue * MAINTENANCE_RATE
  const insurance = estimatedValue * INSURANCE_RATE
  const council = estimatedValue * COUNCIL_RATE

  if (monthlyRent !== null && monthlyRent > 0) {
    const management = monthlyRent * 12 * PROPERTY_MANAGEMENT_RATE
    return Math.round(management + maintenance + insurance + council)
  }

  return Math.round(maintenance + insurance + council)
}

export interface CashflowInput {
  monthlyRent: number | null
  annualExpenses: number
  monthlyMortgagePayment: number
}

export function computeCashflow(input: CashflowInput): CashflowResult {
  const monthlyRentalIncome = input.monthlyRent ?? 0
  const monthlyExpenses = input.annualExpenses / 12
  const monthlyMortgagePayment = input.monthlyMortgagePayment
  const monthlyCashflow = monthlyRentalIncome - monthlyExpenses - monthlyMortgagePayment

  return {
    monthlyRentalIncome,
    monthlyExpenses,
    monthlyMortgagePayment,
    monthlyCashflow,
    annualCashflow: monthlyCashflow * 12,
    isPositive: monthlyCashflow >= 0,
  }
}

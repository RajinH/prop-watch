import type { YieldResult } from './types'

export interface YieldInput {
  estimatedValue: number
  monthlyRent: number
  annualExpenses: number
}

export function computeYield(input: YieldInput): YieldResult {
  const { estimatedValue, monthlyRent, annualExpenses } = input

  if (estimatedValue <= 0 || monthlyRent <= 0) {
    return { grossYield: 0, netYield: 0 }
  }

  const annualRent = monthlyRent * 12
  const grossYield = (annualRent / estimatedValue) * 100
  const netYield = ((annualRent - annualExpenses) / estimatedValue) * 100

  return { grossYield, netYield }
}

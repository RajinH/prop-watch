import type { EquityResult } from './types'

export interface EquityInput {
  estimatedValue: number
  outstandingMortgage: number
}

export function computeEquity(input: EquityInput): EquityResult {
  const { estimatedValue, outstandingMortgage } = input
  const equityAmount = estimatedValue - outstandingMortgage
  const lvr = estimatedValue > 0 ? (outstandingMortgage / estimatedValue) * 100 : 0

  let lvrCategory: EquityResult['lvrCategory']
  if (lvr < 60) {
    lvrCategory = 'low'
  } else if (lvr <= 80) {
    lvrCategory = 'medium'
  } else {
    lvrCategory = 'high'
  }

  return { equityAmount, lvr, lvrCategory }
}

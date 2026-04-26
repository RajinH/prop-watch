import type { Property, PropertyInsights } from './types'
import { computeCashflow, getDefaultExpenses } from './cashflow'
import { computeEquity } from './equity'
import { computeYield } from './yield'
import { computeRisk } from './risk'

export function computeInsights(property: Property): PropertyInsights {
  const cashflow = computeCashflow({
    monthlyRent: property.monthlyRent,
    annualExpenses: property.annualExpenses,
    monthlyMortgagePayment: property.monthlyMortgagePayment,
  })

  const equity = computeEquity({
    estimatedValue: property.estimatedValue,
    outstandingMortgage: property.outstandingMortgage,
  })

  const yieldResult = property.isTenanted && property.monthlyRent
    ? computeYield({
        estimatedValue: property.estimatedValue,
        monthlyRent: property.monthlyRent,
        annualExpenses: property.annualExpenses,
      })
    : { grossYield: 0, netYield: 0 }

  const risk = computeRisk({
    equity,
    cashflow,
    yieldResult,
    isTenanted: property.isTenanted,
  })

  return { property, cashflow, equity, yield: yieldResult, risk }
}

export { getDefaultExpenses }

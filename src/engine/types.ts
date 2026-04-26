export interface OnboardingDraft {
  nickname: string
  estimatedValue: number
  outstandingMortgage: number
  monthlyMortgagePayment: number
  isTenanted: boolean
  monthlyRent: number | null
  annualExpenses: number | null
}

export interface Property {
  id: string
  createdAt: string
  nickname: string
  estimatedValue: number
  outstandingMortgage: number
  monthlyMortgagePayment: number
  isTenanted: boolean
  monthlyRent: number | null
  annualExpenses: number
}

export interface CashflowResult {
  monthlyRentalIncome: number
  monthlyExpenses: number
  monthlyMortgagePayment: number
  monthlyCashflow: number
  annualCashflow: number
  isPositive: boolean
}

export interface EquityResult {
  equityAmount: number
  lvr: number
  lvrCategory: 'low' | 'medium' | 'high'
}

export interface YieldResult {
  grossYield: number
  netYield: number
}

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical'

export interface RiskFactor {
  label: string
  severity: 'positive' | 'neutral' | 'warning' | 'critical'
  description: string
}

export interface RiskResult {
  level: RiskLevel
  score: number
  factors: RiskFactor[]
}

export interface PropertyInsights {
  property: Property
  cashflow: CashflowResult
  equity: EquityResult
  yield: YieldResult
  risk: RiskResult
}

export type OnboardingStep =
  | 'nickname'
  | 'valuation_mortgage'
  | 'mortgage_payment'
  | 'rental'
  | 'expenses'
  | 'review'
  | 'insights'

export interface OnboardingState {
  step: OnboardingStep
  draft: Partial<OnboardingDraft>
}

export interface Portfolio {
  properties: Property[]
  version: number
}

export interface UserAccount {
  email: string
  createdAt: string
}

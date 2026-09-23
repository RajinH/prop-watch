import type { ActionStrategy } from '../types'
import { reviewRefinanceStrategy } from './refinance'
import { reviewRentStrategy } from './rentReview'
import { payDownDebtStrategy } from './debtPaydown'

export const STRATEGIES: ActionStrategy[] = [
  reviewRefinanceStrategy,
  reviewRentStrategy,
  payDownDebtStrategy,
]

import type { Property } from './types'
import { round2 } from './money'

/**
 * How a historical balance was arrived at. Every reconstructed point carries one
 * so a caller can tell a computed figure from a held-flat placeholder — the
 * series is meant to be *derived*, and where it can't be, that has to be visible
 * rather than smoothed over.
 */
export type ReconstructionMethod =
  | 'reverse_amortised'
  | 'interest_only_flat'
  | 'no_rate_flat'
  | 'clamped'

export type ReconstructionConfidence = 'high' | 'medium' | 'low'

export interface ReconstructedBalance {
  /** 0 = `asOf`, 1 = one month earlier, and so on. */
  months_back: number
  /** ISO date (YYYY-MM-DD) this balance applies to. */
  date: string
  balance: number
  method: ReconstructionMethod
  confidence: ReconstructionConfidence
}

export type LoanFacts = Pick<
  Property,
  | 'current_debt'
  | 'monthly_repayment'
  | 'interest_rate'
  | 'loan_type'
  | 'loan_term_years'
  | 'purchase_price'
  | 'purchase_date'
  | 'fixed_rate_expiry'
  | 'interest_rate_type'
>

/** Confidence decays with distance: rate and repayment are *today's* values. */
function confidenceFor(monthsBack: number): ReconstructionConfidence {
  if (monthsBack <= 12) return 'high'
  if (monthsBack <= 24) return 'medium'
  return 'low'
}

function isoMonthsBefore(asOf: string, months: number): string {
  const d = new Date(`${asOf}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() - months)
  return d.toISOString().slice(0, 10)
}

/**
 * Reconstruct a loan's balance backwards, month by month.
 *
 * This is the exact inverse of `computeDebtProjection`'s forward recursion:
 * forward is `B(k+1) = B(k)(1 + i) - R`, so backward is
 * `B(k) = (B(k+1) + R) / (1 + i)`, with `i = interest_rate / 12` — matching that
 * module's convention, since `interest_rate` is stored as a decimal (0.065), not
 * a percentage.
 *
 * Accuracy caveat, deliberately encoded as `confidence` rather than hidden: the
 * recursion runs at today's rate and today's repayment. Both moved materially
 * through the 2023-26 rate cycle, so the further back a point is the less it can
 * be trusted. The slope stays roughly right — repayment is held fixed within the
 * recursion — but the level drifts.
 *
 * `asOf` is passed in rather than read from the clock so the function stays pure
 * and its tests stay deterministic.
 */
export function reverseAmortise(
  loan: LoanFacts,
  monthsBack: number,
  asOf: string
): ReconstructedBalance[] {
  const out: ReconstructedBalance[] = []
  if (monthsBack < 0) return out

  const purchaseMs = loan.purchase_date ? Date.parse(loan.purchase_date) : null

  // A normally-amortising loan grows as you walk backwards, so a long enough
  // window eventually implies a balance larger than the original borrowing. Cap
  // it: the purchase price is the natural ceiling, since nobody borrowed more
  // than the asset cost, and where that is unknown twice the current balance is
  // a sane bound. (A negatively-amortising loan shrinks backwards instead and
  // never reaches the cap.)
  const ceiling = Math.min(
    loan.purchase_price ?? Number.POSITIVE_INFINITY,
    loan.current_debt * 2
  )

  const rate = loan.interest_rate
  const monthlyRate = rate !== null ? rate / 12 : null

  // Interest-only loans do not amortise, so the balance genuinely is flat going
  // backwards. That is a correct reconstruction, not a degraded one.
  const interestOnly = loan.loan_type === 'interest_only'
  // Without a rate we cannot run the recursion at all. Deliberately NOT falling
  // back on computeDebtProjection's implied-rate heuristic: it assumes a
  // 360-month term, and running that assumption backwards compounds it.
  const cannotAmortise =
    monthlyRate === null || loan.monthly_repayment <= 0 || monthlyRate < 0

  const baseMethod: ReconstructionMethod = interestOnly
    ? 'interest_only_flat'
    : cannotAmortise
      ? 'no_rate_flat'
      : 'reverse_amortised'

  // A fixed rate that rolled over inside the window means the repayment we're
  // holding constant wasn't the repayment in force back then.
  const fixedExpiryMs =
    loan.interest_rate_type === 'fixed' && loan.fixed_rate_expiry
      ? Date.parse(loan.fixed_rate_expiry)
      : null

  let balance = loan.current_debt

  for (let k = 0; k <= monthsBack; k++) {
    const date = isoMonthsBefore(asOf, k)

    // The property did not exist in the portfolio before it was bought; emit
    // nothing rather than inventing a balance for a loan that had not started.
    if (purchaseMs !== null && Date.parse(date) < purchaseMs) break

    if (k > 0 && baseMethod === 'reverse_amortised') {
      balance = (balance + loan.monthly_repayment) / (1 + monthlyRate!)
    }

    const clamped = balance > ceiling
    const value = clamped ? ceiling : balance

    let confidence = confidenceFor(k)
    if (clamped) confidence = 'low'
    if (fixedExpiryMs !== null && Date.parse(date) < fixedExpiryMs) confidence = 'low'

    out.push({
      months_back: k,
      date,
      balance: round2(Math.max(0, value)),
      method: clamped ? 'clamped' : baseMethod,
      confidence,
    })

    if (clamped) balance = ceiling
  }

  return out
}

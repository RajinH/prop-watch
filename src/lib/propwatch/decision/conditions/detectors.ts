import { computePropertySnapshot } from '../../engine/computePropertySnapshot'
import type {
  ConditionSeverity,
  DecisionContextBase,
  DetectedCondition,
  EvidenceValue,
} from '../types'
import { daysBetween, monthsBetween } from '../dates'

type Detector = (ctx: DecisionContextBase) => DetectedCondition[]

function condition(
  ctx: DecisionContextBase,
  partial: {
    code: DetectedCondition['code']
    scope: DetectedCondition['scope']
    property_id?: string
    severity: ConditionSeverity
    evidence: Record<string, EvidenceValue>
  }
): DetectedCondition {
  return {
    ...partial,
    detected_at: ctx.today,
    data_as_of: ctx.snapshot.snapshot_date,
  }
}

const detectNegativeCashflow: Detector = (ctx) => {
  if (ctx.snapshot.monthly_cashflow >= 0) return []
  const deficit = Math.abs(ctx.snapshot.monthly_cashflow)
  const maxDeficit = ctx.goal?.max_monthly_deficit ?? null
  const exceedsGoalDeficit = maxDeficit !== null && deficit > maxDeficit
  return [
    condition(ctx, {
      code: 'negative_cashflow',
      scope: 'portfolio',
      severity: exceedsGoalDeficit ? 'critical' : 'warning',
      evidence: {
        monthly_cashflow: ctx.snapshot.monthly_cashflow,
        max_monthly_deficit: maxDeficit,
        exceeds_goal_deficit: exceedsGoalDeficit,
      },
    }),
  ]
}

const detectPropertyNegativeCashflow: Detector = (ctx) =>
  ctx.properties.flatMap((property) => {
    const snap = computePropertySnapshot(property, ctx.today)
    if (snap.monthly_cashflow >= 0) return []
    return [
      condition(ctx, {
        code: 'property_negative_cashflow',
        scope: 'property',
        property_id: property.id,
        severity: 'warning',
        evidence: {
          property_name: property.name,
          monthly_cashflow: snap.monthly_cashflow,
        },
      }),
    ]
  })

const detectRateAboveReference: Detector = (ctx) =>
  ctx.properties.flatMap((property) => {
    if (property.interest_rate === null) return []
    if (property.interest_rate <= ctx.config.rate_flag_threshold) return []
    return [
      condition(ctx, {
        code: 'rate_above_reference',
        scope: 'property',
        property_id: property.id,
        severity: 'warning',
        evidence: {
          property_name: property.name,
          interest_rate: property.interest_rate,
          reference_rate: ctx.config.reference_interest_rate,
          margin_above_reference:
            property.interest_rate - ctx.config.reference_interest_rate,
          current_debt: property.current_debt,
        },
      }),
    ]
  })

const detectHighLvr: Detector = (ctx) => {
  const conditions: DetectedCondition[] = []
  const { weighted_lvr } = ctx.snapshot
  if (weighted_lvr !== null && weighted_lvr >= ctx.config.high_lvr_threshold) {
    conditions.push(
      condition(ctx, {
        code: 'high_lvr',
        scope: 'portfolio',
        severity: 'critical',
        evidence: {
          weighted_lvr,
          threshold: ctx.config.high_lvr_threshold,
        },
      })
    )
  }
  for (const property of ctx.properties) {
    const snap = computePropertySnapshot(property, ctx.today)
    if (snap.lvr !== null && snap.lvr >= ctx.config.high_lvr_threshold) {
      conditions.push(
        condition(ctx, {
          code: 'high_lvr',
          scope: 'property',
          property_id: property.id,
          severity: 'warning',
          evidence: {
            property_name: property.name,
            lvr: snap.lvr,
            threshold: ctx.config.high_lvr_threshold,
          },
        })
      )
    }
  }
  return conditions
}

const detectLowYield: Detector = (ctx) => {
  const conditions: DetectedCondition[] = []
  const portfolioYield = ctx.snapshot.yield
  if (portfolioYield !== null && portfolioYield < ctx.config.target_gross_yield) {
    conditions.push(
      condition(ctx, {
        code: 'low_yield',
        scope: 'portfolio',
        severity: 'info',
        evidence: {
          gross_yield: portfolioYield,
          target: ctx.config.target_gross_yield,
        },
      })
    )
  }
  for (const property of ctx.properties) {
    if (property.monthly_rent <= 0) continue
    const snap = computePropertySnapshot(property, ctx.today)
    if (snap.yield !== null && snap.yield < ctx.config.property_low_yield_threshold) {
      conditions.push(
        condition(ctx, {
          code: 'low_yield',
          scope: 'property',
          property_id: property.id,
          severity: 'info',
          evidence: {
            property_name: property.name,
            gross_yield: snap.yield,
            target: ctx.config.property_low_yield_threshold,
          },
        })
      )
    }
  }
  return conditions
}

const detectFixedExpiryApproaching: Detector = (ctx) =>
  ctx.properties.flatMap((property) => {
    if (!property.fixed_rate_expiry) return []
    const daysUntil = daysBetween(ctx.today, property.fixed_rate_expiry)
    if (daysUntil > ctx.config.fixed_expiry_window_days) return []
    return [
      condition(ctx, {
        code: 'fixed_expiry_approaching',
        scope: 'property',
        property_id: property.id,
        severity: daysUntil <= 30 ? 'critical' : 'warning',
        evidence: {
          property_name: property.name,
          fixed_rate_expiry: property.fixed_rate_expiry,
          days_until_expiry: daysUntil,
        },
      }),
    ]
  })

const detectRentReviewDue: Detector = (ctx) =>
  ctx.properties.flatMap((property) => {
    if (property.monthly_rent <= 0) return []
    const monthsSince = property.last_rent_review_date
      ? monthsBetween(property.last_rent_review_date, ctx.today)
      : null
    const due =
      monthsSince === null || monthsSince >= ctx.config.rent_review_min_interval_months
    if (!due) return []
    return [
      condition(ctx, {
        code: 'rent_review_due',
        scope: 'property',
        property_id: property.id,
        severity: 'info',
        evidence: {
          property_name: property.name,
          last_rent_review_date: property.last_rent_review_date,
          months_since_review: monthsSince,
        },
      }),
    ]
  })

const detectComparableRentGap: Detector = (ctx) =>
  ctx.properties.flatMap((property) => {
    if (property.comparable_monthly_rent === null) return []
    if (property.comparable_monthly_rent <= property.monthly_rent) return []
    return [
      condition(ctx, {
        code: 'comparable_rent_gap',
        scope: 'property',
        property_id: property.id,
        severity: 'info',
        evidence: {
          property_name: property.name,
          monthly_rent: property.monthly_rent,
          comparable_monthly_rent: property.comparable_monthly_rent,
          monthly_gap: property.comparable_monthly_rent - property.monthly_rent,
        },
      }),
    ]
  })

const detectFundsAvailable: Detector = (ctx) => {
  const lumpSum = ctx.goal?.available_lump_sum ?? null
  if (lumpSum === null || lumpSum < ctx.config.paydown_min_lump_sum) return []
  return [
    condition(ctx, {
      code: 'funds_available',
      scope: 'portfolio',
      severity: 'info',
      evidence: {
        available_lump_sum: lumpSum,
        minimum: ctx.config.paydown_min_lump_sum,
      },
    }),
  ]
}

const detectMissingRequiredData: Detector = (ctx) =>
  ctx.properties.flatMap((property) => {
    const missing: string[] = []
    if (property.current_debt > 0) {
      if (property.interest_rate === null) missing.push('interest_rate')
      if (property.loan_type === null) missing.push('loan_type')
    }
    if (property.monthly_rent > 0 && property.comparable_monthly_rent === null) {
      missing.push('comparable_monthly_rent')
    }
    if (missing.length === 0) return []
    return [
      condition(ctx, {
        code: 'missing_required_data',
        scope: 'property',
        property_id: property.id,
        severity: 'info',
        evidence: {
          property_name: property.name,
          missing_fields: missing.join(','),
        },
      }),
    ]
  })

const DETECTORS: Detector[] = [
  detectNegativeCashflow,
  detectPropertyNegativeCashflow,
  detectRateAboveReference,
  detectHighLvr,
  detectLowYield,
  detectFixedExpiryApproaching,
  detectRentReviewDue,
  detectComparableRentGap,
  detectFundsAvailable,
  detectMissingRequiredData,
]

export function detectConditions(ctx: DecisionContextBase): DetectedCondition[] {
  return DETECTORS.flatMap((detect) => detect(ctx))
}

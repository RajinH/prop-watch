import type { Property, PortfolioSnapshotInsert, InsightInsert } from './types'
import { computeSensitivity } from './computeSensitivity'
import { computePropertySnapshot } from './computePropertySnapshot'
import { computeCapitalGrowth } from './computeCapitalGrowth'
import { computeAcquisitionCapacity } from './computeAcquisitionCapacity'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function generateInsights(
  portfolioId: string,
  snapshot: PortfolioSnapshotInsert,
  properties: Property[]
): InsightInsert[] {
  const insights: InsightInsert[] = []

  // Rule 1 & 2: cashflow (mutually exclusive)
  if (snapshot.monthly_cashflow < 0) {
    insights.push({
      portfolio_id: portfolioId,
      type: 'cashflow_negative',
      severity: 'warning',
      title: 'Negative portfolio cashflow',
      description: `Your portfolio costs $${Math.abs(snapshot.monthly_cashflow).toFixed(0)}/month out of pocket after rent, expenses, and repayments.`,
      impact: snapshot.monthly_cashflow,
      status: 'active',
    })
  } else if (snapshot.monthly_cashflow > 0) {
    insights.push({
      portfolio_id: portfolioId,
      type: 'cashflow_positive',
      severity: 'positive',
      title: 'Positive portfolio cashflow',
      description: `Your portfolio generates $${snapshot.monthly_cashflow.toFixed(0)}/month surplus after rent, expenses, and repayments.`,
      impact: snapshot.monthly_cashflow,
      status: 'active',
    })
  }

  // Rule 3 & 4: LVR (mutually exclusive — only fire the higher severity)
  if (snapshot.weighted_lvr !== null) {
    if (snapshot.weighted_lvr >= 0.8) {
      insights.push({
        portfolio_id: portfolioId,
        type: 'lvr_high',
        severity: 'critical',
        title: 'High portfolio LVR',
        description: `Weighted LVR of ${(snapshot.weighted_lvr * 100).toFixed(1)}% is above 80%, which may limit refinancing options.`,
        impact: snapshot.weighted_lvr,
        status: 'active',
      })
    } else if (snapshot.weighted_lvr >= 0.65) {
      insights.push({
        portfolio_id: portfolioId,
        type: 'lvr_moderate',
        severity: 'warning',
        title: 'Moderate portfolio LVR',
        description: `Weighted LVR of ${(snapshot.weighted_lvr * 100).toFixed(1)}% is elevated. Consider paying down debt before acquiring more.`,
        impact: snapshot.weighted_lvr,
        status: 'active',
      })
    }
  }

  // Rule 5: low yield
  if (snapshot.yield !== null && snapshot.yield < 0.035) {
    insights.push({
      portfolio_id: portfolioId,
      type: 'yield_low',
      severity: 'info',
      title: 'Low rental yield',
      description: `Gross yield of ${(snapshot.yield * 100).toFixed(2)}% is below 3.5%. Consider reviewing rent, expenses, or asset mix.`,
      impact: snapshot.yield,
      status: 'active',
    })
  }

  // Rule 6: concentration risk (only relevant with multiple properties)
  if (snapshot.total_value > 0 && properties.length > 1) {
    const maxValue = Math.max(...properties.map((p) => p.current_value))
    const concentrationRatio = maxValue / snapshot.total_value
    if (concentrationRatio > 0.7) {
      const concentrated = properties.find((p) => p.current_value === maxValue)!
      insights.push({
        portfolio_id: portfolioId,
        property_id: concentrated.id,
        type: 'concentration_risk',
        severity: 'warning',
        title: 'Portfolio concentration risk',
        description: `"${concentrated.name}" represents ${(concentrationRatio * 100).toFixed(0)}% of your total portfolio value. Consider diversifying.`,
        impact: concentrationRatio,
        status: 'active',
      })
    }
  }

  // Rule 7: data quality — missing purchase details
  const missingData = properties.filter(
    (p) => p.purchase_price === null || p.purchase_date === null
  )
  if (missingData.length > 0) {
    insights.push({
      portfolio_id: portfolioId,
      type: 'data_quality',
      severity: 'info',
      title: 'Missing purchase data',
      description: `${missingData.length} propert${missingData.length === 1 ? 'y is' : 'ies are'} missing purchase price or date. Add this to unlock capital growth tracking.`,
      status: 'active',
    })
  }

  // Rules 8–10 require sensitivity computation
  const sensitivity = computeSensitivity(snapshot, properties)

  // Rule 8: rate sensitivity warning
  const { rate_breakeven_pct } = sensitivity
  if (rate_breakeven_pct !== null && rate_breakeven_pct < 1.5) {
    insights.push({
      portfolio_id: portfolioId,
      type: 'rate_sensitivity',
      severity: rate_breakeven_pct < 0.5 ? 'critical' : 'warning',
      title: 'High interest rate sensitivity',
      description: `Your portfolio goes cash flow negative at just +${rate_breakeven_pct.toFixed(2)}% in interest rates.`,
      impact: rate_breakeven_pct,
      metadata: { rate_breakeven_pct },
      status: 'active',
    })
  } else if (rate_breakeven_pct === null && snapshot.monthly_cashflow <= 0) {
    // Already negative — still surface as a rate insight if LVR is notable
    if (snapshot.weighted_lvr !== null && snapshot.weighted_lvr >= 0.5) {
      insights.push({
        portfolio_id: portfolioId,
        type: 'rate_sensitivity',
        severity: 'warning',
        title: 'Cash flow already negative',
        description: `Your portfolio is already cash flow negative. Any rate increase will deepen the deficit.`,
        metadata: { rate_breakeven_pct: null },
        status: 'active',
      })
    }
  }

  // Rule 9: yield opportunity (per-property)
  const dateStr = today()
  for (const property of properties) {
    if (property.monthly_rent <= 0) continue
    const propSnap = computePropertySnapshot(property, dateStr)
    const grossYield = propSnap.yield
    if (grossYield !== null && grossYield < 0.04) {
      insights.push({
        portfolio_id: portfolioId,
        property_id: property.id,
        type: 'opportunity_yield',
        severity: 'info',
        title: `Low yield on ${property.name}`,
        description: `${property.name} has a gross yield of ${(grossYield * 100).toFixed(1)}% — below the typical 4% threshold. Review rent or consider refinancing.`,
        impact: grossYield,
        metadata: { property_name: property.name, gross_yield: grossYield },
        status: 'active',
      })
    }
  }

  // Rule 10: all properties negatively geared
  if (properties.length > 0) {
    const dateStr2 = today()
    const allNegative = properties.every((p) => {
      const snap = computePropertySnapshot(p, dateStr2)
      return snap.monthly_cashflow < 0
    })
    if (allNegative) {
      insights.push({
        portfolio_id: portfolioId,
        type: 'gap_all_negative',
        severity: 'warning',
        title: 'All properties negatively geared',
        description: `Every property in your portfolio is negatively geared. Your total monthly deficit is $${Math.abs(snapshot.monthly_cashflow).toFixed(0)}.`,
        impact: snapshot.monthly_cashflow,
        metadata: { total_monthly_deficit: snapshot.monthly_cashflow },
        status: 'active',
      })
    }
  }

  // Rules 11–15: loan and insurance details (per-property, only fire when data is present)
  const todayMs = new Date().setHours(0, 0, 0, 0)

  for (const property of properties) {
    // Rule 11: fixed rate expiring soon
    if (property.fixed_rate_expiry) {
      const expiryMs = new Date(property.fixed_rate_expiry).setHours(0, 0, 0, 0)
      const daysUntilExpiry = Math.round((expiryMs - todayMs) / 86_400_000)
      if (daysUntilExpiry <= 90) {
        insights.push({
          portfolio_id: portfolioId,
          property_id: property.id,
          type: 'loan_fixed_expiry_soon',
          severity: daysUntilExpiry <= 30 ? 'critical' : 'warning',
          title: `Fixed rate expiring on ${property.name}`,
          description: `The fixed rate on ${property.name} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'} (${property.fixed_rate_expiry}). Review refinancing options now.`,
          metadata: { property_name: property.name, days_until_expiry: daysUntilExpiry, fixed_rate_expiry: property.fixed_rate_expiry },
          status: 'active',
        })
      }
    }

    // Rule 12: interest rate above market (>7%)
    if (property.interest_rate !== null && property.interest_rate > 0.07) {
      insights.push({
        portfolio_id: portfolioId,
        property_id: property.id,
        type: 'rate_above_market',
        severity: 'warning',
        title: `High interest rate on ${property.name}`,
        description: `${property.name} has an interest rate of ${(property.interest_rate * 100).toFixed(2)}% — above the 7% threshold. Consider refinancing to a lower rate.`,
        metadata: { property_name: property.name, interest_rate: property.interest_rate },
        status: 'active',
      })
    }

    // Rule 13: insurance renewal approaching
    if (property.insurance_renewal_date) {
      const renewalMs = new Date(property.insurance_renewal_date).setHours(0, 0, 0, 0)
      const daysUntilRenewal = Math.round((renewalMs - todayMs) / 86_400_000)
      if (daysUntilRenewal <= 90) {
        insights.push({
          portfolio_id: portfolioId,
          property_id: property.id,
          type: 'insurance_renewal_soon',
          severity: daysUntilRenewal <= 30 ? 'critical' : 'warning',
          title: `Insurance renewal due for ${property.name}`,
          description: `Insurance on ${property.name} renews in ${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'} (${property.insurance_renewal_date}). Review coverage before renewal.`,
          metadata: { property_name: property.name, days_until_renewal: daysUntilRenewal, renewal_date: property.insurance_renewal_date },
          status: 'active',
        })
      }
    }

    // Rule 14: underinsured (premium < 0.2% of value)
    if (
      property.annual_insurance_premium !== null &&
      property.annual_insurance_premium > 0 &&
      property.current_value > 0
    ) {
      const premiumRatio = property.annual_insurance_premium / property.current_value
      if (premiumRatio < 0.002) {
        insights.push({
          portfolio_id: portfolioId,
          property_id: property.id,
          type: 'insurance_underinsured',
          severity: 'warning',
          title: `Potentially underinsured: ${property.name}`,
          description: `Annual insurance premium of $${property.annual_insurance_premium.toFixed(0)} is ${(premiumRatio * 100).toFixed(2)}% of property value — below the typical 0.2% minimum. Review your coverage.`,
          metadata: { property_name: property.name, premium_to_value_pct: premiumRatio },
          status: 'active',
        })
      }
    }

    // Rule 15: no insurance details provided
    if (property.insurer === null && property.annual_insurance_premium === null) {
      insights.push({
        portfolio_id: portfolioId,
        property_id: property.id,
        type: 'insurance_missing',
        severity: 'info',
        title: `Insurance details missing for ${property.name}`,
        description: `No insurance information recorded for ${property.name}. Add your policy details to track coverage and renewal dates.`,
        metadata: { property_name: property.name },
        status: 'active',
      })
    }

    // Rule 16: insurance details on record (confirmation)
    if (property.insurer !== null || property.annual_insurance_premium !== null) {
      const parts: string[] = []
      if (property.insurer) parts.push(`Insurer: ${property.insurer}`)
      if (property.insurance_policy_type) parts.push(`Type: ${property.insurance_policy_type}`)
      if (property.annual_insurance_premium !== null) parts.push(`Premium: $${property.annual_insurance_premium.toFixed(0)}/yr`)
      if (property.insurance_renewal_date) parts.push(`Renews: ${property.insurance_renewal_date}`)
      insights.push({
        portfolio_id: portfolioId,
        property_id: property.id,
        type: 'insurance_on_record',
        severity: 'positive',
        title: `Insurance on record for ${property.name}`,
        description: parts.length > 0 ? parts.join(' · ') : `Coverage details recorded for ${property.name}.`,
        metadata: {
          property_name: property.name,
          insurer: property.insurer,
          premium: property.annual_insurance_premium,
          policy_type: property.insurance_policy_type,
          renewal_date: property.insurance_renewal_date,
        },
        status: 'active',
      })
    }

    // Rule 17: loan details on record (confirmation)
    if (property.lender !== null || property.interest_rate !== null) {
      const parts: string[] = []
      if (property.lender) parts.push(`Lender: ${property.lender}`)
      if (property.interest_rate !== null) parts.push(`Rate: ${(property.interest_rate * 100).toFixed(2)}%`)
      if (property.interest_rate_type) parts.push(`Type: ${property.interest_rate_type}`)
      if (property.loan_type) parts.push(property.loan_type === 'principal_and_interest' ? 'P&I' : 'Interest only')
      if (property.loan_term_years) parts.push(`${property.loan_term_years}yr term`)
      if (property.fixed_rate_expiry) parts.push(`Fixed until: ${property.fixed_rate_expiry}`)
      insights.push({
        portfolio_id: portfolioId,
        property_id: property.id,
        type: 'loan_on_record',
        severity: 'positive',
        title: `Loan details recorded for ${property.name}`,
        description: parts.length > 0 ? parts.join(' · ') : `Loan details recorded for ${property.name}.`,
        metadata: {
          property_name: property.name,
          lender: property.lender,
          interest_rate: property.interest_rate,
          interest_rate_type: property.interest_rate_type,
          loan_type: property.loan_type,
          loan_term_years: property.loan_term_years,
          fixed_rate_expiry: property.fixed_rate_expiry,
        },
        status: 'active',
      })
    }
  }

  // Rules 18–20: capital growth (need purchase data)
  const growth = computeCapitalGrowth(properties)
  for (const pg of growth.properties) {
    if (pg.annualised_growth_rate === null) continue
    if (pg.annualised_growth_rate >= 0.08) {
      insights.push({
        portfolio_id: portfolioId, property_id: pg.property_id, type: 'capital_growth_strong',
        severity: 'positive', title: `Strong growth on ${pg.property_name}`,
        description: `${pg.property_name} has grown at ${(pg.annualised_growth_rate * 100).toFixed(1)}% per year — above the 8% benchmark.`,
        metadata: { property_name: pg.property_name, cagr: pg.annualised_growth_rate }, status: 'active',
      })
    } else if (pg.annualised_growth_rate < 0.03 && (pg.years_held ?? 0) >= 3) {
      insights.push({
        portfolio_id: portfolioId, property_id: pg.property_id, type: 'capital_growth_underperforming',
        severity: 'warning', title: `Slow growth on ${pg.property_name}`,
        description: `${pg.property_name} has grown at only ${(pg.annualised_growth_rate * 100).toFixed(1)}% per year over ${pg.years_held?.toFixed(1)} years.`,
        metadata: { property_name: pg.property_name, cagr: pg.annualised_growth_rate, years_held: pg.years_held }, status: 'active',
      })
    }
    if (pg.unrealised_gain_pct !== null && pg.unrealised_gain_pct >= 0.5) {
      insights.push({
        portfolio_id: portfolioId, property_id: pg.property_id, type: 'total_return_high',
        severity: 'positive', title: `Strong equity position on ${pg.property_name}`,
        description: `${pg.property_name} has gained ${(pg.unrealised_gain_pct * 100).toFixed(0)}% ($${(pg.unrealised_gain ?? 0).toLocaleString('en-AU', { maximumFractionDigits: 0 })}) since purchase.`,
        metadata: { property_name: pg.property_name, gain_pct: pg.unrealised_gain_pct, gain: pg.unrealised_gain }, status: 'active',
      })
    }
  }

  // Rules 21–22: acquisition capacity
  const capacity = computeAcquisitionCapacity(properties)
  if (capacity.usable_equity_80 > 50000) {
    insights.push({
      portfolio_id: portfolioId, type: 'equity_unlockable',
      severity: 'positive', title: 'Usable equity available',
      description: `You have $${capacity.usable_equity_80.toLocaleString('en-AU', { maximumFractionDigits: 0 })} in usable equity at 80% LVR — enough to support a next purchase of up to $${capacity.max_purchase_price_80.toLocaleString('en-AU', { maximumFractionDigits: 0 })}.`,
      metadata: { usable_equity_80: capacity.usable_equity_80, max_purchase_80: capacity.max_purchase_price_80 }, status: 'active',
    })
  }
  if (capacity.usable_equity_80 <= 0) {
    insights.push({
      portfolio_id: portfolioId, type: 'equity_locked',
      severity: 'warning', title: 'Equity fully leveraged',
      description: `Your portfolio LVR leaves no usable equity at 80%. Focus on debt reduction before purchasing again.`,
      metadata: {}, status: 'active',
    })
  }

  return insights
}

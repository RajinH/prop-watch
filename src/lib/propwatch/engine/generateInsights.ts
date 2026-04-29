import type { Property, PortfolioSnapshotInsert, InsightInsert } from './types'
import { computeSensitivity } from './computeSensitivity'
import { computePropertySnapshot } from './computePropertySnapshot'

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

  return insights
}

import type { Property, PortfolioSnapshotInsert, InsightInsert } from './types'

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

  return insights
}

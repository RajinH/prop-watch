import type { Input, ScenarioResult, RiskLevel } from "./types";
import { computeMetrics, scoreToRiskLevel } from "./decisionEngine";
import { CASHFLOW_DEEP_NEGATIVE_THRESHOLD, RISK_SCORE_CASHFLOW_NEGATIVE, RISK_SCORE_CASHFLOW_DEEP } from "./rules";

function cashflowRiskLevel(cashflow: number): RiskLevel {
  let score = 0;
  if (cashflow < 0) score += RISK_SCORE_CASHFLOW_NEGATIVE;
  if (cashflow < CASHFLOW_DEEP_NEGATIVE_THRESHOLD) score += RISK_SCORE_CASHFLOW_DEEP;
  return scoreToRiskLevel(score);
}

export function runScenarios(base: Input): ScenarioResult[] {
  const variants: Array<{ label: string; input: Input }> = [
    { label: "Base case", input: base },
    { label: "Rate +1%", input: { ...base, interestRate: base.interestRate + 0.01 } },
    { label: "Rent −10%", input: { ...base, rentWeekly: base.rentWeekly * 0.9 } },
  ];

  return variants.map(({ label, input }) => {
    const m = computeMetrics(input);
    return {
      label,
      cashflow: m.cashflow,
      riskLevel: cashflowRiskLevel(m.cashflow),
    };
  });
}

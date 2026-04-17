import type { PartialInput, Input, DecisionResult, DecisionMetrics, RiskLevel } from "./types";
import {
  DEFAULT_INTEREST_RATE,
  DEFAULT_EXPENSES_RATIO,
  DEFAULT_DEPOSIT_RATIO,
  LOAN_TERM_MONTHS,
  RISK_SCORE_CASHFLOW_NEGATIVE,
  RISK_SCORE_CASHFLOW_DEEP,
  RISK_SCORE_RATE_SENSITIVE,
  RISK_SCORE_HIGH_PROPERTY_COUNT,
  RISK_SCORE_LOW_DEPOSIT,
  CASHFLOW_DEEP_NEGATIVE_THRESHOLD,
  RATE_SENSITIVITY_DROP_THRESHOLD,
  RISK_LEVEL_THRESHOLDS,
  MAX_DEBT_SERVICE_RATIO,
} from "./rules";
import { runScenarios } from "./scenarios";

function resolveInput(partial: PartialInput): Input {
  const price = partial.price!;
  const interestRate = partial.interestRate ?? DEFAULT_INTEREST_RATE;
  const expensesRatio = partial.expensesRatio ?? DEFAULT_EXPENSES_RATIO;
  const deposit = partial.deposit ?? price * DEFAULT_DEPOSIT_RATIO;
  return {
    price,
    rentWeekly: partial.rentWeekly!,
    deposit,
    income: partial.income,
    propertyCount: partial.propertyCount,
    interestRate,
    expensesRatio,
  };
}

export function computeMetrics(input: Input): DecisionMetrics {
  const rawLoan = input.price - input.deposit;
  const loanAmount = Math.max(0, rawLoan);
  const depositExceedsPrice = rawLoan < 0;

  const monthlyRate = input.interestRate / 12;
  const factor = Math.pow(1 + monthlyRate, LOAN_TERM_MONTHS);
  const monthlyRepayment =
    monthlyRate === 0
      ? loanAmount / LOAN_TERM_MONTHS
      : (loanAmount * monthlyRate * factor) / (factor - 1);

  const monthlyRent = (input.rentWeekly * 52) / 12;
  const expenses = monthlyRent * input.expensesRatio;
  const cashflow = monthlyRent - monthlyRepayment - expenses;

  const grossYield = input.price > 0 ? (input.rentWeekly * 52) / input.price : 0;
  const depositRatio = input.price > 0 ? input.deposit / input.price : 0;

  void depositExceedsPrice;

  return {
    loanAmount,
    monthlyRepayment,
    monthlyRent,
    expenses,
    cashflow,
    grossYield,
    depositRatio,
    riskScore: 0,
  };
}

export function scoreToRiskLevel(score: number): RiskLevel {
  for (const { maxScore, level } of RISK_LEVEL_THRESHOLDS) {
    if (score <= maxScore) return level;
  }
  return "high";
}

function scoreRisk(
  metrics: DecisionMetrics,
  input: Input
): { score: number; bullets: string[] } {
  let score = 0;
  const bullets: string[] = [];

  const depositExceedsPrice = input.deposit > input.price;
  if (depositExceedsPrice) {
    bullets.push("Deposit exceeds purchase price — loan amount treated as $0");
  }

  if (metrics.cashflow < 0) {
    score += RISK_SCORE_CASHFLOW_NEGATIVE;
    bullets.push("Negative cashflow — you top up from your own pocket each month");
  }
  if (metrics.cashflow < CASHFLOW_DEEP_NEGATIVE_THRESHOLD) {
    score += RISK_SCORE_CASHFLOW_DEEP;
    bullets.push(
      `Deep negative cashflow — exceeds $${Math.abs(CASHFLOW_DEEP_NEGATIVE_THRESHOLD)}/mo shortfall`
    );
  }

  const stressedMetrics = computeMetrics({ ...input, interestRate: input.interestRate + 0.01 });
  if (metrics.cashflow !== 0) {
    const drop = (stressedMetrics.cashflow - metrics.cashflow) / Math.abs(metrics.cashflow);
    if (drop < -RATE_SENSITIVITY_DROP_THRESHOLD) {
      score += RISK_SCORE_RATE_SENSITIVE;
      bullets.push("Sensitive to rate rises — cashflow drops >20% with just +1% rate increase");
    }
  } else if (stressedMetrics.cashflow < 0) {
    score += RISK_SCORE_RATE_SENSITIVE;
    bullets.push("A rate rise of 1% would push cashflow negative");
  }

  if (input.propertyCount === "3+") {
    score += RISK_SCORE_HIGH_PROPERTY_COUNT;
    bullets.push("3+ properties increases total portfolio leverage exposure");
  }

  if (metrics.depositRatio < DEFAULT_DEPOSIT_RATIO && !depositExceedsPrice) {
    score += RISK_SCORE_LOW_DEPOSIT;
    bullets.push(
      `Deposit below 20% (${(metrics.depositRatio * 100).toFixed(0)}%) — Lenders Mortgage Insurance likely applies`
    );
  }

  if (bullets.length === 0) {
    bullets.push("Positive cashflow with a solid deposit — fundamentals look strong");
  }

  return { score, bullets };
}

export function evaluateDecision(partial: PartialInput): DecisionResult {
  if (partial.price == null || partial.rentWeekly == null) {
    throw new Error("evaluateDecision requires price and rentWeekly");
  }

  const input = resolveInput(partial);
  const rawMetrics = computeMetrics(input);
  const { score, bullets } = scoreRisk(rawMetrics, input);
  const riskLevel = scoreToRiskLevel(score);
  const metrics: DecisionMetrics = { ...rawMetrics, riskScore: score };

  const scenarios = runScenarios(input);

  let isAffordable: boolean | null = null;
  let debtServiceRatio: number | null = null;
  if (input.income != null && input.income > 0) {
    debtServiceRatio = metrics.monthlyRepayment / (input.income / 12);
    isAffordable = debtServiceRatio <= MAX_DEBT_SERVICE_RATIO;
  }

  return {
    metrics,
    riskLevel,
    riskScore: score,
    scenarios,
    reasoningBullets: bullets,
    isAffordable,
    debtServiceRatio,
  };
}

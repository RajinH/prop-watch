import type { RiskLevel } from "./types";

export const DEFAULT_INTEREST_RATE = 0.065;
export const DEFAULT_EXPENSES_RATIO = 0.25;
export const DEFAULT_DEPOSIT_RATIO = 0.20;
export const LOAN_TERM_MONTHS = 360;

export const RISK_SCORE_CASHFLOW_NEGATIVE = 2;
export const RISK_SCORE_CASHFLOW_DEEP = 1;
export const RISK_SCORE_RATE_SENSITIVE = 1;
export const RISK_SCORE_HIGH_PROPERTY_COUNT = 1;
export const RISK_SCORE_LOW_DEPOSIT = 1;

export const CASHFLOW_DEEP_NEGATIVE_THRESHOLD = -500;
export const RATE_SENSITIVITY_DROP_THRESHOLD = 0.20;

export const RISK_LEVEL_THRESHOLDS: Array<{ maxScore: number; level: RiskLevel }> = [
  { maxScore: 1, level: "low" },
  { maxScore: 3, level: "medium" },
  { maxScore: Infinity, level: "high" },
];

export const MAX_DEBT_SERVICE_RATIO = 0.30;

export const CASHFLOW_TRIGGER_DEPOSIT = 0;
export const RISK_TRIGGER_INCOME: RiskLevel[] = ["medium", "high"];

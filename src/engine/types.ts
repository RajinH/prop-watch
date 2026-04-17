export type RiskLevel = "low" | "medium" | "high";

export type PropertyCount = "1" | "2" | "3+";

export type QuestionId =
  | "price"
  | "rentWeekly"
  | "deposit"
  | "income"
  | "propertyCount"
  | "interestRate"
  | "expensesRatio";

export interface PartialInput {
  price?: number;
  rentWeekly?: number;
  deposit?: number;
  income?: number;
  propertyCount?: PropertyCount;
  interestRate?: number;
  expensesRatio?: number;
}

export interface Input {
  price: number;
  rentWeekly: number;
  deposit: number;
  income?: number;
  propertyCount?: PropertyCount;
  interestRate: number;
  expensesRatio: number;
}

export interface DecisionMetrics {
  loanAmount: number;
  monthlyRepayment: number;
  monthlyRent: number;
  expenses: number;
  cashflow: number;
  grossYield: number;
  depositRatio: number;
  riskScore: number;
}

export interface ScenarioResult {
  label: string;
  cashflow: number;
  riskLevel: RiskLevel;
}

export interface DecisionResult {
  metrics: DecisionMetrics;
  riskLevel: RiskLevel;
  riskScore: number;
  scenarios: ScenarioResult[];
  reasoningBullets: string[];
  isAffordable: boolean | null;
  debtServiceRatio: number | null;
}

export interface AnsweredQuestion {
  id: QuestionId;
  displayLabel: string;
  displayValue: string;
}

export interface AppState {
  inputs: PartialInput;
  activeQuestion: QuestionId;
  answeredQuestions: AnsweredQuestion[];
  editingQuestion: QuestionId | null;
}

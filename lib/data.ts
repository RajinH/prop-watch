export type TimePeriod = "weekly" | "monthly" | "yearly" | "lifetime";

export interface Property {
  id: string;
  name: string;
  address: string;
  valuation: number;
  loanRemaining: number;
  lvr: number; // (loanRemaining / valuation) * 100
  expenses: number; // monthly
  income: number; // monthly
}

export interface PortfolioHistory {
  month: string;
  totalValue: number;
  totalDebt: number;
  equity: number;
}

export interface CashFlowData {
  month: string;
  income: number;
  expenses: number;
}

export const properties: Property[] = [
  {
    id: "1",
    name: "Bondi Beach Apartment",
    address: "42 Campbell Parade, Bondi Beach NSW 2026",
    valuation: 1450000,
    loanRemaining: 980000,
    lvr: 67.6,
    expenses: 2800,
    income: 4200,
  },
  {
    id: "2",
    name: "Melbourne CBD Unit",
    address: "15/320 Queen Street, Melbourne VIC 3000",
    valuation: 680000,
    loanRemaining: 510000,
    lvr: 75.0,
    expenses: 1950,
    income: 2400,
  },
  {
    id: "3",
    name: "Brisbane Townhouse",
    address: "8 Riverside Drive, New Farm QLD 4005",
    valuation: 920000,
    loanRemaining: 644000,
    lvr: 70.0,
    expenses: 2200,
    income: 3100,
  },
  {
    id: "4",
    name: "Perth Investment Home",
    address: "27 Stirling Highway, Cottesloe WA 6011",
    valuation: 1120000,
    loanRemaining: 728000,
    lvr: 65.0,
    expenses: 2500,
    income: 3800,
  },
  {
    id: "5",
    name: "Adelaide Family Home",
    address: "156 Unley Road, Unley SA 5061",
    valuation: 780000,
    loanRemaining: 468000,
    lvr: 60.0,
    expenses: 1800,
    income: 2600,
  },
];

export const portfolioHistory: PortfolioHistory[] = [
  { month: "Jul", totalValue: 4650000, totalDebt: 3450000, equity: 1200000 },
  { month: "Aug", totalValue: 4700000, totalDebt: 3420000, equity: 1280000 },
  { month: "Sep", totalValue: 4750000, totalDebt: 3390000, equity: 1360000 },
  { month: "Oct", totalValue: 4820000, totalDebt: 3360000, equity: 1460000 },
  { month: "Nov", totalValue: 4880000, totalDebt: 3340000, equity: 1540000 },
  { month: "Dec", totalValue: 4950000, totalDebt: 3330000, equity: 1620000 },
];

export const cashFlowData: CashFlowData[] = [
  { month: "Jul", income: 15200, expenses: 10800 },
  { month: "Aug", income: 15500, expenses: 11100 },
  { month: "Sep", income: 15800, expenses: 10950 },
  { month: "Oct", income: 16100, expenses: 11250 },
  { month: "Nov", income: 16100, expenses: 11000 },
  { month: "Dec", income: 16100, expenses: 11250 },
];

// Helper functions
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function calculatePortfolioSummary(properties: Property[]) {
  const totalValue = properties.reduce((sum, p) => sum + p.valuation, 0);
  const totalDebt = properties.reduce((sum, p) => sum + p.loanRemaining, 0);
  const totalIncome = properties.reduce((sum, p) => sum + p.income, 0);
  const totalExpenses = properties.reduce((sum, p) => sum + p.expenses, 0);
  const avgLvr = (totalDebt / totalValue) * 100;
  const netCashFlow = totalIncome - totalExpenses;

  return {
    totalValue,
    totalDebt,
    totalEquity: totalValue - totalDebt,
    avgLvr,
    totalIncome,
    totalExpenses,
    netCashFlow,
  };
}

// Time period helpers
export function getValueForPeriod(
  monthlyValue: number,
  period: TimePeriod
): number {
  switch (period) {
    case "weekly":
      return monthlyValue / 4.33; // avg weeks per month
    case "monthly":
      return monthlyValue;
    case "yearly":
      return monthlyValue * 12;
    case "lifetime":
      return monthlyValue * 12 * 30; // 30-year assumption
  }
}

export function getPeriodLabel(period: TimePeriod): string {
  switch (period) {
    case "weekly":
      return "/wk";
    case "monthly":
      return "/mo";
    case "yearly":
      return "/yr";
    case "lifetime":
      return " total";
  }
}

export function getPeriodDisplayName(period: TimePeriod): string {
  switch (period) {
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "yearly":
      return "Yearly";
    case "lifetime":
      return "Lifetime";
  }
}

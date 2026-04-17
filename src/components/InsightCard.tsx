"use client";

import type { DecisionResult, RiskLevel } from "@/engine/types";
import { formatCurrency, formatCashflow, formatPercent } from "@/lib/formatters";

interface InsightCardProps {
  result: DecisionResult | null;
  visible: boolean;
}

const RISK_STYLES: Record<RiskLevel, { badge: string; cashflow: string }> = {
  low: {
    badge: "bg-[#e8f5ea] border-[#a8d5ae] text-[#005412]",
    cashflow: "text-[#005412]",
  },
  medium: {
    badge: "bg-amber-50 border-amber-200 text-amber-700",
    cashflow: "text-amber-600",
  },
  high: {
    badge: "bg-[#fff0f0] border-[#ffb3b3] text-[#FF0000]",
    cashflow: "text-[#FF0000]",
  },
};

const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low Risk",
  medium: "Medium Risk",
  high: "High Risk",
};

function ScenarioRow({ label, cashflow, riskLevel }: { label: string; cashflow: number; riskLevel: RiskLevel }) {
  const styles = RISK_STYLES[riskLevel];
  const isPositive = cashflow >= 0;
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium tabular-nums ${isPositive ? "text-[#005412]" : "text-[#FF0000]"}`}>
          {formatCashflow(cashflow)}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${styles.badge}`}>
          {RISK_LABELS[riskLevel]}
        </span>
      </div>
    </div>
  );
}

export default function InsightCard({ result, visible }: InsightCardProps) {
  if (!visible) return null;

  if (!result) {
    return (
      <div className="bg-white border border-[#C5C5C5] rounded-2xl p-6 shadow-sm animate-fade-in">
        <div className="h-10 w-32 bg-slate-100 rounded-lg animate-pulse mb-3" />
        <div className="h-5 w-20 bg-slate-100 rounded-full animate-pulse mb-6" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const { metrics, riskLevel, scenarios, reasoningBullets, isAffordable, debtServiceRatio } = result;
  const styles = RISK_STYLES[riskLevel];

  return (
    <div className="bg-white border border-[#C5C5C5] rounded-2xl p-6 shadow-sm animate-fade-in">
      {/* Headline */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">Monthly cashflow</p>
        <div className="flex items-end gap-3">
          <span
            className={`text-4xl font-bold tabular-nums leading-none ${
              metrics.cashflow >= 0 ? "text-[#005412]" : "text-[#FF0000]"
            }`}
          >
            {formatCashflow(metrics.cashflow)}
          </span>
          <span className={`mb-0.5 text-sm px-2.5 py-1 rounded-full border font-medium ${styles.badge}`}>
            {RISK_LABELS[riskLevel]}
          </span>
        </div>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-400 mb-1">Gross yield</p>
          <p className="text-sm font-semibold text-slate-800">{formatPercent(metrics.grossYield)}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-400 mb-1">Loan amount</p>
          <p className="text-sm font-semibold text-slate-800">{formatCurrency(metrics.loanAmount)}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-400 mb-1">Repayment</p>
          <p className="text-sm font-semibold text-slate-800">{formatCurrency(metrics.monthlyRepayment)}/mo</p>
        </div>
      </div>

      {/* Affordability */}
      {debtServiceRatio != null && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-4 text-sm font-medium border ${
            isAffordable
              ? "bg-[#e8f5ea] border-[#a8d5ae] text-[#005412]"
              : "bg-[#fff0f0] border-[#ffb3b3] text-[#FF0000]"
          }`}
        >
          <span>{isAffordable ? "✓" : "✗"}</span>
          <span>
            Debt service ratio: {formatPercent(debtServiceRatio)} of gross income
            {isAffordable ? " — within 30% guideline" : " — exceeds 30% guideline"}
          </span>
        </div>
      )}

      {/* Scenario comparison */}
      <div className="mb-5">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">Stress scenarios</p>
        <div className="border border-slate-100 rounded-xl px-3">
          {scenarios.map((s) => (
            <ScenarioRow key={s.label} {...s} />
          ))}
        </div>
      </div>

      {/* Reasoning bullets */}
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">Key factors</p>
        <ul className="space-y-1.5">
          {reasoningBullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#C5C5C5] shrink-0" />
              {bullet}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

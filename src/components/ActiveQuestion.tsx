"use client";

import { useState, useEffect, useRef } from "react";
import type { QuestionId, DecisionResult, PropertyCount } from "@/engine/types";
import { DEFAULT_INTEREST_RATE, DEFAULT_EXPENSES_RATIO } from "@/engine/rules";
import { formatCurrency } from "@/lib/formatters";

interface QuestionConfig {
  label: string;
  hint: string;
  inputType: "currency" | "percent" | "toggle";
  placeholder?: string;
  defaultValue?: number;
  toggleOptions?: Array<{ value: PropertyCount; label: string }>;
}

const QUESTION_CONFIG: Record<QuestionId, QuestionConfig> = {
  price: {
    label: "What's the property price?",
    hint: "Enter the purchase price",
    inputType: "currency",
    placeholder: "800,000",
  },
  rentWeekly: {
    label: "What's the expected weekly rent?",
    hint: "Gross weekly rent before expenses",
    inputType: "currency",
    placeholder: "650",
  },
  deposit: {
    label: "How much deposit do you have?",
    hint: "Your upfront contribution",
    inputType: "currency",
    placeholder: "160,000",
  },
  income: {
    label: "What's your annual income?",
    hint: "Gross annual salary — used to check affordability",
    inputType: "currency",
    placeholder: "120,000",
  },
  propertyCount: {
    label: "How many investment properties will you have?",
    hint: "Including this one",
    inputType: "toggle",
    toggleOptions: [
      { value: "1", label: "Just this one" },
      { value: "2", label: "2 properties" },
      { value: "3+", label: "3 or more" },
    ],
  },
  interestRate: {
    label: "What interest rate do you expect?",
    hint: `Defaults to ${(DEFAULT_INTEREST_RATE * 100).toFixed(1)}% p.a.`,
    inputType: "percent",
    placeholder: "6.5",
    defaultValue: DEFAULT_INTEREST_RATE * 100,
  },
  expensesRatio: {
    label: "What's your estimated expenses ratio?",
    hint: `Covers management, maintenance, vacancy — defaults to ${(DEFAULT_EXPENSES_RATIO * 100).toFixed(0)}%`,
    inputType: "percent",
    placeholder: "25",
    defaultValue: DEFAULT_EXPENSES_RATIO * 100,
  },
};

interface ActiveQuestionProps {
  questionId: QuestionId;
  currentValue: string | number | undefined;
  result: DecisionResult | null;
  onChange: (id: QuestionId, value: string) => void;
  onAdvance: () => void;
  canAdvance: boolean;
}

function getMicroFeedback(questionId: QuestionId, result: DecisionResult | null): string | null {
  if (!result) return null;
  const m = result.metrics;
  switch (questionId) {
    case "price":
      return `Loan amount: ${formatCurrency(m.loanAmount)} at 20% deposit`;
    case "rentWeekly":
      return `${formatCurrency(m.monthlyRent)}/mo gross rent`;
    case "deposit":
      return `Loan amount: ${formatCurrency(m.loanAmount)} — ${(m.depositRatio * 100).toFixed(0)}% of price`;
    case "income": {
      if (result.debtServiceRatio != null) {
        const pct = (result.debtServiceRatio * 100).toFixed(0);
        return `Repayments = ${pct}% of gross monthly income`;
      }
      return null;
    }
    case "interestRate":
      return `Monthly repayment: ${formatCurrency(m.monthlyRepayment)}`;
    case "expensesRatio":
      return `Expenses: ${formatCurrency(m.expenses)}/mo`;
    default:
      return null;
  }
}

export default function ActiveQuestion({
  questionId,
  currentValue,
  result,
  onChange,
  onAdvance,
  canAdvance,
}: ActiveQuestionProps) {
  const config = QUESTION_CONFIG[questionId];
  const microFeedback = getMicroFeedback(questionId, result);

  const [raw, setRaw] = useState<string>(currentValue != null ? String(currentValue) : "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRaw(currentValue != null ? String(currentValue) : "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  const handleNumberChange = (value: string) => {
    setRaw(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(questionId, value);
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canAdvance) onAdvance();
  };

  return (
    <div className="bg-white border border-[#C5C5C5] rounded-2xl p-6 shadow-sm transition-all duration-200">
      <label className="block text-lg font-semibold text-slate-900 mb-1">
        {config.label}
      </label>
      <p className="text-sm text-slate-500 mb-4">{config.hint}</p>

      {config.inputType === "toggle" && config.toggleOptions ? (
        <div className="flex gap-2 flex-wrap">
          {config.toggleOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange(questionId, opt.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-150 ${
                currentValue === opt.value
                  ? "bg-[#005412] text-white border-[#005412]"
                  : "bg-white text-slate-700 border-[#C5C5C5] hover:border-[#005412]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : config.inputType === "currency" ? (
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium pointer-events-none">
            $
          </span>
          <input
            type="number"
            min="0"
            value={raw}
            placeholder={config.placeholder}
            onChange={(e) => handleNumberChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-8 pr-4 py-3 border border-[#C5C5C5] rounded-xl text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-[#005412] focus:border-transparent transition-all duration-150 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            autoFocus
          />
        </div>
      ) : (
        <div className="relative">
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={raw}
            placeholder={config.placeholder}
            onChange={(e) => handleNumberChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-4 pr-10 py-3 border border-[#C5C5C5] rounded-xl text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-[#005412] focus:border-transparent transition-all duration-150 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            autoFocus
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium pointer-events-none">
            %
          </span>
        </div>
      )}

      {microFeedback && (
        <p className="mt-2 text-sm text-slate-500 transition-all duration-200">{microFeedback}</p>
      )}

      {canAdvance && (
        <button
          onClick={onAdvance}
          className="mt-4 px-5 py-2 bg-[#005412] text-white text-sm font-medium rounded-xl hover:bg-[#003d0d] active:scale-95 transition-all duration-150"
        >
          Continue →
        </button>
      )}
    </div>
  );
}

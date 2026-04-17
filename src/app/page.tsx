"use client";

import { useReducer, useMemo, useEffect, useCallback } from "react";
import type {
  AppState,
  PartialInput,
  QuestionId,
  AnsweredQuestion,
  PropertyCount,
  DecisionResult,
} from "@/engine/types";
import { evaluateDecision } from "@/engine/decisionEngine";
import { DEFAULT_INTEREST_RATE, DEFAULT_EXPENSES_RATIO } from "@/engine/rules";
import { saveState, loadState } from "@/lib/storage";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import ContextSummary from "@/components/ContextSummary";
import ActiveQuestion from "@/components/ActiveQuestion";
import InsightCard from "@/components/InsightCard";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseInput(id: QuestionId, raw: string): PartialInput[QuestionId] {
  if (!raw || raw.trim() === "") return undefined;
  if (id === "propertyCount") return raw as PropertyCount;
  const n = parseFloat(raw.replace(/,/g, ""));
  if (isNaN(n) || n < 0) return undefined;
  if (id === "interestRate" || id === "expensesRatio") return n / 100;
  return n;
}

function formatDisplayValue(id: QuestionId, value: PartialInput[QuestionId]): string {
  if (value == null) return "";
  if (id === "propertyCount") {
    const labels: Record<PropertyCount, string> = {
      "1": "Just this one",
      "2": "2 properties",
      "3+": "3 or more",
    };
    return labels[value as PropertyCount] ?? String(value);
  }
  if (id === "interestRate" || id === "expensesRatio") return formatPercent(value as number);
  return formatCurrency(value as number);
}

function getDisplayLabel(id: QuestionId): string {
  const labels: Record<QuestionId, string> = {
    price: "Price",
    rentWeekly: "Rent/wk",
    deposit: "Deposit",
    income: "Income",
    propertyCount: "Properties",
    interestRate: "Rate",
    expensesRatio: "Expenses",
  };
  return labels[id];
}

function deriveNextQuestion(
  inputs: PartialInput,
  result: DecisionResult | null,
  answeredIds: Set<QuestionId>
): QuestionId | null {
  if (!inputs.price) return "price";
  if (!inputs.rentWeekly) return "rentWeekly";

  if (result && result.metrics.cashflow < 0 && !answeredIds.has("deposit")) return "deposit";

  const depositProvided = answeredIds.has("deposit");
  const riskElevated = result?.riskLevel === "medium" || result?.riskLevel === "high";
  if ((depositProvided || riskElevated) && !answeredIds.has("income")) return "income";

  if (riskElevated && !answeredIds.has("propertyCount")) return "propertyCount";

  if (!answeredIds.has("interestRate")) return "interestRate";
  if (!answeredIds.has("expensesRatio")) return "expensesRatio";

  return null;
}

// ─── State & Reducer ──────────────────────────────────────────────────────────

type Action =
  | { type: "SET_INPUT"; id: QuestionId; rawValue: string }
  | { type: "ADVANCE_QUESTION"; result: DecisionResult | null; answeredIds: Set<QuestionId> }
  | { type: "EDIT_QUESTION"; id: QuestionId }
  | { type: "RESTORE"; state: AppState }
  | { type: "RESET" };

const INITIAL_STATE: AppState = {
  inputs: {},
  activeQuestion: "price",
  answeredQuestions: [],
  editingQuestion: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_INPUT": {
      const parsed = parseInput(action.id, action.rawValue);
      return {
        ...state,
        inputs: { ...state.inputs, [action.id]: parsed },
      };
    }
    case "ADVANCE_QUESTION": {
      const current = state.activeQuestion;
      const value = state.inputs[current];
      if (value == null) return state;

      const newAnswered: AnsweredQuestion = {
        id: current,
        displayLabel: getDisplayLabel(current),
        displayValue: formatDisplayValue(current, value),
      };

      const existingAnswered = state.answeredQuestions.filter((q) => q.id !== current);
      const updatedAnswered = [...existingAnswered, newAnswered];
      const answeredIds = new Set(updatedAnswered.map((q) => q.id));

      const next = deriveNextQuestion(state.inputs, action.result, answeredIds);

      return {
        ...state,
        answeredQuestions: updatedAnswered,
        activeQuestion: next ?? current,
        editingQuestion: null,
      };
    }
    case "EDIT_QUESTION": {
      return {
        ...state,
        activeQuestion: action.id,
        answeredQuestions: state.answeredQuestions.filter((q) => q.id !== action.id),
        editingQuestion: action.id,
      };
    }
    case "RESTORE": {
      return action.state;
    }
    case "RESET": {
      return INITIAL_STATE;
    }
    default:
      return state;
  }
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function HomePage() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const result: DecisionResult | null = useMemo(() => {
    if (!state.inputs.price || !state.inputs.rentWeekly) return null;
    try {
      return evaluateDecision(state.inputs);
    } catch {
      return null;
    }
  }, [state.inputs]);

  useEffect(() => {
    const saved = loadState();
    if (saved) dispatch({ type: "RESTORE", state: saved });
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const answeredIds = useMemo(
    () => new Set(state.answeredQuestions.map((q) => q.id)),
    [state.answeredQuestions]
  );

  const canAdvance = useMemo(() => {
    const val = state.inputs[state.activeQuestion];
    return val != null;
  }, [state.inputs, state.activeQuestion]);

  const handleChange = useCallback((id: QuestionId, value: string) => {
    dispatch({ type: "SET_INPUT", id, rawValue: value });
  }, []);

  const handleAdvance = useCallback(() => {
    if (!canAdvance) return;
    dispatch({ type: "ADVANCE_QUESTION", result, answeredIds });
  }, [canAdvance, result, answeredIds]);

  const handleEdit = useCallback(
    (id: QuestionId) => dispatch({ type: "EDIT_QUESTION", id }),
    []
  );

  const handleAutoAdvance = useCallback(
    (id: QuestionId) => {
      if ((id === "price" || id === "rentWeekly") && state.inputs[id] != null) {
        dispatch({ type: "ADVANCE_QUESTION", result, answeredIds });
      }
    },
    [state.inputs, result, answeredIds]
  );

  // Convert stored decimal back to display value for percent fields
  const currentDisplayValue = useMemo(() => {
    const raw = state.inputs[state.activeQuestion];
    if (raw == null) return undefined;
    if (state.activeQuestion === "interestRate" || state.activeQuestion === "expensesRatio") {
      return (raw as number) * 100;
    }
    return raw as number | string;
  }, [state.inputs, state.activeQuestion]);

  // Show default placeholder for optional fields that haven't been set
  const inputDisplayValue = useMemo(() => {
    if (state.activeQuestion === "interestRate" && state.inputs.interestRate == null) {
      return DEFAULT_INTEREST_RATE * 100;
    }
    if (state.activeQuestion === "expensesRatio" && state.inputs.expensesRatio == null) {
      return DEFAULT_EXPENSES_RATIO * 100;
    }
    return currentDisplayValue;
  }, [state.activeQuestion, state.inputs, currentDisplayValue]);

  const nextQuestion = deriveNextQuestion(state.inputs, result, answeredIds);
  const flowComplete =
    !!state.inputs.price &&
    !!state.inputs.rentWeekly &&
    nextQuestion === null &&
    answeredIds.has(state.activeQuestion);

  const insightVisible = !!(state.inputs.price && state.inputs.rentWeekly);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-10 flex flex-col gap-5">

        {/* Header */}
        <header className="text-center mb-1">
          <h1 className="text-5xl font-black text-[#005412] tracking-tight">
            PropWatch<span>.</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">Property investing without the guesswork.</p>
        </header>

        {/* Zone 1 — Context summary */}
        <ContextSummary answeredQuestions={state.answeredQuestions} onEdit={handleEdit} />

        {/* Zone 2 — Active question */}
        {!flowComplete && (
          <div onBlur={() => handleAutoAdvance(state.activeQuestion)}>
            <ActiveQuestion
              questionId={state.activeQuestion}
              currentValue={inputDisplayValue}
              result={result}
              onChange={handleChange}
              onAdvance={handleAdvance}
              canAdvance={canAdvance}
            />
          </div>
        )}

        {/* Flow complete state */}
        {flowComplete && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between animate-fade-in">
            <p className="text-sm text-slate-600 font-medium">Analysis complete</p>
            <button
              onClick={() => dispatch({ type: "RESET" })}
              className="text-xs text-slate-400 hover:text-slate-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100"
            >
              Start over
            </button>
          </div>
        )}

        {/* Zone 3 — Insight card */}
        <InsightCard result={result} visible={insightVisible} />

      </div>
    </main>
  );
}

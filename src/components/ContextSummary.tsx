"use client";

import type { AnsweredQuestion, QuestionId } from "@/engine/types";

interface ContextSummaryProps {
  answeredQuestions: AnsweredQuestion[];
  onEdit: (id: QuestionId) => void;
}

export default function ContextSummary({ answeredQuestions, onEdit }: ContextSummaryProps) {
  if (answeredQuestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {answeredQuestions.map((q) => (
        <button
          key={q.id}
          onClick={() => onEdit(q.id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-white border border-[#C5C5C5] text-slate-600 hover:border-[#005412] hover:text-slate-900 transition-all duration-200 group"
        >
          <span className="text-slate-400 text-xs">{q.displayLabel}</span>
          <span className="font-medium text-slate-800">{q.displayValue}</span>
          <svg
            className="w-3 h-3 text-[#C5C5C5] group-hover:text-[#005412] transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}

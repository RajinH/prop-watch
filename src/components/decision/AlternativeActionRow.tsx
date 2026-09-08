'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { RecommendationRow } from './types'
import { ACTION_LABELS, fmtSigned } from './types'

export default function AlternativeActionRow({
  recommendation: rec,
}: {
  recommendation: RecommendationRow
}) {
  const { copy, impact, blocked, required_inputs } = rec.payload
  const monthly = impact.monthly_cashflow_delta

  return (
    <Link
      href={`/actions/${rec.id}`}
      className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:border-slate-200 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{copy.title}</p>
          {blocked && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              Needs input
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {blocked && required_inputs.includes('comparable_monthly_rent')
            ? 'Add a comparable market rent to evaluate this action'
            : copy.summary}
        </p>
      </div>
      {!blocked && monthly !== undefined && monthly !== 0 && (
        <span
          className={`shrink-0 text-sm font-bold ${monthly > 0 ? 'text-green-700' : 'text-red-600'}`}
        >
          {fmtSigned(monthly)}/mo
        </span>
      )}
      <span className="shrink-0 text-xs font-medium text-slate-400">
        {ACTION_LABELS[rec.action_type]}
      </span>
      <ChevronRight size={16} className="shrink-0 text-slate-300" />
    </Link>
  )
}

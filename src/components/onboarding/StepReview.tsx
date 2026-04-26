'use client'

import type { OnboardingDraft, OnboardingStep } from '@/engine/types'
import { formatCurrencyShort } from '@/lib/formatters'

interface Props {
  draft: Partial<OnboardingDraft>
  onConfirm: () => void
  onBack: () => void
  onGoToStep: (step: OnboardingStep) => void
}

interface ReviewRow {
  label: string
  value: string
  step: OnboardingStep
}

export default function StepReview({ draft, onConfirm, onBack, onGoToStep }: Props) {
  const rows: ReviewRow[] = [
    { label: 'Property', value: draft.nickname ?? '—', step: 'nickname' },
    {
      label: 'Estimated value',
      value: draft.estimatedValue ? formatCurrencyShort(draft.estimatedValue) : '—',
      step: 'valuation_mortgage',
    },
    {
      label: 'Outstanding mortgage',
      value: draft.outstandingMortgage === 0
        ? 'Owned outright'
        : draft.outstandingMortgage
        ? formatCurrencyShort(draft.outstandingMortgage)
        : '—',
      step: 'valuation_mortgage',
    },
    ...(draft.outstandingMortgage && draft.outstandingMortgage > 0
      ? [
          {
            label: 'Monthly repayment',
            value: draft.monthlyMortgagePayment ? `$${draft.monthlyMortgagePayment.toLocaleString('en-AU')}/mo` : '—',
            step: 'mortgage_payment' as OnboardingStep,
          },
        ]
      : []),
    {
      label: 'Rental status',
      value: draft.isTenanted ? 'Currently tenanted' : 'Not tenanted',
      step: 'rental',
    },
    ...(draft.isTenanted && draft.monthlyRent
      ? [
          {
            label: 'Monthly rent',
            value: `$${draft.monthlyRent.toLocaleString('en-AU')}/mo`,
            step: 'rental' as OnboardingStep,
          },
        ]
      : []),
    {
      label: 'Annual expenses',
      value: draft.annualExpenses != null ? formatCurrencyShort(draft.annualExpenses) + '/yr' : '—',
      step: 'expenses',
    },
  ]

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-slate-900">Review your details</h2>
        <p className="text-slate-500">Tap any row to edit. We&apos;ll generate your property analysis next.</p>
      </div>

      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {rows.map((row) => (
          <button
            key={row.label}
            onClick={() => onGoToStep(row.step)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
          >
            <span className="text-sm text-slate-500">{row.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-900">{row.value}</span>
              <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
        >
          See my property analysis →
        </button>
      </div>
    </div>
  )
}

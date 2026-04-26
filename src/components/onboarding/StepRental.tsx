'use client'

import { useState, useMemo } from 'react'
import type { OnboardingDraft } from '@/engine/types'
import { computeCashflow, getDefaultExpenses } from '@/engine/cashflow'
import { formatCashflow } from '@/lib/formatters'
import StepInput from './StepInput'
import InlinePreview from './InlinePreview'

interface Props {
  draft: Partial<OnboardingDraft>
  onNext: (updates: Partial<OnboardingDraft>) => void
  onBack: () => void
}

function parseCurrency(val: string): number {
  return parseFloat(val.replace(/[^0-9.]/g, '')) || 0
}

export default function StepRental({ draft, onNext, onBack }: Props) {
  const [isTenanted, setIsTenanted] = useState<boolean | null>(
    draft.isTenanted !== undefined ? draft.isTenanted : null
  )
  const [rentStr, setRentStr] = useState(draft.monthlyRent?.toString() ?? '')

  const rent = parseCurrency(rentStr)

  const cashflowPreview = useMemo(() => {
    if (!isTenanted || rent <= 0) return null
    const estimatedValue = draft.estimatedValue ?? 0
    const defaultExpenses = getDefaultExpenses(estimatedValue, rent)
    return computeCashflow({
      monthlyRent: rent,
      annualExpenses: defaultExpenses,
      monthlyMortgagePayment: draft.monthlyMortgagePayment ?? 0,
    })
  }, [isTenanted, rent, draft.estimatedValue, draft.monthlyMortgagePayment])

  function handleNext() {
    if (isTenanted === null) return
    if (isTenanted && rent <= 0) return
    onNext({
      isTenanted,
      monthlyRent: isTenanted ? rent : null,
    })
  }

  const canProceed = isTenanted !== null && (!isTenanted || rent > 0)

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-slate-900">Is this property tenanted?</h2>
        <p className="text-slate-500">This affects your cashflow and yield calculations.</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: true, label: 'Currently tenanted', icon: '🏠' },
            { value: false, label: 'Not currently tenanted', icon: '🔑' },
          ].map(({ value, label, icon }) => (
            <button
              key={label}
              onClick={() => setIsTenanted(value)}
              className={`flex flex-col gap-1 rounded-xl border-2 p-4 text-left transition-all ${
                isTenanted === value
                  ? 'border-green-700 bg-green-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className="text-lg">{icon}</span>
              <span className={`text-sm font-medium ${isTenanted === value ? 'text-green-800' : 'text-slate-700'}`}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {isTenanted && (
          <div className="animate-fade-in">
            <StepInput
              id="monthly-rent"
              label="Monthly rent"
              value={rentStr}
              onChange={setRentStr}
              prefix="$"
              placeholder="2,800"
              hint="Gross rent received before any deductions."
            />
          </div>
        )}
      </div>

      {cashflowPreview && (
        <InlinePreview
          items={[
            {
              label: 'Est. monthly cashflow',
              value: formatCashflow(cashflowPreview.monthlyCashflow),
              highlight: cashflowPreview.isPositive,
            },
            {
              label: 'Position',
              value: '',
              badge: {
                text: cashflowPreview.isPositive ? 'Positive' : 'Negative',
                color: cashflowPreview.isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800',
              },
            },
          ]}
        />
      )}

      {isTenanted === false && (
        <div className="animate-fade-in rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
          <p className="text-sm text-slate-500">
            No rental income — holding costs will be your mortgage and expenses only.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40 hover:bg-green-700"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

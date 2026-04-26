'use client'

import { useState } from 'react'
import type { OnboardingDraft } from '@/engine/types'
import StepInput from './StepInput'

interface Props {
  draft: Partial<OnboardingDraft>
  onNext: (updates: Partial<OnboardingDraft>) => void
  onBack: () => void
}

function parseCurrency(val: string): number {
  return parseFloat(val.replace(/[^0-9.]/g, '')) || 0
}

export default function StepMortgagePayment({ draft, onNext, onBack }: Props) {
  const [paymentStr, setPaymentStr] = useState(draft.monthlyMortgagePayment?.toString() ?? '')

  const payment = parseCurrency(paymentStr)

  function handleNext() {
    if (payment <= 0) return
    onNext({ monthlyMortgagePayment: payment })
  }

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-slate-900">Monthly mortgage repayment</h2>
        <p className="text-slate-500">This is your principal + interest repayment, not the offset balance.</p>
      </div>

      <StepInput
        id="mortgage-payment"
        label="Monthly repayment"
        value={paymentStr}
        onChange={setPaymentStr}
        prefix="$"
        placeholder="3,200"
        hint="Include principal and interest. Exclude any offset account deductions."
      />

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={payment <= 0}
          className="rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40 hover:bg-green-700"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

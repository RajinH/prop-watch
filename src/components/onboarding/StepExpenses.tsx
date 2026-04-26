'use client'

import { useState, useMemo } from 'react'
import type { OnboardingDraft } from '@/engine/types'
import { getDefaultExpenses } from '@/engine/cashflow'
import { formatCurrencyShort } from '@/lib/formatters'
import StepInput from './StepInput'

interface Props {
  draft: Partial<OnboardingDraft>
  onNext: (updates: Partial<OnboardingDraft>) => void
  onBack: () => void
}

type ExpenseMode = 'default' | 'custom'

function parseCurrency(val: string): number {
  return parseFloat(val.replace(/[^0-9.]/g, '')) || 0
}

export default function StepExpenses({ draft, onNext, onBack }: Props) {
  const defaultAmount = useMemo(() => {
    return getDefaultExpenses(draft.estimatedValue ?? 0, draft.monthlyRent ?? null)
  }, [draft.estimatedValue, draft.monthlyRent])

  const [mode, setMode] = useState<ExpenseMode>(
    draft.annualExpenses !== null && draft.annualExpenses !== undefined ? 'custom' : 'default'
  )
  const [customStr, setCustomStr] = useState(
    draft.annualExpenses !== null && draft.annualExpenses !== undefined
      ? draft.annualExpenses.toString()
      : ''
  )

  const resolvedExpenses = mode === 'default' ? defaultAmount : parseCurrency(customStr)
  const canProceed = mode === 'default' || parseCurrency(customStr) > 0

  function handleNext() {
    if (!canProceed) return
    onNext({ annualExpenses: resolvedExpenses })
  }

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-slate-900">Annual property expenses</h2>
        <p className="text-slate-500">
          Includes council rates, insurance, maintenance, and{' '}
          {draft.isTenanted ? 'property management fees.' : 'upkeep costs.'}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => setMode('default')}
          className={`flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all ${
            mode === 'default' ? 'border-green-700 bg-green-50' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${mode === 'default' ? 'border-green-700' : 'border-slate-300'}`}>
            {mode === 'default' && <div className="h-2 w-2 rounded-full bg-green-700" />}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className={`text-sm font-semibold ${mode === 'default' ? 'text-green-800' : 'text-slate-700'}`}>
              Use a typical estimate
            </span>
            <span className="text-sm text-slate-500">
              ~{formatCurrencyShort(defaultAmount)}/year based on your property
            </span>
          </div>
        </button>

        <button
          onClick={() => setMode('custom')}
          className={`flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all ${
            mode === 'custom' ? 'border-green-700 bg-green-50' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0">
            {mode === 'custom' && <div className="h-2 w-2 rounded-full bg-green-700" />}
          </div>
          <div className="flex flex-col gap-0.5 w-full">
            <span className={`text-sm font-semibold ${mode === 'custom' ? 'text-green-800' : 'text-slate-700'}`}>
              I know my expenses
            </span>
            <span className="text-sm text-slate-500">Enter your actual annual total</span>
          </div>
        </button>

        {mode === 'custom' && (
          <div className="animate-fade-in pl-2">
            <StepInput
              id="annual-expenses"
              label="Annual expenses"
              value={customStr}
              onChange={setCustomStr}
              prefix="$"
              placeholder="18,000"
              hint="Council rates + strata + insurance + maintenance + property management"
            />
          </div>
        )}
      </div>

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

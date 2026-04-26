'use client'

import { useState, useMemo } from 'react'
import type { OnboardingDraft } from '@/engine/types'
import { computeEquity } from '@/engine/equity'
import { formatCurrencyShort, formatLVR } from '@/lib/formatters'
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

export default function StepValuationMortgage({ draft, onNext, onBack }: Props) {
  const [valueStr, setValueStr] = useState(draft.estimatedValue?.toString() ?? '')
  const [mortgageStr, setMortgageStr] = useState(draft.outstandingMortgage?.toString() ?? '')
  const [ownedOutright, setOwnedOutright] = useState(draft.outstandingMortgage === 0)

  const estimatedValue = parseCurrency(valueStr)
  const outstandingMortgage = ownedOutright ? 0 : parseCurrency(mortgageStr)

  const equityPreview = useMemo(() => {
    if (estimatedValue <= 0) return null
    return computeEquity({ estimatedValue, outstandingMortgage })
  }, [estimatedValue, outstandingMortgage])

  const lvrBadgeColor = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-amber-100 text-amber-800',
    high: 'bg-red-100 text-red-800',
  }

  function handleNext() {
    if (estimatedValue <= 0) return
    onNext({
      estimatedValue,
      outstandingMortgage,
      // when owned outright, mortgage payment is implicitly 0 — set it so isDraftComplete passes
      ...(ownedOutright ? { monthlyMortgagePayment: 0 } : {}),
    })
  }

  const canProceed = estimatedValue > 0

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-slate-900">Property value & mortgage</h2>
        <p className="text-slate-500">We&apos;ll use this to calculate your equity position.</p>
      </div>

      <div className="flex flex-col gap-4">
        <StepInput
          id="value"
          label="Estimated property value"
          value={valueStr}
          onChange={setValueStr}
          prefix="$"
          placeholder="750,000"
        />

        <div className="flex flex-col gap-3">
          <StepInput
            id="mortgage"
            label="Outstanding mortgage balance"
            value={ownedOutright ? '0' : mortgageStr}
            onChange={setMortgageStr}
            prefix="$"
            placeholder="500,000"
            disabled={ownedOutright}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={ownedOutright}
              onChange={(e) => setOwnedOutright(e.target.checked)}
              className="rounded accent-green-700"
            />
            <span className="text-sm text-slate-600">Owned outright (no mortgage)</span>
          </label>
        </div>
      </div>

      {equityPreview && (
        <InlinePreview
          items={[
            { label: 'Your equity', value: formatCurrencyShort(equityPreview.equityAmount), highlight: true },
            { label: 'LVR', value: formatLVR(equityPreview.lvr) },
            {
              label: 'Position',
              value: '',
              badge: {
                text: equityPreview.lvrCategory === 'low' ? 'Strong' : equityPreview.lvrCategory === 'medium' ? 'Moderate' : 'High LVR',
                color: lvrBadgeColor[equityPreview.lvrCategory],
              },
            },
          ]}
        />
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

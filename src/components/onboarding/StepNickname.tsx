'use client'

import { useState } from 'react'
import type { OnboardingDraft } from '@/engine/types'
import StepInput from './StepInput'

interface Props {
  draft: Partial<OnboardingDraft>
  onNext: (updates: Partial<OnboardingDraft>) => void
}

export default function StepNickname({ draft, onNext }: Props) {
  const [nickname, setNickname] = useState(draft.nickname ?? '')

  function handleNext() {
    const trimmed = nickname.trim()
    if (!trimmed) return
    onNext({ nickname: trimmed })
  }

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-slate-900">What's this property?</h2>
        <p className="text-slate-500">Give it a nickname so you can identify it in your portfolio.</p>
      </div>

      <StepInput
        id="nickname"
        label="Property nickname"
        value={nickname}
        onChange={setNickname}
        placeholder="e.g. Fitzroy Apartment"
        inputMode="text"
      />

      <button
        onClick={handleNext}
        disabled={!nickname.trim()}
        className="self-start rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40 hover:bg-green-700"
      >
        Let&apos;s go →
      </button>
    </div>
  )
}

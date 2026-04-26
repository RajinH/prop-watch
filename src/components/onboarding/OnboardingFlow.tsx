'use client'

import { useReducer, useEffect, useState } from 'react'
import type { OnboardingDraft, OnboardingState, OnboardingStep, Property } from '@/engine/types'
import { getDefaultExpenses } from '@/engine/cashflow'
import { computeInsights } from '@/engine/insights'
import { addPropertyToPortfolio, loadOnboardingDraft, saveOnboardingDraft, clearOnboardingDraft } from '@/lib/storage'
import ProgressBar from './ProgressBar'
import ResumePrompt from './ResumePrompt'
import StepNickname from './StepNickname'
import StepValuationMortgage from './StepValuationMortgage'
import StepMortgagePayment from './StepMortgagePayment'
import StepRental from './StepRental'
import StepExpenses from './StepExpenses'
import StepReview from './StepReview'
import InsightsReveal from '@/components/insights/InsightsReveal'

const WIZARD_STEPS: OnboardingStep[] = [
  'nickname',
  'valuation_mortgage',
  'mortgage_payment',
  'rental',
  'expenses',
  'review',
]

type Action =
  | { type: 'RESUME'; draft: Partial<OnboardingDraft> }
  | { type: 'NEXT_STEP'; updates: Partial<OnboardingDraft> }
  | { type: 'BACK_STEP' }
  | { type: 'GO_TO_STEP'; step: OnboardingStep }
  | { type: 'COMPLETE' }
  | { type: 'START_FRESH' }

function getNextStep(current: OnboardingStep, draft: Partial<OnboardingDraft>): OnboardingStep {
  const idx = WIZARD_STEPS.indexOf(current)
  if (idx === -1) return 'nickname'
  let next = WIZARD_STEPS[idx + 1]
  if (next === 'mortgage_payment' && !draft.outstandingMortgage) {
    next = WIZARD_STEPS[idx + 2]
  }
  return next ?? 'review'
}

function getPrevStep(current: OnboardingStep, draft: Partial<OnboardingDraft>): OnboardingStep {
  const idx = WIZARD_STEPS.indexOf(current)
  if (idx <= 0) return WIZARD_STEPS[0]
  let prev = WIZARD_STEPS[idx - 1]
  if (prev === 'mortgage_payment' && !draft.outstandingMortgage) {
    prev = WIZARD_STEPS[idx - 2] ?? WIZARD_STEPS[0]
  }
  return prev
}

function reducer(state: OnboardingState, action: Action): OnboardingState {
  switch (action.type) {
    case 'RESUME':
      return { ...state, draft: action.draft }
    case 'START_FRESH':
      return { step: 'nickname', draft: {} }
    case 'NEXT_STEP': {
      const newDraft = { ...state.draft, ...action.updates }
      const nextStep = getNextStep(state.step, newDraft)
      return { step: nextStep, draft: newDraft }
    }
    case 'BACK_STEP':
      return { ...state, step: getPrevStep(state.step, state.draft) }
    case 'GO_TO_STEP':
      return { ...state, step: action.step }
    case 'COMPLETE':
      return { ...state, step: 'insights' }
    default:
      return state
  }
}

function isDraftComplete(draft: Partial<OnboardingDraft>): draft is OnboardingDraft {
  return (
    typeof draft.nickname === 'string' &&
    draft.nickname.length > 0 &&
    typeof draft.estimatedValue === 'number' &&
    typeof draft.outstandingMortgage === 'number' &&
    typeof draft.monthlyMortgagePayment === 'number' &&
    typeof draft.isTenanted === 'boolean' &&
    draft.annualExpenses !== undefined &&
    draft.annualExpenses !== null
  )
}

function buildProperty(draft: OnboardingDraft): Property {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    nickname: draft.nickname,
    estimatedValue: draft.estimatedValue,
    outstandingMortgage: draft.outstandingMortgage,
    monthlyMortgagePayment: draft.monthlyMortgagePayment,
    isTenanted: draft.isTenanted,
    monthlyRent: draft.monthlyRent ?? null,
    annualExpenses: draft.annualExpenses ?? getDefaultExpenses(draft.estimatedValue, draft.monthlyRent),
  }
}

const STEP_PROGRESS: Record<OnboardingStep, number> = {
  nickname: 0,
  valuation_mortgage: 1,
  mortgage_payment: 2,
  rental: 3,
  expenses: 4,
  review: 5,
  insights: 5,
}

export default function OnboardingFlow() {
  const [state, dispatch] = useReducer(reducer, { step: 'nickname', draft: {} })
  const [showResume, setShowResume] = useState(false)
  const [savedProperty, setSavedProperty] = useState<Property | null>(null)

  useEffect(() => {
    const draft = loadOnboardingDraft()
    if (draft && Object.keys(draft).length > 0) {
      dispatch({ type: 'RESUME', draft })
      setShowResume(true)
    }
  }, [])

  useEffect(() => {
    if (state.step !== 'insights' && Object.keys(state.draft).length > 0) {
      saveOnboardingDraft(state.draft)
    }
  }, [state.draft, state.step])

  function handleConfirmReview() {
    if (!isDraftComplete(state.draft)) return
    const property = buildProperty(state.draft as OnboardingDraft)
    addPropertyToPortfolio(property)
    clearOnboardingDraft()
    setSavedProperty(property)
    dispatch({ type: 'COMPLETE' })
  }

  const isInsights = state.step === 'insights'
  const insights = savedProperty ? computeInsights(savedProperty) : null

  return (
    <div className="flex flex-col gap-6">
      {showResume && !isInsights && (
        <ResumePrompt
          onResume={() => setShowResume(false)}
          onStartFresh={() => {
            clearOnboardingDraft()
            dispatch({ type: 'START_FRESH' })
            setShowResume(false)
          }}
        />
      )}

      {!isInsights && (
        <ProgressBar current={STEP_PROGRESS[state.step]} total={6} />
      )}

      {state.step === 'nickname' && (
        <StepNickname
          draft={state.draft}
          onNext={(u) => dispatch({ type: 'NEXT_STEP', updates: u })}
        />
      )}
      {state.step === 'valuation_mortgage' && (
        <StepValuationMortgage
          draft={state.draft}
          onNext={(u) => dispatch({ type: 'NEXT_STEP', updates: u })}
          onBack={() => dispatch({ type: 'BACK_STEP' })}
        />
      )}
      {state.step === 'mortgage_payment' && (
        <StepMortgagePayment
          draft={state.draft}
          onNext={(u) => dispatch({ type: 'NEXT_STEP', updates: u })}
          onBack={() => dispatch({ type: 'BACK_STEP' })}
        />
      )}
      {state.step === 'rental' && (
        <StepRental
          draft={state.draft}
          onNext={(u) => dispatch({ type: 'NEXT_STEP', updates: u })}
          onBack={() => dispatch({ type: 'BACK_STEP' })}
        />
      )}
      {state.step === 'expenses' && (
        <StepExpenses
          draft={state.draft}
          onNext={(u) => dispatch({ type: 'NEXT_STEP', updates: u })}
          onBack={() => dispatch({ type: 'BACK_STEP' })}
        />
      )}
      {state.step === 'review' && (
        <StepReview
          draft={state.draft}
          onConfirm={handleConfirmReview}
          onBack={() => dispatch({ type: 'BACK_STEP' })}
          onGoToStep={(step) => dispatch({ type: 'GO_TO_STEP', step })}
        />
      )}
      {isInsights && insights && (
        <InsightsReveal insights={insights} />
      )}
    </div>
  )
}

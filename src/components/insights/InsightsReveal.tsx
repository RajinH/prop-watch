'use client'

import Link from 'next/link'
import type { PropertyInsights } from '@/engine/types'
import CashflowCard from './CashflowCard'
import EquityCard from './EquityCard'
import YieldCard from './YieldCard'
import RiskCard from './RiskCard'
import FeatureTeaserSection from '@/components/onboarding/FeatureTeaserSection'
import SignUpPrompt from '@/components/onboarding/SignUpPrompt'

interface Props {
  insights: PropertyInsights
  isAuthenticated?: boolean
}

export default function InsightsReveal({ insights, isAuthenticated }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-900">
          {insights.property.nickname}
        </h2>
        <p className="text-slate-500">Here&apos;s how your property stacks up.</p>
      </div>

      <div className="flex flex-col gap-4">
        <CashflowCard cashflow={insights.cashflow} style={{ animationDelay: '80ms', opacity: 0 }} />
        <EquityCard equity={insights.equity} style={{ animationDelay: '180ms', opacity: 0 }} />
        <YieldCard
          yieldResult={insights.yield}
          isTenanted={insights.property.isTenanted}
          style={{ animationDelay: '280ms', opacity: 0 }}
        />
        <RiskCard risk={insights.risk} style={{ animationDelay: '380ms', opacity: 0 }} />

        <FeatureTeaserSection
          insights={insights}
          style={{ animationDelay: '500ms', opacity: 0 }}
        />

        {isAuthenticated ? (
          <div
            className="animate-slide-up flex flex-col gap-3 rounded-2xl border-2 border-green-100 bg-green-50 p-6 text-center"
            style={{ animationDelay: '680ms', opacity: 0 }}
          >
            <p className="text-base font-bold text-slate-900">Your property has been saved.</p>
            <Link
              href="/dashboard"
              className="mt-1 inline-flex items-center justify-center rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
            >
              Go to Dashboard →
            </Link>
          </div>
        ) : (
          <SignUpPrompt style={{ animationDelay: '680ms', opacity: 0 }} />
        )}
      </div>
    </div>
  )
}

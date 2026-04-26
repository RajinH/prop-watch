'use client'

import type { PropertyInsights } from '@/engine/types'
import CashflowCard from './CashflowCard'
import EquityCard from './EquityCard'
import YieldCard from './YieldCard'
import RiskCard from './RiskCard'
import FeatureTeaserSection from '@/components/onboarding/FeatureTeaserSection'
import SignUpPrompt from '@/components/onboarding/SignUpPrompt'

interface Props {
  insights: PropertyInsights
}

export default function InsightsReveal({ insights }: Props) {
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

        <SignUpPrompt style={{ animationDelay: '680ms', opacity: 0 }} />
      </div>
    </div>
  )
}

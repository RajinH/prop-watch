'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import type { Property, PortfolioSnapshotInsert, PropertySnapshot, RiskProfile, SensitivityResult } from '@/lib/propwatch/engine/types'
import ActionHub from './ActionHub'
import PortfolioTab from './tabs/PortfolioTab'
import RiskTab from './tabs/RiskTab'
import InsightsTab from './tabs/InsightsTab'
import ScenariosTab from './tabs/ScenariosTab'

interface InsightRow {
  id: string
  type: string
  severity: string
  title: string
  description: string
  impact: number | null
  metadata: Record<string, unknown>
}

interface Props {
  user: User | null
  portfolioSnapshot: PortfolioSnapshotInsert | null
  properties: Property[]
  propertySnapshots: Record<string, PropertySnapshot>
  insights: InsightRow[]
  riskProfile: RiskProfile | null
  sensitivity: SensitivityResult | null
  hasPortfolio: boolean
}

type Tab = 'portfolio' | 'risk' | 'insights' | 'scenarios'

const TABS: { id: Tab; label: string }[] = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'risk', label: 'Risk' },
  { id: 'insights', label: 'Insights' },
  { id: 'scenarios', label: 'Scenarios' },
]

export default function DashboardShell({
  user,
  portfolioSnapshot,
  properties,
  propertySnapshots,
  insights,
  riskProfile,
  sensitivity,
  hasPortfolio,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('portfolio')

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'there'

  const noData = !portfolioSnapshot || properties.length === 0

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-slate-900">Welcome, {displayName}</h1>
        <Link
          href="/properties"
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Manage properties →
        </Link>
      </div>

      {/* Empty state */}
      {(!hasPortfolio || noData) && (
        <div className="flex flex-col items-center gap-4 py-20 text-center rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-500">No properties yet — add one to unlock your portfolio dashboard.</p>
          <Link
            href="/onboarding"
            className="rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Add your first property →
          </Link>
        </div>
      )}

      {/* Dashboard content */}
      {!noData && portfolioSnapshot && (
        <>
          {/* Action Hub */}
          <ActionHub insights={insights} onTabChange={(tab) => setActiveTab(tab as Tab)} />

          {/* Tab bar */}
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          {activeTab === 'portfolio' && (
            <PortfolioTab
              portfolioSnapshot={portfolioSnapshot}
              properties={properties}
              propertySnapshots={propertySnapshots}
            />
          )}
          {activeTab === 'risk' && riskProfile && sensitivity && (
            <RiskTab
              riskProfile={riskProfile}
              sensitivity={sensitivity}
              portfolioSnapshot={portfolioSnapshot}
              insights={insights}
            />
          )}
          {activeTab === 'insights' && (
            <InsightsTab insights={insights} />
          )}
          {activeTab === 'scenarios' && (
            <ScenariosTab portfolioSnapshot={portfolioSnapshot} />
          )}
        </>
      )}
    </div>
  )
}

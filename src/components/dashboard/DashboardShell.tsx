'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Portfolio } from '@/engine/types'
import { loadPortfolio } from '@/lib/storage'

export default function DashboardShell() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setPortfolio(loadPortfolio())
    setLoaded(true)
  }, [])

  if (!loaded) return null

  const properties = portfolio?.properties ?? []

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-slate-500">No properties yet.</p>
        <Link
          href="/onboarding"
          className="rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
        >
          Add your first property →
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Your portfolio</h2>
        <Link
          href="/onboarding"
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          + Add property
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {properties.map((p) => (
          <div key={p.id} className="animate-fade-in rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="font-semibold text-slate-800">{p.nickname}</p>
            <p className="text-sm text-slate-400 mt-0.5">
              Value: ${p.estimatedValue.toLocaleString('en-AU')} AUD
              {p.isTenanted && p.monthlyRent
                ? ` · Rent: $${p.monthlyRent.toLocaleString('en-AU')}/mo`
                : ' · Not tenanted'}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Full portfolio analytics coming soon — add more properties to unlock.
      </p>
    </div>
  )
}

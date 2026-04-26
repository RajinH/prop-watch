'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Portfolio } from '@/engine/types'
import { loadPortfolio } from '@/lib/storage'

export default function PropertiesShell() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setPortfolio(loadPortfolio())
    setLoaded(true)
  }, [])

  if (!loaded) return null

  const properties = portfolio?.properties ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Properties</h1>
          <p className="text-slate-500 mt-1">
            {properties.length === 0
              ? 'No properties yet.'
              : `${properties.length} propert${properties.length === 1 ? 'y' : 'ies'} in your portfolio`}
          </p>
        </div>
        <Link
          href="/onboarding"
          className="rounded-xl bg-green-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors shrink-0"
        >
          + Add property
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-400 text-sm">
            Add your first property to get started.
          </p>
          <Link
            href="/onboarding"
            className="rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Add your first property →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {properties.map((p) => (
            <div
              key={p.id}
              className="animate-fade-in rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-800">{p.nickname}</p>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Value: ${p.estimatedValue.toLocaleString('en-AU')} AUD
                    {p.isTenanted && p.monthlyRent
                      ? ` · Rent: $${p.monthlyRent.toLocaleString('en-AU')}/mo`
                      : ' · Not tenanted'}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    p.isTenanted
                      ? 'bg-green-100 text-green-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {p.isTenanted ? 'Tenanted' : 'Vacant'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

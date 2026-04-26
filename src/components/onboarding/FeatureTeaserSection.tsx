'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PropertyInsights } from '@/engine/types'
import { formatCashflow } from '@/lib/formatters'
import BarChart from '@/components/charts/BarChart'

interface Props {
  insights: PropertyInsights
  style?: React.CSSProperties
}

function LockBadge() {
  return (
    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 shrink-0">
      <svg className="h-3 w-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
      </svg>
      Unlock
    </span>
  )
}

const INTERVAL_MS = 4000

export default function FeatureTeaserSection({ insights, style }: Props) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)

  const { property, cashflow } = insights

  const advance = useCallback(() => {
    setCurrent((i) => (i + 1) % 3)
  }, [])

  useEffect(() => {
    if (paused) return
    const id = setInterval(advance, INTERVAL_MS)
    return () => clearInterval(id)
  }, [paused, advance])

  // Rate shock estimates
  const extra1pct = (property.outstandingMortgage * 0.007) / 12
  const extra2pct = (property.outstandingMortgage * 0.014) / 12
  const cashAt1pct = cashflow.monthlyCashflow - extra1pct
  const cashAt2pct = cashflow.monthlyCashflow - extra2pct

  // Bar chart data: user's property + 2 simulated comparators
  const barData = [
    { label: 'Prop A', value: Math.abs(cashflow.monthlyCashflow) + 420, color: '#16a34a' },
    { label: property.nickname.slice(0, 6), value: Math.abs(cashflow.monthlyCashflow), color: '#64748b' },
    { label: 'Prop B', value: Math.max(80, Math.abs(cashflow.monthlyCashflow) - 580), color: '#ef4444' },
  ]

  // Vacancy / rent-drop estimates
  const vacancyCost = (property.monthlyRent ?? 0) * 3
  const rentDropCashflow = cashflow.monthlyCashflow - (property.monthlyRent ?? 0) * 0.1

  const cards = [
    // Card 1 — Rate Shock
    <div key="rate" className="flex flex-col gap-3">
      <p className="text-xs text-slate-400 font-medium">If the RBA raises rates…</p>
      <div className="flex flex-col gap-2.5">
        {[
          { label: '+0.5% rate rise', value: cashflow.monthlyCashflow - extra1pct / 2 },
          { label: '+1.0% rate rise', value: cashAt1pct },
          { label: '+2.0% rate rise', value: cashAt2pct },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-sm text-slate-600">{label}</span>
            <span className={`text-sm font-semibold ${value >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {formatCashflow(value)}
            </span>
          </div>
        ))}
      </div>
    </div>,

    // Card 2 — Portfolio Resilience (Visx)
    <div key="portfolio" className="flex flex-col gap-3">
      <p className="text-xs text-slate-400 font-medium">Monthly cashflow across your portfolio</p>
      <div className="flex justify-center">
        <BarChart data={barData} width={220} height={80} padding={0.35} />
      </div>
      <div className="flex justify-center gap-4">
        {[
          { color: 'bg-green-600', label: 'Anchor' },
          { color: 'bg-slate-400', label: property.nickname.slice(0, 12) },
          { color: 'bg-red-500', label: 'Liability' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${color}`} />
            <span className="text-xs text-slate-400">{label}</span>
          </div>
        ))}
      </div>
    </div>,

    // Card 3 — Vacancy & Rent Drop
    <div key="vacancy" className="flex flex-col gap-3">
      <p className="text-xs text-slate-400 font-medium">How shocks hit your position</p>
      <div className="flex flex-col gap-2.5">
        {[
          { label: '3-month vacancy', value: -vacancyCost, isAbsolute: true },
          { label: '10% rent drop', value: rentDropCashflow },
          { label: 'Combined scenario', value: rentDropCashflow - extra1pct },
        ].map(({ label, value, isAbsolute }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-sm text-slate-600">{label}</span>
            <span className={`text-sm font-semibold ${value >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {isAbsolute
                ? `-$${Math.abs(Math.round(value)).toLocaleString('en-AU')}`
                : formatCashflow(value)}
            </span>
          </div>
        ))}
      </div>
    </div>,
  ]

  const titles = ['Rate Shock Analysis', 'Portfolio Resilience', 'Vacancy & Rent Scenarios']

  return (
    <div className="animate-slide-up flex flex-col gap-4" style={style}>
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">What you&apos;re missing</p>
        <h3 className="text-xl font-bold text-slate-900">Unlock the full picture</h3>
      </div>

      {/* Carousel */}
      <div
        className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Card header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            {titles[current]}
          </h4>
          <LockBadge />
        </div>

        {/* Sliding content area */}
        <div className="relative overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {cards.map((card) => (
              <div key={card.key} className="min-w-full px-5 pb-5">
                {/* Blurred overlay */}
                <div className="relative rounded-xl overflow-hidden min-h-[140px]">
                  {card}
                  <div className="absolute inset-0 backdrop-blur-[3px] bg-white/35 rounded-xl flex items-center justify-center">
                    <svg className="h-6 w-6 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dot navigation */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              onClick={() => { setCurrent(i); setPaused(true) }}
              className={`rounded-full transition-all duration-300 ${
                i === current ? 'w-5 h-2 bg-green-700' : 'w-2 h-2 bg-slate-200 hover:bg-slate-300'
              }`}
              aria-label={`Go to ${titles[i]}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import type { GoalProgress } from '@/lib/propwatch/engine/types'

interface Props {
  goalProgress: GoalProgress | null
  taxBracket: number
}

const TAX_BRACKETS = [
  { label: '19% ($18,201–$45,000)', value: 0.19 },
  { label: '32.5% ($45,001–$120,000)', value: 0.325 },
  { label: '37% ($120,001–$180,000)', value: 0.37 },
  { label: '45% ($180,001+)', value: 0.45 },
]

function fmt(n: number) {
  return '$' + Math.abs(n).toLocaleString('en-AU', { maximumFractionDigits: 0 })
}

export default function GoalBanner({ goalProgress, taxBracket }: Props) {
  const [editing, setEditing] = useState(false)
  const [targetInput, setTargetInput] = useState(goalProgress?.target?.toString() ?? '')
  const [bracketInput, setBracketInput] = useState(taxBracket.toString())
  const [saving, setSaving] = useState(false)
  const [showSetup, setShowSetup] = useState(false)

  async function saveSettings() {
    setSaving(true)
    const target = parseFloat(targetInput)
    await fetch('/api/portfolio/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passive_income_target: isNaN(target) || target <= 0 ? null : target,
        income_tax_bracket: parseFloat(bracketInput),
      }),
    })
    setSaving(false)
    setEditing(false)
    setShowSetup(false)
    window.location.reload()
  }

  if (!goalProgress && !showSetup) {
    return (
      <button
        onClick={() => setShowSetup(true)}
        className="w-full text-left rounded-xl border border-dashed border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700 hover:bg-green-100 transition-colors"
      >
        Set a passive income goal → Track your progress toward financial freedom
      </button>
    )
  }

  if (showSetup || editing) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex flex-col gap-3">
        <p className="text-sm font-semibold text-slate-700">
          {editing ? 'Edit passive income goal' : 'Set your passive income goal'}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">Monthly target ($/mo)</label>
            <input
              type="number"
              placeholder="e.g. 5000"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">Income tax bracket</label>
            <select
              value={bracketInput}
              onChange={(e) => setBracketInput(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              {TAX_BRACKETS.map((b) => (
                <option key={b.value} value={b.value.toString()}>{b.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => { setEditing(false); setShowSetup(false) }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (!goalProgress) return null

  const pct = Math.max(0, Math.min(goalProgress.progress_pct, 100))
  const onTrack = goalProgress.monthly_gap <= 0

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">Passive Income Goal</p>
          <p className="text-sm font-semibold text-slate-800">
            {fmt(goalProgress.current)}/mo current
            {' · '}
            {onTrack
              ? <span className="text-green-700">Goal achieved!</span>
              : <span className="text-slate-500">{fmt(goalProgress.monthly_gap)}/mo to go</span>
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-700">{pct.toFixed(0)}%</span>
          <button
            onClick={() => { setTargetInput(goalProgress.target.toString()); setBracketInput(taxBracket.toString()); setEditing(true) }}
            className="text-xs text-green-700 hover:text-green-900 font-semibold transition-colors"
          >
            Edit goal
          </button>
        </div>
      </div>
      <div className="w-full h-2.5 bg-green-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-green-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-green-700">
        Target: {fmt(goalProgress.target)}/mo · {fmt(Math.abs(goalProgress.monthly_gap))}/mo {onTrack ? 'surplus' : 'remaining'}
      </p>
    </div>
  )
}

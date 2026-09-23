'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Target } from 'lucide-react'
import { apiGet } from '@/lib/propwatch/api/client'
import { useToast } from '@/components/ui/ToastProvider'
import type { InvestorGoal } from '@/lib/propwatch/decision/types'

const GOAL_OPTIONS = [
  { value: 'improve_cashflow', label: 'Improve cashflow' },
  { value: 'prepare_next_purchase', label: 'Prepare my next purchase' },
  { value: 'reduce_debt', label: 'Reduce debt' },
  { value: 'reduce_risk', label: 'Reduce risk' },
] as const

const RISK_OPTIONS = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'growth', label: 'Growth' },
] as const

interface Draft {
  type: string
  target_value: string
  target_date: string
  max_monthly_deficit: string
  minimum_cash_buffer: string
  risk_tolerance: string
  available_lump_sum: string
}

const EMPTY_DRAFT: Draft = {
  type: 'improve_cashflow',
  target_value: '',
  target_date: '',
  max_monthly_deficit: '',
  minimum_cash_buffer: '',
  risk_tolerance: 'balanced',
  available_lump_sum: '',
}

export default function GoalEditor() {
  const router = useRouter()
  const { toast } = useToast()
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [hasGoal, setHasGoal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiGet<{ goal: InvestorGoal | null }>('/api/goal')
      .then(({ goal }) => {
        if (goal) {
          setHasGoal(true)
          setDraft({
            type: goal.type,
            target_value: goal.target_value?.toString() ?? '',
            target_date: goal.target_date ?? '',
            max_monthly_deficit: goal.max_monthly_deficit?.toString() ?? '',
            minimum_cash_buffer: goal.minimum_cash_buffer?.toString() ?? '',
            risk_tolerance: goal.risk_tolerance,
            available_lump_sum: goal.available_lump_sum?.toString() ?? '',
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try {
      const body = {
        type: draft.type,
        risk_tolerance: draft.risk_tolerance,
        target_value: draft.target_value !== '' ? Number(draft.target_value) : null,
        target_date: draft.target_date !== '' ? draft.target_date : null,
        max_monthly_deficit:
          draft.max_monthly_deficit !== '' ? Number(draft.max_monthly_deficit) : null,
        minimum_cash_buffer:
          draft.minimum_cash_buffer !== '' ? Number(draft.minimum_cash_buffer) : null,
        available_lump_sum:
          draft.available_lump_sum !== '' ? Number(draft.available_lump_sum) : null,
      }
      await fetch('/api/goal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error ?? 'Failed to save goal')
        }
      })
      setHasGoal(true)
      toast('Goal saved — recommendations will re-rank.', 'success')
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-700'

  return (
    <div id="goal" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100 text-green-700">
          <Target size={18} />
        </span>
        <div>
          <h2 className="text-base font-bold text-slate-900">Investment goal</h2>
          <p className="text-sm text-slate-500">
            Your primary goal drives which actions PropWatch prioritises.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm text-slate-600">
              Primary goal
              <select
                value={draft.type}
                onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
                className={inputClass}
              >
                {GOAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-slate-600">
              Risk tolerance
              <select
                value={draft.risk_tolerance}
                onChange={(e) => setDraft((d) => ({ ...d, risk_tolerance: e.target.value }))}
                className={inputClass}
              >
                {RISK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {draft.type === 'improve_cashflow' && (
              <label className="flex flex-col gap-1.5 text-sm text-slate-600">
                Monthly cashflow target ($)
                <input
                  type="number"
                  min={0}
                  value={draft.target_value}
                  onChange={(e) => setDraft((d) => ({ ...d, target_value: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. 1000"
                />
              </label>
            )}
            <label className="flex flex-col gap-1.5 text-sm text-slate-600">
              Target date (optional)
              <input
                type="date"
                value={draft.target_date}
                onChange={(e) => setDraft((d) => ({ ...d, target_date: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-slate-600">
              Funds available to deploy ($)
              <input
                type="number"
                min={0}
                value={draft.available_lump_sum}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, available_lump_sum: e.target.value }))
                }
                className={inputClass}
                placeholder="Unlocks debt-paydown suggestions"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-slate-600">
              Minimum cash buffer ($)
              <input
                type="number"
                min={0}
                value={draft.minimum_cash_buffer}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, minimum_cash_buffer: e.target.value }))
                }
                className={inputClass}
                placeholder="Cash you always want on hand"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-slate-600">
              Max acceptable monthly deficit ($)
              <input
                type="number"
                min={0}
                value={draft.max_monthly_deficit}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, max_monthly_deficit: e.target.value }))
                }
                className={inputClass}
                placeholder="e.g. 500"
              />
            </label>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="self-start rounded-xl bg-green-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : hasGoal ? 'Update goal' : 'Set goal'}
          </button>
        </div>
      )}
    </div>
  )
}

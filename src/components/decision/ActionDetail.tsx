'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ClipboardList, SlidersHorizontal, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { apiPatch, apiPost } from '@/lib/propwatch/api/client'
import { useToast } from '@/components/ui/ToastProvider'
import type { RecommendationRow, OutcomeRow } from './types'
import { ACTION_LABELS, fmtMoney, fmtSigned } from './types'
import ConfidenceBadge from './ConfidenceBadge'
import ImpactCompareTable from './ImpactCompareTable'

interface Props {
  recommendation: RecommendationRow
  outcome: OutcomeRow | null
}

type AssumptionField = {
  key: string
  label: string
  kind: 'percent' | 'money' | 'years' | 'boolean'
}

const ASSUMPTION_FIELDS: Record<RecommendationRow['action_type'], AssumptionField[]> = {
  review_refinance: [
    { key: 'target_rate', label: 'Target rate (%)', kind: 'percent' },
    { key: 'remaining_term_years', label: 'Remaining term (years)', kind: 'years' },
    { key: 'switching_cost_total', label: 'Switching costs ($)', kind: 'money' },
  ],
  review_rent: [
    { key: 'comparable_monthly_rent', label: 'Comparable rent ($/mo)', kind: 'money' },
    { key: 'management_fee_pct', label: 'Management fee (%)', kind: 'percent' },
    { key: 'uplift_capture_pct', label: 'Uplift captured (%)', kind: 'percent' },
  ],
  pay_down_debt: [
    { key: 'lump_sum', label: 'Lump sum ($)', kind: 'money' },
    { key: 'reduce_repayment', label: 'Reduce the repayment (rather than the term)', kind: 'boolean' },
  ],
}

function toInputValue(kind: AssumptionField['kind'], value: unknown): string {
  if (typeof value !== 'number') return ''
  return kind === 'percent' ? String(Math.round(value * 10000) / 100) : String(value)
}

const STATUS_BADGES: Record<string, string> = {
  new: 'bg-green-100 text-green-700',
  viewed: 'bg-slate-100 text-slate-500',
  investigating: 'bg-blue-100 text-blue-700',
  deferred: 'bg-amber-100 text-amber-700',
  dismissed: 'bg-slate-100 text-slate-400',
  completed: 'bg-green-100 text-green-700',
  expired: 'bg-slate-100 text-slate-400',
}

export default function ActionDetail({ recommendation: rec, outcome }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const action = rec.payload
  const [busy, setBusy] = useState(false)

  // Editable assumptions
  const fields = ASSUMPTION_FIELDS[rec.action_type]
  const [assumptionsOpen, setAssumptionsOpen] = useState(false)
  const [openedOnce, setOpenedOnce] = useState(false)
  const [draft, setDraft] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      fields.map((f) => [
        f.key,
        f.kind === 'boolean'
          ? action.assumptions[f.key] === true
          : toInputValue(f.kind, action.assumptions[f.key]),
      ])
    )
  )

  // Status panels
  const [panel, setPanel] = useState<'none' | 'defer' | 'dismiss' | 'complete'>('none')
  const [reason, setReason] = useState('')
  const [deferUntil, setDeferUntil] = useState('')

  // Outcome capture
  const [outcomeDraft, setOutcomeDraft] = useState({
    actual_monthly_delta: '',
    actual_one_off_cost: '',
    actual_rate: '',
    notes: '',
  })

  const terminal = ['dismissed', 'completed', 'expired'].includes(rec.status)

  function openAssumptions() {
    const next = !assumptionsOpen
    setAssumptionsOpen(next)
    if (next && !openedOnce) {
      setOpenedOnce(true)
      apiPost(`/api/recommendations/${rec.id}/events`, {
        event_type: 'assumptions_opened',
      }).catch(() => {})
    }
  }

  async function saveAssumptions() {
    const overrides: Record<string, number | boolean> = {}
    for (const field of fields) {
      const value = draft[field.key]
      if (field.kind === 'boolean') {
        overrides[field.key] = value === true
      } else if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value)
        if (!Number.isFinite(parsed) || parsed < 0) {
          toast(`Invalid value for ${field.label}`, 'error')
          return
        }
        overrides[field.key] = field.kind === 'percent' ? parsed / 100 : parsed
      }
    }
    setBusy(true)
    try {
      await apiPatch(`/api/recommendations/${rec.id}/assumptions`, { overrides })
      toast('Assumptions updated — numbers recalculated.', 'success')
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function transition(status: 'investigating' | 'deferred' | 'dismissed' | 'completed') {
    setBusy(true)
    try {
      await apiPatch(`/api/recommendations/${rec.id}`, {
        status,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(status === 'deferred' ? { deferred_until: deferUntil } : {}),
      })
      toast('Status updated.', 'success')
      setPanel('none')
      setReason('')
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function saveOutcome() {
    setBusy(true)
    try {
      await apiPost(`/api/recommendations/${rec.id}/outcome`, {
        ...(outcomeDraft.actual_monthly_delta !== ''
          ? { actual_monthly_delta: Number(outcomeDraft.actual_monthly_delta) }
          : {}),
        ...(outcomeDraft.actual_one_off_cost !== ''
          ? { actual_one_off_cost: Number(outcomeDraft.actual_one_off_cost) }
          : {}),
        ...(outcomeDraft.actual_rate !== ''
          ? { actual_rate: Number(outcomeDraft.actual_rate) / 100 }
          : {}),
        ...(outcomeDraft.notes.trim() ? { notes: outcomeDraft.notes.trim() } : {}),
      })
      toast('Outcome recorded.', 'success')
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'rounded-lg border border-slate-200 px-3 py-1.5 text-sm bg-white w-full'

  return (
    <div className="flex flex-col gap-5">
      {/* Summary */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGES[rec.status]}`}
          >
            {rec.status}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
            {ACTION_LABELS[rec.action_type]}
          </span>
          <ConfidenceBadge confidence={rec.confidence} />
          {rec.deferred_until && (
            <span className="text-xs text-slate-400">
              Deferred until {rec.deferred_until}
            </span>
          )}
        </div>
        <p className="mt-3 text-sm text-slate-600">{action.copy.summary}</p>
        {action.copy.why.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1">
            {action.copy.why.map((line) => (
              <li key={line} className="flex gap-2 text-sm text-slate-600">
                <span className="text-green-600">•</span>
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Baseline vs projected */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Baseline vs projected</h3>
        <div className="mt-3">
          <ImpactCompareTable baseline={action.baseline} projected={action.projected} />
        </div>
        {action.impact.estimated_one_off_cost !== undefined &&
          action.impact.estimated_one_off_cost > 0 && (
            <p className="mt-2 text-xs text-slate-400">
              Estimated one-off cost: {fmtMoney(action.impact.estimated_one_off_cost)}
              {action.impact.estimated_break_even_months !== undefined &&
                ` · breaks even in ~${action.impact.estimated_break_even_months} months`}
            </p>
          )}
        {action.sensitivity?.map((entry) => (
          <p key={entry.label} className="mt-1 text-xs text-slate-400">
            {entry.label}:{' '}
            {entry.impact.monthly_cashflow_delta !== undefined
              ? `${fmtSigned(entry.impact.monthly_cashflow_delta)}/mo`
              : '—'}
          </p>
        ))}
      </div>

      {/* Required information checklist */}
      {action.required_inputs.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">Required information</h3>
          </div>
          <ul className="mt-2 flex flex-col gap-1">
            {action.required_inputs.map((input) => (
              <li key={input} className="text-sm text-slate-600">
                {input === 'comparable_monthly_rent'
                  ? 'A comparable market rent — enter it under assumptions below, or on the property.'
                  : input.replaceAll('_', ' ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Editable assumptions */}
      {!terminal && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <button
            onClick={openAssumptions}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-slate-400" />
              <span className="text-sm font-bold text-slate-900">Assumptions</span>
            </span>
            <span className="text-xs font-medium text-green-700">
              {assumptionsOpen ? 'Hide' : 'Edit'}
            </span>
          </button>
          {assumptionsOpen && (
            <div className="mt-4 flex flex-col gap-3">
              {fields.map((field) =>
                field.kind === 'boolean' ? (
                  <label key={field.key} className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={draft[field.key] === true}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [field.key]: e.target.checked }))
                      }
                    />
                    {field.label}
                  </label>
                ) : (
                  <label key={field.key} className="flex flex-col gap-1 text-sm text-slate-600">
                    {field.label}
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={draft[field.key] as string}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [field.key]: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </label>
                )
              )}
              <button
                onClick={saveAssumptions}
                disabled={busy}
                className="self-start rounded-xl bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-60"
              >
                Recalculate with these assumptions
              </button>
            </div>
          )}
        </div>
      )}

      {/* Caveats */}
      {action.copy.caveats.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900">Caveats & assumptions</h3>
          </div>
          <ul className="mt-2 flex flex-col gap-1">
            {action.copy.caveats.map((line) => (
              <li key={line} className="flex gap-2 text-sm text-slate-600">
                <span className="text-slate-300">–</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Estimated vs actual (completed with outcome) */}
      {rec.status === 'completed' && outcome && (
        <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600" />
            <h3 className="text-sm font-bold text-slate-900">Estimated vs actual</h3>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Estimated
              </p>
              <p className="mt-1 font-medium text-slate-900">
                {outcome.estimated.monthly_cashflow_delta !== undefined
                  ? `${fmtSigned(outcome.estimated.monthly_cashflow_delta)}/mo`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Actual
              </p>
              <p className="mt-1 font-medium text-slate-900">
                {outcome.actual_monthly_delta !== null
                  ? `${fmtSigned(outcome.actual_monthly_delta)}/mo`
                  : 'Not recorded'}
              </p>
            </div>
          </div>
          {outcome.notes && <p className="mt-3 text-sm text-slate-500">{outcome.notes}</p>}
        </div>
      )}

      {/* Outcome capture (completed, no outcome yet) */}
      {rec.status === 'completed' && !outcome && (
        <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Record the actual outcome</h3>
          <p className="mt-1 text-sm text-slate-500">
            Comparing what actually happened against the estimate keeps future
            recommendations honest.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              Monthly change ($)
              <input
                type="number"
                step="any"
                value={outcomeDraft.actual_monthly_delta}
                onChange={(e) =>
                  setOutcomeDraft((d) => ({ ...d, actual_monthly_delta: e.target.value }))
                }
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              One-off cost ($)
              <input
                type="number"
                step="any"
                min={0}
                value={outcomeDraft.actual_one_off_cost}
                onChange={(e) =>
                  setOutcomeDraft((d) => ({ ...d, actual_one_off_cost: e.target.value }))
                }
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              New rate (%) — if refinanced
              <input
                type="number"
                step="any"
                min={0}
                value={outcomeDraft.actual_rate}
                onChange={(e) =>
                  setOutcomeDraft((d) => ({ ...d, actual_rate: e.target.value }))
                }
                className={inputClass}
              />
            </label>
          </div>
          <label className="mt-3 flex flex-col gap-1 text-sm text-slate-600">
            Notes
            <input
              type="text"
              value={outcomeDraft.notes}
              onChange={(e) => setOutcomeDraft((d) => ({ ...d, notes: e.target.value }))}
              className={inputClass}
              placeholder="e.g. switched to Bank X at 5.99%"
            />
          </label>
          <button
            onClick={saveOutcome}
            disabled={busy}
            className="mt-3 rounded-xl bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-60"
          >
            Save outcome
          </button>
        </div>
      )}

      {/* Status controls */}
      {!terminal && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Update status</h3>
          {panel === 'none' ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {rec.status !== 'investigating' && (
                <button
                  onClick={() => transition('investigating')}
                  disabled={busy}
                  className="rounded-xl bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  Mark investigating
                </button>
              )}
              <button
                onClick={() => setPanel('complete')}
                disabled={busy}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Mark completed
              </button>
              <button
                onClick={() => setPanel('defer')}
                disabled={busy}
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                Defer
              </button>
              <button
                onClick={() => setPanel('dismiss')}
                disabled={busy}
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                Dismiss
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2.5">
              {panel === 'defer' && (
                <label className="flex flex-col gap-1 text-sm text-slate-600">
                  Review again on
                  <input
                    type="date"
                    value={deferUntil}
                    onChange={(e) => setDeferUntil(e.target.value)}
                    className={inputClass}
                  />
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                {panel === 'dismiss'
                  ? 'Why dismiss this? (optional)'
                  : panel === 'complete'
                    ? 'What did you do? (optional)'
                    : 'Reason (optional)'}
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={inputClass}
                />
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    transition(
                      panel === 'defer'
                        ? 'deferred'
                        : panel === 'dismiss'
                          ? 'dismissed'
                          : 'completed'
                    )
                  }
                  disabled={busy || (panel === 'defer' && !deferUntil)}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors disabled:opacity-60"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setPanel('none')}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <Link
        href="/dashboard"
        className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
      >
        ← Back to portfolio
      </Link>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Compass, ChevronRight } from 'lucide-react'
import { apiPatch } from '@/lib/propwatch/api/client'
import { useToast } from '@/components/ui/ToastProvider'
import type { RecommendationRow } from './types'
import ConfidenceBadge from './ConfidenceBadge'
import ImpactCompareTable from './ImpactCompareTable'

interface Props {
  recommendation: RecommendationRow
}

export default function NextBestActionCard({ recommendation: rec }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [panel, setPanel] = useState<'none' | 'defer' | 'dismiss'>('none')
  const [reason, setReason] = useState('')
  const [deferUntil, setDeferUntil] = useState('')
  const [busy, setBusy] = useState(false)

  const { copy, baseline, projected } = rec.payload

  async function transition(status: 'investigating' | 'deferred' | 'dismissed') {
    setBusy(true)
    try {
      await apiPatch(`/api/recommendations/${rec.id}`, {
        status,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(status === 'deferred' ? { deferred_until: deferUntil } : {}),
      })
      if (status === 'investigating') {
        router.push(`/actions/${rec.id}`)
        return
      }
      toast(status === 'deferred' ? 'Action deferred.' : 'Action dismissed.', 'success')
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100 text-green-700">
            <Compass size={18} />
          </span>
          <div>
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
              Next best action
            </p>
            <h3 className="text-lg font-black text-slate-900">{copy.title}</h3>
          </div>
        </div>
        <ConfidenceBadge confidence={rec.confidence} />
      </div>

      <p className="mt-3 text-sm text-slate-600">{copy.summary}</p>

      {copy.why.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Why this action
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {copy.why.map((line) => (
              <li key={line} className="flex gap-2 text-sm text-slate-600">
                <span className="text-green-600">•</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
        <p className="mb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Expected impact
        </p>
        <ImpactCompareTable baseline={baseline} projected={projected} />
      </div>

      {panel === 'none' && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => transition('investigating')}
            disabled={busy}
            className="rounded-xl bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-60"
          >
            Investigate
          </button>
          <Link
            href={`/plan?rec=${rec.id}`}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Model in Plan
          </Link>
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
          <Link
            href={`/actions/${rec.id}`}
            className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
          >
            Details <ChevronRight size={15} />
          </Link>
        </div>
      )}

      {panel !== 'none' && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2.5">
          {panel === 'defer' && (
            <label className="text-sm text-slate-600 flex flex-col gap-1">
              Review again on
              <input
                type="date"
                value={deferUntil}
                onChange={(e) => setDeferUntil(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm bg-white"
              />
            </label>
          )}
          <label className="text-sm text-slate-600 flex flex-col gap-1">
            {panel === 'dismiss' ? 'Why dismiss this? (optional)' : 'Reason (optional)'}
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm bg-white"
              placeholder={panel === 'dismiss' ? 'e.g. already refinanced recently' : ''}
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => transition(panel === 'defer' ? 'deferred' : 'dismissed')}
              disabled={busy || (panel === 'defer' && !deferUntil)}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors disabled:opacity-60"
            >
              {panel === 'defer' ? 'Defer action' : 'Dismiss action'}
            </button>
            <button
              onClick={() => {
                setPanel('none')
                setReason('')
              }}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

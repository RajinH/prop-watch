'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { apiPost } from '@/lib/propwatch/api/client'
import { formatCode } from '@/lib/propwatch/access/codes'

export default function RedeemCodeForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiPost<{ label: string; comp_until: string | null }>(
        '/api/access-code/redeem',
        { code }
      )
      // Access is read server-side, so the gate only re-evaluates on a fresh
      // server render.
      router.replace('/dashboard')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not redeem that code')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-900">
        <KeyRound className="h-4 w-4 text-green-700" />
        <h2 className="font-semibold">Have an access code?</h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Beta testers and early users can unlock PropWatch without a subscription.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onBlur={() => setCode((c) => (c ? formatCode(c) : c))}
          placeholder="XXXX-XXXX-XXXXX"
          autoComplete="off"
          spellCheck={false}
          aria-label="Access code"
          aria-invalid={error ? true : undefined}
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2 font-mono text-sm tracking-wider text-slate-900 uppercase placeholder:text-slate-300 focus:border-green-700 focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting || code.trim().length === 0}
          className="rounded-xl bg-green-800 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-900 disabled:opacity-50"
        >
          {submitting ? 'Checking…' : 'Redeem'}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  )
}

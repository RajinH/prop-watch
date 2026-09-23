'use client'

import { useState } from 'react'
import { apiPost } from '@/lib/propwatch/api/client'

export default function ManageBillingButton() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function open() {
    setError(null)
    setPending(true)
    try {
      const { url } = await apiPost<{ url: string }>('/api/billing/portal', {})
      window.location.assign(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the billing portal')
      setPending(false)
    }
  }

  return (
    <>
      <button
        onClick={open}
        disabled={pending}
        className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? 'Opening…' : 'Manage billing'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </>
  )
}

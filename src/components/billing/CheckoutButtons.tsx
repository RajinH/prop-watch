'use client'

import { useState } from 'react'
import { apiPost } from '@/lib/propwatch/api/client'
import type { Flow } from '@/lib/propwatch/stripe/flows'

export default function CheckoutButtons({ flows }: { flows: Flow[] }) {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function start(flowKey: string) {
    setError(null)
    setPending(flowKey)
    try {
      const { url } = await apiPost<{ url: string }>('/api/billing/checkout', { flow: flowKey })
      // Hosted Checkout is a plain redirect — redirectToCheckout() was removed
      // from Stripe.js and no client-side Stripe library is needed.
      window.location.assign(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout')
      setPending(null)
    }
  }

  return (
    <div className="mt-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {flows.map((flow) => (
          <button
            key={flow.key}
            onClick={() => start(flow.key)}
            disabled={pending !== null}
            className="rounded-xl bg-green-800 px-5 py-3 text-left transition-colors hover:bg-green-900 disabled:opacity-50"
          >
            <span className="block text-sm font-medium text-white">
              {pending === flow.key ? 'Redirecting…' : flow.label}
            </span>
            <span className="mt-0.5 block text-xs text-green-100">{flow.blurb}</span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

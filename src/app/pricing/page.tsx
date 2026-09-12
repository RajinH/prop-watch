import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getAccess } from '@/lib/propwatch/access/getAccess'
import { isStripeConfigured } from '@/lib/propwatch/stripe/server'
import { FLOWS, DEFAULT_FLOWS, isFlowKey } from '@/lib/propwatch/stripe/flows'
import RedeemCodeForm from '@/components/billing/RedeemCodeForm'
import CheckoutButtons from '@/components/billing/CheckoutButtons'

export const metadata = { title: 'Pricing' }

const FEATURES = [
  'Unlimited properties',
  'Live cashflow, equity, LVR and yield',
  'Risk profile and rate sensitivity',
  'What-if scenario planning',
  'Capital growth and equity release',
  'Suburb-level market comparison',
]

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string }>
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Someone who already has access has no business on the paywall.
  if (user) {
    const access = await getAccess(supabase, user.id)
    if (access.hasAccess) redirect('/dashboard')
  }

  // ?flow=<key> pins a single variant, which is how payment journeys get
  // compared; without it the default pair is shown.
  const { flow } = await searchParams
  const flows =
    flow && isFlowKey(flow) ? [FLOWS[flow]] : DEFAULT_FLOWS.map((k) => FLOWS[k])

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <header>
        <h1 className="text-3xl font-black text-slate-900">Unlock your portfolio</h1>
        <p className="mt-1 text-slate-500">
          You&apos;ve set up your properties. Subscribe to see what they&apos;re actually doing.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
        <span className="text-3xl font-black text-slate-900">PropWatch Pro</span>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
              {f}
            </li>
          ))}
        </ul>

        {isStripeConfigured() ? (
          <CheckoutButtons flows={flows} />
        ) : (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Billing isn&apos;t configured on this environment. Use an access code below.
          </div>
        )}
      </section>

      <div className="mt-6">
        <RedeemCodeForm />
      </div>

      <footer className="mt-8 text-sm text-slate-500">
        {user ? (
          <Link href="/settings" className="text-green-700 hover:underline">
            Account settings
          </Link>
        ) : (
          <Link href="/signin" className="text-green-700 hover:underline">
            Sign in
          </Link>
        )}
      </footer>
    </main>
  )
}

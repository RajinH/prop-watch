import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getAccess } from '@/lib/propwatch/access/getAccess'
import RedeemCodeForm from '@/components/billing/RedeemCodeForm'

export const metadata = { title: 'Pricing' }

const FEATURES = [
  'Unlimited properties',
  'Live cashflow, equity, LVR and yield',
  'Risk profile and rate sensitivity',
  'What-if scenario planning',
  'Capital growth and equity release',
  'Suburb-level market comparison',
]

export default async function PricingPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Someone who already has access has no business on the paywall.
  if (user) {
    const access = await getAccess(supabase, user.id)
    if (access.hasAccess) redirect('/dashboard')
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <header>
        <h1 className="text-3xl font-black text-slate-900">Unlock your portfolio</h1>
        <p className="mt-1 text-slate-500">
          You&apos;ve set up your properties. Subscribe to see what they&apos;re actually doing.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-slate-900">PropWatch Pro</span>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Checkout isn&apos;t wired up yet — subscription plans land once Stripe is
          configured. Use an access code in the meantime.
        </div>
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

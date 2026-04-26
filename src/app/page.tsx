import Link from 'next/link'

export const metadata = {
  title: 'PropWatch — Property Portfolio Management',
  description: 'Understand your property portfolio with clarity. Track cashflow, equity, yield, and risk across all your properties.',
}

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-lg flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-5xl font-black text-[#005412] tracking-tight">PropWatch</h1>
          <p className="text-slate-500 text-lg leading-snug">
            Remove the guesswork from property ownership.<br />
            Understand your cashflow, equity, and risk in minutes.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center rounded-xl bg-green-800 px-6 py-4 text-base font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Add your first property →
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-6 py-4 text-base font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            View my portfolio
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2">
          {[
            { label: 'Cash flow', desc: 'Know your monthly position' },
            { label: 'Equity & LVR', desc: 'Track your wealth building' },
            { label: 'Risk score', desc: 'Spot issues early' },
          ].map((feat) => (
            <div key={feat.label} className="flex flex-col gap-1 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs font-semibold text-green-800">{feat.label}</span>
              <span className="text-xs text-slate-500">{feat.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

import Link from 'next/link'
import { Target } from 'lucide-react'

export default function GoalPromptCard() {
  return (
    <div className="rounded-2xl border border-dashed border-green-200 bg-green-50/50 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700">
          <Target size={18} />
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-slate-900">
            What are you working toward?
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Set your primary goal — improve cashflow, prepare a purchase, reduce debt, or
            reduce risk — and PropWatch will prioritise the actions that move you toward
            it.
          </p>
          <Link
            href="/settings#goal"
            className="mt-3 inline-block rounded-xl bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Set your goal →
          </Link>
        </div>
      </div>
    </div>
  )
}

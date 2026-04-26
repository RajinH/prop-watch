'use client'

import Link from 'next/link'

interface Props {
  style?: React.CSSProperties
}

export default function SignUpPrompt({ style }: Props) {
  return (
    <div
      className="animate-slide-up flex flex-col gap-3 rounded-2xl border-2 border-green-100 bg-green-50 p-6 text-center"
      style={style}
    >
      <div className="flex flex-col gap-1">
        <p className="text-base font-bold text-slate-900">Ready to see the full picture?</p>
        <p className="text-sm text-slate-500">
          Stress testing, rate sensitivity, and portfolio resilience — all yours with a free account.
        </p>
      </div>
      <Link
        href="/signup"
        className="mt-1 inline-flex items-center justify-center rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
      >
        Create your account →
      </Link>
    </div>
  )
}

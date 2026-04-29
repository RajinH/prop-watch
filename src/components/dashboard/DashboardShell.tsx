import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import InsightsList from './InsightsList'

interface InsightRow {
  id: string
  type: string
  severity: string
  title: string
  description: string
  impact: string | null
}

interface Props {
  user: User | null
  insights: InsightRow[]
  hasPortfolio: boolean
}

export default function DashboardShell({ user, insights, hasPortfolio }: Props) {
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'there'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-slate-900">Welcome, {displayName}</h1>
        <Link
          href="/properties"
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Manage properties →
        </Link>
      </div>

      {!hasPortfolio || insights.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-500">No insights yet.</p>
          <Link
            href="/onboarding"
            className="rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Add your first property →
          </Link>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold text-slate-900">Portfolio insights</h2>
          <InsightsList insights={insights} />
        </>
      )}
    </div>
  )
}

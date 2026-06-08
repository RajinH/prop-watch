import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import type { PortfolioSnapshotInsert } from '@/lib/propwatch/engine/types'
import ScenariosTab from '@/components/dashboard/tabs/ScenariosTab'
import PageHero from '@/components/ui/PageHero'
import { CalendarCheck, Info } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Plan',
}

export default async function PlanPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!portfolio) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-black text-slate-900">Plan</h1>
        <div className="flex flex-col items-center gap-4 py-20 text-center rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-500">No portfolio yet — add a property to run scenarios.</p>
          <Link
            href="/onboarding"
            className="rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Add your first property →
          </Link>
        </div>
      </div>
    )
  }

  const { data: portfolioSnapRow } = await supabase
    .from('portfolio_snapshots')
    .select('*')
    .eq('portfolio_id', portfolio.id)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const portfolioSnapshot = portfolioSnapRow as PortfolioSnapshotInsert | null

  if (!portfolioSnapshot) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-black text-slate-900">Plan</h1>
        <div className="flex flex-col items-center gap-4 py-20 text-center rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-500">No snapshot data yet — add a property to run scenarios.</p>
          <Link
            href="/onboarding"
            className="rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Add your first property →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHero
        icon={CalendarCheck}
        eyebrow="Scenarios"
        title="Plan"
        description="Model what-if scenarios to stress-test and shape your next move"
        callout={
          <>
            <Info size={15} className="shrink-0 text-slate-400 mt-0.5" />
            <span>
              Scenarios run live — adjust the inputs below to model how rate hikes, rent shifts, or market corrections affect your portfolio.
            </span>
          </>
        }
      />
      <ScenariosTab portfolioSnapshot={portfolioSnapshot} />
    </div>
  )
}

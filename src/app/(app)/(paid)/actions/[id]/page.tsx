import { Compass, Info } from 'lucide-react'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import PageHero from '@/components/ui/PageHero'
import ActionDetail from '@/components/decision/ActionDetail'
import type { RecommendationRow, OutcomeRow } from '@/components/decision/types'

export const metadata = {
  title: 'Action',
}

export default async function ActionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { id } = await params

  // RLS scopes the row to the signed-in owner via the portfolio chain
  const { data: recommendation } = await supabase
    .from('recommendations')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!recommendation) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-black text-slate-900">Action not found</h1>
        <p className="text-slate-500">
          This recommendation no longer exists — it may have been superseded.
        </p>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-green-700 hover:text-green-800"
        >
          ← Back to portfolio
        </Link>
      </div>
    )
  }

  // Opening the detail counts as viewing it
  if (recommendation.status === 'new') {
    await supabase
      .from('recommendations')
      .update({ status: 'viewed', updated_at: new Date().toISOString() })
      .eq('id', id)
    await supabase.from('recommendation_events').insert({
      portfolio_id: recommendation.portfolio_id,
      recommendation_id: id,
      event_type: 'viewed',
      from_status: 'new',
      to_status: 'viewed',
    })
    recommendation.status = 'viewed'
  }

  const { data: outcome } = await supabase
    .from('recommendation_outcomes')
    .select('*')
    .eq('recommendation_id', id)
    .maybeSingle()

  const rec = recommendation as RecommendationRow

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        icon={Compass}
        eyebrow="Recommended action"
        title={rec.payload.copy.title}
        callout={
          <>
            <Info size={15} className="shrink-0 text-slate-400 mt-0.5" />
            <span>
              Every number below is derived from your recorded facts and the listed
              assumptions — adjust them to see the impact recalculate. This is
              modelling, not financial advice.
            </span>
          </>
        }
      />
      <ActionDetail recommendation={rec} outcome={(outcome as OutcomeRow | null) ?? null} />
    </div>
  )
}

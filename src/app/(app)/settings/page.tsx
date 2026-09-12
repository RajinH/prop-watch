import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getAccess } from '@/lib/propwatch/access/getAccess'
import UserInfoCard from '@/components/auth/UserInfoCard'
import GoalEditor from '@/components/settings/GoalEditor'

export const metadata = {
  title: 'Settings',
}

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()
  const [{ data: { user } }, { data: { session } }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ])

  // Settings deliberately sits outside the (paid) route group so an
  // unsubscribed user can still reach billing. Paid features are hidden rather
  // than left to fail: GoalEditor reads /api/goal, which now returns 402.
  const access = user ? await getAccess(supabase, user.id) : null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account.</p>
      </div>

      {user && access?.hasAccess && <GoalEditor />}

      {user && !access?.hasAccess && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Your portfolio is locked</h2>
          <p className="mt-1 text-sm text-slate-500">
            Subscribe or redeem an access code to use PropWatch.
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-block rounded-xl bg-green-800 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-900"
          >
            View options
          </Link>
        </div>
      )}

      {user && <UserInfoCard user={user} session={session} />}
    </div>
  )
}

import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import UserInfoCard from '@/components/auth/UserInfoCard'

export const metadata = {
  title: 'Settings',
}

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()
  const [{ data: { user } }, { data: { session } }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account.</p>
      </div>

      {user && <UserInfoCard user={user} session={session} />}
    </div>
  )
}

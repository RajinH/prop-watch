import { createSupabaseServerClient } from '@/lib/supabase/server-client'

export const metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'there'

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-black text-slate-900">
        Welcome, {displayName}
      </h1>
      <p className="text-slate-500">
        Your property portfolio overview will appear here.
      </p>
    </div>
  )
}

import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import Sidebar from '@/components/ui/Sidebar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    ''

  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    null

  return (
    <div className="min-h-screen flex flex-row bg-white">
      <Sidebar displayName={displayName} avatarUrl={avatarUrl} />
      <main className="flex-1 overflow-y-auto px-8 py-8 min-h-screen">
        {children}
      </main>
    </div>
  )
}

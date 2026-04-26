import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'

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
    <div className="min-h-screen flex flex-col">
      <Navbar displayName={displayName} avatarUrl={avatarUrl} />
      <main className="flex-1 w-full max-w-3xl mx-auto px-5 py-10">
        {children}
      </main>
      <Footer />
    </div>
  )
}

import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import DashboardShell from '@/components/dashboard/DashboardShell'

export const metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  await supabase
    .from('profiles')
    .upsert({ id: user!.id }, { onConflict: 'id', ignoreDuplicates: true })

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id, name')
    .eq('user_id', user!.id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const insights = portfolio
    ? (await supabase
        .from('insights')
        .select('id, type, severity, title, description, impact')
        .eq('portfolio_id', portfolio.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      ).data ?? []
    : []

  return <DashboardShell user={user} insights={insights} hasPortfolio={!!portfolio} />
}

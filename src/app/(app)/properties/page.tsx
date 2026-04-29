import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import PropertiesShell from '@/components/properties/PropertiesShell'

export const metadata = {
  title: 'Properties',
}

export default async function PropertiesPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  await supabase
    .from('profiles')
    .upsert({ id: user!.id }, { onConflict: 'id', ignoreDuplicates: true })

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id')
    .eq('user_id', user!.id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const portfolioId = portfolio?.id ?? null

  const { data: properties } = portfolioId
    ? await supabase
        .from('properties')
        .select('*')
        .eq('portfolio_id', portfolioId)
        .order('created_at')
    : { data: [] }

  return (
    <PropertiesShell
      initialProperties={properties ?? []}
      portfolioId={portfolioId}
    />
  )
}

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import PropertyWizard from '@/components/properties/PropertyWizard'

export const metadata = {
  title: 'Add property',
}

export default async function NewPropertyPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!portfolio) redirect('/properties')

  return <PropertyWizard mode="create" />
}

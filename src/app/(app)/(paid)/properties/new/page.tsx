import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import PropertyWizard from '@/components/properties/PropertyWizard'

export const metadata = {
  title: 'Add property',
}

export default async function NewPropertyPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // No portfolio guard here — POST /api/properties resolves (and creates)
  // the portfolio lazily, so a first-time user can add their first property.
  return <PropertyWizard mode="create" />
}

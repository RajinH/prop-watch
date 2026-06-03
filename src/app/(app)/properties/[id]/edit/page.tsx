import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import PropertyWizard from '@/components/properties/PropertyWizard'

export const metadata = {
  title: 'Edit property',
}

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!property) redirect('/properties')

  return <PropertyWizard mode="edit" property={property} />
}

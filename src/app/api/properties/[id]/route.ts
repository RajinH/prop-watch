import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { upsertPropertySnapshot, upsertPortfolioSnapshot, refreshInsights } from '@/lib/propwatch/db/snapshotHelpers'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getAuthUser } from '@/lib/propwatch/api/getAuthUser'
import type { Property } from '@/lib/propwatch/engine/types'

const updatePropertySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    current_value: z.number().nonnegative().optional(),
    current_debt: z.number().nonnegative().optional(),
    monthly_rent: z.number().nonnegative().optional(),
    monthly_repayment: z.number().nonnegative().optional(),
    annual_expenses: z.number().nonnegative().optional(),
    purchase_price: z.number().positive().nullable().optional(),
    purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field is required' })

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const user = await getAuthUser(supabase, request)
  if (!user) return err('Unauthorized', 401)

  const { id } = await params

  const body = await request.json()
  const parsed = updatePropertySchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

  // RLS will return null if property doesn't belong to user
  const { data: existing } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return err('Property not found', 404)

  const { data: updated, error: updateErr } = await supabase
    .from('properties')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (updateErr || !updated) return err('Failed to update property', 500)

  await upsertPropertySnapshot(supabase, updated as Property)

  const { data: allProperties } = await supabase
    .from('properties')
    .select('*')
    .eq('portfolio_id', existing.portfolio_id)

  const portfolioSnap = await upsertPortfolioSnapshot(
    supabase,
    existing.portfolio_id,
    (allProperties ?? []) as Property[]
  )
  await refreshInsights(
    supabase,
    existing.portfolio_id,
    portfolioSnap,
    (allProperties ?? []) as Property[]
  )

  return ok({ property: updated, portfolioSnapshot: portfolioSnap })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const user = await getAuthUser(supabase, request)
  if (!user) return err('Unauthorized', 401)

  const { id } = await params

  // RLS will return null if property doesn't belong to user
  const { data: existing } = await supabase
    .from('properties')
    .select('id, portfolio_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return err('Property not found', 404)

  const { error: deleteErr } = await supabase
    .from('properties')
    .delete()
    .eq('id', id)

  if (deleteErr) return err('Failed to delete property', 500)

  // Fetch remaining properties after deletion
  const { data: remaining } = await supabase
    .from('properties')
    .select('*')
    .eq('portfolio_id', existing.portfolio_id)

  const remainingProps = (remaining ?? []) as Property[]

  if (remainingProps.length > 0) {
    const portfolioSnap = await upsertPortfolioSnapshot(
      supabase,
      existing.portfolio_id,
      remainingProps
    )
    await refreshInsights(supabase, existing.portfolio_id, portfolioSnap, remainingProps)
    return ok({ success: true, portfolioSnapshot: portfolioSnap })
  } else {
    // No properties left — clear active insights
    await supabase
      .from('insights')
      .delete()
      .eq('portfolio_id', existing.portfolio_id)
      .eq('status', 'active')
    return ok({ success: true, portfolioSnapshot: null })
  }
}

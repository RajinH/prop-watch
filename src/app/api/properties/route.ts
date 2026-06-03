import { z } from 'zod'
import { resolvePortfolio } from '@/lib/propwatch/db/resolvePortfolio'
import { upsertPropertySnapshot, upsertPortfolioSnapshot, refreshInsights } from '@/lib/propwatch/db/snapshotHelpers'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'
import type { Property } from '@/lib/propwatch/engine/types'

const createPropertySchema = z.object({
  name: z.string().min(1).max(200),
  unit: z.string().max(100).optional(),
  street: z.string().max(300).optional(),
  city: z.string().max(150).optional(),
  postcode: z.string().max(20).optional(),
  state: z.string().max(100).optional(),
  current_value: z.number().nonnegative(),
  current_debt: z.number().nonnegative(),
  monthly_rent: z.number().nonnegative(),
  monthly_repayment: z.number().nonnegative(),
  annual_expenses: z.number().nonnegative(),
  purchase_price: z.number().positive().optional(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Loan details
  loan_type: z.enum(['principal_and_interest', 'interest_only']).optional(),
  interest_rate: z.number().min(0).max(1).optional(),
  interest_rate_type: z.enum(['variable', 'fixed', 'split']).optional(),
  loan_term_years: z.number().int().positive().optional(),
  lender: z.string().max(200).optional(),
  fixed_rate_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Insurance details
  insurer: z.string().max(200).optional(),
  annual_insurance_premium: z.number().nonnegative().optional(),
  insurance_policy_type: z.enum(['landlord', 'building', 'contents', 'combined']).optional(),
  insurance_renewal_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function POST(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const body = await request.json()
  const parsed = createPropertySchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

  const portfolio = await resolvePortfolio(supabase, user.id)
  if (!portfolio) return err('Failed to resolve portfolio', 500)

  const { data: property, error: insertErr } = await supabase
    .from('properties')
    .insert({
      portfolio_id: portfolio.id,
      ...parsed.data,
      purchase_price: parsed.data.purchase_price ?? null,
      purchase_date: parsed.data.purchase_date ?? null,
    })
    .select('*')
    .single()

  if (insertErr || !property) return err('Failed to create property', 500)

  await upsertPropertySnapshot(supabase, property as Property)

  const { data: allProperties } = await supabase
    .from('properties')
    .select('*')
    .eq('portfolio_id', portfolio.id)

  const portfolioSnap = await upsertPortfolioSnapshot(
    supabase,
    portfolio.id,
    (allProperties ?? []) as Property[]
  )
  await refreshInsights(supabase, portfolio.id, portfolioSnap, (allProperties ?? []) as Property[])

  return ok({ property, portfolioSnapshot: portfolioSnap }, 201)
}

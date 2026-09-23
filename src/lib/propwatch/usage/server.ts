import 'server-only'
import { err } from '@/lib/propwatch/api/respond'
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client'

// Metering for the paid external APIs. Every user-facing HTAG or Checkify call
// goes through `metered`, which claims a row in `api_usage` (enforcing the caps
// below) before the call and settles it with the real charge after.
// Schema and the atomic claim: supabase/migrations/20260923120000_add_api_usage_caps.sql

export type Provider = 'htag' | 'checkify'

interface ProviderLimits {
  /** Calls per user over a rolling 24 hours. */
  userDaily: number
  /** Spend ceiling per calendar month (Sydney), AUD. null = none. */
  monthlyBudgetAud: number | null
  /** Call ceiling per calendar month. null = none. */
  monthlyCalls: number | null
  /** Charge assumed until the real one is known. */
  estCostAud: number
}

function envNumber(name: string, fallback: number): number {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? n : fallback
}

// Sized for the closed beta. Adding a property is ~1 geocode + 1 estimate, so
// 40 HTAG calls a day is about 20 properties; typing an address is ~5-10
// autocomplete calls. The monthly ceilings are the real spend guard; override
// them in the environment without a code change.
export function limitsFor(provider: Provider): ProviderLimits {
  return provider === 'htag'
    ? {
        userDaily: 40,
        monthlyBudgetAud: envNumber('HTAG_MONTHLY_BUDGET_AUD', 20),
        monthlyCalls: null,
        // Geocode has no free allowance and bills $0.031 from the first call;
        // see docs/htag-integration.md.
        estCostAud: 0.031,
      }
    : {
        userDaily: 400,
        monthlyBudgetAud: null,
        // Checkify doesn't report a per-call charge, so cap by count.
        monthlyCalls: envNumber('CHECKIFY_MONTHLY_CALL_LIMIT', 5000),
        estCostAud: 0,
      }
}

export type DenyReason = 'user_daily' | 'monthly_budget' | 'monthly_calls' | 'unavailable'

export type MeteredResult<T> = { ok: true; data: T } | { ok: false; reason: DenyReason }

export async function metered<T>(
  userId: string,
  provider: Provider,
  endpoint: string,
  run: () => Promise<{ data: T; cost: number | null }>
): Promise<MeteredResult<T>> {
  const admin = getSupabaseAdminClient()
  const limits = limitsFor(provider)

  const { data: claim, error } = await admin.rpc('claim_api_call', {
    p_user_id: userId,
    p_provider: provider,
    p_endpoint: endpoint,
    p_est_cost_aud: limits.estCostAud,
    p_user_daily_limit: limits.userDaily,
    p_monthly_budget_aud: limits.monthlyBudgetAud,
    p_monthly_call_limit: limits.monthlyCalls,
  })

  // Fail closed: if the ledger can't be reached, the spend guard can't either.
  if (error || !claim) {
    console.error(`[usage] claim failed for ${provider}${endpoint}: ${error?.message}`)
    return { ok: false, reason: 'unavailable' }
  }
  if (!claim.ok) {
    console.warn(`[usage:cap] ${provider} ${claim.reason} user=${userId}`)
    return { ok: false, reason: claim.reason as DenyReason }
  }

  const settle = (cost: number | null) =>
    admin.rpc('settle_api_call', { p_id: claim.id, p_cost_aud: cost }).then(({ error: e }) => {
      if (e) console.error(`[usage] settle failed for ${claim.id}: ${e.message}`)
    })

  try {
    const { data, cost } = await run()
    await settle(cost)
    return { ok: true, data }
  } catch (e) {
    // HTAG doesn't charge non-2xx responses; Checkify reports no charge either way.
    await settle(0)
    throw e
  }
}

/** The route response for a denied call. Callers fall back to manual entry. */
export function usageDenied(reason: DenyReason) {
  switch (reason) {
    case 'user_daily':
      return err("You've reached today's limit for address lookups. Enter the details manually, or try again tomorrow.", 429)
    case 'monthly_budget':
    case 'monthly_calls':
      return err('Address lookups are paused for now. Enter the details manually.', 429)
    case 'unavailable':
      return err('Address lookups are unavailable right now. Enter the details manually.', 503)
  }
}

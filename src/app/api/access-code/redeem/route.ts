import { z } from 'zod'
import { ok, err } from '@/lib/propwatch/api/respond'
import { getSupabaseWithUser } from '@/lib/propwatch/api/getSupabaseWithUser'
import { hashAccessCode, isPlausibleCode } from '@/lib/propwatch/access/codes'

const redeemSchema = z.object({
  code: z.string().min(1).max(64),
})

/** Failure reasons returned by the redeem_access_code() Postgres function. */
const FAILURES: Record<string, { status: number; message: string }> = {
  unauthenticated: { status: 401, message: 'Unauthorized' },
  invalid: { status: 400, message: "That code isn't valid, or has already been used up" },
  already_redeemed: { status: 409, message: "You've already redeemed this code" },
  rate_limited: { status: 429, message: 'Too many attempts. Try again in an hour.' },
}

export async function POST(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request)
  if (!user) return err('Unauthorized', 401)

  const body = await request.json()
  const parsed = redeemSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

  // Shape check before touching the database. Deliberately does NOT count
  // toward the throttle: a malformed string isn't a guess at a real code.
  if (!isPlausibleCode(parsed.data.code)) {
    return err("That code isn't valid, or has already been used up", 400)
  }

  // The pepper is a server-side secret, so the code is hashed here and only the
  // digest crosses into Postgres. Called with the user's own session client so
  // auth.uid() resolves inside the SECURITY DEFINER function — a caller cannot
  // redeem on someone else's behalf.
  const { data, error } = await supabase.rpc('redeem_access_code', {
    p_code_hash: hashAccessCode(parsed.data.code),
  })

  if (error) return err('Could not redeem that code', 500)

  const result = data as { ok: boolean; reason?: string; label?: string; comp_until?: string | null }

  if (!result?.ok) {
    const failure = FAILURES[result?.reason ?? ''] ?? {
      status: 400,
      message: 'Could not redeem that code',
    }
    return err(failure.message, failure.status)
  }

  return ok({ label: result.label, comp_until: result.comp_until ?? null })
}

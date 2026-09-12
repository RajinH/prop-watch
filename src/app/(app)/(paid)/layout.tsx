import { requirePaidAccess } from '@/lib/propwatch/access/getAccess'

/**
 * The paywall.
 *
 * Every page in this route group is behind it; route groups don't affect URLs,
 * so /dashboard, /risk, /plan and the rest are unchanged. Gating here rather
 * than per-page means a new paid page cannot forget to check.
 *
 * `/settings` deliberately lives outside this group: an unsubscribed user must
 * still be able to reach billing without bouncing off a redirect loop.
 *
 * Not gated in `src/proxy.ts` on purpose — proxy runs on every matched request
 * including prefetches, and Next's own auth guide says to keep it to optimistic
 * cookie checks rather than database reads.
 */
export default async function PaidLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePaidAccess()
  return <>{children}</>
}

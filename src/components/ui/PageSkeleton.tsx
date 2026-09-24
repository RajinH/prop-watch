import { Skeleton } from './skeleton'

/**
 * Route-level loading state, shown by the `loading.tsx` files while a page's
 * server data loads. Shaped like the real pages (PageHero, then content) so
 * nothing jumps when the content swaps in.
 */
export default function PageSkeleton({
  variant = 'default',
}: {
  variant?: 'default' | 'grid' | 'form'
}) {
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">Loading…</span>

      {/* PageHero: icon tile, eyebrow, title, description */}
      <div className="flex items-start gap-4">
        <Skeleton className="h-20 w-20 shrink-0 rounded-2xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-full max-w-48" />
          <Skeleton className="h-4 w-full max-w-64" />
        </div>
      </div>

      {variant === 'form' ? (
        // Property wizard: stepper, then a column of fields
        <div className="flex max-w-3xl flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : variant === 'grid' ? (
        // Properties: card grid matching PropertiesShell
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <Skeleton className="h-40 w-full rounded-none" />
              <div className="flex flex-col gap-3 p-5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Stat row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-28" />
              </div>
            ))}
          </div>
          {/* Main panel (chart / card) */}
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-64 w-full" />
          </div>
        </>
      )}
    </div>
  )
}

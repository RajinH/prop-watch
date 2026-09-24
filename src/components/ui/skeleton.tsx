import { cn } from '@/lib/utils'

/**
 * A placeholder block for content that's still loading.
 *
 * `bg-slate-200` rather than a `bg-muted` token: the dark theme works by
 * re-pointing the slate ramp (see globals.css), and `@theme inline` tokens
 * can't be overridden that way, so `bg-muted` would stay light in dark mode.
 * slate-200, not 100: 100 on a white card nearly vanishes mid-pulse.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-slate-200 motion-reduce:animate-none', className)}
      {...props}
    />
  )
}

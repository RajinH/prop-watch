'use client'

import { useId, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  /** What the metric means and how to read it. Kept short enough to scan. */
  content: React.ReactNode
  children: React.ReactNode
  /**
   * Which side of the card the trigger sits on. Items at the edges would push a
   * centred bubble outside the card, so callers can anchor it instead.
   */
  align?: 'center' | 'start' | 'end'
  className?: string
}

/**
 * A hover/focus tooltip for explaining a figure.
 *
 * Hand-rolled rather than pulling in a popover library: this needs no collision
 * detection or portalling, and the native `title` attribute — which this
 * replaces — is slow to appear, unstyleable, and cannot hold more than a line.
 *
 * Opens on focus as well as hover so it is reachable by keyboard, and the
 * trigger is described by the bubble rather than labelled by it, so a screen
 * reader still reads the underlying value first.
 */
export default function InfoTooltip({ content, children, align = 'center', className }: Props) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
      >
        {children}
      </span>

      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute bottom-full z-30 mb-2 w-56 rounded-lg bg-slate-900 px-3 py-2 text-left text-xs font-normal leading-relaxed text-slate-100 shadow-lg',
            align === 'center' && 'left-1/2 -translate-x-1/2',
            align === 'start' && 'left-0',
            align === 'end' && 'right-0'
          )}
        >
          {content}
          <span
            className={cn(
              'absolute top-full border-4 border-transparent border-t-slate-900',
              align === 'center' && 'left-1/2 -translate-x-1/2',
              align === 'start' && 'left-4',
              align === 'end' && 'right-4'
            )}
            aria-hidden
          />
        </span>
      )}
    </span>
  )
}

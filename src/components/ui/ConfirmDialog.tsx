'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  /** The consequence being confirmed. Say what is lost, not just "are you sure". */
  description: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Styles the dialog for an irreversible action and warns the user as much. */
  destructive?: boolean
  /** Disables both actions while the confirmed work is in flight. */
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Focus the safe option on open, so a stray Enter dismisses rather than
  // destroys, and Escape always backs out.
  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) {
        onCancel()
        return
      }
      // Keep Tab inside the dialog — without this, focus walks the page behind.
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled])'
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, busy, onCancel])

  // The page behind must not scroll while a modal is up.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="animate-fade-in absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        // Clicking away is a cancel, but never mid-flight.
        onClick={() => !busy && onCancel()}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="animate-slide-up relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              destructive ? 'bg-red-50' : 'bg-slate-100'
            }`}
          >
            <AlertTriangle
              size={22}
              className={destructive ? 'text-red-600' : 'text-amber-500'}
            />
          </div>
          <div className="flex flex-col gap-1.5 pt-0.5">
            <h2 id="confirm-dialog-title" className="text-base font-bold text-slate-900">
              {title}
            </h2>
            <div id="confirm-dialog-description" className="text-sm text-slate-500">
              {description}
            </div>
            {destructive && (
              <p className="mt-1 text-sm font-semibold text-red-600">
                This action cannot be undone.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
              destructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-800 hover:bg-green-700'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

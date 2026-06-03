'use client'

import { useEffect, useRef, useState } from 'react'
import { apiGet } from '@/lib/propwatch/api/client'

interface CheckifyAddressDetails {
  unit: string | null
  street: string | null
  city: string | null
  postcode: string | null
  state: string | null
  region: string | null
}

export interface AddressFields {
  unit: string
  street: string
  city: string
  postcode: string
  state: string
}

interface Props {
  /** Current street value (also the search box text). */
  value: string
  /** Fired as the user types in the street box. */
  onChange: (street: string) => void
  /** Fired when a suggestion is picked, with the full structured address. */
  onSelect: (fields: AddressFields) => void
}

const inputClass =
  'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-700'

// How long to wait after the user stops typing before hitting the network.
// Tuned so a search only fires on a deliberate pause, not mid-word.
const DEBOUNCE_MS = 300

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

export default function AddressAutocomplete({ value, onChange, onSelect }: Props) {
  const [suggestions, setSuggestions] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  // The last query we actually sent, so identical queries (e.g. retype/backspace) don't refetch.
  const lastQuery = useRef<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  // Clean up any pending timer / in-flight request when the field unmounts.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      controllerRef.current?.abort()
    }
  }, [])

  // Search is driven only by user intent (typing or focusing) — never on mount,
  // so returning to a pre-filled field does not re-fire a lookup.
  function scheduleSearch(raw: string) {
    const q = raw.trim()

    if (debounceRef.current) clearTimeout(debounceRef.current)
    controllerRef.current?.abort()

    if (q.length < 3) {
      lastQuery.current = null
      setSuggestions({})
      setOpen(false)
      return
    }
    if (q === lastQuery.current) {
      // Same query as the last search (e.g. backspace + retype) — just reopen.
      setOpen(Object.keys(suggestions).length > 0)
      return
    }

    const controller = new AbortController()
    controllerRef.current = controller

    debounceRef.current = setTimeout(async () => {
      lastQuery.current = q
      setLoading(true)
      try {
        const data = await apiGet<Record<string, string>>(
          `/api/checkify/autocomplete?query=${encodeURIComponent(q)}&country=au`,
          controller.signal
        )
        setSuggestions(data)
        setOpen(Object.keys(data).length > 0)
      } catch (err) {
        // Ignore aborts from superseded keystrokes; only surface real failures.
        if ((err as Error).name !== 'AbortError') {
          setSuggestions({})
          setOpen(false)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)
  }

  function handleChange(next: string) {
    onChange(next)
    scheduleSearch(next)
  }

  function handleFocus() {
    if (Object.keys(suggestions).length > 0) {
      setOpen(true)
    } else {
      // Focusing a field that's already filled should offer matches too.
      scheduleSearch(value)
    }
  }

  async function handleSelect(id: string, label: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    controllerRef.current?.abort()
    setOpen(false)
    setSuggestions({})
    try {
      const d = await apiGet<CheckifyAddressDetails>(
        `/api/checkify/autocomplete-details?id=${encodeURIComponent(id)}&country=au`
      )
      onSelect({
        unit: d.unit ?? '',
        street: d.street ?? '',
        city: d.city ?? '',
        postcode: d.postcode ?? '',
        state: d.state ?? d.region ?? '',
      })
    } catch {
      // Fall back to the plain suggestion text in the street field.
      onChange(stripTags(label))
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={inputClass}
        placeholder="Start typing an address…"
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">…</span>
      )}
      {open && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {Object.entries(suggestions).map(([id, label]) => (
            <li key={id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(id, label)}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {stripTags(label)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

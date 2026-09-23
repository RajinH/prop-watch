'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'propwatch_theme'

const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** The attribute is the source of truth — the no-flash script sets it first. */
function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function setTheme(next: Theme) {
  document.documentElement.dataset.theme = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // private browsing — the toggle still works for this session
  }
  listeners.forEach((l) => l())
}

/**
 * Runs before paint, so the page never renders light and then snaps to dark.
 * Inlined in the document head; kept here so the storage key has one owner.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})()`

export default function ThemeToggle() {
  // Server render has no DOM, so it assumes light; the script has already set
  // the attribute by the time this hydrates.
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'light' as Theme)

  const options: { id: Theme; label: string; icon: typeof Sun }[] = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
  ]

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="mt-3 inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
    >
      {options.map(({ id, label, icon: Icon }) => {
        const active = theme === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={15} className="shrink-0" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

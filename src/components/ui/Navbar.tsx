'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { useToast } from '@/components/ui/ToastProvider'
import { GearIcon, ExitIcon } from '@radix-ui/react-icons'

interface Props {
  displayName: string
  avatarUrl: string | null
}

const NAV_LINKS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Properties', href: '/properties' },
]

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function Navbar({ displayName, avatarUrl }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Signed out successfully.', 'success')
      router.push('/signin')
    }
  }

  return (
    <nav className="bg-green-950 px-6 h-14 flex items-center gap-8 shrink-0">
      <Link
        href="/dashboard"
        className="text-white font-black text-lg tracking-tight shrink-0"
      >
        PropWatch.
      </Link>

      <div className="flex items-center gap-6 flex-1">
        {NAV_LINKS.map(({ label, href }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`text-sm font-medium transition-colors ${
                isActive
                  ? 'text-white underline underline-offset-4 decoration-white'
                  : 'text-green-300 hover:text-white'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>

      <div ref={menuRef} className="relative">
        <button
          aria-label="Account menu"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full bg-white w-9 h-9 flex items-center justify-center shrink-0 overflow-hidden hover:ring-2 hover:ring-green-400 transition-all cursor-pointer"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-green-900 text-xs font-bold select-none">
              {getInitials(displayName) || '?'}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-green-100 py-1 min-w-[150px] flex flex-col z-50">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm text-green-900 hover:bg-green-50 transition-colors flex items-center gap-2.5"
            >
              <GearIcon className="shrink-0 text-green-700" />
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm text-green-900 hover:bg-green-50 transition-colors text-left flex items-center gap-2.5"
            >
              <ExitIcon className="shrink-0 text-green-700" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}

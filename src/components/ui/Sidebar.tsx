"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useToast } from "@/components/ui/ToastProvider";
import {
  LayoutDashboard,
  Building2,
  ShieldAlert,
  CalendarCheck,
  Globe2,
  Settings,
  LogOut,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface Props {
  displayName: string;
  avatarUrl: string | null;
}

const NAV_LINKS = [
  { label: "Portfolio", href: "/dashboard", icon: LayoutDashboard },
  { label: "Properties", href: "/properties", icon: Building2 },
  { label: "Market", href: "/market", icon: Globe2 },
  { label: "Risk", href: "/risk", icon: ShieldAlert },
  { label: "Plan", href: "/plan", icon: CalendarCheck },
];

/* Chrome-only preference, so it lives here rather than in the Track-A
   storage module (which is reserved for onboarding/portfolio drafts). It is
   read through useSyncExternalStore so the server render (always expanded)
   hydrates cleanly and other tabs stay in sync. */
const COLLAPSED_KEY = "propwatch_sidebar_collapsed";

const collapseListeners = new Set<() => void>();

function subscribeToCollapse(onChange: () => void) {
  collapseListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    collapseListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    // private browsing — fall back to expanded
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(value));
  } catch {
    // ignore: the toggle still works for this session
  }
  collapseListeners.forEach((listener) => listener());
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Label that only appears when the rail is collapsed, so icons stay readable. */
function Tooltip({ label, show }: { label: string; show: boolean }) {
  if (!show) return null;
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
    >
      {label}
    </span>
  );
}

export default function Sidebar({ displayName, avatarUrl }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const supabase = getSupabaseBrowserClient();

  const collapsed = useSyncExternalStore(
    subscribeToCollapse,
    readCollapsed,
    () => false,
  );

  function toggleCollapsed() {
    writeCollapsed(!collapsed);
    setOpen(false);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast(error.message, "error");
    } else {
      toast("Signed out successfully.", "success");
      router.push("/signin");
    }
  }

  return (
    /* The width deliberately snaps rather than animating. A width transition
       resizes the content column on every frame, and each of those frames
       fires the ResizeObserver inside every chart's ResponsiveContainer — on
       /market that is ~12 full Recharts re-layouts per chart per toggle
       instead of one, which locks the main thread for the whole animation.
       Only cheap, non-layout properties (colours) transition here. */
    <aside
      className={`${collapsed ? "w-16" : "w-56"} shrink-0 bg-[var(--surface-rail)] border-r border-[var(--surface-rail-border)] flex flex-col min-h-screen sticky top-0 h-screen`}
    >
      {/* Collapsed the rail carries no brand — just the control that brings it
          back. Expanded, the wordmark links home and the toggle sits at the
          far edge. */}
      <div
        className={`h-14 flex items-center border-b border-[var(--surface-rail-border)] shrink-0 ${
          collapsed ? "justify-center px-2" : "justify-between pl-5 pr-2"
        }`}
      >
        {!collapsed && (
          <Link
            href="/dashboard"
            className="text-green-900 font-black text-lg tracking-tight"
          >
            PropWatch.
          </Link>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? undefined : "Collapse sidebar"}
          className="group relative p-2 rounded-lg text-slate-400 hover:text-green-800 hover:bg-green-100/60 transition-colors"
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          <Tooltip label="Expand sidebar" show={collapsed} />
        </button>
      </div>

      {/* Nav links */}
      <nav
        /* Collapsed, the rail is a short fixed list and must not clip — a
           scroll container on either axis would cut off the hover labels. */
        className={`flex-1 py-4 flex flex-col gap-1 ${
          collapsed
            ? "px-2 items-center overflow-visible"
            : "px-3 overflow-y-auto overflow-x-hidden"
        }`}
      >
        {NAV_LINKS.map(({ label, href, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href + "/"));
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`group relative flex items-center rounded-lg text-sm font-medium transition-colors ${
                collapsed ? "justify-center w-10 h-10" : "gap-3 px-3 py-2 w-full"
              } ${
                isActive
                  ? "bg-green-100 text-green-900"
                  : "text-slate-600 hover:bg-white hover:text-green-900"
              }`}
            >
              <Icon
                size={18}
                className={`shrink-0 ${isActive ? "text-green-700" : "text-slate-400 group-hover:text-slate-600"}`}
              />
              {!collapsed && <span className="truncate">{label}</span>}
              <Tooltip label={label} show={collapsed} />
            </Link>
          );
        })}
      </nav>

      {/* User account section */}
      <div
        ref={menuRef}
        className={`relative py-3 border-t border-[var(--surface-rail-border)] shrink-0 ${
          collapsed ? "px-2" : "px-3"
        }`}
      >
        <button
          aria-label="Account menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`group relative flex items-center rounded-lg hover:bg-white transition-colors cursor-pointer ${
            collapsed ? "justify-center w-10 h-10 mx-auto" : "gap-3 px-3 py-2 w-full"
          }`}
        >
          <div className="rounded-full bg-green-100 ring-1 ring-green-200 w-8 h-8 flex items-center justify-center shrink-0 overflow-hidden">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-green-800 text-xs font-bold select-none">
                {getInitials(displayName) || "?"}
              </span>
            )}
          </div>
          {!collapsed && (
            <>
              <span className="text-sm text-slate-700 font-medium truncate flex-1 text-left">
                {displayName}
              </span>
              <ChevronUp
                size={14}
                className={`shrink-0 text-slate-400 transition-transform ${open ? "" : "rotate-180"}`}
              />
            </>
          )}
          <Tooltip label={displayName || "Account"} show={collapsed && !open} />
        </button>

        {open && (
          <div
            className={`absolute bg-white rounded-xl shadow-lg border border-[var(--surface-rail-border)] py-1 flex flex-col z-50 ${
              collapsed
                ? "bottom-3 left-full ml-2 min-w-[160px]"
                : "bottom-full left-3 right-3 mb-2"
            }`}
          >
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-800 transition-colors flex items-center gap-2.5"
            >
              <Settings size={14} className="shrink-0 text-slate-400" />
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-800 transition-colors text-left flex items-center gap-2.5"
            >
              <LogOut size={14} className="shrink-0 text-slate-400" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

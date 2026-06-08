"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useToast } from "@/components/ui/ToastProvider";
import {
  LayoutDashboard,
  Building2,
  ShieldAlert,
  CalendarCheck,
  Settings,
  LogOut,
  ChevronUp,
} from "lucide-react";

interface Props {
  displayName: string;
  avatarUrl: string | null;
}

const NAV_LINKS = [
  { label: "Portfolio", href: "/dashboard", icon: LayoutDashboard },
  { label: "Properties", href: "/properties", icon: Building2 },
  { label: "Risk", href: "/risk", icon: ShieldAlert },
  { label: "Plan", href: "/plan", icon: CalendarCheck },
];

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Sidebar({ displayName, avatarUrl }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const supabase = getSupabaseBrowserClient();

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
    <aside className="w-56 shrink-0 bg-green-950 flex flex-col min-h-screen sticky top-0 h-screen">
      {/* Logo */}
      <div className="px-5 h-14 flex items-center border-b border-green-900/60 shrink-0">
        <Link
          href="/dashboard"
          className="text-white font-black text-lg tracking-tight"
        >
          PropWatch.
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-2 overflow-y-auto">
        {NAV_LINKS.map(({ label, href, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href + "/"));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-green-800 text-white"
                  : "text-green-300 hover:bg-green-900 hover:text-white"
              }`}
            >
              <Icon size={16} className="shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User account section */}
      <div
        ref={menuRef}
        className="relative px-3 py-3 border-t border-green-900/60 shrink-0"
      >
        <button
          aria-label="Account menu"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-green-900 transition-colors cursor-pointer"
        >
          <div className="rounded-full bg-white w-8 h-8 flex items-center justify-center shrink-0 overflow-hidden">
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
                {getInitials(displayName) || "?"}
              </span>
            )}
          </div>
          <span className="text-sm text-green-200 font-medium truncate flex-1 text-left">
            {displayName}
          </span>
          <ChevronUp
            size={14}
            className={`shrink-0 text-green-400 transition-transform ${open ? "" : "rotate-180"}`}
          />
        </button>

        {open && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-xl shadow-lg border border-green-100 py-1 flex flex-col z-50">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm text-green-900 hover:bg-green-50 transition-colors flex items-center gap-2.5"
            >
              <Settings size={14} className="shrink-0 text-green-700" />
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm text-green-900 hover:bg-green-50 transition-colors text-left flex items-center gap-2.5"
            >
              <LogOut size={14} className="shrink-0 text-green-700" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

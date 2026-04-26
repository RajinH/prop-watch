"use client";

import { useRouter } from "next/navigation";
import type { User, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useToast } from "@/components/ui/ToastProvider";
import Avatar from "@/components/ui/Avatar";

interface Props {
  user: User;
  session: Session | null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="break-all font-mono text-xs text-slate-700">{value}</span>
    </div>
  );
}

export default function UserInfoCard({ user, session }: Props) {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const { toast } = useToast();

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split("@")[0] ||
    "Unknown";

  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ||
    (user.user_metadata?.picture as string | undefined) ||
    null;

  const provider = (user.app_metadata?.provider as string | undefined) ?? "email";

  const sessionExpiry = session?.expires_at
    ? new Date(session.expires_at * 1000).toLocaleString("en-AU")
    : "—";

  const lastSignIn = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString("en-AU")
    : "—";

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
    <div className="animate-fade-in rounded-2xl border border-green-100 bg-green-50 p-5 shadow-sm">
      {/* Profile header */}
      <div className="mb-4 flex items-center gap-3">
        <Avatar src={avatarUrl} name={displayName} size={48} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{displayName}</p>
          <p className="text-xs text-slate-500 truncate">{user.email}</p>
        </div>
        <span className="rounded-full bg-green-800 px-2.5 py-0.5 text-xs font-semibold text-white shrink-0">
          authenticated
        </span>
      </div>

      <div className="flex flex-col gap-3 border-t border-green-100 pt-4">
        <Row label="User ID" value={user.id} />
        <Row label="Provider" value={provider} />
        <Row label="Session expires" value={sessionExpiry} />
        <Row label="Last sign-in" value={lastSignIn} />
      </div>

      <button
        onClick={handleSignOut}
        className="mt-5 w-full rounded-xl border border-green-200 px-4 py-2.5 text-sm font-medium text-green-900 hover:bg-green-100 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}

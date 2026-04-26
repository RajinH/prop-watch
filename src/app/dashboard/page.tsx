import DashboardShell from "@/components/dashboard/DashboardShell";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export const metadata = {
  title: "Portfolio — PropWatch",
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: { user } }, { data: { session } }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  return (
    <main className="min-h-screen px-5 py-10 max-w-lg mx-auto">
      <div className="mb-8">
        <a
          href="/"
          className="text-sm font-semibold text-green-800 hover:underline"
        >
          ← PropWatch
        </a>
      </div>
      <DashboardShell user={user} session={session} />
    </main>
  );
}

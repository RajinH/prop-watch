import { redirect } from "next/navigation";
import AuthForm from "@/components/auth/AuthForm";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export const metadata = {
  title: "Sign in — PropWatch",
};

export default async function SignInPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

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

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black text-slate-900">Welcome back</h1>
          <p className="text-slate-500">
            Sign in to your PropWatch account to view your portfolio.
          </p>
        </div>

        <AuthForm user={user} initialMode="signin" />
      </div>
    </main>
  );
}

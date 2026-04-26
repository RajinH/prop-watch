"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useToast } from "@/components/ui/ToastProvider";
import { saveDisplayName } from "@/lib/storage";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const signUpSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100, "Name is too long"),
    email: z.email({ error: "Enter a valid email address" }),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password is too long"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const signInSchema = z.object({
  email: z.email({ error: "Enter a valid email address" }),
  password: z.string().min(1, "Password is required"),
});

type FieldErrors = Partial<
  Record<"name" | "email" | "password" | "confirmPassword", string>
>;

// ---------------------------------------------------------------------------
// Password strength
// ---------------------------------------------------------------------------

const STRENGTH_LEVELS = [
  { label: "Very weak",   textColor: "text-red-500",    barColor: "bg-red-500"    },
  { label: "Weak",        textColor: "text-orange-500", barColor: "bg-orange-400" },
  { label: "Fair",        textColor: "text-yellow-600", barColor: "bg-yellow-400" },
  { label: "Strong",      textColor: "text-blue-600",   barColor: "bg-blue-500"   },
  { label: "Very strong", textColor: "text-green-700",  barColor: "bg-green-700"  },
] as const;

function getStrength(pw: string) {
  if (!pw) return null;
  const score = [
    pw.length >= 8,
    /[a-z]/.test(pw),
    /[A-Z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ].filter(Boolean).length;
  return { score, ...STRENGTH_LEVELS[score - 1] ?? STRENGTH_LEVELS[0] };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500 mt-1">{message}</p>;
}

function EyeToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
      aria-label={visible ? "Hide password" : "Show password"}
    >
      {visible ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = getStrength(password);
  if (!strength) return null;

  return (
    <div className="flex flex-col gap-1.5 mt-1">
      <div className="flex gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i < strength.score ? strength.barColor : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${strength.textColor}`}>
        {strength.label}
        {strength.score < 3 && (
          <span className="text-slate-400 font-normal">
            {" "}— add uppercase, numbers, or symbols to strengthen
          </span>
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Mode = "signup" | "signin";

interface Props {
  user: User | null;
  initialMode: Mode;
}

export default function AuthForm({ user, initialMode }: Props) {
  const mode = initialMode;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(user);

  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setCurrentUser(session?.user ?? null);
      }
    );
    return () => listener?.subscription.unsubscribe();
  }, [supabase]);

  function clearError(field: keyof FieldErrors) {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setErrors({});

    if (mode === "signup") {
      const result = signUpSchema.safeParse({ name, email, password, confirmPassword });
      if (!result.success) {
        const fieldErrors: FieldErrors = {};
        for (const issue of result.error.issues) {
          const field = issue.path[0] as keyof FieldErrors;
          if (!fieldErrors[field]) fieldErrors[field] = issue.message;
        }
        setErrors(fieldErrors);
        return;
      }
    } else {
      const result = signInSchema.safeParse({ email, password });
      if (!result.success) {
        const fieldErrors: FieldErrors = {};
        for (const issue of result.error.issues) {
          const field = issue.path[0] as keyof FieldErrors;
          if (!fieldErrors[field]) fieldErrors[field] = issue.message;
        }
        setErrors(fieldErrors);
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        saveDisplayName(name);
        toast("Account created! Check your email to confirm.", "success");
        router.push("/dashboard");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        const fullName =
          (data.user?.user_metadata?.full_name as string | undefined) ??
          email.split("@")[0];
        saveDisplayName(fullName);
        toast("Welcome back!", "success");
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      toast(
        err instanceof Error ? err.message : "Something went wrong.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    // Google OAuth automatically captures full_name from the user's Google profile.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) toast(error.message, "error");
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast(error.message, "error");
    } else {
      setCurrentUser(null);
      toast("Signed out successfully.", "success");
      router.push("/signin");
    }
  }

  if (currentUser) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">
          Signed in as{" "}
          <span className="font-semibold text-slate-800">
            {currentUser.email}
          </span>
        </p>
        <a
          href="/dashboard"
          className="rounded-xl bg-green-800 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-green-700 transition-colors"
        >
          Go to dashboard →
        </a>
        <button
          onClick={handleSignOut}
          className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {/* Name — signup only */}
        {mode === "signup" && (
          <div className="flex flex-col gap-1.5">
            <label
              className="text-sm font-semibold text-slate-700"
              htmlFor="name"
            >
              Full name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearError("name");
              }}
              placeholder="Jane Smith"
              className={`rounded-xl border px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-800 transition-shadow ${
                errors.name ? "border-red-300" : "border-slate-200"
              }`}
            />
            <FieldError message={errors.name} />
          </div>
        )}

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-semibold text-slate-700"
            htmlFor="email"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError("email");
            }}
            placeholder="you@example.com"
            className={`rounded-xl border px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-800 transition-shadow ${
              errors.email ? "border-red-300" : "border-slate-200"
            }`}
          />
          <FieldError message={errors.email} />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-semibold text-slate-700"
            htmlFor="password"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError("password");
                clearError("confirmPassword");
              }}
              placeholder={mode === "signup" ? "Min. 8 characters" : "Your password"}
              className={`w-full rounded-xl border px-4 py-3 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-800 transition-shadow ${
                errors.password ? "border-red-300" : "border-slate-200"
              }`}
            />
            <EyeToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
          </div>
          {mode === "signup" && <PasswordStrengthBar password={password} />}
          <FieldError message={errors.password} />
        </div>

        {/* Confirm password — signup only */}
        {mode === "signup" && (
          <div className="flex flex-col gap-1.5">
            <label
              className="text-sm font-semibold text-slate-700"
              htmlFor="confirmPassword"
            >
              Confirm password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clearError("confirmPassword");
                }}
                placeholder="Re-enter your password"
                className={`w-full rounded-xl border px-4 py-3 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-800 transition-shadow ${
                  errors.confirmPassword ? "border-red-300" : "border-slate-200"
                }`}
              />
              <EyeToggle visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((v) => !v)} />
            </div>
            <FieldError message={errors.confirmPassword} />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-xl bg-green-800 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading
            ? mode === "signup"
              ? "Creating account…"
              : "Signing in…"
            : mode === "signup"
            ? "Create account"
            : "Sign in"}
        </button>
      </form>

      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-slate-200" />
        <span className="text-xs font-medium text-slate-400">or</span>
        <div className="flex-1 border-t border-slate-200" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
            fill="#4285F4"
          />
          <path
            d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
            fill="#34A853"
          />
          <path
            d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
            fill="#FBBC05"
          />
          <path
            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </button>

      <p className="text-center text-sm text-slate-500">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <a
              href="/signin"
              className="font-semibold text-green-800 hover:underline"
            >
              Sign in
            </a>
          </>
        ) : (
          <>
            Don&apos;t have an account?{" "}
            <a
              href="/signup"
              className="font-semibold text-green-800 hover:underline"
            >
              Sign up
            </a>
          </>
        )}
      </p>
    </div>
  );
}

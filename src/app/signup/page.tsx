import SignUpForm from '@/components/signup/SignUpForm'

export const metadata = {
  title: 'Create account — PropWatch',
}

export default function SignUpPage() {
  return (
    <main className="min-h-screen px-5 py-10 max-w-lg mx-auto">
      <div className="mb-8">
        <a href="/onboarding" className="text-sm font-semibold text-green-800 hover:underline">
          ← Back to analysis
        </a>
      </div>

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black text-slate-900">Create your account</h1>
          <p className="text-slate-500">
            Unlock stress testing, rate sensitivity, and portfolio resilience analysis.
          </p>
        </div>

        <SignUpForm />
      </div>
    </main>
  )
}

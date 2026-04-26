import OnboardingFlow from '@/components/onboarding/OnboardingFlow'

export const metadata = {
  title: 'Add your property — PropWatch',
}

export default function OnboardingPage() {
  return (
    <main className="min-h-screen px-5 py-10 max-w-lg mx-auto">
      <div className="mb-8">
        <a href="/" className="text-sm font-semibold text-green-800 hover:underline">
          ← PropWatch
        </a>
      </div>
      <OnboardingFlow />
    </main>
  )
}

import DashboardShell from '@/components/dashboard/DashboardShell'

export const metadata = {
  title: 'Portfolio — PropWatch',
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen px-5 py-10 max-w-lg mx-auto">
      <div className="mb-8">
        <a href="/" className="text-sm font-semibold text-green-800 hover:underline">
          ← PropWatch
        </a>
      </div>
      <DashboardShell />
    </main>
  )
}

'use client'

interface ResumePromptProps {
  onResume: () => void
  onStartFresh: () => void
}

export default function ResumePrompt({ onResume, onStartFresh }: ResumePromptProps) {
  return (
    <div className="animate-fade-in rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-4">
      <p className="text-sm text-amber-800">You have an unfinished property setup.</p>
      <div className="flex gap-3 shrink-0">
        <button
          onClick={onStartFresh}
          className="text-xs text-amber-600 hover:text-amber-800 transition-colors"
        >
          Start fresh
        </button>
        <button
          onClick={onResume}
          className="text-xs font-semibold text-amber-900 underline underline-offset-2 hover:no-underline transition-all"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

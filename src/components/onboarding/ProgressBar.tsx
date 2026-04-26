'use client'

interface ProgressBarProps {
  current: number
  total: number
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < current
              ? 'bg-green-700'
              : i === current
              ? 'bg-green-700/40'
              : 'bg-slate-200'
          } ${i === current ? 'w-6' : 'w-3'}`}
        />
      ))}
      <span className="ml-1 text-xs text-slate-400">
        {current + 1} of {total}
      </span>
    </div>
  )
}

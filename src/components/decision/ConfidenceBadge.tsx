const STYLES: Record<string, string> = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-500',
}

export default function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STYLES[confidence] ?? STYLES.low}`}
    >
      {confidence} confidence
    </span>
  )
}

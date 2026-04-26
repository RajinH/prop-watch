'use client'

interface InlinePreviewItem {
  label: string
  value: string
  highlight?: boolean
  badge?: { text: string; color: string }
}

interface InlinePreviewProps {
  items: InlinePreviewItem[]
}

export default function InlinePreview({ items }: InlinePreviewProps) {
  return (
    <div className="animate-fade-in flex flex-wrap gap-3 rounded-xl bg-green-50 border border-green-100 px-4 py-3">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5">
          <span className="text-xs text-green-700/60 font-medium">{item.label}</span>
          {item.badge ? (
            <span className={`inline-block self-start rounded-full px-2 py-0.5 text-xs font-semibold ${item.badge.color}`}>
              {item.badge.text}
            </span>
          ) : (
            <span className={`text-sm font-semibold ${item.highlight ? 'text-green-800' : 'text-slate-800'}`}>
              {item.value}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

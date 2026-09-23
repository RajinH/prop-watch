import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  eyebrow: string
  title: string
  description?: React.ReactNode
  badge?: { label: string; className: string }
  callout?: React.ReactNode
  action?: React.ReactNode
}

export default function PageHero({
  icon: Icon,
  eyebrow,
  title,
  description,
  badge,
  callout,
  action,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
            <Icon size={40} className="text-slate-600" />
          </div>
          <div className="flex flex-col gap-0.5 pt-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              {eyebrow}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900">{title}</h1>
              {badge && (
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${badge.className}`}>
                  {badge.label}
                </span>
              )}
            </div>
            {description && (
              <p className="text-sm text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0 self-center">{action}</div>}
      </div>

      {callout && (
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {callout}
        </div>
      )}
    </div>
  )
}

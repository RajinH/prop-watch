'use client'

import Link from 'next/link'
import {
  TrendingDown,
  Scale,
  Banknote,
  PieChart,
  Database,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react'
import type { DecisionDimension, DecisionDimensionKey } from '@/lib/propwatch/engine/types'

interface Props {
  dimensions: DecisionDimension[]
}

const DIMENSION_META: Record<
  DecisionDimensionKey,
  { icon: LucideIcon; href: string; cta: string }
> = {
  performance: { icon: TrendingDown, href: '/risk', cta: 'Review performance' },
  leverage: { icon: Scale, href: '/risk', cta: 'Review risk profile' },
  cashflow: { icon: Banknote, href: '/risk', cta: 'Review cashflow' },
  concentration: { icon: PieChart, href: '/risk', cta: 'See insights' },
  data_quality: { icon: Database, href: '/properties', cta: 'Complete your data' },
}

const STATUS_STYLES = {
  attention: {
    card: 'border-red-200 bg-red-50/60',
    icon: 'bg-red-100 text-red-600',
    pill: 'bg-red-100 text-red-700',
    pillLabel: 'Attention',
    cta: 'text-red-700 hover:text-red-900',
  },
  watch: {
    card: 'border-amber-200 bg-amber-50/60',
    icon: 'bg-amber-100 text-amber-600',
    pill: 'bg-amber-100 text-amber-700',
    pillLabel: 'Watch',
    cta: 'text-amber-700 hover:text-amber-900',
  },
} as const

export default function DecisionSurface({ dimensions }: Props) {
  if (dimensions.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-slate-700">Where to focus</p>
        <p className="text-xs text-slate-400">
          {dimensions.length} area{dimensions.length === 1 ? '' : 's'} need
          {dimensions.length === 1 ? 's' : ''} attention
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {dimensions.map((dim) => {
          const meta = DIMENSION_META[dim.key]
          const styles = STATUS_STYLES[dim.status]
          const Icon = meta.icon
          return (
            <div
              key={dim.key}
              className={`flex flex-col gap-3 rounded-2xl border p-4 ${styles.card}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}
                  >
                    <Icon size={16} />
                  </span>
                  <p className="text-sm font-semibold text-slate-800 truncate">{dim.label}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles.pill}`}
                >
                  {styles.pillLabel}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-slate-800">{dim.headline.title}</p>
                <p className="text-xs leading-relaxed text-slate-500">
                  {dim.headline.description}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                {dim.count > 1 ? (
                  <span className="text-xs font-medium text-slate-400">
                    +{dim.count - 1} more in this area
                  </span>
                ) : (
                  <span />
                )}
                <Link
                  href={meta.href}
                  className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors ${styles.cta}`}
                >
                  {meta.cta}
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

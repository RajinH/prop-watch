import type { PortfolioOutcome } from '@/lib/propwatch/decision/types'
import { fmtMoney, fmtPct, fmtSigned } from './types'

interface Props {
  baseline: PortfolioOutcome
  projected: PortfolioOutcome
}

type Row = {
  label: string
  baseline: string
  projected: string
  delta: number | null
  format: 'money' | 'pct'
}

export default function ImpactCompareTable({ baseline, projected }: Props) {
  const rows: Row[] = [
    {
      label: 'Monthly cashflow',
      baseline: fmtSigned(baseline.monthly_cashflow),
      projected: fmtSigned(projected.monthly_cashflow),
      delta: projected.monthly_cashflow - baseline.monthly_cashflow,
      format: 'money',
    },
    {
      label: 'Portfolio LVR',
      baseline: fmtPct(baseline.weighted_lvr),
      projected: fmtPct(projected.weighted_lvr),
      delta:
        baseline.weighted_lvr !== null && projected.weighted_lvr !== null
          ? projected.weighted_lvr - baseline.weighted_lvr
          : null,
      format: 'pct',
    },
    {
      label: 'Total equity',
      baseline: fmtMoney(baseline.total_equity),
      projected: fmtMoney(projected.total_equity),
      delta: projected.total_equity - baseline.total_equity,
      format: 'money',
    },
    {
      label: 'Interest remaining',
      baseline:
        baseline.total_interest_remaining !== null
          ? fmtMoney(baseline.total_interest_remaining)
          : '—',
      projected:
        projected.total_interest_remaining !== null
          ? fmtMoney(projected.total_interest_remaining)
          : '—',
      delta:
        baseline.total_interest_remaining !== null &&
        projected.total_interest_remaining !== null
          ? projected.total_interest_remaining - baseline.total_interest_remaining
          : null,
      format: 'money',
    },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
            <th className="py-2 pr-4 font-semibold">Metric</th>
            <th className="py-2 pr-4 font-semibold">Now</th>
            <th className="py-2 pr-4 font-semibold">Projected</th>
            <th className="py-2 font-semibold">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-slate-100">
              <td className="py-2 pr-4 text-slate-500">{row.label}</td>
              <td className="py-2 pr-4 font-medium text-slate-900">{row.baseline}</td>
              <td className="py-2 pr-4 font-medium text-slate-900">{row.projected}</td>
              <td className="py-2 font-semibold">
                {row.delta === null || row.delta === 0 ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  <DeltaValue delta={row.delta} format={row.format} label={row.label} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DeltaValue({
  delta,
  format,
  label,
}: {
  delta: number
  format: 'money' | 'pct'
  label: string
}) {
  // For LVR and interest remaining, down is good; for cashflow/equity, up is good.
  const downIsGood = label === 'Portfolio LVR' || label === 'Interest remaining'
  const isGood = downIsGood ? delta < 0 : delta > 0
  const text =
    format === 'pct'
      ? (delta > 0 ? '+' : '−') + Math.abs(delta * 100).toFixed(1) + ' pts'
      : fmtSigned(delta)
  return <span className={isGood ? 'text-green-700' : 'text-red-600'}>{text}</span>
}

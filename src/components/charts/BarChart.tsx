'use client'

import { Bar, BarChart as RechartsBarChart, Cell, XAxis } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'

export interface BarDatum {
  label: string
  value: number
  color: string
}

interface BarChartProps {
  data: BarDatum[]
  /** Chart height in px. Width always fills the container. */
  height?: number
  /** Gap between bars as a fraction of bandwidth (0–1). Default 0.3 */
  padding?: number
  className?: string
}

const chartConfig = {
  value: { label: 'Value' },
} satisfies ChartConfig

/**
 * Compact, label-free bar chart used as a decorative teaser. Colours come from
 * the caller (one per datum) rather than a ChartConfig ramp, so it can mirror
 * the semantic green/slate/red coding used alongside it.
 */
export default function BarChart({ data, height = 80, padding = 0.3, className }: BarChartProps) {
  const chartData = data.map((d) => ({ ...d, value: Math.abs(d.value) }))

  return (
    <ChartContainer
      config={chartConfig}
      className={className ?? 'aspect-auto w-full'}
      style={{ height }}
    >
      <RechartsBarChart
        accessibilityLayer
        data={chartData}
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        barCategoryGap={`${padding * 100}%`}
      >
        <XAxis dataKey="label" hide />
        <Bar dataKey="value" radius={4} isAnimationActive={false}>
          {chartData.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ChartContainer>
  )
}

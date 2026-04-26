'use client'

import { Bar } from '@visx/shape'
import { Group } from '@visx/group'
import { scaleBand, scaleLinear } from '@visx/scale'

export interface BarDatum {
  label: string
  value: number
  color: string
}

interface BarChartProps {
  data: BarDatum[]
  width: number
  height: number
  /** Gap between bars as a fraction of bandwidth (0–1). Default 0.3 */
  padding?: number
}

export default function BarChart({ data, width, height, padding = 0.3 }: BarChartProps) {
  const xScale = scaleBand<string>({
    domain: data.map((d) => d.label),
    range: [0, width],
    padding,
  })

  const maxVal = Math.max(...data.map((d) => Math.abs(d.value)), 1)

  const yScale = scaleLinear<number>({
    domain: [0, maxVal],
    range: [height, 0],
  })

  return (
    <svg width={width} height={height}>
      <Group>
        {data.map((d) => {
          const barWidth = xScale.bandwidth()
          const barHeight = height - (yScale(Math.abs(d.value)) ?? 0)
          const x = xScale(d.label) ?? 0
          const y = height - barHeight

          return (
            <Bar
              key={d.label}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={d.color}
              rx={4}
            />
          )
        })}
      </Group>
    </svg>
  )
}

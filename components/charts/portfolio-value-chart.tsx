"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { type PortfolioHistory } from "@/lib/data";

const portfolioChartConfig = {
  totalValue: {
    label: "Total Value",
    color: "var(--chart-1)",
  },
  equity: {
    label: "Equity",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

interface PortfolioValueChartInnerProps {
  data: PortfolioHistory[];
}

export function PortfolioValueChartInner({
  data,
}: PortfolioValueChartInnerProps) {
  return (
    <ChartContainer
      config={portfolioChartConfig}
      className="h-[300px] w-full min-h-[300px]"
    >
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => `$${Number(value).toLocaleString()}`}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          type="monotone"
          dataKey="totalValue"
          stackId="1"
          stroke="var(--color-totalValue)"
          fill="var(--color-totalValue)"
          fillOpacity={0.2}
        />
        <Area
          type="monotone"
          dataKey="equity"
          stackId="2"
          stroke="var(--color-equity)"
          fill="var(--color-equity)"
          fillOpacity={0.4}
        />
      </AreaChart>
    </ChartContainer>
  );
}

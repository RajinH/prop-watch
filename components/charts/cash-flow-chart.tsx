"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { type CashFlowData } from "@/lib/data";

const cashFlowChartConfig = {
  income: {
    label: "Income",
    color: "var(--chart-2)",
  },
  expenses: {
    label: "Expenses",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

interface CashFlowChartInnerProps {
  data: CashFlowData[];
}

export function CashFlowChartInner({ data }: CashFlowChartInnerProps) {
  return (
    <ChartContainer
      config={cashFlowChartConfig}
      className="h-[300px] w-full min-h-[300px]"
    >
      <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => `$${Number(value).toLocaleString()}`}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="income" fill="var(--color-income)" radius={4} />
        <Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

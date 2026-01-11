"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { type Property } from "@/lib/data";

const lvrChartConfig = {
  lvr: {
    label: "LVR",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

interface LvrDistributionChartInnerProps {
  properties: Property[];
}

export function LvrDistributionChartInner({ properties }: LvrDistributionChartInnerProps) {
  const data = properties.map((p) => ({
    name: p.name.split(" ")[0],
    lvr: p.lvr,
    fullName: p.name,
  }));

  return (
    <ChartContainer
      config={lvrChartConfig}
      className="h-[300px] w-full min-h-[300px]"
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 10, right: 30, left: 60, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => `${value}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => `${Number(value).toFixed(1)}%`}
              labelKey="fullName"
            />
          }
        />
        <Bar dataKey="lvr" fill="var(--color-lvr)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

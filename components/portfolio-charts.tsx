"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  type PortfolioHistory,
  type CashFlowData,
  type Property,
} from "@/lib/data";

// Hook to check if component is mounted (client-side)
function useMounted() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

// Skeleton placeholder for charts during SSR
function ChartSkeleton() {
  return (
    <div className="h-[300px] w-full min-h-[300px] flex items-center justify-center bg-muted/10 rounded-md animate-pulse">
      <span className="text-muted-foreground text-sm">Loading chart...</span>
    </div>
  );
}

interface PortfolioValueChartProps {
  data: PortfolioHistory[];
}

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

export function PortfolioValueChart({ data }: PortfolioValueChartProps) {
  const mounted = useMounted();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Value</CardTitle>
        <CardDescription>
          Total portfolio value and equity over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!mounted ? (
          <ChartSkeleton />
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}

interface CashFlowChartProps {
  data: CashFlowData[];
}

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

export function CashFlowChart({ data }: CashFlowChartProps) {
  const mounted = useMounted();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow</CardTitle>
        <CardDescription>Monthly income vs expenses</CardDescription>
      </CardHeader>
      <CardContent>
        {!mounted ? (
          <ChartSkeleton />
        ) : (
          <ChartContainer
            config={cashFlowChartConfig}
            className="h-[300px] w-full min-h-[300px]"
          >
            <BarChart
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
        )}
      </CardContent>
    </Card>
  );
}

interface LvrDistributionChartProps {
  properties: Property[];
}

const lvrChartConfig = {
  lvr: {
    label: "LVR",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export function LvrDistributionChart({
  properties,
}: LvrDistributionChartProps) {
  const mounted = useMounted();
  const data = properties.map((p) => ({
    name: p.name.split(" ")[0], // Short name for chart
    lvr: p.lvr,
    fullName: p.name,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>LVR Distribution</CardTitle>
        <CardDescription>Loan-to-Value ratio per property</CardDescription>
      </CardHeader>
      <CardContent>
        {!mounted ? (
          <ChartSkeleton />
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}

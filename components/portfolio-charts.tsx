"use client";

import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type PortfolioHistory,
  type CashFlowData,
  type Property,
} from "@/lib/data";

// Skeleton placeholder for charts during loading
function ChartSkeleton() {
  return (
    <div className="h-[300px] w-full min-h-[300px] flex items-center justify-center bg-muted/10 rounded-md animate-pulse">
      <span className="text-muted-foreground text-sm">Loading chart...</span>
    </div>
  );
}

// Dynamic imports with SSR disabled to prevent hydration issues with recharts
const PortfolioValueChartInner = dynamic(
  () => import("./charts/portfolio-value-chart").then((mod) => mod.PortfolioValueChartInner),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

const CashFlowChartInner = dynamic(
  () => import("./charts/cash-flow-chart").then((mod) => mod.CashFlowChartInner),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

const LvrDistributionChartInner = dynamic(
  () => import("./charts/lvr-distribution-chart").then((mod) => mod.LvrDistributionChartInner),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

interface PortfolioValueChartProps {
  data: PortfolioHistory[];
}

export function PortfolioValueChart({ data }: PortfolioValueChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Value</CardTitle>
        <CardDescription>
          Total portfolio value and equity over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PortfolioValueChartInner data={data} />
      </CardContent>
    </Card>
  );
}

interface CashFlowChartProps {
  data: CashFlowData[];
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow</CardTitle>
        <CardDescription>Monthly income vs expenses</CardDescription>
      </CardHeader>
      <CardContent>
        <CashFlowChartInner data={data} />
      </CardContent>
    </Card>
  );
}

interface LvrDistributionChartProps {
  properties: Property[];
}

export function LvrDistributionChart({ properties }: LvrDistributionChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>LVR Distribution</CardTitle>
        <CardDescription>Loan-to-Value ratio per property</CardDescription>
      </CardHeader>
      <CardContent>
        <LvrDistributionChartInner properties={properties} />
      </CardContent>
    </Card>
  );
}

import { Building2, Wallet, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertyCard } from "@/components/property-card";
import {
  PortfolioValueChart,
  CashFlowChart,
  LvrDistributionChart,
} from "@/components/portfolio-charts";
import {
  properties,
  portfolioHistory,
  cashFlowData,
  calculatePortfolioSummary,
  formatCurrency,
} from "@/lib/data";

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const summary = calculatePortfolioSummary(properties);

  return (
    <main className="flex-1">
      <div className="container py-6 px-4 md:px-6 space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your property portfolio performance
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total Portfolio Value"
            value={formatCurrency(summary.totalValue)}
            description={`${properties.length} properties`}
            icon={Building2}
          />
          <SummaryCard
            title="Total Debt"
            value={formatCurrency(summary.totalDebt)}
            description={`Equity: ${formatCurrency(summary.totalEquity)}`}
            icon={Wallet}
          />
          <SummaryCard
            title="Average LVR"
            value={`${summary.avgLvr.toFixed(1)}%`}
            description="Loan-to-Value Ratio"
            icon={TrendingUp}
          />
          <SummaryCard
            title="Net Cash Flow"
            value={formatCurrency(summary.netCashFlow)}
            description="Monthly net income"
            icon={DollarSign}
          />
        </div>

        {/* Charts Section */}
        <div className="grid gap-4 md:grid-cols-2">
          <PortfolioValueChart data={portfolioHistory} />
          <CashFlowChart data={cashFlowData} />
        </div>

        {/* LVR Distribution */}
        <div className="grid gap-4 lg:grid-cols-2">
          <LvrDistributionChart properties={properties} />
        </div>

        {/* Properties Section */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-4">Properties</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

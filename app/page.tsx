"use client";

import { useState, useCallback, useEffect } from "react";
import { Building2, Wallet, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertyCard } from "@/components/property-card";
import { TimePeriodSelector } from "@/components/time-period-selector";
import { AddPropertyCard } from "@/components/add-property-card";
import { AddPropertyModal } from "@/components/add-property-modal";
import {
  PortfolioValueChart,
  CashFlowChart,
  LvrDistributionChart,
} from "@/components/portfolio-charts";
import {
  portfolioHistory,
  cashFlowData,
  calculatePortfolioSummary,
  formatCurrency,
  type TimePeriod,
  type Property,
} from "@/lib/data";
import { getProperties, deleteProperty, addProperty } from "@/lib/storage";

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
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("monthly");
  const [modalOpen, setModalOpen] = useState(false);
  // Lazy initialization from localStorage
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setProperties(getProperties());
    });
  }, []);
  const handleDelete = useCallback((id: string) => {
    const updated = deleteProperty(id);
    setProperties(updated);
  }, []);

  const handleAdd = useCallback((property: Omit<Property, "id" | "lvr">) => {
    const updated = addProperty(property);
    setProperties(updated);
  }, []);

  const hasData = properties.length > 0;
  const summary = hasData ? calculatePortfolioSummary(properties) : null;

  return (
    <main className="flex-1">
      <div className="container mx-auto py-6 px-4 md:px-6 space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your property portfolio performance
          </p>
        </div>

        {/* Summary Cards */}
        {summary && (
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
        )}

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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-2xl font-bold tracking-tight">Properties</h2>
            <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                timePeriod={timePeriod}
                onDelete={handleDelete}
              />
            ))}
            <AddPropertyCard onClick={() => setModalOpen(true)} />
          </div>
        </div>
      </div>

      {/* Add Property Modal */}
      <AddPropertyModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onAdd={handleAdd}
      />
    </main>
  );
}

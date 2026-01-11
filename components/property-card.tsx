import { MapPin, TrendingUp, TrendingDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  type Property,
  type TimePeriod,
  formatCurrency,
  getValueForPeriod,
  getPeriodLabel,
  getPeriodDisplayName,
} from "@/lib/data";

interface PropertyCardProps {
  property: Property;
  timePeriod?: TimePeriod;
}

function getLvrBadgeVariant(
  lvr: number
): "default" | "secondary" | "destructive" {
  if (lvr < 65) return "secondary";
  if (lvr < 80) return "default";
  return "destructive";
}

function MetricRow({
  label,
  value,
  badge,
  lvrValue,
}: {
  label: string;
  value: string;
  badge?: boolean;
  lvrValue?: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      {badge && lvrValue !== undefined ? (
        <Badge variant={getLvrBadgeVariant(lvrValue)}>{value}</Badge>
      ) : (
        <span className="text-sm font-medium">{value}</span>
      )}
    </div>
  );
}

export function PropertyCard({
  property,
  timePeriod = "monthly",
}: PropertyCardProps) {
  const income = getValueForPeriod(property.income, timePeriod);
  const expenses = getValueForPeriod(property.expenses, timePeriod);
  const cashFlow = income - expenses;
  const isPositiveCashFlow = cashFlow >= 0;
  const periodLabel = getPeriodLabel(timePeriod);
  const periodDisplayName = getPeriodDisplayName(timePeriod);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{property.name}</CardTitle>
        <CardDescription className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {property.address}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <MetricRow
            label="Valuation"
            value={formatCurrency(property.valuation)}
          />
          <MetricRow
            label="Loan Remaining"
            value={formatCurrency(property.loanRemaining)}
          />
          <MetricRow
            label="LVR"
            value={`${property.lvr.toFixed(1)}%`}
            badge
            lvrValue={property.lvr}
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <MetricRow
            label={`${periodDisplayName} Income`}
            value={formatCurrency(income)}
          />
          <MetricRow
            label={`${periodDisplayName} Expenses`}
            value={formatCurrency(expenses)}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Net Cash Flow</span>
          <div
            className={`flex items-center gap-1 text-sm font-semibold ${
              isPositiveCashFlow ? "text-green-600" : "text-red-600"
            }`}
          >
            {isPositiveCashFlow ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            {formatCurrency(Math.abs(cashFlow))}
            <span className="text-xs text-muted-foreground">{periodLabel}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

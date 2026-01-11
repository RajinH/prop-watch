"use client";

import { MapPin, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  type Property,
  type TimePeriod,
  formatCurrency,
  getValueForPeriod,
  getPeriodLabel,
  getPeriodDisplayName,
} from "@/lib/data";
import { useState } from "react";

interface PropertyCardProps {
  property: Property;
  timePeriod?: TimePeriod;
  onDelete?: (id: string) => void;
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
  onDelete,
}: PropertyCardProps) {
  const [open, setOpen] = useState(false);
  const income = getValueForPeriod(property.income, timePeriod);
  const expenses = getValueForPeriod(property.expenses, timePeriod);
  const cashFlow = income - expenses;
  const isPositiveCashFlow = cashFlow >= 0;
  const periodLabel = getPeriodLabel(timePeriod);
  const periodDisplayName = getPeriodDisplayName(timePeriod);

  return (
    <Card className="h-full relative group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{property.name}</CardTitle>
            <CardDescription className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {property.address}
            </CardDescription>
          </div>
          {onDelete && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity absolute right-5 top-5 text-muted-foreground hover:text-destructive cursor-pointer"
                onClick={() => setOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete property</span>
              </Button>
              <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Property</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &quot;{property.name}
                      &quot;? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setOpen(false)}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        onDelete(property.id);
                        setOpen(false);
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
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

"use client";

import { type TimePeriod, getPeriodDisplayName } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const periods: TimePeriod[] = ["weekly", "monthly", "yearly", "lifetime"];

interface TimePeriodSelectorProps {
  value: TimePeriod;
  onChange: (period: TimePeriod) => void;
}

export function TimePeriodSelector({
  value,
  onChange,
}: TimePeriodSelectorProps) {
  return (
    <div className="inline-flex items-center rounded-lg border bg-muted p-1 gap-1">
      {periods.map((period) => (
        <Button
          key={period}
          variant={value === period ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange(period)}
          className={cn(
            "h-8 px-3 text-sm",
            value === period
              ? "bg-background text-foreground shadow-sm hover:bg-background"
              : "hover:bg-transparent hover:text-foreground"
          )}
        >
          {getPeriodDisplayName(period)}
        </Button>
      ))}
    </div>
  );
}

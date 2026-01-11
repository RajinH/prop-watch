import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";

interface AddPropertyCardProps {
  onClick: () => void;
}

export function AddPropertyCard({ onClick }: AddPropertyCardProps) {
  return (
    <Card
      className="h-full border-dashed border-2 cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3">
        <div className="rounded-full bg-muted p-4">
          <Plus className="h-8 w-8 text-muted-foreground" />
        </div>
        <span className="text-lg font-medium text-muted-foreground">
          Add Property
        </span>
        <span className="text-sm text-muted-foreground/70">
          Click to add a new property
        </span>
      </div>
    </Card>
  );
}

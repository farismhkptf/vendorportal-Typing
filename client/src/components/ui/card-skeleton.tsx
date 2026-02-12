import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CardSkeletonProps {
  lines?: number;
  className?: string;
}

export function CardSkeleton({ lines = 3, className }: CardSkeletonProps) {
  return (
    <Card className={cn("p-4 border border-border/50 animate-pulse", className)} data-testid="card-skeleton">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted/80 shrink-0" />
        <div className="flex-1 space-y-2.5">
          <div className="h-4 w-2/5 rounded bg-muted/80" />
          {Array.from({ length: lines - 1 }).map((_, i) => (
            <div key={i} className={cn("h-3 rounded bg-muted/60", i === 0 ? "w-4/5" : "w-3/5")} />
          ))}
        </div>
        <div className="h-5 w-16 rounded-full bg-muted/60" />
      </div>
    </Card>
  );
}

interface ListSkeletonProps {
  count?: number;
  lines?: number;
  className?: string;
}

export function ListSkeleton({ count = 5, lines = 3, className }: ListSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)} data-testid="list-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} lines={lines} />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" data-testid="dashboard-skeleton">
      <div className="h-8 w-48 rounded bg-muted/80" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4 border border-border/50">
            <div className="space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted/60" />
              <div className="h-8 w-1/2 rounded bg-muted/80" />
            </div>
          </Card>
        ))}
      </div>
      <Card className="p-4 border border-border/50">
        <div className="h-6 w-40 rounded bg-muted/80 mb-4" />
        <div className="h-16 rounded bg-muted/60" />
      </Card>
    </div>
  );
}

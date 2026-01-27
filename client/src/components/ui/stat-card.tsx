import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: string;
    positive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn("border border-border/50 shadow-sm", className)} data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold text-foreground">{value}</p>
            {trend && (
              <p className={cn(
                "text-xs font-medium",
                trend.positive ? "text-green-600" : "text-red-600"
              )}>
                {trend.positive ? "+" : ""}{trend.value}
              </p>
            )}
          </div>
          {icon && (
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

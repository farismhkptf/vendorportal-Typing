import { ReactNode } from "react";
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
  animationDelay?: number;
}

export function StatCard({ title, value, icon, trend, className, animationDelay = 0 }: StatCardProps) {
  return (
    <div 
      className={cn(
        "stat-card p-6 opacity-0 animate-fade-in",
        animationDelay === 1 && "animate-delay-1",
        animationDelay === 2 && "animate-delay-2",
        animationDelay === 3 && "animate-delay-3",
        animationDelay === 4 && "animate-delay-4",
        className
      )} 
      data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="relative z-10 flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground tracking-wide">{title}</p>
          <p className="text-3xl font-semibold text-foreground tracking-tight animate-count">{value}</p>
          {trend && (
            <p className={cn(
              "text-xs font-medium",
              trend.positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            )}>
              {trend.positive ? "+" : ""}{trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className="icon-container icon-container-md">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

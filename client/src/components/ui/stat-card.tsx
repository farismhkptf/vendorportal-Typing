import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/use-count-up";

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
  onClick?: () => void;
}

function AnimatedValue({ value, delay }: { value: string | number; delay: number }) {
  const numericMatch = typeof value === "number" 
    ? { prefix: "", num: value, suffix: "" }
    : value.match(/^(.*?)(\d[\d,]*)(.*)$/) 
      ? (() => {
          const m = value.match(/^(.*?)(\d[\d,]*)(.*)$/);
          return m ? { prefix: m[1], num: parseInt(m[2].replace(/,/g, "")), suffix: m[3] } : null;
        })()
      : null;

  const animatedNum = useCountUp(numericMatch?.num ?? 0, 800, delay);

  if (!numericMatch) {
    return <span>{value}</span>;
  }

  return (
    <span>
      {numericMatch.prefix}
      {animatedNum.toLocaleString()}
      {numericMatch.suffix}
    </span>
  );
}

export function StatCard({ title, value, icon, trend, className, animationDelay = 0, onClick }: StatCardProps) {
  const delayMs = animationDelay * 60;

  return (
    <div 
      className={cn(
        "stat-card p-5 opacity-0 animate-fade-in",
        animationDelay === 1 && "animate-delay-1",
        animationDelay === 2 && "animate-delay-2",
        animationDelay === 3 && "animate-delay-3",
        animationDelay === 4 && "animate-delay-4",
        onClick && "cursor-pointer hover-elevate",
        className
      )} 
      data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="space-y-2 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">{title}</p>
          <p className="text-2xl font-bold text-foreground tracking-tight tabular-nums">
            <AnimatedValue value={value} delay={delayMs} />
          </p>
          {trend && (
            <p className={cn(
              "text-xs font-medium",
              trend.positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}>
              {trend.positive ? "+" : ""}{trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className="icon-container icon-container-md shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

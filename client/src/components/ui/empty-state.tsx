import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center",
      compact ? "py-10 px-4" : "py-20 px-6",
      className
    )} data-testid="empty-state">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-primary/5 scale-[2] blur-xl" />
        <div className={cn(
          "relative rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground/60",
          compact ? "h-11 w-11" : "h-14 w-14"
        )}>
          {icon}
        </div>
      </div>
      <h3 className="text-base font-medium text-foreground mb-1.5" data-testid="text-empty-title">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-[260px] mb-6" data-testid="text-empty-description">{description}</p>
      {action}
    </div>
  );
}

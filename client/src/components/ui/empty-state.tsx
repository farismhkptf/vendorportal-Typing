import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-20 px-6 text-center", className)} data-testid="empty-state">
      <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground/60 mb-5">
        {icon}
      </div>
      <h3 className="text-base font-medium text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-[260px] mb-6">{description}</p>
      {action}
    </div>
  );
}

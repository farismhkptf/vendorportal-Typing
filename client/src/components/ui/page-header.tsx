import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="gradient-header border-b border-border/50">
      <div className="px-4 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl lg:text-2xl font-semibold text-foreground truncate" data-testid="page-title">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2" data-testid="page-subtitle">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-wrap shrink-0" data-testid="page-actions">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

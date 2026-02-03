import { ReactNode } from "react";
import { PageBreadcrumb, type BreadcrumbItemData } from "@/components/ui/page-breadcrumb";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItemData[];
}

export function PageHeader({ title, subtitle, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="gradient-header border-b border-border/50">
      <div className="px-4 lg:px-8 py-6">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="mb-3">
            <PageBreadcrumb items={breadcrumbs} />
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-semibold text-foreground" data-testid="page-title">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground" data-testid="page-subtitle">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-3" data-testid="page-actions">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

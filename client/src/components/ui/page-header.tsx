import { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageBreadcrumb, type BreadcrumbItemData } from "@/components/ui/page-breadcrumb";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItemData[];
  backHref?: string;
}

export function PageHeader({ title, subtitle, actions, breadcrumbs, backHref }: PageHeaderProps) {
  return (
    <div className="gradient-header border-b border-border/40">
      <div className="px-4 lg:px-8 py-7">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="mb-4">
            <PageBreadcrumb items={breadcrumbs} />
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            {backHref && (
              <Link href={backHref}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg shrink-0"
                  data-testid="button-back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight" data-testid="page-title">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1.5 text-sm text-muted-foreground" data-testid="page-subtitle">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center flex-wrap gap-3" data-testid="page-actions">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

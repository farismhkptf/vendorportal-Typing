import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function SectionCard({ title, required, children, className, actions }: SectionCardProps) {
  return (
    <Card className={cn("border border-border/50 shadow-sm", className)} data-testid={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base font-medium text-foreground">
            {title}
          </CardTitle>
          {required && (
            <Badge 
              variant="secondary" 
              className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-0"
            >
              Required
            </Badge>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}

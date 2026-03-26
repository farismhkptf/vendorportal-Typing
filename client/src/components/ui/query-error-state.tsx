import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueryErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function QueryErrorState({
  message = "Something went wrong while loading data.",
  onRetry,
}: QueryErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center" data-testid="query-error-state">
      <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mb-4">
        <AlertTriangle className="h-6 w-6 text-red-500" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">Failed to load</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2" data-testid="button-retry">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}

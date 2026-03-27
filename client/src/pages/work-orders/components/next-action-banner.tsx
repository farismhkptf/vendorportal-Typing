import { cn } from "@/lib/utils";
import { getNextAction, type PipelineInfo } from "@/lib/pipeline-stage";
import {
  Clock,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function NextActionBanner({ 
  pipeline, typingJobs, appointments, onAction 
}: { 
  pipeline: PipelineInfo; 
  typingJobs: any[]; 
  appointments: any[]; 
  onAction: (type: string) => void;
}) {
  const action = getNextAction(typingJobs, appointments, pipeline);

  const variantStyles = {
    info: "bg-blue-50/80 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
    action: "bg-amber-50/80 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",
    warning: "bg-red-50/80 border-red-200 dark:bg-red-900/20 dark:border-red-800",
    success: "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800",
  };

  const iconStyles = {
    info: "text-blue-600 dark:text-blue-400",
    action: "text-amber-600 dark:text-amber-400",
    warning: "text-red-600 dark:text-red-400",
    success: "text-emerald-600 dark:text-emerald-400",
  };

  const icons = {
    info: <Clock className="h-4 w-4" />,
    action: <ArrowRight className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    success: <CheckCircle2 className="h-4 w-4" />,
  };

  return (
    <div className={cn("rounded-xl border px-4 py-3 flex items-center justify-between gap-3", variantStyles[action.variant])} data-testid="next-action-banner">
      <div className="flex items-center gap-3 min-w-0">
        <span className={iconStyles[action.variant]}>{icons[action.variant]}</span>
        <span className="text-sm font-medium text-foreground">{action.message}</span>
      </div>
      {action.actionLabel && action.actionType && (
        <Button
          size="sm"
          variant={action.variant === "warning" ? "destructive" : "default"}
          className="gap-1.5 shrink-0"
          onClick={() => onAction(action.actionType!)}
          data-testid="button-next-action"
        >
          {action.actionLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

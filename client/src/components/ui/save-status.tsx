import { Check, Loader2, AlertCircle, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  className?: string;
  showText?: boolean;
  onRetry?: () => void;
}

const statusConfig: Record<SaveStatus, { icon: typeof Cloud; text: string; className: string; animate?: boolean }> = {
  idle: {
    icon: Cloud,
    text: "Ready",
    className: "text-muted-foreground",
  },
  saving: {
    icon: Loader2,
    text: "Saving...",
    className: "text-blue-500",
    animate: true,
  },
  saved: {
    icon: Check,
    text: "All changes saved",
    className: "text-emerald-500",
  },
  error: {
    icon: AlertCircle,
    text: "Save failed",
    className: "text-destructive",
  },
};

export function SaveStatusIndicator({ status, className, showText = true, onRetry }: SaveStatusIndicatorProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const isClickable = status === "error" && onRetry;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-sm",
        config.className,
        isClickable && "cursor-pointer hover:underline",
        className,
      )}
      onClick={isClickable ? onRetry : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") onRetry?.(); } : undefined}
      data-testid="save-status-indicator"
    >
      <Icon className={cn("h-4 w-4", config.animate && "animate-spin")} />
      {showText && <span>{status === "error" && onRetry ? "Error — click to retry" : config.text}</span>}
    </div>
  );
}

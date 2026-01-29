import { Check, Loader2, AlertCircle, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  className?: string;
  showText?: boolean;
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

export function SaveStatusIndicator({ status, className, showText = true }: SaveStatusIndicatorProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-1.5 text-sm", config.className, className)}>
      <Icon className={cn("h-4 w-4", config.animate && "animate-spin")} />
      {showText && <span>{config.text}</span>}
    </div>
  );
}

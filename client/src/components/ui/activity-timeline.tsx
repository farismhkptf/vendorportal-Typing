import { formatDistanceToNow } from "date-fns";
import { User, FileText, Calendar, Settings, Building2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  userId?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string | Date;
  userName?: string;
}

interface ActivityTimelineProps {
  activities: ActivityItem[];
  className?: string;
}

const getActionIcon = (entityType: string) => {
  switch (entityType) {
    case "work_order":
      return FileText;
    case "appointment":
      return Calendar;
    case "company":
      return Building2;
    case "user":
      return User;
    default:
      return Settings;
  }
};

const getActionColor = (action: string) => {
  if (action.includes("create")) return "bg-emerald-500";
  if (action.includes("update") || action.includes("edit")) return "bg-blue-500";
  if (action.includes("delete")) return "bg-red-500";
  if (action.includes("schedule")) return "bg-violet-500";
  return "bg-muted-foreground";
};

const formatAction = (action: string, entityType: string): string => {
  const entityLabel = entityType.replace(/_/g, " ");
  if (action.includes("create")) return `Created ${entityLabel}`;
  if (action.includes("update")) return `Updated ${entityLabel}`;
  if (action.includes("delete")) return `Deleted ${entityLabel}`;
  if (action.includes("schedule")) return `Scheduled ${entityLabel}`;
  return action;
};

export function ActivityTimeline({ activities, className }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground text-sm", className)}>
        No activity recorded yet
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {activities.map((activity, index) => {
        const Icon = getActionIcon(activity.entityType);
        const colorClass = getActionColor(activity.action);
        const isLast = index === activities.length - 1;

        return (
          <div key={activity.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white", colorClass)}>
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && <div className="w-0.5 flex-1 bg-border mt-2" />}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {formatAction(activity.action, activity.entityType)}
                </p>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                </span>
              </div>
              {activity.userName && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  by {activity.userName}
                </p>
              )}
              {activity.details && Object.keys(activity.details).length > 0 && (
                <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1">
                  {Object.entries(activity.details).slice(0, 3).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}:</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

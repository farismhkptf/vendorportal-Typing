import { formatDistanceToNow } from "date-fns";
import { User, FileText, Calendar, Settings, Building2, ArrowRight, CheckCircle2, XCircle, AlertTriangle, Send, Stethoscope, CreditCard, Clock, RefreshCw } from "lucide-react";
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

const getActionIcon = (action: string, entityType: string) => {
  if (action.includes("auto_completed") || action.includes("complete")) return CheckCircle2;
  if (action.includes("auto_delayed") || action.includes("delay")) return AlertTriangle;
  if (action.includes("abort") || action.includes("cancel")) return XCircle;
  if (action.includes("schedule")) return Calendar;
  if (action.includes("activate")) return ArrowRight;
  if (action.includes("send") || action.includes("assign") || action.includes("submitted")) return Send;
  if (action.includes("status_change") || action.includes("revert")) return RefreshCw;

  switch (entityType) {
    case "work_order":
      return FileText;
    case "appointment":
      return Calendar;
    case "typing_job":
      return Clock;
    case "company":
      return Building2;
    case "user":
      return User;
    default:
      return Settings;
  }
};

const getActionColor = (action: string) => {
  if (action.includes("create") || action.includes("activate")) return "bg-emerald-500";
  if (action.includes("auto_completed") || action.includes("complete") || action.includes("delay_resolved")) return "bg-emerald-500";
  if (action.includes("update") || action.includes("edit") || action.includes("status_change")) return "bg-blue-500";
  if (action.includes("delete") || action.includes("abort") || action.includes("cancel")) return "bg-red-500";
  if (action.includes("schedule")) return "bg-violet-500";
  if (action.includes("send") || action.includes("assign") || action.includes("submitted")) return "bg-amber-500";
  if (action.includes("auto_delayed") || action.includes("delay")) return "bg-orange-500";
  return "bg-muted-foreground";
};

const formatAction = (action: string, entityType: string, details?: Record<string, unknown> | null): string => {
  const entityLabel = entityType.replace(/_/g, " ");

  if (action === "auto_completed") return "Auto-completed work order";
  if (action === "auto_delayed") return "Flagged as delayed";
  if (action === "delay_resolved") return "Delay resolved";
  if (action === "activated") return "Work order activated";
  if (action === "status_changed") {
    const newStatus = details?.newStatus as string;
    if (newStatus) return `Status changed to ${newStatus}`;
    return "Status changed";
  }
  if (action === "submitted_to_vendor" || action === "sent_to_vendor") return "Sent to vendor";
  if (action === "vendor_completed") return "Vendor completed job";
  if (action === "scheduled") return `Scheduled ${entityLabel}`;
  if (action === "appointment_scheduled") {
    const type = details?.type as string;
    return type ? `Scheduled ${type} appointment` : "Appointment scheduled";
  }
  if (action === "appointment_completed") return "Appointment completed";
  if (action === "appointment_cancelled") return "Appointment cancelled";
  if (action === "appointment_rescheduled") return "Appointment rescheduled";

  if (action.includes("create")) return `Created ${entityLabel}`;
  if (action.includes("update")) return `Updated ${entityLabel}`;
  if (action.includes("delete")) return `Deleted ${entityLabel}`;
  if (action.includes("schedule")) return `Scheduled ${entityLabel}`;
  if (action.includes("activate")) return `Activated ${entityLabel}`;
  if (action.includes("abort")) return `Aborted ${entityLabel}`;
  if (action.includes("complete")) return `Completed ${entityLabel}`;
  if (action.includes("cancel")) return `Cancelled ${entityLabel}`;

  return action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
};

const formatDetailDescription = (details: Record<string, unknown>): string | null => {
  const parts: string[] = [];

  if (details.applicantName) parts.push(String(details.applicantName));
  if (details.woNumber) parts.push(`WO ${details.woNumber}`);
  if (details.newStatus && !details.bulkAction) {
    // already shown in title
  }
  if (details.previousStatus && details.newStatus) {
    parts.push(`${details.previousStatus} → ${details.newStatus}`);
  }
  if (details.reason) parts.push(String(details.reason));
  if (details.centerName) parts.push(`at ${details.centerName}`);
  if (details.scheduledDate) parts.push(`on ${details.scheduledDate}`);
  if (details.type && !parts.some(p => p.includes(String(details.type)))) {
    parts.push(`Type: ${details.type}`);
  }
  if (details.jobCategory) parts.push(`${details.jobCategory} job`);
  if (details.vendorName) parts.push(`Vendor: ${details.vendorName}`);

  return parts.length > 0 ? parts.join(" · ") : null;
};

export function ActivityTimeline({ activities, className }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground text-sm", className)} data-testid="text-no-activity">
        No activity recorded yet
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)} data-testid="activity-timeline">
      {activities.map((activity, index) => {
        const Icon = getActionIcon(activity.action, activity.entityType);
        const colorClass = getActionColor(activity.action);
        const isLast = index === activities.length - 1;
        const description = activity.details ? formatDetailDescription(activity.details as Record<string, unknown>) : null;

        return (
          <div key={activity.id} className="flex gap-3" data-testid={`activity-item-${activity.id}`}>
            <div className="flex flex-col items-center">
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0", colorClass)}>
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && <div className="w-0.5 flex-1 bg-border mt-1" />}
            </div>
            <div className="flex-1 pb-4 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium" data-testid={`text-action-${activity.id}`}>
                  {formatAction(activity.action, activity.entityType, activity.details as Record<string, unknown> | null)}
                </p>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0" data-testid={`text-time-${activity.id}`}>
                  {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                </span>
              </div>
              {description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate" data-testid={`text-description-${activity.id}`}>
                  {description}
                </p>
              )}
              {activity.userName && (
                <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-user-${activity.id}`}>
                  by {activity.userName}
                </p>
              )}
              {!activity.userName && !activity.userId && (
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  System
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

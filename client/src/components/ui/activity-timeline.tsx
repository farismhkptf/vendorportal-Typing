import { formatDistanceToNow } from "date-fns";
import { User, FileText, Calendar, Settings, Building2, ArrowRight, CheckCircle2, XCircle, AlertTriangle, Send, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  photoMap?: Record<string, string>;
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
    return type ? `${type} Appointment Scheduled` : "Appointment Scheduled";
  }
  if (action === "appointment_completed") return "Appointment Completed";
  if (action === "appointment_cancelled") return "Appointment Cancelled";
  if (action === "appointment_rescheduled") return "Appointment Rescheduled";

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

const formatNaturalDescription = (action: string, entityType: string, details?: Record<string, unknown> | null, userName?: string): string => {
  const d = details || {};
  const name = d.applicantName as string || userName || "";
  const woNum = d.woNumber as string || "";

  if (action === "appointment_scheduled" || (action === "scheduled" && entityType === "appointment")) {
    const type = d.type as string || "";
    const center = d.centerName as string || "";
    const date = d.scheduledDate as string || "";
    const parts = [name, "has", type ? `a ${type.toLowerCase()} appointment` : "an appointment"];
    if (center) parts.push(`at ${center}`);
    if (date) parts.push(`on ${date}`);
    return parts.filter(Boolean).join(" ");
  }

  if (action === "auto_completed" || action.includes("complete")) {
    if (woNum) return `Work Order ${woNum} has been completed`;
    return name ? `${name}'s work order has been completed` : "Work order has been completed";
  }

  if (action === "status_changed") {
    const prev = d.previousStatus as string;
    const next = d.newStatus as string;
    if (woNum && prev && next) return `Work Order ${woNum} changed from ${prev} to ${next}`;
    if (woNum && next) return `Work Order ${woNum} status changed to ${next}`;
    return name ? `${name}'s status has been updated` : "Status has been updated";
  }

  if (action === "activated") {
    if (woNum) return `Work Order ${woNum} has been activated`;
    return name ? `${name}'s work order has been activated` : "Work order has been activated";
  }

  if (action === "submitted_to_vendor" || action === "sent_to_vendor") {
    const vendor = d.vendorName as string;
    const category = d.jobCategory as string;
    const parts = [category || "Typing", "job"];
    if (name) parts.unshift(`${name}'s`);
    parts.push("has been sent");
    if (vendor) parts.push(`to ${vendor}`);
    return parts.join(" ");
  }

  if (action === "vendor_completed") {
    const category = d.jobCategory as string;
    return name
      ? `${name}'s ${category || "typing"} job has been completed by vendor`
      : `${category || "Typing"} job has been completed by vendor`;
  }

  if (action === "auto_delayed") {
    if (woNum) return `Work Order ${woNum} has been flagged as delayed`;
    return name ? `${name}'s work order has been flagged as delayed` : "Work order flagged as delayed";
  }

  if (action === "delay_resolved") {
    if (woNum) return `Delay on Work Order ${woNum} has been resolved`;
    return "Delay has been resolved";
  }

  if (action.includes("create")) {
    const label = entityType.replace(/_/g, " ");
    if (woNum) return `Work Order ${woNum} has been created`;
    return name ? `${name}'s ${label} has been created` : `A ${label} has been created`;
  }

  const parts: string[] = [];
  if (name) parts.push(name);
  if (woNum) parts.push(`WO ${woNum}`);
  if (d.reason) parts.push(String(d.reason));
  if (d.centerName) parts.push(`at ${d.centerName}`);
  if (d.scheduledDate) parts.push(`on ${d.scheduledDate}`);

  return parts.length > 0 ? parts.join(" · ") : "";
};

const getEntityWoId = (activity: ActivityItem): string | null => {
  if (activity.entityType === "work_order" && activity.entityId) return activity.entityId;
  const d = activity.details as Record<string, unknown> | null;
  if (d?.woId) return String(d.woId);
  if (d?.workOrderId) return String(d.workOrderId);
  return null;
};

export function ActivityTimeline({ activities, className, photoMap }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground text-sm", className)} data-testid="text-no-activity">
        No activity recorded yet
      </div>
    );
  }

  return (
    <div className={cn("divide-y divide-border/40", className)} data-testid="activity-timeline">
      {activities.map((activity) => {
        const Icon = getActionIcon(activity.action, activity.entityType);
        const details = activity.details as Record<string, unknown> | null;
        const title = formatAction(activity.action, activity.entityType, details);
        const description = formatNaturalDescription(activity.action, activity.entityType, details, activity.userName);
        const woId = getEntityWoId(activity);
        const photoUrl = woId && photoMap ? photoMap[woId] : null;
        const applicantName = (details?.applicantName as string) || activity.userName || "";
        const initials = applicantName
          ? applicantName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
          : "";

        return (
          <div key={activity.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" data-testid={`activity-item-${activity.id}`}>
            <Avatar className="h-10 w-10 shrink-0 border border-border/30">
              {photoUrl ? (
                <AvatarImage src={photoUrl} alt={applicantName} />
              ) : null}
              <AvatarFallback className="bg-muted/60 text-muted-foreground text-xs">
                {initials || <Icon className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-snug" data-testid={`text-action-${activity.id}`}>
                {title}
              </p>
              {description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate leading-relaxed" data-testid={`text-description-${activity.id}`}>
                  {description}
                </p>
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 self-start pt-0.5" data-testid={`text-time-${activity.id}`}>
              {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = 
  | "Draft" | "AtVendor" | "ReadyToSchedule" | "Scheduled" | "Completed" | "Cancelled" | "Rescheduled"
  | "SubmittedToVendor" | "InProcess" | "Returned" | "ReadyForScheduling"
  | "OnHold" | "Rejected" | "Aborted"
  | "FollowUpRequired" | "FollowUpScheduled" | "FollowUpCompleted"
  | "New" | "Accepted" | "Closed"
  | "Medical" | "EID"
  | "MedScheduled" | "EIDScheduled" | "BothScheduled";

interface StatusBadgeProps {
  status: StatusType;
  isDelayed?: boolean;
  className?: string;
  vendorContext?: boolean;
}

const SLATE  = "bg-slate-100/80 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300";
const AMBER  = "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
const BLUE   = "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300";
const GREEN  = "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300";
const RED    = "bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-300";

const statusStyles: Record<StatusType, string> = {
  Draft:              SLATE,
  Cancelled:          SLATE,
  Aborted:            SLATE,
  Closed:             SLATE,

  Rescheduled:        AMBER,
  AtVendor:           AMBER,
  SubmittedToVendor:  AMBER,
  OnHold:             AMBER,
  FollowUpRequired:   AMBER,
  InProcess:          AMBER,
  Medical:            AMBER,

  Scheduled:          BLUE,
  ReadyToSchedule:    BLUE,
  ReadyForScheduling: BLUE,
  New:                BLUE,
  EID:                BLUE,
  MedScheduled:       BLUE,
  EIDScheduled:       BLUE,
  BothScheduled:      BLUE,

  Completed:          GREEN,
  FollowUpCompleted:  GREEN,
  FollowUpScheduled:  GREEN,
  Accepted:           GREEN,
  Returned:           GREEN,

  Rejected:           RED,
};

const statusLabels: Record<StatusType, string> = {
  Draft: "Draft",
  AtVendor: "At Vendor",
  ReadyToSchedule: "Ready to Schedule",
  Scheduled: "Scheduled",
  Completed: "Completed",
  Cancelled: "Cancelled",
  Rescheduled: "Rescheduled",
  SubmittedToVendor: "Submitted to Vendor",
  InProcess: "In Process",
  Returned: "Returned",
  ReadyForScheduling: "Ready for Scheduling",
  OnHold: "On Hold",
  Rejected: "Rejected",
  Aborted: "Aborted",
  FollowUpRequired: "Follow-Up Required",
  FollowUpScheduled: "Follow-Up Scheduled",
  FollowUpCompleted: "Follow-Up Completed",
  New: "New",
  Accepted: "Accepted",
  Closed: "Closed",
  Medical: "Medical",
  EID: "Emirates ID",
  MedScheduled: "Med Scheduled",
  EIDScheduled: "EID Scheduled",
  BothScheduled: "Med+EID Scheduled",
};

export function StatusBadge({ status, isDelayed, className, vendorContext }: StatusBadgeProps) {
  const label = vendorContext && status === "ReadyForScheduling" ? "Completed" : statusLabels[status];

  return (
    <span className="inline-flex items-center gap-1">
      <Badge
        variant="secondary"
        className={cn(
          "rounded-full px-2.5 py-0.5 text-[11px] font-medium border-0 tracking-wide",
          statusStyles[status],
          className
        )}
        data-testid={`badge-status-${status.toLowerCase()}`}
      >
        {label}
      </Badge>
      {isDelayed && (
        <Badge
          variant="secondary"
          className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border border-red-300 dark:border-red-600 animate-pulse"
          data-testid="badge-delayed"
        >
          DELAYED
        </Badge>
      )}
    </span>
  );
}

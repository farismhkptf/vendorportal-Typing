import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = 
  | "Draft" | "Scheduled" | "Sent" | "Completed" | "Cancelled" | "Rescheduled"
  | "SentToVendor" | "InProgress" | "Returned" | "ReadyToSchedule"
  | "SentToClient" | "VendorMistake" | "OnHold" | "Rejected"
  | "New" | "Accepted" | "Closed"
  | "Medical" | "EID"
  | "MedScheduled" | "EIDScheduled" | "BothScheduled";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusStyles: Record<StatusType, string> = {
  Draft: "bg-slate-100/80 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
  Scheduled: "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  Sent: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  Completed: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  Cancelled: "bg-gray-100/80 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400",
  Rescheduled: "bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  SentToVendor: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300",
  InProgress: "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  Returned: "bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300",
  ReadyToSchedule: "bg-teal-50 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300",
  SentToClient: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  VendorMistake: "bg-orange-50 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300",
  OnHold: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  Rejected: "bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-300",
  New: "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  Accepted: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  Closed: "bg-gray-100/80 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400",
  Medical: "bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",
  EID: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-300",
  MedScheduled: "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  EIDScheduled: "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  BothScheduled: "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
};

const statusLabels: Record<StatusType, string> = {
  Draft: "Draft",
  Scheduled: "Scheduled",
  Sent: "Sent",
  Completed: "Completed",
  Cancelled: "Cancelled",
  Rescheduled: "Rescheduled",
  SentToVendor: "Sent to Vendor",
  InProgress: "In Progress",
  Returned: "Returned",
  ReadyToSchedule: "Ready to Schedule",
  SentToClient: "Sent to Client",
  VendorMistake: "Vendor Mistake",
  OnHold: "On Hold",
  Rejected: "Rejected",
  New: "New",
  Accepted: "Accepted",
  Closed: "Closed",
  Medical: "Medical",
  EID: "Emirates ID",
  MedScheduled: "Med Scheduled",
  EIDScheduled: "EID Scheduled",
  BothScheduled: "Med+EID Scheduled",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-medium border-0 tracking-wide",
        statusStyles[status],
        className
      )}
      data-testid={`badge-status-${status.toLowerCase()}`}
    >
      {statusLabels[status]}
    </Badge>
  );
}

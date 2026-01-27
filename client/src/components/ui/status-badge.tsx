import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = 
  | "Draft" | "Scheduled" | "Sent" | "Completed" | "Cancelled"
  | "SentToVendor" | "InProgress" | "WaitingForDocs" | "Returned"
  | "SentToClient" | "VendorMistake"
  | "New" | "Accepted" | "Closed"
  | "Medical" | "EID";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusStyles: Record<StatusType, string> = {
  Draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  Sent: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  Completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  Cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  SentToVendor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
  InProgress: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  WaitingForDocs: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  Returned: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  SentToClient: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  VendorMistake: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  New: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  Accepted: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  Closed: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  Medical: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  EID: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
};

const statusLabels: Record<StatusType, string> = {
  Draft: "Draft",
  Scheduled: "Scheduled",
  Sent: "Sent",
  Completed: "Completed",
  Cancelled: "Cancelled",
  SentToVendor: "Sent to Vendor",
  InProgress: "In Progress",
  WaitingForDocs: "Waiting for Docs",
  Returned: "Returned",
  SentToClient: "Sent to Client",
  VendorMistake: "Vendor Mistake",
  New: "New",
  Accepted: "Accepted",
  Closed: "Closed",
  Medical: "Medical",
  EID: "Emirates ID",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium border-0",
        statusStyles[status],
        className
      )}
      data-testid={`badge-status-${status.toLowerCase()}`}
    >
      {statusLabels[status]}
    </Badge>
  );
}

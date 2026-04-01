import { useState } from "react";
import { useLocation } from "wouter";
import {
  ChevronDown,
  ChevronRight,
  Timer,
  Loader2,
  RotateCcw,
  Building2,
  FileText,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

import { toProperCase } from "@/lib/proper-case";
import { cn, getInitials } from "@/lib/utils";

type WoStatusType = "Draft" | "AtVendor" | "ReadyToSchedule" | "Scheduled" | "Completed" | "Cancelled" | "Rescheduled" | "OnHold" | "MedScheduled" | "EIDScheduled" | "BothScheduled";

export interface VendorJobItem {
  id: string;
  woId: string;
  woNumber: string;
  applicantName: string;
  type: "Medical" | "EID";
  urgent?: boolean;
  vendorId: string | null;
  vendorName: string;
  vendorLogoUrl?: string | null;
  status: "unaccepted" | "inProgress" | "returned";
  hoursWaiting?: number;
  hoursElapsed?: number;
  returnedAt?: string | null;
  jobStatus?: string;
}

interface VendorGroup {
  vendorId: string | null;
  vendorName: string;
  vendorLogoUrl?: string | null;
  returned: VendorJobItem[];
  inProgress: VendorJobItem[];
  unaccepted: VendorJobItem[];
}

function VendorJobRow({
  job,
  photoUrl,
}: {
  job: VendorJobItem;
  photoUrl?: string;
}) {
  const [, navigate] = useLocation();

  const statusColor =
    job.status === "returned"
      ? "text-red-600 dark:text-red-400"
      : job.status === "inProgress"
      ? "text-blue-600 dark:text-blue-400"
      : "text-amber-600 dark:text-amber-400";

  const statusLabel =
    job.status === "returned"
      ? job.jobStatus === "Rejected"
        ? "Rejected"
        : "Returned"
      : job.status === "inProgress"
      ? `${job.hoursElapsed ?? 0}h elapsed`
      : `${job.hoursWaiting ?? 0}h waiting`;

  const statusIcon =
    job.status === "returned" ? (
      <RotateCcw className="h-3 w-3" />
    ) : job.status === "inProgress" ? (
      <Loader2 className="h-3 w-3" />
    ) : (
      <Timer className="h-3 w-3" />
    );

  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all hover-elevate"
      onClick={() => navigate(`/typing-jobs/${job.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") navigate(`/typing-jobs/${job.id}`);
      }}
      data-testid={`vendor-job-row-${job.id}`}
    >
      <Avatar className="h-6 w-6 shrink-0">
        {photoUrl && <AvatarImage src={photoUrl} alt={job.applicantName} />}
        <AvatarFallback className="text-[9px] font-medium">
          {getInitials(job.applicantName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {job.woNumber}
          </span>
          {job.urgent && (
            <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full">
              URGENT
            </span>
          )}
          {job.status === "returned" && (
            <Badge
              variant="destructive"
              className="text-[10px] px-1.5 py-0 rounded-full h-4"
            >
              {job.jobStatus === "Rejected" ? "Rejected" : "Returned"}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {toProperCase(job.applicantName)}
        </p>
      </div>
      <div
        className={cn("flex items-center gap-1 text-[11px] font-medium shrink-0", statusColor)}
        data-testid={`vendor-job-status-${job.id}`}
      >
        {statusIcon}
        <span>{statusLabel}</span>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
    </div>
  );
}

function VendorSection({
  group,
  photoMap,
  defaultOpen,
}: {
  group: VendorGroup;
  photoMap?: Record<string, string>;
  defaultOpen?: boolean;
}) {
  const totalCount =
    group.returned.length + group.inProgress.length + group.unaccepted.length;
  const [open, setOpen] = useState(defaultOpen ?? true);
  const hasReturned = group.returned.length > 0;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/40 overflow-hidden",
        hasReturned && "border-red-200/60 dark:border-red-800/30"
      )}
      data-testid={`vendor-section-${group.vendorId ?? "unassigned"}`}
    >
      <button
        className={cn(
          "flex items-center justify-between gap-3 w-full px-4 py-3 text-left transition-colors",
          hasReturned
            ? "bg-red-50/60 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30"
            : "bg-muted/30 hover:bg-muted/50"
        )}
        onClick={() => setOpen(!open)}
        data-testid={`vendor-section-toggle-${group.vendorId ?? "unassigned"}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {group.vendorLogoUrl ? (
            <img
              src={group.vendorLogoUrl}
              alt={group.vendorName}
              className="h-6 w-6 rounded object-contain shrink-0"
              data-testid={`vendor-logo-${group.vendorId}`}
            />
          ) : (
            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-3.5 w-3.5 text-primary" />
            </div>
          )}
          <span className="text-sm font-semibold text-foreground truncate">
            {group.vendorName}
          </span>
          {hasReturned && (
            <Badge
              variant="destructive"
              className="text-[10px] px-1.5 py-0 rounded-full h-4 shrink-0"
            >
              {group.returned.length} returned
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full tabular-nums">
            {totalCount} job{totalCount !== 1 ? "s" : ""}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      {open && (
        <div className="divide-y divide-border/20 bg-background/50">
          {group.returned.map((job) => (
            <VendorJobRow
              key={job.id}
              job={job}
              photoUrl={photoMap?.[job.woId]}
            />
          ))}
          {group.inProgress.map((job) => (
            <VendorJobRow
              key={job.id}
              job={job}
              photoUrl={photoMap?.[job.woId]}
            />
          ))}
          {group.unaccepted.map((job) => (
            <VendorJobRow
              key={job.id}
              job={job}
              photoUrl={photoMap?.[job.woId]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function VendorGroupedJobsView({
  jobs,
  photoMap,
}: {
  jobs: VendorJobItem[];
  photoMap?: Record<string, string>;
}) {
  const groupMap = new Map<string, VendorGroup>();

  for (const job of jobs) {
    const key = job.vendorId ?? "__unassigned__";
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        vendorId: job.vendorId,
        vendorName: job.vendorName,
        vendorLogoUrl: job.vendorLogoUrl,
        returned: [],
        inProgress: [],
        unaccepted: [],
      });
    }
    const group = groupMap.get(key)!;
    if (job.status === "returned") group.returned.push(job);
    else if (job.status === "inProgress") group.inProgress.push(job);
    else group.unaccepted.push(job);
  }

  Array.from(groupMap.values()).forEach((group) => {
    group.returned.sort((a: VendorJobItem, b: VendorJobItem) => {
      const aTime = a.returnedAt ? new Date(a.returnedAt).getTime() : 0;
      const bTime = b.returnedAt ? new Date(b.returnedAt).getTime() : 0;
      return aTime - bTime;
    });
    group.inProgress.sort((a: VendorJobItem, b: VendorJobItem) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return (b.hoursElapsed ?? 0) - (a.hoursElapsed ?? 0);
    });
    group.unaccepted.sort((a: VendorJobItem, b: VendorJobItem) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return (b.hoursWaiting ?? 0) - (a.hoursWaiting ?? 0);
    });
  });

  const groups = Array.from(groupMap.values()).sort((a, b) => {
    const aScore = a.returned.length > 0 ? 0 : a.inProgress.length > 0 ? 1 : 2;
    const bScore = b.returned.length > 0 ? 0 : b.inProgress.length > 0 ? 1 : 2;
    if (aScore !== bScore) return aScore - bScore;
    const aTotal = a.returned.length + a.inProgress.length + a.unaccepted.length;
    const bTotal = b.returned.length + b.inProgress.length + b.unaccepted.length;
    return bTotal - aTotal;
  });

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="h-6 w-6" />}
        title="No active jobs"
        description="All typing jobs have been processed."
      />
    );
  }

  return (
    <div className="space-y-2" data-testid="vendor-grouped-jobs-view">
      {groups.map((group, i) => (
        <VendorSection
          key={group.vendorId ?? "__unassigned__"}
          group={group}
          photoMap={photoMap}
          defaultOpen={i === 0 || group.returned.length > 0}
        />
      ))}
    </div>
  );
}

// ─── Work Orders grouped by vendor ──────────────────────────────────────────

export interface VendorWorkOrderItem {
  id: string;
  woNumber: string;
  applicantName: string;
  status: WoStatusType;
  companyName?: string;
  hasIssue: boolean;
  vendorId: string | null;
  vendorName: string;
  vendorLogoUrl?: string | null;
}

interface VendorWoGroup {
  vendorId: string | null;
  vendorName: string;
  vendorLogoUrl?: string | null;
  hasIssue: boolean;
  workOrders: VendorWorkOrderItem[];
}

function VendorWoSection({
  group,
  defaultOpen,
}: {
  group: VendorWoGroup;
  defaultOpen?: boolean;
}) {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(defaultOpen ?? true);

  return (
    <div
      className={cn(
        "rounded-xl border border-border/40 overflow-hidden",
        group.hasIssue && "border-red-200/60 dark:border-red-800/30"
      )}
      data-testid={`vendor-wo-section-${group.vendorId ?? "unassigned"}`}
    >
      <button
        className={cn(
          "flex items-center justify-between gap-3 w-full px-4 py-3 text-left transition-colors",
          group.hasIssue
            ? "bg-red-50/60 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30"
            : "bg-muted/30 hover:bg-muted/50"
        )}
        onClick={() => setOpen(!open)}
        data-testid={`vendor-wo-toggle-${group.vendorId ?? "unassigned"}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {group.vendorLogoUrl ? (
            <img
              src={group.vendorLogoUrl}
              alt={group.vendorName}
              className="h-6 w-6 rounded object-contain shrink-0"
              data-testid={`vendor-wo-logo-${group.vendorId}`}
            />
          ) : (
            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-3.5 w-3.5 text-primary" />
            </div>
          )}
          <span className="text-sm font-semibold text-foreground truncate">
            {group.vendorName}
          </span>
          {group.hasIssue && (
            <Badge
              variant="destructive"
              className="text-[10px] px-1.5 py-0 rounded-full h-4 shrink-0"
            >
              Action needed
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full tabular-nums">
            {group.workOrders.length} WO{group.workOrders.length !== 1 ? "s" : ""}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      {open && (
        <div className="divide-y divide-border/20 bg-background/50">
          {group.workOrders.map((wo) => (
            <div
              key={wo.id}
              className="flex items-center gap-3 p-3 cursor-pointer transition-all hover:bg-muted/30"
              onClick={() => navigate(`/work-orders/${wo.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") navigate(`/work-orders/${wo.id}`);
              }}
              data-testid={`vendor-wo-row-${wo.id}`}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground text-sm" data-testid={`text-vendor-wo-number-${wo.id}`}>
                    {wo.woNumber}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{wo.status}</span>
                  {wo.hasIssue && (
                    <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full">
                      Action needed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate" data-testid={`text-vendor-wo-applicant-${wo.id}`}>
                    {toProperCase(wo.applicantName)}
                  </span>
                  {wo.companyName && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="truncate max-w-[110px]">{toProperCase(wo.companyName)}</span>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function VendorGroupedWorkOrdersView({
  workOrders,
}: {
  workOrders: VendorWorkOrderItem[];
}) {
  const groupMap = new Map<string, VendorWoGroup>();

  for (const wo of workOrders) {
    const key = wo.vendorId ?? "__unassigned__";
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        vendorId: wo.vendorId,
        vendorName: wo.vendorName,
        vendorLogoUrl: wo.vendorLogoUrl,
        hasIssue: false,
        workOrders: [],
      });
    }
    const group = groupMap.get(key)!;
    if (wo.hasIssue) group.hasIssue = true;
    group.workOrders.push(wo);
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => {
    if (a.hasIssue !== b.hasIssue) return a.hasIssue ? -1 : 1;
    return b.workOrders.length - a.workOrders.length;
  });

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-6 w-6" />}
        title="No active work orders"
        description="No work orders in the pipeline right now."
      />
    );
  }

  return (
    <div className="space-y-2" data-testid="vendor-grouped-wo-view">
      {groups.map((group, i) => (
        <VendorWoSection
          key={group.vendorId ?? "__unassigned__"}
          group={group}
          defaultOpen={i === 0 || group.hasIssue}
        />
      ))}
    </div>
  );
}

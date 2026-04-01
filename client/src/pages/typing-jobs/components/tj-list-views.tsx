import { useCallback } from "react";
import { Link, useLocation } from "wouter";
import { FileText, ExternalLink, Copy, MoreHorizontal } from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusBadge } from "@/components/ui/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHeader } from "@/components/ui/sortable-header";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toProperCase } from "@/lib/proper-case";
import type { SortState } from "@/hooks/use-data-table";
import { AppointmentIndicator, type TypingJobWithRelations } from "./tj-appointment-indicator";
import { useToast } from "@/hooks/use-toast";

const STATUS_ORDER = ["Draft", "SubmittedToVendor", "InProcess", "ReadyForScheduling", "Returned", "OnHold", "Rejected", "Aborted"] as const;

interface ViewProps {
  items: TypingJobWithRelations[];
  density: "compact" | "comfortable";
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  getAppointmentStatus: (job: TypingJobWithRelations) => { status: "none" | "completed" | "cancelled" | "rescheduled" | "scheduled"; appointment: any } | null;
}

function useTjContextMenu() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const handleCopyJobCode = useCallback((jobCode: string | null) => {
    if (!jobCode) return;
    navigator.clipboard.writeText(jobCode);
    toast({ title: "Copied", description: `${jobCode} copied to clipboard.` });
  }, [toast]);

  const renderTjContextMenu = useCallback((job: TypingJobWithRelations, children: React.ReactNode) => (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => navigate(`/typing-jobs/${job.id}`)}
          data-testid={`ctx-tj-open-${job.id}`}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!job.jobCode}
          onClick={() => handleCopyJobCode(job.jobCode)}
          data-testid={`ctx-tj-copy-${job.id}`}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy Job Code
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={!job.workOrder?.id}
          onClick={() => job.workOrder?.id && navigate(`/work-orders/${job.workOrder.id}`)}
          data-testid={`ctx-tj-view-wo-${job.id}`}
        >
          <FileText className="h-4 w-4 mr-2" />
          View WO
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ), [navigate, handleCopyJobCode]);

  return { renderTjContextMenu, handleCopyJobCode };
}

export function CompactListView({ items, density, selectedIds, toggleSelected, getAppointmentStatus }: ViewProps) {
  const [, navigate] = useLocation();
  const { renderTjContextMenu, handleCopyJobCode } = useTjContextMenu();

  return (
    <div className="space-y-1 stagger-children">
      {items.map((job, index) => {
        const isSelected = selectedIds.has(job.id);
        const compactMobileMenu = (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 lg:hidden shrink-0"
                data-testid={`button-mobile-actions-tj-compact-${job.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => navigate(`/typing-jobs/${job.id}`)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!job.jobCode} onClick={() => handleCopyJobCode(job.jobCode)}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Job Code
              </DropdownMenuItem>
              {job.workOrder?.id && (
                <DropdownMenuItem onClick={() => navigate(`/work-orders/${job.workOrder!.id}`)}>
                  <FileText className="h-4 w-4 mr-2" />
                  View Work Order
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
        return (
          <div key={job.id} className="flex items-center gap-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleSelected(job.id)}
              aria-label={`Select ${job.jobCode || job.id}`}
              data-testid={`checkbox-tj-compact-${job.id}`}
              className="hidden lg:flex"
            />
            {renderTjContextMenu(job,
            <Link href={`/typing-jobs/${job.id}`} className="flex-1 min-w-0">
              <div 
                className={`flex items-center justify-between gap-3 ${density === "comfortable" ? "py-2 px-3" : "py-1.5 px-2"} rounded-lg hover-elevate opacity-0 animate-fade-in`}
                style={{ animationDelay: `${index * 0.02}s` }}
                data-testid={`typing-job-compact-${job.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs text-foreground">{job.jobCode || "-"}</span>
                  <span className="font-mono text-sm font-medium text-foreground">{job.workOrder?.woNumber || "N/A"}</span>
                  <span className="text-sm text-muted-foreground truncate">{job.workOrder?.applicantName ? toProperCase(job.workOrder.applicantName) : ""}</span>
                  {job.jobType && (
                    <span className="text-xs text-muted-foreground/70 hidden sm:inline">{job.jobType.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={job.status} />
                  <AppointmentIndicator job={job} compact getAppointmentStatus={getAppointmentStatus} />
                  {job.costSnapshot && (
                    <span className="text-xs font-medium text-foreground">AED {job.costSnapshot}</span>
                  )}
                </div>
              </div>
            </Link>
            )}
            {compactMobileMenu}
          </div>
        );
      })}
    </div>
  );
}

export function CardsView({ items, density, getAppointmentStatus }: Omit<ViewProps, "selectedIds" | "toggleSelected">) {
  const [, navigate] = useLocation();
  const { renderTjContextMenu, handleCopyJobCode } = useTjContextMenu();

  return (
    <div className="space-y-2 stagger-children">
      {items.map((job, index) => {
        const cardMobileMenu = (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 lg:hidden shrink-0"
                data-testid={`button-mobile-actions-tj-card-${job.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => navigate(`/typing-jobs/${job.id}`)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!job.jobCode} onClick={() => handleCopyJobCode(job.jobCode)}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Job Code
              </DropdownMenuItem>
              {job.workOrder?.id && (
                <DropdownMenuItem onClick={() => navigate(`/work-orders/${job.workOrder!.id}`)}>
                  <FileText className="h-4 w-4 mr-2" />
                  View Work Order
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
        return (
          <div key={job.id} className="flex items-start gap-2">
          {renderTjContextMenu(job,
          <Link href={`/typing-jobs/${job.id}`} className="flex-1 min-w-0">
            <div 
              className={`premium-card ${density === "comfortable" ? "p-4" : "p-2.5"} opacity-0 animate-fade-in`}
              style={{ animationDelay: `${index * 0.03}s` }}
              data-testid={`typing-job-card-${job.id}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="icon-container icon-container-sm shrink-0 !bg-blue-100 dark:!bg-blue-900/30 !text-blue-600 dark:!text-blue-400">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-foreground">{job.jobCode || "-"}</span>
                      <span className="font-semibold text-sm text-foreground">{job.workOrder?.woNumber || "N/A"}</span>
                      <StatusBadge status={job.status} />
                      <AppointmentIndicator job={job} getAppointmentStatus={getAppointmentStatus} />
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{job.workOrder?.applicantName ? toProperCase(job.workOrder.applicantName) : ""}</p>
                    {job.jobType && (
                      <span className="text-xs text-muted-foreground">{job.jobType.name}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {job.costSnapshot && (
                    <p className="font-medium text-sm text-foreground">AED {job.costSnapshot}</p>
                  )}
                  <RelativeTime date={job.createdAt} className="text-xs" id={job.id} />
                </div>
              </div>
            </div>
          </Link>
          )}
          <div className="pt-3 lg:hidden shrink-0">
            {cardMobileMenu}
          </div>
          </div>
        );
      })}
    </div>
  );
}

interface TableViewProps extends ViewProps {
  columnSort: SortState;
  toggleColumnSort: (key: string) => void;
  isColumnVisible: (id: string) => boolean;
  isAllSelected: boolean;
  isPartiallySelected: boolean;
  toggleSelectAll: () => void;
}

export function TableView({ items, density, selectedIds, toggleSelected, getAppointmentStatus, columnSort, toggleColumnSort, isColumnVisible: cv, isAllSelected, isPartiallySelected, toggleSelectAll }: TableViewProps) {
  const [, navigate] = useLocation();

  return (
    <div className="premium-card overflow-hidden">
      <Table>
        <TableHeader className="sticky top-0 z-[9999] bg-background">
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={() => toggleSelectAll()}
                aria-label="Select all"
                data-testid="checkbox-select-all"
                {...(isPartiallySelected ? { "data-state": "indeterminate" } : {})}
              />
            </TableHead>
            {cv("jobCode") && <SortableHeader sortKey="jobCode" sort={columnSort} onToggle={toggleColumnSort} className="w-24">Job Code</SortableHeader>}
            {cv("woNumber") && <SortableHeader sortKey="woNumber" sort={columnSort} onToggle={toggleColumnSort} className="w-28">Work Order #</SortableHeader>}
            {cv("applicant") && <SortableHeader sortKey="applicant" sort={columnSort} onToggle={toggleColumnSort}>Applicant</SortableHeader>}
            {cv("jobType") && <TableHead className="hidden sm:table-cell">Job Type</TableHead>}
            {cv("status") && <SortableHeader sortKey="status" sort={columnSort} onToggle={toggleColumnSort} className="w-32">Status</SortableHeader>}
            {cv("appointment") && <TableHead className="w-36">Appointment</TableHead>}
            {cv("cost") && <SortableHeader sortKey="cost" sort={columnSort} onToggle={toggleColumnSort} className="w-24 text-right">Cost</SortableHeader>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((job) => {
            const isSelected = selectedIds.has(job.id);
            const cellPadding = density === "compact" ? "py-1.5" : "";
            return (
              <ContextMenu key={job.id}>
                <ContextMenuTrigger asChild>
                  <TableRow 
                    className={`cursor-pointer hover-elevate ${isSelected ? "bg-primary/5" : ""}`}
                    data-state={isSelected ? "selected" : undefined}
                    data-testid={`typing-job-table-${job.id}`}
                  >
                    <TableCell className={cellPadding}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelected(job.id)}
                        aria-label={`Select ${job.jobCode || job.id}`}
                        data-testid={`checkbox-tj-table-${job.id}`}
                      />
                    </TableCell>
                    {cv("jobCode") && <TableCell className={cellPadding} onClick={() => navigate(`/typing-jobs/${job.id}`)}>
                      <span className="font-mono text-xs text-foreground">{job.jobCode || "-"}</span>
                    </TableCell>}
                    {cv("woNumber") && <TableCell className={cellPadding} onClick={() => navigate(`/typing-jobs/${job.id}`)}>
                      <span className="font-mono font-medium text-foreground">{job.workOrder?.woNumber || "N/A"}</span>
                    </TableCell>}
                    {cv("applicant") && <TableCell className={`${cellPadding} max-w-[200px]`} onClick={() => navigate(`/typing-jobs/${job.id}`)}><span className="block truncate">{job.workOrder?.applicantName ? toProperCase(job.workOrder.applicantName) : "-"}</span></TableCell>}
                    {cv("jobType") && <TableCell className={`hidden sm:table-cell text-muted-foreground ${cellPadding}`} onClick={() => navigate(`/typing-jobs/${job.id}`)}>
                      {job.jobType?.name || "-"}
                    </TableCell>}
                    {cv("status") && <TableCell className={cellPadding} onClick={() => navigate(`/typing-jobs/${job.id}`)}>
                      <StatusBadge status={job.status} />
                    </TableCell>}
                    {cv("appointment") && <TableCell className={cellPadding} onClick={() => navigate(`/typing-jobs/${job.id}`)}>
                      <AppointmentIndicator job={job} getAppointmentStatus={getAppointmentStatus} />
                    </TableCell>}
                    {cv("cost") && <TableCell className={`text-right font-medium ${cellPadding}`} onClick={() => navigate(`/typing-jobs/${job.id}`)}>
                      {job.costSnapshot ? `AED ${job.costSnapshot}` : "-"}
                    </TableCell>}
                  </TableRow>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => navigate(`/typing-jobs/${job.id}`)} data-testid={`ctx-tj-table-open-${job.id}`}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </ContextMenuItem>
                  <ContextMenuItem disabled={!job.jobCode} onClick={() => {
                    if (job.jobCode) {
                      navigator.clipboard.writeText(job.jobCode);
                    }
                  }} data-testid={`ctx-tj-table-copy-${job.id}`}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Job Code
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem disabled={!job.workOrder?.id} onClick={() => job.workOrder?.id && navigate(`/work-orders/${job.workOrder.id}`)} data-testid={`ctx-tj-table-view-wo-${job.id}`}>
                    <FileText className="h-4 w-4 mr-2" />
                    View WO
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

interface KanbanViewProps {
  kanbanGroups: Record<string, TypingJobWithRelations[]> | null;
  getAppointmentStatus: ViewProps["getAppointmentStatus"];
}

export function KanbanView({ kanbanGroups, getAppointmentStatus }: KanbanViewProps) {
  const { renderTjContextMenu } = useTjContextMenu();

  if (!kanbanGroups) return null;
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STATUS_ORDER.map((status) => (
        <div key={status} className="flex-shrink-0 w-64">
          <div className="flex items-center justify-between gap-2 mb-3 px-1">
            <div className="flex items-center gap-2">
              <StatusBadge status={status} />
              <span className="text-xs text-muted-foreground">({kanbanGroups[status]?.length || 0})</span>
            </div>
          </div>
          <div className="space-y-2 min-h-[200px] p-2 rounded-xl bg-muted/30">
            {kanbanGroups[status]?.map((job, index) => (
              <div key={job.id}>
              {renderTjContextMenu(job,
              <Link href={`/typing-jobs/${job.id}`}>
                <div 
                  className="premium-card p-3 opacity-0 animate-fade-in"
                  style={{ animationDelay: `${index * 0.03}s` }}
                  data-testid={`typing-job-kanban-${job.id}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-foreground">{job.jobCode || "-"}</span>
                    <span className="font-mono text-sm font-medium text-foreground">{job.workOrder?.woNumber || "N/A"}</span>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">{job.workOrder?.applicantName ? toProperCase(job.workOrder.applicantName) : ""}</div>
                  {job.jobType && (
                    <div className="text-xs text-muted-foreground mt-1">{job.jobType.name}</div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <AppointmentIndicator job={job} getAppointmentStatus={getAppointmentStatus} />
                    {job.costSnapshot && (
                      <span className="text-xs font-medium text-foreground">AED {job.costSnapshot}</span>
                    )}
                  </div>
                </div>
              </Link>
              )}
              </div>
            ))}
            {(!kanbanGroups[status] || kanbanGroups[status].length === 0) && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No items
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

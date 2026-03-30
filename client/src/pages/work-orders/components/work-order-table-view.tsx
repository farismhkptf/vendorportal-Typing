import { useLocation } from "wouter";
import { Star, AlertTriangle, ArrowUpDown, ExternalLink, Copy, StarOff } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHeader } from "@/components/ui/sortable-header";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { toProperCase } from "@/lib/proper-case";
import { getInitials } from "@/lib/utils";
import {
  needsAttention,
  getDaysOld, getPipelineInfo, getNextAction,
} from "@/lib/pipeline-stage";
import { TrackStatusIconsFromState } from "@/components/track-status-icons";
import { NextActionIndicator } from "./status-pills";
import type { WorkOrderEnriched } from "./types";
import type { SortState } from "@/hooks/use-data-table";

interface WorkOrderTableViewProps {
  items: WorkOrderEnriched[];
  photoMap?: Record<string, string>;
  density: "compact" | "comfortable";
  selectedIds: Set<string>;
  isAllSelected: boolean;
  isPartiallySelected: boolean;
  toggleSelected: (id: string) => void;
  toggleSelectAll: () => void;
  columnSort: SortState;
  toggleColumnSort: (key: string) => void;
  isColumnVisible: (id: string) => boolean;
  navigate: (path: string) => void;
  handleCopyWoNumber: (woNumber: string) => void;
  singleStatusMutate: (args: { id: string; status: string }) => void;
  toggleVipMutate: (args: { id: string; isVip: boolean }) => void;
}

export function WorkOrderTableView({
  items, photoMap, density, selectedIds, isAllSelected, isPartiallySelected,
  toggleSelected, toggleSelectAll, columnSort, toggleColumnSort, isColumnVisible: cv,
  navigate, handleCopyWoNumber, singleStatusMutate, toggleVipMutate,
}: WorkOrderTableViewProps) {
  const cellPadding = density === "compact" ? "py-1.5" : "";

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
            {cv("woNumber") && <SortableHeader sortKey="woNumber" sort={columnSort} onToggle={toggleColumnSort} className="w-28">WO #</SortableHeader>}
            {cv("applicant") && <SortableHeader sortKey="applicant" sort={columnSort} onToggle={toggleColumnSort}>Applicant</SortableHeader>}
            {cv("company") && <SortableHeader sortKey="company" sort={columnSort} onToggle={toggleColumnSort} className="hidden sm:table-cell">Company</SortableHeader>}
            {cv("service") && <TableHead className="hidden lg:table-cell">Service</TableHead>}
            {cv("pipeline") && <TableHead className="w-24">Tracks</TableHead>}
            {cv("status") && <SortableHeader sortKey="status" sort={columnSort} onToggle={toggleColumnSort} className="w-20">Status</SortableHeader>}
            {cv("age") && <SortableHeader sortKey="age" sort={columnSort} onToggle={toggleColumnSort} className="w-16 text-right">Age</SortableHeader>}
            {cv("nextAction") && <TableHead className="hidden lg:table-cell w-48">Next Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((wo) => {
            const daysOld = getDaysOld(wo.createdAt);
            const attention = needsAttention(wo);
            const isSelected = selectedIds.has(wo.id);
            const pipeline = getPipelineInfo(wo.typingJobs || [], wo.appointments || [], wo.serviceType, wo.isMinor);
            const nextAction = getNextAction(wo.typingJobs || [], wo.appointments || [], pipeline);
            return (
              <ContextMenu key={wo.id}>
                <ContextMenuTrigger asChild>
                  <TableRow 
                    className={`cursor-pointer hover-elevate ${isSelected ? "bg-primary/5" : ""}`}
                    data-state={isSelected ? "selected" : undefined}
                    data-testid={`work-order-table-${wo.woNumber}`}
                  >
                    <TableCell className={cellPadding}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelected(wo.id)}
                        aria-label={`Select ${wo.woNumber}`}
                        data-testid={`checkbox-wo-table-${wo.woNumber}`}
                      />
                    </TableCell>
                    {cv("woNumber") && <TableCell className={cellPadding} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-medium text-primary">{wo.woNumber}</span>
                        {wo.isVip && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                        {attention && <AlertTriangle className="h-3 w-3 text-red-500" />}
                      </div>
                    </TableCell>}
                    {cv("applicant") && <TableCell className={`${cellPadding} max-w-[200px]`} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 shrink-0" data-testid={`avatar-wo-table-${wo.woNumber}`}>
                          {photoMap?.[wo.id] ? (
                            <AvatarImage src={photoMap[wo.id]} alt={wo.applicantName} />
                          ) : null}
                          <AvatarFallback className="text-[9px] font-medium">{getInitials(wo.applicantName)}</AvatarFallback>
                        </Avatar>
                        <span className="block truncate">{toProperCase(wo.applicantName)}</span>
                      </div>
                    </TableCell>}
                    {cv("company") && <TableCell className={`hidden sm:table-cell text-muted-foreground text-xs ${cellPadding}`} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                      {wo.company?.name ? toProperCase(wo.company.name) : "-"}
                    </TableCell>}
                    {cv("service") && <TableCell className={`hidden lg:table-cell text-muted-foreground text-xs ${cellPadding}`} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                      {wo.serviceType?.name || "-"}
                    </TableCell>}
                    {cv("pipeline") && <TableCell className={cellPadding} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                      {pipeline.fourTrack && <TrackStatusIconsFromState tracks={pipeline.fourTrack} />}
                    </TableCell>}
                    {cv("status") && <TableCell className={cellPadding} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                      <span className="text-[10px] text-muted-foreground">{wo.status}</span>
                    </TableCell>}
                    {cv("age") && <TableCell className={`text-right text-xs text-muted-foreground ${cellPadding}`} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                      {daysOld === 0 ? "Today" : `${daysOld}d`}
                    </TableCell>}
                    {cv("nextAction") && <TableCell className={`hidden lg:table-cell ${cellPadding}`} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                      <NextActionIndicator message={nextAction.message} variant={nextAction.variant} />
                    </TableCell>}
                  </TableRow>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => navigate(`/work-orders/${wo.id}`)} data-testid={`ctx-table-open-${wo.woNumber}`}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleCopyWoNumber(wo.woNumber)} data-testid={`ctx-table-copy-wo-${wo.woNumber}`}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy WO#
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuSub>
                    <ContextMenuSubTrigger data-testid={`ctx-table-change-status-${wo.woNumber}`}>
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      Change Status
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                      {[
                        { key: "Draft", label: "Draft" },
                        { key: "AtVendor", label: "At Vendor" },
                        { key: "ReadyToSchedule", label: "Ready to Schedule" },
                        { key: "Scheduled", label: "Scheduled" },
                        { key: "Completed", label: "Completed" },
                        { key: "Cancelled", label: "Cancelled" },
                      ].map(({ key, label }) => (
                        <ContextMenuItem
                          key={key}
                          disabled={wo.status === key}
                          onClick={() => singleStatusMutate({ id: wo.id, status: key })}
                          data-testid={`ctx-table-status-${key.toLowerCase()}-${wo.woNumber}`}
                        >
                          {label}
                        </ContextMenuItem>
                      ))}
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => toggleVipMutate({ id: wo.id, isVip: !wo.isVip })} data-testid={`ctx-table-vip-${wo.woNumber}`}>
                    {wo.isVip ? <><StarOff className="h-4 w-4 mr-2" />Unmark VIP</> : <><Star className="h-4 w-4 mr-2" />Mark VIP</>}
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

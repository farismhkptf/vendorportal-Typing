import { useCallback } from "react";
import { useLocation } from "wouter";
import {
  FileText, Filter, ArrowUpDown, List, LayoutGrid, Columns3, Table2, Star,
  AlertTriangle, CheckCircle2, CircleDot, CalendarCheck, Send as SendIcon,
  Loader2, Download, Circle, ExternalLink, Copy, StarOff, MoreHorizontal,
} from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { STAGE_CONFIG, type PipelineStage } from "@/lib/pipeline-stage";
import type { WorkOrderEnriched, ViewMode, SortByOption, SpecialFilter } from "./types";
import { STATUS_ORDER } from "./use-work-orders-data";

interface StatTilesProps {
  stats: { awaitingTyping: number; needScheduling: number; attentionNeeded: number; totalActive: number; vipCount: number } | null;
  specialFilter: SpecialFilter;
  setSpecialFilter: (f: SpecialFilter) => void;
}

export function StatTiles({ stats, specialFilter, setSpecialFilter }: StatTilesProps) {
  if (!stats) return null;
  const tiles = [
    { label: "Active", value: stats.totalActive, icon: FileText, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30", filter: "all" as SpecialFilter },
    { label: "Needs Action", value: stats.attentionNeeded, icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/30", filter: "needs_attention" as SpecialFilter },
    { label: "Awaiting Typing", value: stats.awaitingTyping, icon: SendIcon, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", filter: "awaiting_typing" as SpecialFilter },
    { label: "Need Scheduling", value: stats.needScheduling, icon: CalendarCheck, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/30", filter: "need_scheduling" as SpecialFilter },
    { label: "VIP Cases", value: stats.vipCount, icon: Star, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-900/30", filter: "vip" as SpecialFilter },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {tiles.map((tile) => (
        <Card key={tile.label} className={`p-3 cursor-pointer hover-elevate border border-border/50 ${specialFilter === tile.filter && tile.filter !== "all" ? "ring-2 ring-primary/30" : ""}`} onClick={() => { if (tile.filter === "all") setSpecialFilter("all"); else setSpecialFilter(specialFilter === tile.filter ? "all" : tile.filter); }} data-testid={`stat-tile-${tile.label.toLowerCase().replace(/\s/g, "-")}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${tile.bg}`}><tile.icon className={`h-4 w-4 ${tile.color}`} /></div>
            <div>
              <p className="text-xl lg:text-2xl font-bold text-foreground leading-none tabular-nums">{tile.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{tile.label}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

interface PipelineButtonsProps {
  pipelineCounts: Record<PipelineStage | "all", number> | null;
  pipelineFilter: PipelineStage | "all";
  setPipelineFilter: (f: PipelineStage | "all") => void;
}

export function PipelineButtons({ pipelineCounts, pipelineFilter, setPipelineFilter }: PipelineButtonsProps) {
  if (!pipelineCounts) return null;
  const stages: { key: PipelineStage | "all"; label: string; icon: typeof Circle; color: string; bgColor: string }[] = [
    { key: "all", label: "All", icon: FileText, color: "text-foreground", bgColor: "bg-muted" },
    { key: "new", label: "New", icon: Circle, color: STAGE_CONFIG.new.color, bgColor: STAGE_CONFIG.new.bgColor },
    { key: "at_vendor", label: "At Vendor", icon: SendIcon, color: STAGE_CONFIG.at_vendor.color, bgColor: STAGE_CONFIG.at_vendor.bgColor },
    { key: "ready_to_schedule", label: "Ready to Schedule", icon: CalendarCheck, color: STAGE_CONFIG.ready_to_schedule.color, bgColor: STAGE_CONFIG.ready_to_schedule.bgColor },
    { key: "scheduled", label: "Scheduled", icon: CheckCircle2, color: STAGE_CONFIG.scheduled.color, bgColor: STAGE_CONFIG.scheduled.bgColor },
    { key: "complete", label: "Complete", icon: CheckCircle2, color: STAGE_CONFIG.complete.color, bgColor: STAGE_CONFIG.complete.bgColor },
    { key: "needs_attention", label: "Attention", icon: AlertTriangle, color: STAGE_CONFIG.needs_attention.color, bgColor: STAGE_CONFIG.needs_attention.bgColor },
  ];
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1" data-testid="pipeline-filter-buttons">
      {stages.map((s) => {
        const count = pipelineCounts[s.key];
        const isActive = pipelineFilter === s.key;
        return (
          <Button key={s.key} variant={isActive ? "secondary" : "ghost"} size="sm" className={`gap-1.5 shrink-0 ${isActive ? "ring-1 ring-primary/20" : ""}`} onClick={() => setPipelineFilter(isActive ? "all" : s.key)} data-testid={`button-pipeline-${s.key}`}>
            <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
            <span>{s.label}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? s.bgColor : "bg-muted"}`}>{count}</span>
          </Button>
        );
      })}
    </div>
  );
}

interface FilterControlsProps {
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  specialFilter: SpecialFilter;
  setSpecialFilter: (v: SpecialFilter) => void;
  dateRangeFilter: string;
  setDateRangeFilter: (v: string) => void;
  sortBy: SortByOption;
  setSortBy: (v: SortByOption) => void;
}

export function FilterControls({ statusFilter, setStatusFilter, specialFilter, setSpecialFilter, dateRangeFilter, setDateRangeFilter, sortBy, setSortBy }: FilterControlsProps) {
  return (
    <>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-32 h-9 rounded-lg" data-testid="select-status-filter"><Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /><SelectValue placeholder="All Status" /></SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="Draft">Draft</SelectItem><SelectItem value="AtVendor">At Vendor</SelectItem>
          <SelectItem value="ReadyToSchedule">Ready to Schedule</SelectItem><SelectItem value="Scheduled">Scheduled</SelectItem>
          <SelectItem value="Completed">Completed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>
      <Select value={specialFilter} onValueChange={(v) => setSpecialFilter(v as SpecialFilter)}>
        <SelectTrigger className="w-44 h-9 rounded-lg" data-testid="select-special-filter"><CircleDot className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /><SelectValue placeholder="Quick Filter" /></SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="all">All Work Orders</SelectItem><SelectItem value="needs_attention">Needs Attention</SelectItem>
          <SelectItem value="awaiting_typing">Awaiting Typing</SelectItem><SelectItem value="need_scheduling">Need Scheduling</SelectItem>
          <SelectItem value="vip">VIP Cases</SelectItem><SelectItem value="med_not_scheduled">Medical Not Scheduled</SelectItem>
          <SelectItem value="eid_not_scheduled">EID Not Scheduled</SelectItem><SelectItem value="med_typing_pending">Medical Typing Pending</SelectItem>
          <SelectItem value="eid_typing_pending">EID Typing Pending</SelectItem><SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>
      <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
        <SelectTrigger className="w-36 h-9 rounded-lg" data-testid="select-date-range-filter"><SelectValue placeholder="Date Range" /></SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="all">All Dates</SelectItem><SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">This Week</SelectItem><SelectItem value="month">This Month</SelectItem>
          <SelectItem value="last_month">Last Month</SelectItem>
        </SelectContent>
      </Select>
      <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortByOption)}>
        <SelectTrigger className="w-36 h-9 rounded-lg" data-testid="select-sort-by"><ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /><SelectValue placeholder="Sort by" /></SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="newest">Newest First</SelectItem><SelectItem value="oldest">Oldest First</SelectItem>
          <SelectItem value="wo_asc">WO # A-Z</SelectItem><SelectItem value="wo_desc">WO # Z-A</SelectItem>
          <SelectItem value="applicant_asc">Applicant A-Z</SelectItem><SelectItem value="applicant_desc">Applicant Z-A</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

export function ViewModeToggle({ viewMode, setViewMode }: { viewMode: ViewMode; setViewMode: (m: string) => void }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
      {[
        { mode: "compact", icon: List }, { mode: "cards", icon: LayoutGrid },
        { mode: "table", icon: Table2 }, { mode: "kanban", icon: Columns3 },
      ].map(({ mode, icon: Icon }) => (
        <Button key={mode} size="icon" variant={viewMode === mode ? "secondary" : "ghost"} onClick={() => setViewMode(mode)} data-testid={`button-view-${mode}`}><Icon className="h-4 w-4" /></Button>
      ))}
    </div>
  );
}

interface BulkActionsProps {
  selectedIds: Set<string>;
  filteredWorkOrders: WorkOrderEnriched[] | undefined;
  bulkStatusMutation: { isPending: boolean; mutate: (args: { ids: string[]; status: string }) => void };
}

export function BulkActions({ selectedIds, filteredWorkOrders, bulkStatusMutation }: BulkActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {STATUS_ORDER.map((status) => (
        <Button key={status} variant="outline" size="sm" disabled={bulkStatusMutation.isPending} onClick={() => bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status })} data-testid={`button-bulk-${status.toLowerCase()}`}>
          {bulkStatusMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
          {status}
        </Button>
      ))}
      <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-export-csv" onClick={() => {
        const selected = (filteredWorkOrders || []).filter(wo => selectedIds.has(wo.id));
        exportToCsv(selected, [
          { header: "WO #", accessor: (wo: WorkOrderEnriched) => wo.woNumber },
          { header: "Applicant", accessor: (wo: WorkOrderEnriched) => wo.applicantName },
          { header: "Company", accessor: (wo: WorkOrderEnriched) => wo.company?.name || "" },
          { header: "Status", accessor: (wo: WorkOrderEnriched) => wo.status },
        ], "work-orders-export");
      }}><Download className="h-3.5 w-3.5" />Export</Button>
    </div>
  );
}

interface WoContextMenuActions {
  navigate: (path: string) => void;
  handleCopyWoNumber: (woNumber: string) => void;
  singleStatusMutate: (args: { id: string; status: string }) => void;
  toggleVipMutate: (args: { id: string; isVip: boolean }) => void;
}

export function useWoMenus(actions: WoContextMenuActions) {
  const { navigate, handleCopyWoNumber, singleStatusMutate, toggleVipMutate } = actions;

  const renderWoContextMenu = useCallback((wo: WorkOrderEnriched, children: React.ReactNode) => (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => navigate(`/work-orders/${wo.id}`)} data-testid={`ctx-open-${wo.woNumber}`}><ExternalLink className="h-4 w-4 mr-2" />Open</ContextMenuItem>
        <ContextMenuItem onClick={() => handleCopyWoNumber(wo.woNumber)} data-testid={`ctx-copy-wo-${wo.woNumber}`}><Copy className="h-4 w-4 mr-2" />Copy WO#</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger data-testid={`ctx-change-status-${wo.woNumber}`}><ArrowUpDown className="h-4 w-4 mr-2" />Change Status</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {[{ key: "Draft", label: "Draft" }, { key: "AtVendor", label: "At Vendor" }, { key: "ReadyToSchedule", label: "Ready to Schedule" }, { key: "Scheduled", label: "Scheduled" }, { key: "Completed", label: "Completed" }, { key: "Cancelled", label: "Cancelled" }].map(({ key, label }) => (
              <ContextMenuItem key={key} disabled={wo.status === key} onClick={() => singleStatusMutate({ id: wo.id, status: key })} data-testid={`ctx-status-${key.toLowerCase()}-${wo.woNumber}`}>{label}</ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => toggleVipMutate({ id: wo.id, isVip: !wo.isVip })} data-testid={`ctx-vip-${wo.woNumber}`}>
          {wo.isVip ? <><StarOff className="h-4 w-4 mr-2" />Unmark VIP</> : <><Star className="h-4 w-4 mr-2" />Mark VIP</>}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ), [navigate, handleCopyWoNumber, singleStatusMutate, toggleVipMutate]);

  const renderMobileMenu = useCallback((wo: WorkOrderEnriched) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden shrink-0" data-testid={`button-mobile-actions-${wo.woNumber}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => navigate(`/work-orders/${wo.id}`)}><ExternalLink className="h-4 w-4 mr-2" />Open</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCopyWoNumber(wo.woNumber)}><Copy className="h-4 w-4 mr-2" />Copy WO#</DropdownMenuItem>
        <DropdownMenuItem onClick={() => singleStatusMutate({ id: wo.id, status: wo.status === "Completed" ? "Scheduled" : "Completed" })}>
          <ArrowUpDown className="h-4 w-4 mr-2" />{wo.status === "Completed" ? "Set Scheduled" : "Set Completed"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleVipMutate({ id: wo.id, isVip: !wo.isVip })}>
          {wo.isVip ? <><StarOff className="h-4 w-4 mr-2" />Unmark VIP</> : <><Star className="h-4 w-4 mr-2" />Mark VIP</>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ), [navigate, handleCopyWoNumber, singleStatusMutate, toggleVipMutate]);

  return { renderWoContextMenu, renderMobileMenu };
}

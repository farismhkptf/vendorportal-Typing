import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { FileText, Filter, ArrowUpDown, List, LayoutGrid, Table2, Columns3, Plus, Clock, CheckCircle2, AlertTriangle, Send, Stethoscope, CreditCard, Loader2, Download } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DataTableToolbar } from "@/components/ui/data-table-toolbar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDataTable, type SortState, type ColumnDef } from "@/hooks/use-data-table";
import { ColumnVisibilityDropdown } from "@/components/ui/column-visibility";
import { toProperCase } from "@/lib/proper-case";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TypingJob, WorkOrder, JobType, Vendor } from "@shared/schema";

interface TypingJobWithRelations extends TypingJob {
  workOrder?: WorkOrder;
  jobType?: JobType;
}

type ViewMode = "compact" | "cards" | "table" | "kanban";
type SortByOption = "newest" | "oldest" | "wo_asc" | "wo_desc";
type CategoryFilter = "all" | "Medical" | "EID";

const STATUS_ORDER = ["Draft", "SentToVendor", "InProgress", "ReadyToSchedule", "Returned", "SentToClient", "VendorMistake", "Cancelled", "OnHold", "Rejected"] as const;

export default function TypingJobsList() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const initialStatus = urlParams.get("status") || "all";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const s = params.get("status");
    if (s) setStatusFilter(s);
  }, [searchString]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sortBy, setSortBy] = useState<SortByOption>("newest");
  const [columnSort, setColumnSort] = useState<SortState>({ key: null, direction: null });
  const toggleColumnSort = useCallback((key: string) => {
    setColumnSort(prev => {
      if (prev.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" as const };
        if (prev.direction === "desc") return { key: null, direction: null };
      }
      return { key, direction: "asc" as const };
    });
  }, []);
  const { toast } = useToast();

  const apiStatus = statusFilter.startsWith("_") ? "all" : statusFilter;
  const { data: typingJobs, isLoading } = useQuery<TypingJobWithRelations[]>({
    queryKey: ["/api/typing-jobs", { status: apiStatus }],
  });

  const { data: vendors } = useQuery<Vendor[]>({ queryKey: ["/api/vendors"] });

  const stats = useMemo(() => {
    if (!typingJobs) return { pending: 0, inProgress: 0, completed: 0, issues: 0, medical: 0, eid: 0 };
    return {
      pending: typingJobs.filter(j => j.status === "Draft" || j.status === "SentToVendor").length,
      inProgress: typingJobs.filter(j => j.status === "InProgress").length,
      completed: typingJobs.filter(j => j.status === "ReadyToSchedule" || j.status === "Returned" || j.status === "SentToClient").length,
      issues: typingJobs.filter(j => j.status === "VendorMistake" || j.status === "Cancelled" || j.status === "Rejected" || j.status === "OnHold").length,
      medical: typingJobs.filter(j => j.jobType?.category === "Medical").length,
      eid: typingJobs.filter(j => j.jobType?.category === "EID").length,
    };
  }, [typingJobs]);

  const filteredAndSortedJobs = useMemo(() => {
    let result = typingJobs?.filter((job) => {
      const matchesSearch = !search || 
        job.workOrder?.woNumber.toLowerCase().includes(search.toLowerCase()) ||
        job.workOrder?.applicantName.toLowerCase().includes(search.toLowerCase()) ||
        job.jobCode?.toLowerCase().includes(search.toLowerCase());
      const pendingStatuses = ["Draft", "SentToVendor"];
      const inProgressStatuses = ["InProgress"];
      const completedStatuses = ["ReadyToSchedule", "Returned", "SentToClient"];
      const issueStatuses = ["VendorMistake", "Cancelled", "Rejected", "OnHold"];
      const matchesStatus = statusFilter === "all" || job.status === statusFilter
        || (statusFilter === "_pending" && pendingStatuses.includes(job.status))
        || (statusFilter === "_inprogress" && inProgressStatuses.includes(job.status))
        || (statusFilter === "_completed" && completedStatuses.includes(job.status))
        || (statusFilter === "_issues" && issueStatuses.includes(job.status));
      const matchesCategory = categoryFilter === "all" || job.jobType?.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
    
    if (result) {
      result = [...result].sort((a, b) => {
        if (columnSort.key) {
          const dir = columnSort.direction === "desc" ? -1 : 1;
          switch (columnSort.key) {
            case "jobCode":
              return dir * (a.jobCode || "").localeCompare(b.jobCode || "");
            case "woNumber":
              return dir * (a.workOrder?.woNumber || "").localeCompare(b.workOrder?.woNumber || "");
            case "applicant":
              return dir * (a.workOrder?.applicantName || "").localeCompare(b.workOrder?.applicantName || "");
            case "status":
              return dir * a.status.localeCompare(b.status);
            case "cost":
              return dir * (Number(a.costSnapshot || 0) - Number(b.costSnapshot || 0));
          }
        }
        switch (sortBy) {
          case "newest":
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case "oldest":
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case "wo_asc":
            return (a.workOrder?.woNumber || "").localeCompare(b.workOrder?.woNumber || "");
          case "wo_desc":
            return (b.workOrder?.woNumber || "").localeCompare(a.workOrder?.woNumber || "");
          default:
            return 0;
        }
      });
    }
    
    return result;
  }, [typingJobs, search, statusFilter, categoryFilter, sortBy, columnSort]);

  const getId = useCallback((job: TypingJobWithRelations) => job.id, []);

  const tjColumns: ColumnDef[] = useMemo(() => [
    { id: "jobCode", label: "Job Code" },
    { id: "woNumber", label: "Work Order #" },
    { id: "applicant", label: "Applicant" },
    { id: "jobType", label: "Job Type" },
    { id: "status", label: "Status" },
    { id: "cost", label: "Cost" },
  ], []);

  const dt = useDataTable(filteredAndSortedJobs, {
    storageKey: "tj_list",
    defaultPageSize: 25,
    defaultViewMode: "cards",
    getId,
    columns: tjColumns,
  });

  const bulkAssignVendorMutation = useMutation({
    mutationFn: async ({ ids, vendorId }: { ids: string[], vendorId: string }) => {
      const res = await apiRequest("POST", "/api/typing-jobs/bulk-assign-vendor", { ids, vendorId });
      return res.json() as Promise<{ updated: number; failed: number; errors: string[] }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/typing-jobs"] });
      dt.clearSelection();
      const desc = result.failed > 0
        ? `${result.updated} submitted to vendor, ${result.failed} failed.`
        : `${result.updated} jobs submitted to vendor.`;
      toast({ title: "Vendor assigned", description: desc, variant: result.failed > 0 ? "destructive" : "default" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to assign vendor", variant: "destructive" });
    },
  });

  const viewMode = dt.viewMode as ViewMode;
  const isKanban = viewMode === "kanban";
  const displayItems = isKanban ? (filteredAndSortedJobs || []) : dt.paginatedData;

  const kanbanGroups = useMemo(() => {
    if (!filteredAndSortedJobs) return null;
    const groups: Record<string, TypingJobWithRelations[]> = {};
    STATUS_ORDER.forEach(status => { groups[status] = []; });
    filteredAndSortedJobs.forEach(job => {
      if (groups[job.status]) {
        groups[job.status].push(job);
      }
    });
    return groups;
  }, [filteredAndSortedJobs]);

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (categoryFilter !== "all" ? 1 : 0);

  const clearAllFilters = useCallback(() => {
    setStatusFilter("all");
    setCategoryFilter("all");
    setSearch("");
  }, []);

  const renderCompactList = (items: TypingJobWithRelations[]) => (
    <div className="space-y-1 stagger-children">
      {items.map((job, index) => {
        const isSelected = dt.selectedIds.has(job.id);
        return (
          <div key={job.id} className="flex items-center gap-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => dt.toggleSelected(job.id)}
              aria-label={`Select ${job.jobCode || job.id}`}
              data-testid={`checkbox-tj-compact-${job.id}`}
            />
            <Link href={`/typing-jobs/${job.id}`} className="flex-1 min-w-0">
              <div 
                className={`flex items-center justify-between gap-3 ${dt.density === "comfortable" ? "py-2 px-3" : "py-1.5 px-2"} rounded-lg hover-elevate opacity-0 animate-fade-in`}
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
                  {job.costSnapshot && (
                    <span className="text-xs font-medium text-foreground">AED {job.costSnapshot}</span>
                  )}
                </div>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );

  const renderCards = (items: TypingJobWithRelations[]) => (
    <div className="space-y-2 stagger-children">
      {items.map((job, index) => (
        <Link key={job.id} href={`/typing-jobs/${job.id}`}>
          <div 
            className={`premium-card ${dt.density === "comfortable" ? "p-4" : "p-2.5"} opacity-0 animate-fade-in`}
            style={{ animationDelay: `${index * 0.03}s` }}
            data-testid={`typing-job-card-${job.id}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="icon-container icon-container-sm shrink-0 !bg-violet-100 dark:!bg-violet-900/30 !text-violet-600 dark:!text-violet-400">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-foreground">{job.jobCode || "-"}</span>
                    <span className="font-semibold text-sm text-foreground">{job.workOrder?.woNumber || "N/A"}</span>
                    <StatusBadge status={job.status} />
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
      ))}
    </div>
  );

  const cv = dt.isColumnVisible;

  const renderTable = (items: TypingJobWithRelations[]) => (
    <div className="premium-card overflow-hidden">
      <Table>
        <TableHeader className="sticky top-0 z-[9999] bg-background">
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={dt.isAllSelected}
                onCheckedChange={() => dt.toggleSelectAll()}
                aria-label="Select all"
                data-testid="checkbox-select-all"
                {...(dt.isPartiallySelected ? { "data-state": "indeterminate" } : {})}
              />
            </TableHead>
            {cv("jobCode") && <SortableHeader sortKey="jobCode" sort={columnSort} onToggle={toggleColumnSort} className="w-24">Job Code</SortableHeader>}
            {cv("woNumber") && <SortableHeader sortKey="woNumber" sort={columnSort} onToggle={toggleColumnSort} className="w-28">Work Order #</SortableHeader>}
            {cv("applicant") && <SortableHeader sortKey="applicant" sort={columnSort} onToggle={toggleColumnSort}>Applicant</SortableHeader>}
            {cv("jobType") && <TableHead className="hidden sm:table-cell">Job Type</TableHead>}
            {cv("status") && <SortableHeader sortKey="status" sort={columnSort} onToggle={toggleColumnSort} className="w-32">Status</SortableHeader>}
            {cv("cost") && <SortableHeader sortKey="cost" sort={columnSort} onToggle={toggleColumnSort} className="w-24 text-right">Cost</SortableHeader>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((job) => {
            const isSelected = dt.selectedIds.has(job.id);
            const cellPadding = dt.density === "compact" ? "py-1.5" : "";
            return (
              <TableRow 
                key={job.id} 
                className={`cursor-pointer hover-elevate ${isSelected ? "bg-primary/5" : ""}`}
                data-state={isSelected ? "selected" : undefined}
                data-testid={`typing-job-table-${job.id}`}
              >
                <TableCell className={cellPadding}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => dt.toggleSelected(job.id)}
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
                {cv("cost") && <TableCell className={`text-right font-medium ${cellPadding}`} onClick={() => navigate(`/typing-jobs/${job.id}`)}>
                  {job.costSnapshot ? `AED ${job.costSnapshot}` : "-"}
                </TableCell>}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const renderKanban = () => {
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
                <Link key={job.id} href={`/typing-jobs/${job.id}`}>
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
                    {job.costSnapshot && (
                      <div className="text-xs font-medium text-foreground mt-1">AED {job.costSnapshot}</div>
                    )}
                  </div>
                </Link>
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
  };

  const viewModeToggle = (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
      <Button
        size="icon"
        variant={viewMode === "compact" ? "secondary" : "ghost"}
        onClick={() => dt.setViewMode("compact")}
        data-testid="button-view-compact"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant={viewMode === "cards" ? "secondary" : "ghost"}
        onClick={() => dt.setViewMode("cards")}
        data-testid="button-view-cards"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant={viewMode === "table" ? "secondary" : "ghost"}
        onClick={() => dt.setViewMode("table")}
        data-testid="button-view-table"
      >
        <Table2 className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant={viewMode === "kanban" ? "secondary" : "ghost"}
        onClick={() => dt.setViewMode("kanban")}
        data-testid="button-view-kanban"
      >
        <Columns3 className="h-4 w-4" />
      </Button>
    </div>
  );

  const filterControls = (
    <>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-32 h-9 rounded-lg" data-testid="select-status-filter">
          <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="_pending">Pending</SelectItem>
          <SelectItem value="_inprogress">In Progress</SelectItem>
          <SelectItem value="_completed">Completed</SelectItem>
          <SelectItem value="_issues">Issues</SelectItem>
          <SelectItem value="Draft">Draft</SelectItem>
          <SelectItem value="SentToVendor">Sent to Vendor</SelectItem>
          <SelectItem value="InProgress">In Progress (Active)</SelectItem>
          <SelectItem value="ReadyToSchedule">Ready to Schedule</SelectItem>
          <SelectItem value="Returned">Returned</SelectItem>
          <SelectItem value="SentToClient">Sent to Client</SelectItem>
          <SelectItem value="VendorMistake">Vendor Mistake</SelectItem>
          <SelectItem value="Cancelled">Cancelled</SelectItem>
          <SelectItem value="OnHold">On Hold</SelectItem>
          <SelectItem value="Rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>
      <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortByOption)}>
        <SelectTrigger className="w-36 h-9 rounded-lg" data-testid="select-sort-by">
          <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="newest">Newest First</SelectItem>
          <SelectItem value="oldest">Oldest First</SelectItem>
          <SelectItem value="wo_asc">Work Order # A-Z</SelectItem>
          <SelectItem value="wo_desc">Work Order # Z-A</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground" data-testid="page-title">
              Typing Jobs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage medical and EID application typing
            </p>
          </div>
          <Link href="/typing-jobs/new">
            <Button size="sm" className="gap-1.5" data-testid="button-new-typing-job">
              <Plus className="h-4 w-4" />
              New Job
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-20 md:pb-6 space-y-4">
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            title="Pending"
            value={stats.pending}
            icon={<Send className="h-4 w-4 text-blue-600" />}
            animationDelay={1}
            onClick={() => setStatusFilter("_pending")}
          />
          <StatCard
            title="In Progress"
            value={stats.inProgress}
            icon={<Clock className="h-4 w-4 text-amber-600" />}
            animationDelay={2}
            onClick={() => setStatusFilter("_inprogress")}
          />
          <StatCard
            title="Completed"
            value={stats.completed}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            animationDelay={3}
            onClick={() => setStatusFilter("_completed")}
          />
          <StatCard
            title="Issues"
            value={stats.issues}
            icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
            animationDelay={4}
            onClick={() => setStatusFilter("_issues")}
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
          <Button
            variant={categoryFilter === "all" ? "default" : "ghost"}
            size="sm"
            onClick={() => setCategoryFilter("all")}
            className="gap-1.5"
            data-testid="filter-category-all"
          >
            All
            <span className="text-xs opacity-60">({typingJobs?.length || 0})</span>
          </Button>
          <Button
            variant={categoryFilter === "Medical" ? "default" : "ghost"}
            size="sm"
            onClick={() => setCategoryFilter("Medical")}
            className="gap-1.5"
            data-testid="filter-category-medical"
          >
            <Stethoscope className="h-3.5 w-3.5" />
            Medical
            <span className="text-xs opacity-60">({stats.medical})</span>
          </Button>
          <Button
            variant={categoryFilter === "EID" ? "default" : "ghost"}
            size="sm"
            onClick={() => setCategoryFilter("EID")}
            className="gap-1.5"
            data-testid="filter-category-eid"
          >
            <CreditCard className="h-3.5 w-3.5" />
            EID
            <span className="text-xs opacity-60">({stats.eid})</span>
          </Button>
        </div>

        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by WO#, applicant, or job code..."
          density={dt.density}
          onDensityChange={dt.setDensity}
          totalItems={dt.totalItems}
          selectedCount={dt.selectedCount}
          onClearSelection={dt.clearSelection}
          filters={filterControls}
          viewModeToggle={viewModeToggle}
          actions={
            <ColumnVisibilityDropdown
              columns={dt.columns}
              isColumnVisible={dt.isColumnVisible}
              toggleColumn={dt.toggleColumn}
              resetColumns={dt.resetColumns}
            />
          }
          activeFilterCount={activeFilterCount}
          onClearFilters={clearAllFilters}
          selectionActions={
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5" disabled={bulkAssignVendorMutation.isPending} data-testid="button-bulk-assign-vendor">
                    {bulkAssignVendorMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Assign Vendor
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Submit to Vendor</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {vendors && vendors.length > 0 ? vendors.map(v => (
                    <DropdownMenuItem key={v.id} onClick={() => bulkAssignVendorMutation.mutate({ ids: Array.from(dt.selectedIds), vendorId: v.id })} data-testid={`menu-assign-vendor-${v.id}`}>
                      {v.name}
                    </DropdownMenuItem>
                  )) : (
                    <DropdownMenuItem disabled>No vendors available</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                data-testid="button-export-csv"
                onClick={() => {
                  const selected = (filteredAndSortedJobs || []).filter(j => dt.selectedIds.has(j.id));
                  exportToCsv(selected, [
                    { header: "Job Code", accessor: (j: TypingJobWithRelations) => j.jobCode || "" },
                    { header: "WO Number", accessor: (j: TypingJobWithRelations) => j.workOrder?.woNumber || "" },
                    { header: "Applicant", accessor: (j: TypingJobWithRelations) => j.workOrder?.applicantName || "" },
                    { header: "Job Type", accessor: (j: TypingJobWithRelations) => j.jobType?.name || "" },
                    { header: "Status", accessor: (j: TypingJobWithRelations) => j.status },
                    { header: "Vendor", accessor: (j: TypingJobWithRelations) => (j.vendorId && vendors ? vendors.find(v => v.id === j.vendorId)?.name : "") || "" },
                    { header: "Cost", accessor: (j: TypingJobWithRelations) => j.costSnapshot || "" },
                  ], "typing-jobs-export");
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </>
          }
        />

        <div>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : displayItems && displayItems.length > 0 ? (
            <>
              {viewMode === "compact" && renderCompactList(displayItems)}
              {viewMode === "cards" && renderCards(displayItems)}
              {viewMode === "table" && renderTable(displayItems)}
              {viewMode === "kanban" && renderKanban()}
            </>
          ) : (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={search || activeFilterCount > 0 ? "No results match your filters" : "No typing jobs found"}
              description={search || activeFilterCount > 0 ? "Try adjusting your search or filters" : "Typing jobs will appear here once created from work orders."}
              action={
                search || activeFilterCount > 0 ? (
                  <Button size="sm" variant="outline" className="gap-2 rounded-lg" onClick={clearAllFilters} data-testid="button-clear-all-filters">
                    Clear filters
                  </Button>
                ) : (
                  <Link href="/typing-jobs/new">
                    <Button size="sm" className="gap-2 rounded-lg">
                      <Plus className="h-4 w-4" />
                      New Typing Job
                    </Button>
                  </Link>
                )
              }
            />
          )}
        </div>

        {!isKanban && !isLoading && dt.totalItems > 0 && (
          <DataTablePagination
            page={dt.page}
            pageSize={dt.pageSize}
            totalPages={dt.totalPages}
            totalItems={dt.totalItems}
            onPageChange={dt.setPage}
            onPageSizeChange={dt.setPageSize}
            selectedCount={dt.selectedCount}
          />
        )}
      </div>
      <FloatingActionButton href="/typing-jobs/new" label="New Typing Job" testId="fab-new-typing-job" />
    </AppLayout>
  );
}

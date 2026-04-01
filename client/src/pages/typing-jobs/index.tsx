import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { FileText, Filter, ArrowUpDown, List, LayoutGrid, Table2, Columns3, Plus, Clock, CheckCircle2, AlertTriangle, Send, Stethoscope, CreditCard, Loader2, Download, TriangleAlert } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { queryKeys } from "@/lib/query-keys";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DataTableToolbar } from "@/components/ui/data-table-toolbar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDataTable, type SortState, type ColumnDef } from "@/hooks/use-data-table";
import { ColumnVisibilityDropdown } from "@/components/ui/column-visibility";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TypingJob, WorkOrder, JobType, Vendor, Appointment } from "@shared/schema";
import { useAppointmentStatus, type AppointmentWithCenter, type TypingJobWithRelations } from "./components/tj-appointment-indicator";
import { CompactListView, CardsView, TableView, KanbanView } from "./components/tj-list-views";

type ViewMode = "compact" | "cards" | "table" | "kanban";
type SortByOption = "newest" | "oldest" | "wo_asc" | "wo_desc";
type CategoryFilter = "all" | "Medical" | "EID";

const STATUS_ORDER = ["Draft", "SubmittedToVendor", "InProcess", "ReadyForScheduling", "Returned", "OnHold", "Rejected", "Aborted"] as const;

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
  const { data: typingJobs, isLoading, isError, refetch } = useQuery<TypingJobWithRelations[]>({
    queryKey: queryKeys.typingJobs(apiStatus),
  });

  const { data: vendors } = useQuery<Vendor[]>({ queryKey: queryKeys.vendors });

  const { data: allAppointments } = useQuery<AppointmentWithCenter[]>({ queryKey: queryKeys.appointments });

  const { getAppointmentStatus } = useAppointmentStatus(allAppointments);

  const stats = useMemo(() => {
    if (!typingJobs) return { pending: 0, inProgress: 0, completed: 0, issues: 0, medical: 0, eid: 0, returned: 0 };
    return {
      pending: typingJobs.filter(j => j.status === "Draft" || j.status === "SubmittedToVendor").length,
      inProgress: typingJobs.filter(j => j.status === "InProcess").length,
      completed: typingJobs.filter(j => j.status === "ReadyForScheduling").length,
      issues: typingJobs.filter(j => j.status === "Aborted" || j.status === "Rejected" || j.status === "OnHold").length,
      medical: typingJobs.filter(j => j.jobType?.category === "Medical").length,
      eid: typingJobs.filter(j => j.jobType?.category === "EID").length,
      returned: typingJobs.filter(j => j.status === "Returned").length,
    };
  }, [typingJobs]);

  const returnedJobs = useMemo(() => {
    if (!typingJobs) return [];
    return typingJobs
      .filter(j => j.status === "Returned")
      .sort((a, b) => {
        const aTime = a.returnedAt ? new Date(a.returnedAt).getTime() : new Date(a.createdAt).getTime();
        const bTime = b.returnedAt ? new Date(b.returnedAt).getTime() : new Date(b.createdAt).getTime();
        return aTime - bTime;
      });
  }, [typingJobs]);

  const filteredAndSortedJobs = useMemo(() => {
    let result = typingJobs?.filter((job) => {
      const matchesSearch = !search || 
        job.workOrder?.woNumber.toLowerCase().includes(search.toLowerCase()) ||
        job.workOrder?.applicantName.toLowerCase().includes(search.toLowerCase()) ||
        job.jobCode?.toLowerCase().includes(search.toLowerCase());
      const pendingStatuses = ["Draft", "SubmittedToVendor"];
      const inProgressStatuses = ["InProcess"];
      const completedStatuses = ["ReadyForScheduling"];
      const issueStatuses = ["Aborted", "Rejected", "OnHold"];
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
    { id: "appointment", label: "Appointment" },
    { id: "cost", label: "Cost" },
  ], []);

  const dt = useDataTable(filteredAndSortedJobs, {
    storageKey: "tj_list",
    defaultPageSize: 25,
    defaultViewMode: "table",
    getId,
    columns: tjColumns,
  });

  const bulkAssignVendorMutation = useMutation({
    mutationFn: async ({ ids, vendorId }: { ids: string[], vendorId: string }) => {
      const res = await apiRequest("POST", "/api/typing-jobs/bulk-assign-vendor", { ids, vendorId });
      return res.json() as Promise<{ updated: number; failed: number; errors: string[] }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.typingJobsAll });
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

  const viewModeToggle = (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
      <Button size="icon" variant={viewMode === "compact" ? "secondary" : "ghost"} onClick={() => dt.setViewMode("compact")} data-testid="button-view-compact">
        <List className="h-4 w-4" />
      </Button>
      <Button size="icon" variant={viewMode === "cards" ? "secondary" : "ghost"} onClick={() => dt.setViewMode("cards")} data-testid="button-view-cards">
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button size="icon" variant={viewMode === "table" ? "secondary" : "ghost"} onClick={() => dt.setViewMode("table")} data-testid="button-view-table">
        <Table2 className="h-4 w-4" />
      </Button>
      <Button size="icon" variant={viewMode === "kanban" ? "secondary" : "ghost"} onClick={() => dt.setViewMode("kanban")} data-testid="button-view-kanban">
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
          <SelectItem value="SubmittedToVendor">Submitted to Vendor</SelectItem>
          <SelectItem value="InProcess">In Process</SelectItem>
          <SelectItem value="ReadyForScheduling">Ready for Scheduling</SelectItem>
          <SelectItem value="Returned">Returned</SelectItem>
          <SelectItem value="Aborted">Aborted</SelectItem>
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
            <h1 className="text-2xl font-semibold text-foreground tracking-tight" data-testid="page-title">
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

      <div className="px-4 lg:px-6 pb-6 space-y-4">

        {!isLoading && returnedJobs.length > 0 && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3" data-testid="section-returned-jobs">
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Returned — Needs Action ({returnedJobs.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-amber-700 dark:text-amber-300 h-7 text-xs gap-1"
                onClick={() => setStatusFilter("Returned")}
                data-testid="button-view-all-returned"
              >
                View all
              </Button>
            </div>
            <div className="space-y-1.5">
              {returnedJobs.slice(0, 5).map((job) => (
                <Link key={job.id} href={`/typing-jobs/${job.id}`}>
                  <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer" data-testid={`returned-job-row-${job.id}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs text-foreground">{job.jobCode || "-"}</span>
                      <span className="font-mono text-sm font-medium text-foreground">{job.workOrder?.woNumber || "N/A"}</span>
                      <span className="text-sm text-muted-foreground truncate hidden sm:block">{job.workOrder?.applicantName || ""}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <RelativeTime date={job.returnedAt || job.createdAt} className="text-xs text-amber-700 dark:text-amber-300" id={`returned-${job.id}`} />
                    </div>
                  </div>
                </Link>
              ))}
              {returnedJobs.length > 5 && (
                <p className="text-xs text-amber-700 dark:text-amber-300 px-1">
                  +{returnedJobs.length - 5} more returned jobs
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="Pending" value={stats.pending} icon={<Send className="h-4 w-4 text-blue-600" />} animationDelay={1} onClick={() => setStatusFilter("_pending")} />
          <StatCard title="In Progress" value={stats.inProgress} icon={<Clock className="h-4 w-4 text-amber-600" />} animationDelay={2} onClick={() => setStatusFilter("_inprogress")} />
          <StatCard title="Completed" value={stats.completed} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} animationDelay={3} onClick={() => setStatusFilter("_completed")} />
          <StatCard title="Issues" value={stats.issues} icon={<AlertTriangle className="h-4 w-4 text-red-600" />} animationDelay={4} onClick={() => setStatusFilter("_issues")} />
        </div>

        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
          <Button variant={categoryFilter === "all" ? "default" : "ghost"} size="sm" onClick={() => setCategoryFilter("all")} className="gap-1.5" data-testid="filter-category-all">
            All
            <span className="text-xs opacity-60">({typingJobs?.length || 0})</span>
          </Button>
          <Button variant={categoryFilter === "Medical" ? "default" : "ghost"} size="sm" onClick={() => setCategoryFilter("Medical")} className="gap-1.5" data-testid="filter-category-medical">
            <Stethoscope className="h-3.5 w-3.5" />
            Medical
            <span className="text-xs opacity-60">({stats.medical})</span>
          </Button>
          <Button variant={categoryFilter === "EID" ? "default" : "ghost"} size="sm" onClick={() => setCategoryFilter("EID")} className="gap-1.5" data-testid="filter-category-eid">
            <CreditCard className="h-3.5 w-3.5" />
            EID
            <span className="text-xs opacity-60">({stats.eid})</span>
          </Button>
        </div>

        <div className="sticky top-[72px] z-20 -mx-4 lg:-mx-6 px-4 lg:px-6 py-2 bg-background/80 backdrop-blur-md border-b border-border/30">
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
                      { header: "Appointment", accessor: (j: TypingJobWithRelations) => {
                        const info = getAppointmentStatus(j);
                        if (!info) return "";
                        if (info.status === "none") return "Not Scheduled";
                        if (info.status === "completed") return "Completed";
                        if (info.status === "cancelled") return "Cancelled";
                        return info.appointment?.datetime ? `Scheduled ${new Date(info.appointment.datetime).toLocaleDateString("en-GB")}` : "Scheduled";
                      }},
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
        </div>

        <div>
          {isError ? (
            <QueryErrorState message="Could not load typing jobs." onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : displayItems && displayItems.length > 0 ? (
            <>
              {viewMode === "compact" && <CompactListView items={displayItems} density={dt.density} selectedIds={dt.selectedIds} toggleSelected={dt.toggleSelected} getAppointmentStatus={getAppointmentStatus} />}
              {viewMode === "cards" && <CardsView items={displayItems} density={dt.density} getAppointmentStatus={getAppointmentStatus} />}
              {viewMode === "table" && <TableView items={displayItems} density={dt.density} selectedIds={dt.selectedIds} toggleSelected={dt.toggleSelected} getAppointmentStatus={getAppointmentStatus} columnSort={columnSort} toggleColumnSort={toggleColumnSort} isColumnVisible={dt.isColumnVisible} isAllSelected={dt.isAllSelected} isPartiallySelected={dt.isPartiallySelected} toggleSelectAll={dt.toggleSelectAll} />}
              {viewMode === "kanban" && <KanbanView kanbanGroups={kanbanGroups} getAppointmentStatus={getAppointmentStatus} />}
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
    </AppLayout>
  );
}

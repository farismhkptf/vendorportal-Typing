import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Search, FileText, Filter, ArrowUpDown, List, LayoutGrid, Table2, Columns3, Plus, Clock, CheckCircle2, AlertTriangle, Send, Stethoscope, CreditCard } from "lucide-react";
import { formatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TypingJob, WorkOrder, JobType } from "@shared/schema";

interface TypingJobWithRelations extends TypingJob {
  workOrder?: WorkOrder;
  jobType?: JobType;
}

type ViewMode = "compact" | "cards" | "table" | "kanban";
type SortByOption = "newest" | "oldest" | "wo_asc" | "wo_desc";
type CategoryFilter = "all" | "Medical" | "EID";

const STATUS_ORDER = ["Draft", "SentToVendor", "InProgress", "WaitingForDocs", "Returned", "SentToClient", "VendorMistake", "Cancelled"] as const;

export default function TypingJobsList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [sortBy, setSortBy] = useState<SortByOption>("newest");

  const { data: typingJobs, isLoading } = useQuery<TypingJobWithRelations[]>({
    queryKey: ["/api/typing-jobs", { status: statusFilter }],
  });

  const stats = useMemo(() => {
    if (!typingJobs) return { pending: 0, inProgress: 0, completed: 0, issues: 0, medical: 0, eid: 0 };
    return {
      pending: typingJobs.filter(j => j.status === "Draft" || j.status === "SentToVendor").length,
      inProgress: typingJobs.filter(j => j.status === "InProgress" || j.status === "WaitingForDocs").length,
      completed: typingJobs.filter(j => j.status === "Returned" || j.status === "SentToClient").length,
      issues: typingJobs.filter(j => j.status === "VendorMistake" || j.status === "Cancelled").length,
      medical: typingJobs.filter(j => j.jobType?.category === "Medical").length,
      eid: typingJobs.filter(j => j.jobType?.category === "EID").length,
    };
  }, [typingJobs]);

  const filteredAndSortedJobs = useMemo(() => {
    let result = typingJobs?.filter((job) => {
      const matchesSearch = !search || 
        job.workOrder?.woNumber.toLowerCase().includes(search.toLowerCase()) ||
        job.workOrder?.applicantName.toLowerCase().includes(search.toLowerCase()) ||
        job.workCode?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || job.jobType?.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
    
    if (result) {
      result = [...result].sort((a, b) => {
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
  }, [typingJobs, search, statusFilter, sortBy]);

  // Group by status for Kanban view
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

  const renderCompactList = (items: TypingJobWithRelations[]) => (
    <div className="space-y-1">
      {items.map((job, index) => (
        <Link key={job.id} href={`/typing-jobs/${job.id}`}>
          <div 
            className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover-elevate opacity-0 animate-fade-in"
            style={{ animationDelay: `${index * 0.02}s` }}
            data-testid={`typing-job-compact-${job.id}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-xs text-primary">{job.workCode || "-"}</span>
              <span className="font-mono text-sm font-medium text-foreground">{job.workOrder?.woNumber || "N/A"}</span>
              <span className="text-sm text-muted-foreground truncate">{job.workOrder?.applicantName}</span>
              {job.jobType && (
                <span className="text-xs text-muted-foreground/70 hidden sm:inline">• {job.jobType.name}</span>
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
      ))}
    </div>
  );

  const renderCards = (items: TypingJobWithRelations[]) => (
    <div className="space-y-2">
      {items.map((job, index) => (
        <Link key={job.id} href={`/typing-jobs/${job.id}`}>
          <div 
            className="premium-card p-4 opacity-0 animate-fade-in"
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
                    <span className="font-mono text-xs text-primary">{job.workCode || "-"}</span>
                    <span className="font-semibold text-sm text-foreground">{job.workOrder?.woNumber || "N/A"}</span>
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{job.workOrder?.applicantName}</p>
                  {job.jobType && (
                    <span className="text-xs text-muted-foreground">{job.jobType.name}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                {job.costSnapshot && (
                  <p className="font-medium text-sm text-foreground">AED {job.costSnapshot}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatDate(job.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );

  const renderTable = (items: TypingJobWithRelations[]) => (
    <div className="premium-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Work Code</TableHead>
            <TableHead className="w-28">Work Order #</TableHead>
            <TableHead>Applicant</TableHead>
            <TableHead className="hidden sm:table-cell">Job Type</TableHead>
            <TableHead className="w-32">Status</TableHead>
            <TableHead className="w-24 text-right">Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((job) => (
            <TableRow 
              key={job.id} 
              className="cursor-pointer hover-elevate" 
              onClick={() => navigate(`/typing-jobs/${job.id}`)}
              data-testid={`typing-job-table-${job.id}`}
            >
              <TableCell>
                <span className="font-mono text-xs text-primary">{job.workCode || "-"}</span>
              </TableCell>
              <TableCell>
                <span className="font-mono font-medium text-foreground">{job.workOrder?.woNumber || "N/A"}</span>
              </TableCell>
              <TableCell>{job.workOrder?.applicantName || "-"}</TableCell>
              <TableCell className="hidden sm:table-cell text-muted-foreground">
                {job.jobType?.name || "-"}
              </TableCell>
              <TableCell>
                <StatusBadge status={job.status} />
              </TableCell>
              <TableCell className="text-right font-medium">
                {job.costSnapshot ? `AED ${job.costSnapshot}` : "-"}
              </TableCell>
            </TableRow>
          ))}
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
                      <span className="font-mono text-xs text-primary">{job.workCode || "-"}</span>
                      <span className="font-mono text-sm font-medium text-foreground">{job.workOrder?.woNumber || "N/A"}</span>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{job.workOrder?.applicantName}</div>
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

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            title="Pending"
            value={stats.pending}
            icon={<Send className="h-4 w-4 text-blue-600" />}
            animationDelay={1}
          />
          <StatCard
            title="In Progress"
            value={stats.inProgress}
            icon={<Clock className="h-4 w-4 text-amber-600" />}
            animationDelay={2}
          />
          <StatCard
            title="Completed"
            value={stats.completed}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            animationDelay={3}
          />
          <StatCard
            title="Issues"
            value={stats.issues}
            icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
            animationDelay={4}
          />
        </div>

        {/* Category Filter Tabs */}
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

      <div className="space-y-4">
        {/* Search, Filters, and View Mode */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by WO#, applicant, or work code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
              data-testid="input-search-typing-jobs"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-9 rounded-lg" data-testid="select-status-filter">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="SentToVendor">Sent to Vendor</SelectItem>
              <SelectItem value="InProgress">In Progress</SelectItem>
              <SelectItem value="WaitingForDocs">Waiting for Docs</SelectItem>
              <SelectItem value="Returned">Returned</SelectItem>
              <SelectItem value="SentToClient">Sent to Client</SelectItem>
              <SelectItem value="VendorMistake">Vendor Mistake</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
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
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
            <Button
              size="icon"
              variant={viewMode === "compact" ? "secondary" : "ghost"}
              onClick={() => setViewMode("compact")}
              data-testid="button-view-compact"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              onClick={() => setViewMode("cards")}
              data-testid="button-view-cards"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "table" ? "secondary" : "ghost"}
              onClick={() => setViewMode("table")}
              data-testid="button-view-table"
            >
              <Table2 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              onClick={() => setViewMode("kanban")}
              data-testid="button-view-kanban"
            >
              <Columns3 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Jobs Display */}
        <div>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : filteredAndSortedJobs && filteredAndSortedJobs.length > 0 ? (
            <>
              {viewMode === "compact" && renderCompactList(filteredAndSortedJobs)}
              {viewMode === "cards" && renderCards(filteredAndSortedJobs)}
              {viewMode === "table" && renderTable(filteredAndSortedJobs)}
              {viewMode === "kanban" && renderKanban()}
            </>
          ) : (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No typing jobs found"
              description={search ? "Try adjusting your search or filters" : "Typing jobs will appear here once created from work orders."}
            />
          )}
        </div>
      </div>
      </div>
    </AppLayout>
  );
}

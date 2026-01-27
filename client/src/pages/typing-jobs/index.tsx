import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, FileText, Filter, Calendar, LayoutGrid, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { TypingJob, WorkOrder, JobType } from "@shared/schema";

interface TypingJobWithRelations extends TypingJob {
  workOrder?: WorkOrder;
  jobType?: JobType;
}

type ViewByOption = "none" | "status" | "jobType";
type SortByOption = "newest" | "oldest" | "wo_asc" | "wo_desc";

export default function TypingJobsList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewBy, setViewBy] = useState<ViewByOption>("none");
  const [sortBy, setSortBy] = useState<SortByOption>("newest");

  const { data: typingJobs, isLoading } = useQuery<TypingJobWithRelations[]>({
    queryKey: ["/api/typing-jobs", { status: statusFilter }],
  });

  const filteredAndSortedJobs = useMemo(() => {
    let result = typingJobs?.filter((job) => {
      const matchesSearch = !search || 
        job.workOrder?.woNumber.toLowerCase().includes(search.toLowerCase()) ||
        job.workOrder?.applicantName.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      return matchesSearch && matchesStatus;
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

  const groupedJobs = useMemo(() => {
    if (!filteredAndSortedJobs || filteredAndSortedJobs.length === 0 || viewBy === "none") return null;
    
    const groups: Record<string, TypingJobWithRelations[]> = {};
    
    filteredAndSortedJobs.forEach((job) => {
      let key: string;
      if (viewBy === "status") {
        key = job.status;
      } else if (viewBy === "jobType") {
        key = job.jobType?.name || "Unknown Type";
      } else {
        key = "All";
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(job);
    });
    
    return Object.keys(groups).length > 0 ? groups : null;
  }, [filteredAndSortedJobs, viewBy]);

  return (
    <AppLayout>
      {/* Header Section */}
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Typing Jobs
        </h1>
      </div>

      <div className="px-4 lg:px-6 pb-6 space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by WO number or applicant..."
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
          <Select value={viewBy} onValueChange={(v) => setViewBy(v as ViewByOption)}>
            <SelectTrigger className="w-32 h-9 rounded-lg" data-testid="select-view-by">
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="View by" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="none">No Grouping</SelectItem>
              <SelectItem value="status">By Status</SelectItem>
              <SelectItem value="jobType">By Job Type</SelectItem>
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
              <SelectItem value="wo_asc">WO# A-Z</SelectItem>
              <SelectItem value="wo_desc">WO# Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Jobs List */}
        <div className="space-y-4">
          {isLoading ? (
            <>
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </>
          ) : groupedJobs ? (
            Object.entries(groupedJobs).map(([groupKey, items]) => (
              <div key={groupKey} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{groupKey}</h3>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </div>
                <div className="space-y-2">
                  {items.map((job, index) => (
                    <Link key={job.id} href={`/typing-jobs/${job.id}`}>
                      <div 
                        className="premium-card p-4 opacity-0 animate-fade-in"
                        style={{ animationDelay: `${index * 0.03}s` }}
                        data-testid={`typing-job-row-${job.id}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="icon-container icon-container-sm shrink-0 !bg-violet-100 dark:!bg-violet-900/30 !text-violet-600 dark:!text-violet-400">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-foreground">{job.workOrder?.woNumber || "N/A"}</span>
                                <StatusBadge status={job.status} />
                              </div>
                              <p className="text-sm text-muted-foreground truncate">{job.workOrder?.applicantName}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {job.costSnapshot && (
                              <p className="font-medium text-sm text-foreground">AED {job.costSnapshot}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          ) : filteredAndSortedJobs && filteredAndSortedJobs.length > 0 ? (
            <div className="space-y-2">
              {filteredAndSortedJobs.map((job, index) => (
                <Link key={job.id} href={`/typing-jobs/${job.id}`}>
                  <div 
                    className="premium-card p-4 opacity-0 animate-fade-in"
                    style={{ animationDelay: `${index * 0.03}s` }}
                    data-testid={`typing-job-row-${job.id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="icon-container icon-container-sm shrink-0 !bg-violet-100 dark:!bg-violet-900/30 !text-violet-600 dark:!text-violet-400">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
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
                          {new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No typing jobs found"
              description={search ? "Try adjusting your search or filters" : "Typing jobs will appear here once created from work orders."}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}

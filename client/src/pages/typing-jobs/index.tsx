import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, FileText, Filter, Calendar } from "lucide-react";
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

export default function TypingJobsList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: typingJobs, isLoading } = useQuery<TypingJobWithRelations[]>({
    queryKey: ["/api/typing-jobs", { status: statusFilter }],
  });

  const filteredJobs = typingJobs?.filter((job) => {
    const matchesSearch = !search || 
      job.workOrder?.woNumber.toLowerCase().includes(search.toLowerCase()) ||
      job.workOrder?.applicantName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
            <SelectTrigger className="w-40 h-9 rounded-lg" data-testid="select-status-filter">
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
        </div>

        {/* Jobs List */}
        <div className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </>
          ) : filteredJobs && filteredJobs.length > 0 ? (
            filteredJobs.map((job, index) => (
              <Link key={job.id} href={`/typing-jobs/${job.id}`}>
                <div 
                  className="premium-card p-5 opacity-0 animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                  data-testid={`typing-job-row-${job.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-violet-100/80 dark:bg-violet-900/30 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="font-semibold text-foreground">
                            {job.workOrder?.woNumber || "N/A"}
                          </span>
                          <StatusBadge status={job.status} />
                        </div>
                        <p className="text-sm text-foreground">{job.workOrder?.applicantName}</p>
                        {job.jobType && (
                          <div className="flex items-center gap-2">
                            <StatusBadge status={job.jobType.category} />
                            <span className="text-xs text-muted-foreground">{job.jobType.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right space-y-1.5">
                      {job.costSnapshot && (
                        <p className="font-medium text-foreground">AED {job.costSnapshot}</p>
                      )}
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 justify-end">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(job.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))
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

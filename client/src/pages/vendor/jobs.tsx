import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, FileText, Filter, Calendar, Upload, MessageSquare, LogOut } from "lucide-react";
import { formatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTableRow } from "@/components/ui/data-table-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { TypingJob, WorkOrder, JobType } from "@shared/schema";

interface VendorJob extends TypingJob {
  workOrder?: WorkOrder;
  jobType?: JobType;
  hasInputDocs?: boolean;
  commentCount?: number;
}

export default function VendorJobs() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: jobs, isLoading } = useQuery<VendorJob[]>({
    queryKey: ["/api/vendor/jobs", { status: statusFilter }],
  });

  const filteredJobs = jobs?.filter((job) => {
    const matchesSearch = !search || 
      job.workOrder?.woNumber.toLowerCase().includes(search.toLowerCase()) ||
      job.workOrder?.applicantName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="flex h-16 items-center justify-between gap-2 px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <span className="text-sm font-semibold text-white">V</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">Vendor Portal</h1>
              <p className="text-xs text-muted-foreground">The P.R.O. Company™</p>
            </div>
          </div>
          <Link href="/vendor/login">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-vendor-logout">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </Link>
        </div>
      </header>

      {/* Page Header */}
      <div className="gradient-header border-b border-border/50">
        <div className="px-4 lg:px-8 py-6">
          <h1 className="text-xl lg:text-2xl font-semibold text-foreground">My Jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage your assigned typing jobs
          </p>
        </div>
      </div>

      <div className="p-4 lg:p-8 space-y-6">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by work order number or applicant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-xl"
              data-testid="input-search-vendor-jobs"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 h-11 rounded-xl" data-testid="select-vendor-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jobs</SelectItem>
              <SelectItem value="SentToVendor">New</SelectItem>
              <SelectItem value="InProgress">In Progress</SelectItem>
              <SelectItem value="WaitingForDocs">Waiting for Docs</SelectItem>
              <SelectItem value="Returned">Returned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-border/50">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">New Jobs</p>
              <p className="text-2xl font-semibold text-foreground mt-1">
                {jobs?.filter(j => j.status === "SentToVendor").length || 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-border/50">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-semibold text-foreground mt-1">
                {jobs?.filter(j => j.status === "InProgress").length || 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-border/50">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Waiting for Docs</p>
              <p className="text-2xl font-semibold text-foreground mt-1">
                {jobs?.filter(j => j.status === "WaitingForDocs").length || 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-border/50">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Returned</p>
              <p className="text-2xl font-semibold text-foreground mt-1">
                {jobs?.filter(j => j.status === "Returned").length || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Jobs List */}
        <div className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </>
          ) : filteredJobs && filteredJobs.length > 0 ? (
            filteredJobs.map((job) => (
              <Link key={job.id} href={`/vendor/jobs/${job.id}`}>
                <DataTableRow className="mb-0" data-testid={`vendor-job-row-${job.id}`}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {job.workOrder?.woNumber || "N/A"}
                            </span>
                            <StatusBadge status={job.status} />
                          </div>
                          <p className="text-sm text-foreground mt-0.5">{job.workOrder?.applicantName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 justify-end">
                          <Calendar className="h-3.5 w-3.5" />
                          {job.sentAt ? formatDate(job.sentAt) : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/50">
                      <div className="flex items-center gap-3">
                        {job.jobType && (
                          <>
                            <StatusBadge status={job.jobType.category} />
                            <span className="text-sm text-muted-foreground">{job.jobType.name}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {job.hasInputDocs && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Upload className="h-3 w-3" />
                            Docs
                          </Badge>
                        )}
                        {job.commentCount && job.commentCount > 0 && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <MessageSquare className="h-3 w-3" />
                            {job.commentCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </DataTableRow>
              </Link>
            ))
          ) : (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No jobs found"
              description={search ? "Try adjusting your search or filters" : "You don't have any assigned jobs yet."}
            />
          )}
        </div>
      </div>
    </div>
  );
}

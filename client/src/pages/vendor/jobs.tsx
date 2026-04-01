import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useSearch, useLocation } from "wouter";
import { Search, FileText, Filter, Calendar, Upload, MessageSquare, AlertTriangle, Zap, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { VendorHeader } from "@/components/vendor-header";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TypingJob, WorkOrder, JobType } from "@shared/schema";

interface VendorJob extends TypingJob {
  workOrder?: WorkOrder;
  jobType?: JobType;
  hasInputDocs?: boolean;
  commentCount?: number;
  priority?: "urgent" | "today" | "standard";
}

export default function VendorJobs() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const urlParams = new URLSearchParams(searchString);
  const initialStatus = urlParams.get("status") || "all";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const s = params.get("status");
    if (s) setStatusFilter(s);
  }, [searchString]);
  const { toast } = useToast();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const { data: jobs, isLoading } = useQuery<VendorJob[]>({
    queryKey: [`/api/vendor/jobs?status=${statusFilter}`],
  });

  const invalidateJobs = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/vendor/dashboard"] });
  };

  const startWorkMutation = useMutation({
    mutationFn: async (jobId: string) => {
      setPendingAction(`start-${jobId}`);
      return apiRequest("POST", `/api/vendor/jobs/${jobId}/start-work`);
    },
    onSuccess: () => {
      toast({ title: "Work started", description: "Job has been moved to In Progress" });
      invalidateJobs();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
    onSettled: () => setPendingAction(null),
  });

  const completeMutation = useMutation({
    mutationFn: async (jobId: string) => {
      setPendingAction(`complete-${jobId}`);
      return apiRequest("POST", `/api/vendor/jobs/${jobId}/complete`);
    },
    onSuccess: () => {
      toast({ title: "Job completed", description: "Job has been marked as done" });
      invalidateJobs();
      setLocation("/vendor/jobs");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
    onSettled: () => setPendingAction(null),
  });

  const filteredJobs = jobs?.filter((job) => {
    const matchesSearch = !search || 
      job.workOrder?.woNumber.toLowerCase().includes(search.toLowerCase()) ||
      job.workOrder?.applicantName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "Completed" ? (job.status === "ReadyForScheduling" || job.status === "Returned") : job.status === statusFilter);
    return matchesSearch && matchesStatus;
  });

  const sortedJobs = filteredJobs?.sort((a, b) => {
    const priorityOrder = { urgent: 0, today: 1, standard: 2 };
    return (priorityOrder[a.priority || "standard"] || 2) - (priorityOrder[b.priority || "standard"] || 2);
  });

  return (
    <div className="min-h-screen bg-background">
      <VendorHeader />

      {/* Page Header */}
      <div className="gradient-header border-b border-border/50">
        <div className="px-4 lg:px-8 py-6">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">My Jobs</h1>
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
              <SelectItem value="SubmittedToVendor">New</SelectItem>
              <SelectItem value="InProcess">In Progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 xs:grid-cols-3 gap-4">
          <Card className="border border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">New Jobs</p>
              <p className="text-2xl font-bold text-foreground mt-1.5 tabular-nums">
                {jobs?.filter(j => j.status === "SubmittedToVendor").length || 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">In Progress</p>
              <p className="text-2xl font-bold text-foreground mt-1.5 tabular-nums">
                {jobs?.filter(j => j.status === "InProcess").length || 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed</p>
              <p className="text-2xl font-bold text-foreground mt-1.5 tabular-nums">
                {jobs?.filter(j => j.status === "ReadyForScheduling" || j.status === "Returned").length || 0}
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
          ) : sortedJobs && sortedJobs.length > 0 ? (
            sortedJobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <DataTableRow className="mb-0" data-testid={`vendor-job-row-${job.id}`}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {job.workOrder?.woNumber || "N/A"}
                            </span>
                            <StatusBadge status={job.status} vendorContext />
                            {job.priority === "urgent" && (
                              <Badge variant="destructive" className="text-[10px] gap-0.5"><AlertTriangle className="h-3 w-3" /> Urgent</Badge>
                            )}
                            {job.priority === "today" && (
                              <Badge variant="secondary" className="text-[10px] gap-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 no-default-hover-elevate no-default-active-elevate"><Zap className="h-3 w-3" /> New Today</Badge>
                            )}
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

                    {(job.status === "SubmittedToVendor" || job.status === "InProcess") && (
                      <div className="flex items-center gap-2 pt-3 border-t border-border/50 md:hidden" onClick={(e) => e.preventDefault()}>
                        {job.status === "SubmittedToVendor" && (
                          <Button
                            size="sm"
                            className="flex-1 gap-1.5 bg-emerald-600 text-white"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); startWorkMutation.mutate(job.id); }}
                            disabled={pendingAction === `start-${job.id}`}
                            data-testid={`button-start-work-${job.id}`}
                          >
                            {pendingAction === `start-${job.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Start Work
                          </Button>
                        )}
                        {job.status === "InProcess" && (
                          <>
                            <Button
                              size="sm"
                              className="flex-1 gap-1.5 bg-emerald-600 text-white"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); completeMutation.mutate(job.id); }}
                              disabled={pendingAction === `complete-${job.id}`}
                              data-testid={`button-complete-job-${job.id}`}
                            >
                              {pendingAction === `complete-${job.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Mark Done
                            </Button>
                            <Link href={`/jobs/${job.id}`} onClick={(e: any) => e.stopPropagation()}>
                              <Button size="sm" variant="outline" className="gap-1.5" data-testid={`button-request-docs-${job.id}`}>
                                <ExternalLink className="h-3.5 w-3.5" />
                                Request Docs
                              </Button>
                            </Link>
                          </>
                        )}
                      </div>
                    )}
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

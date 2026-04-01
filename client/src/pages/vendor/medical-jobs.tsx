import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { JobWizardDialog } from "./job-detail";
import {
  Search, Stethoscope, Upload, MessageSquare,
  AlertTriangle, CheckCircle2, Loader2, Clock, Inbox,
  Zap, ArrowRight, User
} from "lucide-react";
import { formatRelativeTime } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
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

export default function MedicalJobs() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const urlParams = new URLSearchParams(searchString);
  const initialStatus = urlParams.get("status") || "all";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const { toast } = useToast();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const s = params.get("status");
    if (s) setStatusFilter(s);
  }, [searchString]);

  const { data: allJobs, isLoading } = useQuery<VendorJob[]>({
    queryKey: ["/api/vendor/jobs"],
  });

  const jobs = allJobs?.filter(j => j.jobType?.category === "Medical") || [];

  const invalidateJobs = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/vendor/dashboard"] });
  };

  const acceptMutation = useMutation({
    mutationFn: async (jobId: string) => {
      setPendingAction(`accept-${jobId}`);
      return apiRequest("POST", `/api/vendor/jobs/${jobId}/accept`);
    },
    onSuccess: () => {
      toast({ title: "Job accepted", description: "Job has been moved to In Progress" });
      invalidateJobs();
      setLocation("/vendor/jobs");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    onSettled: () => setPendingAction(null),
  });

  const completeMutation = useMutation({
    mutationFn: async (jobId: string) => {
      setPendingAction(`complete-${jobId}`);
      return apiRequest("POST", `/api/vendor/jobs/${jobId}/complete`);
    },
    onSuccess: () => {
      toast({ title: "Job completed" });
      invalidateJobs();
      setLocation("/vendor/jobs");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    onSettled: () => setPendingAction(null),
  });

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = !search ||
      job.workOrder?.woNumber.toLowerCase().includes(search.toLowerCase()) ||
      job.workOrder?.applicantName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "NeedsAction" ? (job.status === "SubmittedToVendor" || job.priority === "urgent") : 
       statusFilter === "Completed" ? (job.status === "ReadyForScheduling" || job.status === "Returned") :
       job.status === statusFilter);
    return matchesSearch && matchesStatus;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    const order = { urgent: 0, today: 1, standard: 2 };
    return (order[a.priority || "standard"] || 2) - (order[b.priority || "standard"] || 2);
  });

  const statusCounts = {
    all: jobs.length,
    SubmittedToVendor: jobs.filter(j => j.status === "SubmittedToVendor").length,
    InProcess: jobs.filter(j => j.status === "InProcess").length,
    Completed: jobs.filter(j => j.status === "ReadyForScheduling" || j.status === "Returned").length,
  };

  return (
    <div className="p-4 lg:p-6 max-w-6xl">
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-md bg-blue-500/10 flex items-center justify-center">
            <Stethoscope className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="heading-medical">Medical Jobs</h1>
            <p className="text-sm text-muted-foreground">
              {statusCounts.SubmittedToVendor > 0
                ? `${statusCounts.SubmittedToVendor} ${statusCounts.SubmittedToVendor === 1 ? "job" : "jobs"} awaiting acceptance`
                : "All caught up"}
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-md" />)}
          </div>
          <Skeleton className="h-12 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3" data-testid="section-medical-stats">
            <Card
              className="hover-elevate cursor-pointer h-full"
              onClick={() => setStatusFilter("SubmittedToVendor")}
              data-testid="tile-medical-new"
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="h-7 w-7 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Inbox className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs text-muted-foreground">New</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-foreground" data-testid="text-medical-new-count">{statusCounts.SubmittedToVendor}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 hidden sm:block">Awaiting acceptance</p>
              </CardContent>
            </Card>
            <Card
              className="hover-elevate cursor-pointer h-full"
              onClick={() => setStatusFilter("InProcess")}
              data-testid="tile-medical-progress"
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="h-7 w-7 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-xs text-muted-foreground">In Progress</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-foreground" data-testid="text-medical-progress-count">{statusCounts.InProcess}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 hidden sm:block">Being worked on</p>
              </CardContent>
            </Card>
            <Card
              className="hover-elevate cursor-pointer h-full"
              onClick={() => setStatusFilter("Completed")}
              data-testid="tile-medical-completed"
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="h-7 w-7 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-xs text-muted-foreground">Completed</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-foreground" data-testid="text-medical-completed-count">{statusCounts.Completed}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 hidden sm:block">Work submitted</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by WO number or applicant name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-medical"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 shrink-0">
              {[
                { key: "all", label: "All" },
                { key: "NeedsAction", label: "Needs Action" },
                { key: "SubmittedToVendor", label: "New" },
                { key: "InProcess", label: "Active" },
              ].map(({ key, label }) => (
                <Button
                  key={key}
                  variant={statusFilter === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(key)}
                  data-testid={`filter-${key}`}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xs font-medium text-muted-foreground mb-3" data-testid="heading-medical-jobs-list">
              {statusFilter === "all" ? "All Jobs" : 
               statusFilter === "NeedsAction" ? "Jobs Needing Action" :
               statusFilter === "SubmittedToVendor" ? "New Jobs" :
               statusFilter === "InProcess" ? "Active Jobs" :
               statusFilter === "Completed" ? "Completed Jobs" : "Jobs"}
              {` (${sortedJobs.length})`}
            </h2>
            <div className="space-y-2">
              {sortedJobs.length > 0 ? (
                sortedJobs.map((job) => (
                  <div key={job.id} onClick={() => setSelectedJobId(job.id)}>
                    <Card
                      className={`hover-elevate cursor-pointer ${job.priority === "urgent" ? "border-red-500/30 dark:border-red-500/20" : ""}`}
                      data-testid={`medical-job-${job.id}`}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start gap-3">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                            job.priority === "urgent" ? "bg-red-500/10" : "bg-blue-500/10"
                          }`}>
                            {job.priority === "urgent" ? (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            ) : (
                              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{job.workOrder?.woNumber || "N/A"}</span>
                              <StatusBadge status={job.status} vendorContext />
                              {job.priority === "urgent" && (
                                <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{job.workOrder?.applicantName}</p>
                            {job.jobType && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {job.jobType.name}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {job.hasInputDocs && (
                                <Badge variant="outline" className="text-[10px] gap-0.5">
                                  <Upload className="h-3 w-3" /> Docs
                                </Badge>
                              )}
                              {job.commentCount && job.commentCount > 0 && (
                                <Badge variant="outline" className="text-[10px] gap-0.5">
                                  <MessageSquare className="h-3 w-3" /> {job.commentCount}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground hidden sm:block">
                                {job.sentAt ? formatRelativeTime(job.sentAt) : ""}
                              </span>
                              {job.status === "SubmittedToVendor" && (
                                <Button
                                  size="sm"
                                  className="gap-1.5 ml-auto"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); acceptMutation.mutate(job.id); }}
                                  disabled={pendingAction === `accept-${job.id}`}
                                  data-testid={`button-accept-${job.id}`}
                                >
                                  {pendingAction === `accept-${job.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                  Accept
                                </Button>
                              )}
                              {job.status === "InProcess" && (
                                <div className="ml-auto flex items-center gap-1.5 shrink-0">
                                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">Open to complete</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))
              ) : (
                <Card>
                  <CardContent className="p-4 sm:p-8">
                    <EmptyState
                      icon={<Stethoscope className="h-6 w-6" />}
                      title="No medical jobs found"
                      description={search ? "Try adjusting your search or filters" : "No medical jobs assigned yet."}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
      <JobWizardDialog
        jobId={selectedJobId}
        open={!!selectedJobId}
        onClose={() => setSelectedJobId(null)}
      />
    </div>
  );
}

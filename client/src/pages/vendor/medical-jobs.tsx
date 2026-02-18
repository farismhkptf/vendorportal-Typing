import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import {
  Search, Stethoscope, Upload, MessageSquare,
  AlertTriangle, CheckCircle2, Loader2
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
  const urlParams = new URLSearchParams(searchString);
  const initialStatus = urlParams.get("status") || "all";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const { toast } = useToast();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

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
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    onSettled: () => setPendingAction(null),
  });

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = !search ||
      job.workOrder?.woNumber.toLowerCase().includes(search.toLowerCase()) ||
      job.workOrder?.applicantName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "NeedsAction" ? (job.status === "SentToVendor" || job.priority === "urgent") : job.status === statusFilter);
    return matchesSearch && matchesStatus;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    const order = { urgent: 0, today: 1, standard: 2 };
    return (order[a.priority || "standard"] || 2) - (order[b.priority || "standard"] || 2);
  });

  const statusCounts = {
    all: jobs.length,
    SentToVendor: jobs.filter(j => j.status === "SentToVendor").length,
    InProgress: jobs.filter(j => j.status === "InProgress").length,
    WaitingForDocs: jobs.filter(j => j.status === "WaitingForDocs").length,
    Returned: jobs.filter(j => j.status === "Returned").length,
  };

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-md bg-blue-500/10 flex items-center justify-center">
            <Stethoscope className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground" data-testid="heading-medical">Medical Jobs</h1>
            <p className="text-sm text-muted-foreground">{jobs.length} total jobs</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" data-testid="status-pills">
        {[
          { key: "all", label: "All", count: statusCounts.all },
          { key: "SentToVendor", label: "New", count: statusCounts.SentToVendor },
          { key: "NeedsAction", label: "Needs Action", count: jobs.filter(j => j.status === "SentToVendor" || (j.priority === "urgent")).length },
          { key: "InProgress", label: "In Progress", count: statusCounts.InProgress },
          { key: "WaitingForDocs", label: "Waiting", count: statusCounts.WaitingForDocs },
          { key: "Returned", label: "Returned", count: statusCounts.Returned },
        ].map(({ key, label, count }) => (
          <Button
            key={key}
            variant={statusFilter === key ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setStatusFilter(key)}
            data-testid={`filter-${key}`}
          >
            {label}
            {count > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 min-w-[18px]">{count}</Badge>
            )}
          </Button>
        ))}
      </div>

      <div className="relative">
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

      <div className="space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-24 rounded-md" />
            <Skeleton className="h-24 rounded-md" />
            <Skeleton className="h-24 rounded-md" />
          </>
        ) : sortedJobs.length > 0 ? (
          sortedJobs.map((job) => (
            <Link key={job.id} href={`/medical/${job.id}`}>
              <Card
                className={`hover-elevate cursor-pointer ${job.priority === "urgent" ? "border-red-500/30 dark:border-red-500/20" : ""}`}
                data-testid={`medical-job-${job.id}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${
                      job.priority === "urgent" ? "bg-red-500/10" : "bg-blue-500/10"
                    }`}>
                      {job.priority === "urgent" ? (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{job.workOrder?.woNumber || "N/A"}</span>
                        <StatusBadge status={job.status} />
                        {job.priority === "urgent" && (
                          <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">{job.workOrder?.applicantName}</p>
                        {job.costSnapshot && (
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0">AED {job.costSnapshot}</span>
                        )}
                      </div>
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
                        {job.status === "SentToVendor" && (
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
                        {job.status === "InProgress" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 ml-auto"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); completeMutation.mutate(job.id); }}
                            disabled={pendingAction === `complete-${job.id}`}
                            data-testid={`button-complete-${job.id}`}
                          >
                            {pendingAction === `complete-${job.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Done
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <Card>
            <CardContent className="p-8">
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
  );
}

import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Shield, Stethoscope, AlertTriangle, ArrowRight,
  CreditCard, Clock, CheckCircle2, TrendingUp,
  Inbox, Loader2, Zap, PartyPopper
} from "lucide-react";
import { formatRelativeTime } from "@/lib/format-date";
import { useVendorAuth } from "@/hooks/use-vendor-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TypingJob, WorkOrder, JobType } from "@shared/schema";

interface DashboardData {
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    urgent: number;
    todayPending: number;
    activeEid: number;
    activeMedical: number;
  };
  recentJobs: Array<TypingJob & { workOrder?: WorkOrder; jobType?: JobType; urgent?: boolean; priority?: "urgent" | "today" | "standard" }>;
  staleAlerts?: {
    unacceptedJobs: number;
    waitingForDocsJobs: number;
  };
}

interface PerformanceData {
  completionRate: number;
  avgTurnaroundHours: number;
  monthlyEarnings: number;
  totalJobsThisMonth: number;
  jobsByCategory: Record<string, number>;
  statusBreakdown: { pending: number; inProgress: number; completed: number; cancelled: number };
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function VendorDashboard() {
  const { user } = useVendorAuth();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/vendor/dashboard"],
  });

  const { data: performanceData } = useQuery<PerformanceData>({
    queryKey: ["/api/vendor/performance"],
  });

  const { data: balanceData } = useQuery<{ balance: number }>({
    queryKey: ["/api/vendor/wallet/balance"],
  });

  const acceptMutation = useMutation({
    mutationFn: async (jobId: string) => apiRequest("POST", `/api/vendor/jobs/${jobId}/accept`),
    onSuccess: () => {
      toast({ title: "Job accepted" });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const stats = data?.stats;
  const recentJobs = data?.recentJobs || [];
  const staleAlerts = data?.staleAlerts;
  const needsAttention = recentJobs.filter(j => j.status === "SentToVendor" || j.priority === "urgent");

  const hasStaleAlerts = staleAlerts && (staleAlerts.unacceptedJobs > 0 || staleAlerts.waitingForDocsJobs > 0);

  return (
    <div className="p-4 lg:p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-foreground" data-testid="text-greeting">
          {getGreeting()}, {user?.name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {needsAttention.length > 0
            ? `${needsAttention.length} ${needsAttention.length === 1 ? "job needs" : "jobs need"} your attention`
            : "You're all caught up"}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-3">
            <Skeleton className="h-16 rounded-md" />
            <Skeleton className="h-16 rounded-md" />
            <Skeleton className="h-16 rounded-md" />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-24 rounded-md" />
            <Skeleton className="h-32 rounded-md" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-5">
            {hasStaleAlerts && (
              <div className="space-y-2">
                {staleAlerts.unacceptedJobs > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/20" data-testid="alert-unaccepted">
                    <Inbox className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{staleAlerts.unacceptedJobs}</span> {staleAlerts.unacceptedJobs === 1 ? "job" : "jobs"} awaiting acceptance
                      <span className="text-muted-foreground"> &middot; pending over 12 hours</span>
                    </p>
                  </div>
                )}
                {staleAlerts.waitingForDocsJobs > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-md bg-blue-500/10 border border-blue-500/20" data-testid="alert-waiting-docs">
                    <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{staleAlerts.waitingForDocsJobs}</span> {staleAlerts.waitingForDocsJobs === 1 ? "job" : "jobs"} waiting for docs
                      <span className="text-muted-foreground"> &middot; pending over 24 hours</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            <div>
              <h2 className="text-xs font-medium text-muted-foreground mb-3" data-testid="heading-action-queue">
                Action Queue
              </h2>
              {needsAttention.length > 0 ? (
                <Card>
                  <div className="divide-y divide-border/50">
                  {needsAttention.map((job) => {
                    const isEid = job.jobType?.category === "EID";
                    const detailUrl = isEid ? `/vendor/eid/${job.id}` : `/vendor/medical/${job.id}`;
                    const isAccepting = acceptMutation.isPending && acceptMutation.variables === job.id;
                    return (
                      <Link key={job.id} href={detailUrl}>
                        <div
                          className={`flex items-center gap-3 p-3 hover-elevate cursor-pointer ${
                            job.priority === "urgent" ? "bg-red-500/5 dark:bg-red-500/10" : ""
                          }`}
                          data-testid={`action-job-${job.id}`}
                        >
                          <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${
                            job.priority === "urgent" ? "bg-red-500/10" : isEid ? "bg-amber-500/10" : "bg-blue-500/10"
                          }`}>
                            {job.priority === "urgent" ? (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            ) : isEid ? (
                              <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            ) : (
                              <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{job.workOrder?.woNumber || "N/A"}</span>
                              <StatusBadge status={job.status} />
                              {job.priority === "urgent" && (
                                <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground truncate">{job.workOrder?.applicantName}</p>
                              {job.costSnapshot && (
                                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">AED {job.costSnapshot}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground hidden sm:block">
                              {job.sentAt ? formatRelativeTime(job.sentAt) : ""}
                            </span>
                            {job.status === "SentToVendor" && (
                              <Button
                                size="sm"
                                className="gap-1.5"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); acceptMutation.mutate(job.id); }}
                                disabled={isAccepting}
                                data-testid={`button-accept-${job.id}`}
                              >
                                {isAccepting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                Accept
                              </Button>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  </div>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <PartyPopper className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground">You're all caught up</p>
                    <p className="text-xs text-muted-foreground mt-1">No jobs need your immediate attention</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN — single cohesive panel */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-5 space-y-0">
                {/* Wallet Balance */}
                <Link href="/vendor/wallet">
                  <div className="flex items-center justify-between gap-2 hover-elevate rounded-md -mx-2 px-2 py-1 cursor-pointer" data-testid="card-wallet-balance">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Wallet Balance</p>
                      <p className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-wallet-balance">
                        AED {(balanceData?.balance || 0).toLocaleString()}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>

                {/* Divider */}
                <div className="border-t border-border/60 my-4" />

                {/* Active Jobs */}
                <p className="text-xs font-medium text-muted-foreground mb-3">Active Jobs</p>
                <div className="grid grid-cols-2 gap-3 mb-1">
                  <Link href="/vendor/eid">
                    <div className="p-3 rounded-md bg-muted/50 hover-elevate cursor-pointer" data-testid="stat-eid-jobs">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Shield className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs text-muted-foreground">Emirates ID</span>
                      </div>
                      <p className="text-xl font-bold text-foreground" data-testid="text-eid-count">
                        {stats?.activeEid || 0}
                      </p>
                    </div>
                  </Link>
                  <Link href="/vendor/medical">
                    <div className="p-3 rounded-md bg-muted/50 hover-elevate cursor-pointer" data-testid="stat-medical-jobs">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Stethoscope className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs text-muted-foreground">Medical</span>
                      </div>
                      <p className="text-xl font-bold text-foreground" data-testid="text-medical-count">
                        {stats?.activeMedical || 0}
                      </p>
                    </div>
                  </Link>
                </div>

                {/* Urgent count inline */}
                {(stats?.urgent || 0) > 0 && (
                  <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-red-500/10" data-testid="stat-urgent-count">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <p className="text-xs">
                      <span className="font-medium text-red-600 dark:text-red-400">{stats?.urgent}</span>
                      <span className="text-muted-foreground"> priority {stats?.urgent === 1 ? "job" : "jobs"}</span>
                    </p>
                  </div>
                )}

                {/* Divider */}
                {performanceData && <div className="border-t border-border/60 my-4" />}

                {/* Performance */}
                {performanceData && (
                  <div data-testid="section-performance">
                    <p className="text-xs font-medium text-muted-foreground mb-3">Performance</p>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-sm text-muted-foreground">Completion</span>
                          </div>
                          <span className="text-sm font-bold" data-testid="text-completion-rate">{performanceData.completionRate}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${Math.min(performanceData.completionRate, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm text-muted-foreground">Avg. Turnaround</span>
                        </div>
                        <span className="text-sm font-bold" data-testid="text-turnaround">{performanceData.avgTurnaroundHours}h</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                          <span className="text-sm text-muted-foreground">This Month</span>
                        </div>
                        <span className="text-sm font-bold" data-testid="text-monthly-earnings">AED {performanceData.monthlyEarnings.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

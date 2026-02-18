import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Shield, Stethoscope, AlertTriangle, ArrowRight,
  CreditCard, Clock, CheckCircle2, Zap, TrendingUp, FileText,
  Calendar, Inbox
} from "lucide-react";
import { formatDate } from "@/lib/format-date";
import { useVendorAuth } from "@/hooks/use-vendor-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { TypingJob, WorkOrder, JobType } from "@shared/schema";

interface DashboardData {
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    urgent: number;
    todayPending: number;
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

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/vendor/dashboard"],
  });

  const { data: performanceData } = useQuery<PerformanceData>({
    queryKey: ["/api/vendor/performance"],
  });

  const { data: balanceData } = useQuery<{ balance: number }>({
    queryKey: ["/api/vendor/wallet/balance"],
  });

  const stats = data?.stats;
  const recentJobs = data?.recentJobs || [];
  const staleAlerts = data?.staleAlerts;
  const eidJobs = recentJobs.filter(j => j.jobType?.category === "EID");
  const medJobs = recentJobs.filter(j => j.jobType?.category === "Medical");
  const urgentJobs = recentJobs.filter(j => j.priority === "urgent" || j.urgent);
  const needsAttention = recentJobs.filter(j => j.status === "SentToVendor" || j.priority === "urgent");

  return (
    <div className="space-y-8 p-4 lg:p-6 max-w-5xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground" data-testid="text-greeting">
          {getGreeting()}, {user?.name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here's what needs your attention today
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-md" />)}
          </div>
          <Skeleton className="h-48 rounded-md" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/vendor/eid">
              <Card className="hover-elevate cursor-pointer group" data-testid="stat-eid-jobs">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="h-10 w-10 rounded-md bg-amber-500/10 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-eid-count">
                    {performanceData?.jobsByCategory?.["EID"] || 0}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">Emirates ID</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/vendor/medical">
              <Card className="hover-elevate cursor-pointer group" data-testid="stat-medical-jobs">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="h-10 w-10 rounded-md bg-blue-500/10 flex items-center justify-center">
                      <Stethoscope className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-medical-count">
                    {performanceData?.jobsByCategory?.["Medical"] || 0}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">Medical</p>
                </CardContent>
              </Card>
            </Link>

            <Card data-testid="stat-urgent-count">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className={`h-10 w-10 rounded-md flex items-center justify-center ${(stats?.urgent || 0) > 0 ? "bg-red-500/10" : "bg-muted"}`}>
                    <AlertTriangle className={`h-5 w-5 ${(stats?.urgent || 0) > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
                  </div>
                </div>
                <p className={`text-2xl font-bold ${(stats?.urgent || 0) > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                  {stats?.urgent || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">Priority</p>
              </CardContent>
            </Card>

            <Link href="/vendor/wallet">
              <Card className="hover-elevate cursor-pointer group" data-testid="stat-wallet">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="h-10 w-10 rounded-md bg-emerald-500/10 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-wallet-balance">
                    AED {(balanceData?.balance || 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">Wallet</p>
                </CardContent>
              </Card>
            </Link>
          </div>

          {needsAttention.length > 0 && (
            <div data-testid="section-needs-attention">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <h2 className="text-lg font-semibold text-foreground">Needs Your Attention</h2>
                <Badge variant="secondary" className="text-xs">{needsAttention.length}</Badge>
              </div>
              <div className="space-y-2">
                {needsAttention.slice(0, 5).map((job) => {
                  const isEid = job.jobType?.category === "EID";
                  const detailUrl = isEid ? `/vendor/eid/${job.id}` : `/vendor/medical/${job.id}`;
                  return (
                    <Link key={job.id} href={detailUrl}>
                      <Card
                        className={`hover-elevate cursor-pointer ${job.priority === "urgent" ? "border-red-500/30 dark:border-red-500/20" : ""}`}
                        data-testid={`attention-job-${job.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${
                                job.priority === "urgent"
                                  ? "bg-red-500/10"
                                  : isEid ? "bg-amber-500/10" : "bg-blue-500/10"
                              }`}>
                                {job.priority === "urgent" ? (
                                  <AlertTriangle className="h-5 w-5 text-red-500" />
                                ) : isEid ? (
                                  <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                ) : (
                                  <Stethoscope className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-sm">{job.workOrder?.woNumber || "N/A"}</span>
                                  <StatusBadge status={job.status} />
                                  {job.priority === "urgent" && (
                                    <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground truncate">{job.workOrder?.applicantName}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-muted-foreground">{job.sentAt ? formatDate(job.sentAt) : ""}</p>
                              {job.jobType && (
                                <Badge variant="outline" className="text-[10px] mt-1">{job.jobType.category}</Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {staleAlerts && (staleAlerts.unacceptedJobs > 0 || staleAlerts.waitingForDocsJobs > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {staleAlerts.unacceptedJobs > 0 && (
                <Card className="border-amber-500/20" data-testid="alert-unaccepted">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Inbox className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {staleAlerts.unacceptedJobs} {staleAlerts.unacceptedJobs === 1 ? "job" : "jobs"} awaiting acceptance
                        </p>
                        <p className="text-xs text-muted-foreground">Pending over 12 hours</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {staleAlerts.waitingForDocsJobs > 0 && (
                <Card className="border-blue-500/20" data-testid="alert-waiting-docs">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {staleAlerts.waitingForDocsJobs} {staleAlerts.waitingForDocsJobs === 1 ? "job" : "jobs"} waiting for docs
                        </p>
                        <p className="text-xs text-muted-foreground">Pending over 24 hours</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {performanceData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="section-performance">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-9 w-9 rounded-md bg-emerald-500/10 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-sm text-muted-foreground">Completion</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-completion-rate">{performanceData.completionRate}%</p>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.min(performanceData.completionRate, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-9 w-9 rounded-md bg-blue-500/10 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm text-muted-foreground">Avg. Turnaround</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-turnaround">{performanceData.avgTurnaroundHours}h</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-9 w-9 rounded-md bg-violet-500/10 flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <span className="text-sm text-muted-foreground">This Month</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-monthly-earnings">AED {performanceData.monthlyEarnings.toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {recentJobs.length > 0 && (
            <div data-testid="section-recent-jobs">
              <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
              <div className="space-y-2">
                {recentJobs.slice(0, 6).map((job) => {
                  const isEid = job.jobType?.category === "EID";
                  const detailUrl = isEid ? `/vendor/eid/${job.id}` : `/vendor/medical/${job.id}`;
                  return (
                    <Link key={job.id} href={detailUrl}>
                      <div className="flex items-center gap-3 p-3 rounded-md hover-elevate cursor-pointer" data-testid={`recent-job-${job.id}`}>
                        <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${
                          isEid ? "bg-amber-500/10" : "bg-blue-500/10"
                        }`}>
                          {isEid ? (
                            <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{job.workOrder?.woNumber}</span>
                            <StatusBadge status={job.status} />
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{job.workOrder?.applicantName}</p>
                        </div>
                        <p className="text-xs text-muted-foreground shrink-0">
                          {job.sentAt ? formatDate(job.sentAt) : ""}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

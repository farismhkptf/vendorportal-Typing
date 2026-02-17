import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  FileText, Clock, CheckCircle2, AlertTriangle, 
  ArrowRight, Calendar, Zap, TrendingUp, Wallet,
  Info, Inbox, Play
} from "lucide-react";
import { formatDate } from "@/lib/format-date";
import { useVendorAuth } from "@/hooks/use-vendor-auth";
import { VendorHeader } from "@/components/vendor-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
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

function VendorPerformance({ data }: { data: PerformanceData }) {
  const maxCategoryCount = Math.max(...Object.values(data.jobsByCategory), 1);

  return (
    <div data-testid="section-vendor-performance">
      <h2 className="text-lg font-semibold text-foreground mb-4">Your Performance</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <Card className="border border-border/50" data-testid="stat-completion-rate">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-2xl font-semibold text-foreground" data-testid="text-completion-rate">{data.completionRate}%</p>
            <p className="text-sm text-muted-foreground mb-2">Completion Rate</p>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(data.completionRate, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50" data-testid="stat-avg-turnaround">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-2xl font-semibold text-foreground" data-testid="text-avg-turnaround">{data.avgTurnaroundHours}h</p>
            <p className="text-sm text-muted-foreground">Avg. Turnaround</p>
          </CardContent>
        </Card>

        <Card className="border border-border/50" data-testid="stat-monthly-earnings">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-5 w-5 text-violet-500" />
            </div>
            <p className="text-2xl font-semibold text-foreground" data-testid="text-monthly-earnings">
              AED {data.monthlyEarnings.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">This Month's Earnings</p>
          </CardContent>
        </Card>
      </div>

      {Object.keys(data.jobsByCategory).length > 0 && (
        <Card className="border border-border/50" data-testid="card-category-breakdown">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-foreground mb-3">Jobs by Category</p>
            <div className="space-y-3">
              {Object.entries(data.jobsByCategory).map(([category, count]) => (
                <div key={category} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-16 shrink-0">{category}</span>
                  <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded transition-all ${
                        category === "Medical" ? "bg-blue-500" : category === "EID" ? "bg-amber-500" : "bg-violet-500"
                      }`}
                      style={{ width: `${(count / maxCategoryCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground w-8 text-right" data-testid={`text-category-count-${category}`}>{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function VendorDashboard() {
  const { user } = useVendorAuth();
  
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/vendor/dashboard"],
  });

  const { data: performanceData, isLoading: perfLoading } = useQuery<PerformanceData>({
    queryKey: ["/api/vendor/performance"],
  });

  const stats = data?.stats;
  const recentJobs = data?.recentJobs || [];
  const staleAlerts = data?.staleAlerts;

  return (
    <div className="min-h-screen bg-background">
      <VendorHeader />
      
      <div className="gradient-header border-b border-border/50">
        <div className="px-4 lg:px-8 py-6">
          <h1 className="text-xl lg:text-2xl font-semibold text-foreground">
            {getGreeting()}, {user?.name?.split(" ")[0] || "there"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's your work overview for today
          </p>
        </div>
      </div>

      <div className="p-4 lg:p-8 space-y-6">
        {staleAlerts && staleAlerts.unacceptedJobs > 0 && (
          <Link href="/vendor/jobs">
            <Card className="border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 hover-elevate cursor-pointer" data-testid="alert-unaccepted-jobs">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-amber-100 dark:bg-amber-900/40 shrink-0">
                    <AlertTriangle className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      You have {staleAlerts.unacceptedJobs} {staleAlerts.unacceptedJobs === 1 ? "job" : "jobs"} waiting for acceptance
                    </p>
                    <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">These jobs have been pending for over 12 hours</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {staleAlerts && staleAlerts.waitingForDocsJobs > 0 && (
          <Link href="/vendor/jobs">
            <Card className="border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/20 hover-elevate cursor-pointer" data-testid="alert-waiting-docs-jobs">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 shrink-0">
                    <Info className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      {staleAlerts.waitingForDocsJobs} {staleAlerts.waitingForDocsJobs === 1 ? "job is" : "jobs are"} waiting for document resubmission
                    </p>
                    <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-0.5">Documents have been pending for over 24 hours</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {isLoading ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border border-border/50" data-testid="stat-pending">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Clock className="h-5 w-5 text-amber-500" />
                    {(stats?.todayPending || 0) > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {stats?.todayPending} today
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-semibold text-foreground">{stats?.pending || 0}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </CardContent>
              </Card>

              <Card className="border border-border/50" data-testid="stat-in-progress">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Zap className="h-5 w-5 text-blue-500" />
                  </div>
                  <p className="text-2xl font-semibold text-foreground">{stats?.inProgress || 0}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </CardContent>
              </Card>

              <Card className="border border-border/50" data-testid="stat-completed">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-semibold text-foreground">{stats?.completed || 0}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </CardContent>
              </Card>

              <Card className={`border ${(stats?.urgent || 0) > 0 ? "border-rose-200 dark:border-rose-800/50" : "border-border/50"}`} data-testid="stat-urgent">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  </div>
                  <p className="text-2xl font-semibold text-foreground">{stats?.urgent || 0}</p>
                  <p className="text-sm text-muted-foreground">Urgent</p>
                </CardContent>
              </Card>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="text-lg font-semibold text-foreground">Recent Jobs</h2>
                <Link href="/vendor/jobs">
                  <Button variant="ghost" size="sm" className="gap-1" data-testid="link-view-all-jobs">
                    View all
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {recentJobs.length > 0 ? (
                <div className="space-y-3">
                  {recentJobs.map((job) => (
                    <Link key={job.id} href={`/vendor/jobs/${job.id}`}>
                      <Card 
                        className={`border hover-elevate ${(job as any).urgent ? "border-red-300 dark:border-red-800" : "border-border/50"}`}
                        data-testid={`dashboard-job-${job.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                                (job as any).urgent 
                                  ? "bg-red-100 dark:bg-red-900/30" 
                                  : "bg-violet-100 dark:bg-violet-900/30"
                              }`}>
                                {(job as any).urgent ? (
                                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                ) : (
                                  <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-foreground text-sm">
                                    {job.workOrder?.woNumber || "N/A"}
                                  </span>
                                  <StatusBadge status={job.status} />
                                  {(job as any).priority === "urgent" && (
                                    <Badge variant="destructive" className="text-[10px] gap-0.5"><AlertTriangle className="h-3 w-3" /> Urgent</Badge>
                                  )}
                                  {(job as any).priority === "today" && (
                                    <Badge variant="secondary" className="text-[10px] gap-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 no-default-hover-elevate no-default-active-elevate"><Zap className="h-3 w-3" /> New Today</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground truncate">{job.workOrder?.applicantName}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                <Calendar className="h-3 w-3" />
                                {job.sentAt ? formatDate(job.sentAt) : ""}
                              </p>
                              {job.jobType && (
                                <p className="text-xs text-muted-foreground mt-0.5">{job.jobType.name}</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <Card className="border border-border/50">
                  <CardContent className="p-8">
                    <EmptyState
                      icon={<FileText className="h-6 w-6" />}
                      title="No jobs yet"
                      description="You don't have any assigned jobs. They'll appear here once assigned."
                    />
                  </CardContent>
                </Card>
              )}
            </div>

            {perfLoading && (
              <div className="space-y-4">
                <Skeleton className="h-6 w-40" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
                <Skeleton className="h-32 rounded-xl" />
              </div>
            )}

            {performanceData && <VendorPerformance data={performanceData} />}
          </>
        )}
      </div>

      {!isLoading && stats && ((stats.pending || 0) > 0 || (stats.inProgress || 0) > 0) && (
        <div className="fixed bottom-4 left-4 right-4 md:hidden z-20" data-testid="mobile-quick-actions">
          <Card className="border border-border/50 shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                {(stats.pending || 0) > 0 && (
                  <Link href="/vendor/jobs?status=SentToVendor" className="flex-1">
                    <Button size="sm" className="w-full gap-1.5 bg-amber-600 text-white" data-testid="quick-action-to-accept">
                      <Inbox className="h-3.5 w-3.5" />
                      {stats.pending} to accept
                    </Button>
                  </Link>
                )}
                {(stats.inProgress || 0) > 0 && (
                  <Link href="/vendor/jobs?status=InProgress" className="flex-1">
                    <Button size="sm" variant="outline" className="w-full gap-1.5" data-testid="quick-action-in-progress">
                      <Play className="h-3.5 w-3.5" />
                      {stats.inProgress} in progress
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

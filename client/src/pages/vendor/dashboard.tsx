import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  FileText, Clock, CheckCircle2, AlertTriangle, 
  ArrowRight, Calendar, Zap
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
  recentJobs: Array<TypingJob & { workOrder?: WorkOrder; jobType?: JobType; urgent?: boolean }>;
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

  const stats = data?.stats;
  const recentJobs = data?.recentJobs || [];

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

              <Card className="border border-border/50" data-testid="stat-urgent">
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
                                  {(job as any).urgent && (
                                    <Badge variant="destructive" className="text-xs">Urgent</Badge>
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
          </>
        )}
      </div>
    </div>
  );
}

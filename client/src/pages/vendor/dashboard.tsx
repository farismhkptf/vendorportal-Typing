import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Shield, Stethoscope, AlertTriangle, ArrowRight,
  CreditCard, Clock, CheckCircle2, Inbox, Loader2,
  Zap, Bell, ChevronRight
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
import type { VendorNotification } from "@shared/schema";

interface WoGroupedItem {
  woId: string;
  woNumber: string;
  applicantName: string;
  jobs: Array<{
    id: string;
    category: string;
    status: string;
    priority: string;
    sentAt: string | null;
    costSnapshot: number | null;
  }>;
}

interface ActivityItem {
  id: string;
  woNumber: string;
  applicantName: string;
  category: string;
  status: string;
  timestamp: string;
  sentAt: string | null;
}

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
  recentJobs: Array<any>;
  staleAlerts?: {
    unacceptedJobs: number;
    waitingForDocsJobs: number;
  };
  woGrouped: WoGroupedItem[];
  activityFeed: ActivityItem[];
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

  const { data: balanceData } = useQuery<{ balance: number }>({
    queryKey: ["/api/vendor/wallet/balance"],
  });

  const { data: notifications } = useQuery<VendorNotification[]>({
    queryKey: ["/api/vendor/notifications"],
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PUT", `/api/vendor/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/notifications/unread-count"] });
    },
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
  const woGrouped = data?.woGrouped || [];
  const activityFeed = data?.activityFeed || [];
  const staleAlerts = data?.staleAlerts;
  const hasStaleAlerts = staleAlerts && (staleAlerts.unacceptedJobs > 0 || staleAlerts.waitingForDocsJobs > 0);
  const unreadNotifications = (notifications || []).filter(n => !n.isRead).slice(0, 5);

  return (
    <div className="p-4 lg:p-6 max-w-6xl">
      {/* Greeting */}
      <div className="mb-5">
        <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-foreground" data-testid="text-greeting">
          {getGreeting()}, {user?.name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {(stats?.pending || 0) > 0
            ? `${stats?.pending} ${stats?.pending === 1 ? "job" : "jobs"} awaiting acceptance`
            : "You're all caught up"}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-md" />)}
          </div>
          <Skeleton className="h-48 rounded-md" />
          <Skeleton className="h-48 rounded-md" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* ── OVERVIEW STRIP ── */}
          <div className="flex gap-3 flex-wrap" data-testid="section-overview-strip">
            <div className="flex gap-3 flex-1 min-w-0">
              <Link href="/vendor/eid" className="flex-1 min-w-0">
                <Card className="hover-elevate cursor-pointer h-full" data-testid="tile-pending">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="h-7 w-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                        <Inbox className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="text-xs text-muted-foreground">Pending</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-pending-count">{stats?.pending || 0}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Not accepted</p>
                  </CardContent>
                </Card>
              </Link>
              <div className="flex-1 min-w-0">
                <Card className="h-full" data-testid="tile-in-progress">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="h-7 w-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                        <Zap className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-xs text-muted-foreground">In Progress</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-inprogress-count">{stats?.inProgress || 0}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Accepted, not done</p>
                  </CardContent>
                </Card>
              </div>
              <div className="flex-1 min-w-0">
                <Card className="h-full" data-testid="tile-completed">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="h-7 w-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-xs text-muted-foreground">Completed</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-completed-count">{stats?.completed || 0}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Done</p>
                  </CardContent>
                </Card>
              </div>
            </div>
            {/* Gap + Wallet */}
            <div className="w-px bg-border/40 hidden sm:block self-stretch" />
            <Link href="/vendor/wallet" className="min-w-[140px]">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="tile-wallet">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-7 w-7 rounded-md bg-violet-500/10 flex items-center justify-center">
                      <CreditCard className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <span className="text-xs text-muted-foreground">Wallet</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-wallet-balance">
                    AED {(balanceData?.balance || 0).toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">View details</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* ── ALERTS ── */}
          {hasStaleAlerts && (
            <div className="flex flex-col sm:flex-row gap-2">
              {staleAlerts.unacceptedJobs > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 flex-1" data-testid="alert-unaccepted">
                  <Inbox className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{staleAlerts.unacceptedJobs}</span> {staleAlerts.unacceptedJobs === 1 ? "job" : "jobs"} awaiting acceptance
                    <span className="text-muted-foreground"> -- pending over 12 hours</span>
                  </p>
                </div>
              )}
              {staleAlerts.waitingForDocsJobs > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-md bg-blue-500/10 border border-blue-500/20 flex-1" data-testid="alert-waiting-docs">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{staleAlerts.waitingForDocsJobs}</span> {staleAlerts.waitingForDocsJobs === 1 ? "job" : "jobs"} waiting for docs
                    <span className="text-muted-foreground"> -- pending over 24 hours</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── MAIN GRID ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* LEFT COLUMN: Action Queue + Activity Feed */}
            <div className="lg:col-span-3 space-y-5">
              {/* Action Queue — WO-based */}
              <div>
                <h2 className="text-xs font-medium text-muted-foreground mb-3" data-testid="heading-action-queue">
                  Active Work Orders
                </h2>
                {woGrouped.length > 0 ? (
                  <Card>
                    <div className="divide-y divide-border/50">
                      {woGrouped.map((wo) => {
                        const hasPending = wo.jobs.some(j => j.status === "SentToVendor");
                        const hasUrgent = wo.jobs.some(j => j.priority === "urgent");
                        return (
                          <div
                            key={wo.woId}
                            className={`p-3 ${hasUrgent ? "bg-red-500/5 dark:bg-red-500/10" : ""}`}
                            data-testid={`action-wo-${wo.woId}`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium">{wo.woNumber}</span>
                                  {hasUrgent && <Badge variant="destructive" className="text-[10px]">Urgent</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{wo.applicantName}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {wo.jobs.map((job) => {
                                const isEid = job.category === "EID";
                                const detailUrl = isEid ? `/vendor/eid/${job.id}` : `/vendor/medical/${job.id}`;
                                const isAccepting = acceptMutation.isPending && acceptMutation.variables === job.id;
                                return (
                                  <div
                                    key={job.id}
                                    className="flex items-center gap-2 p-2 rounded-md bg-muted/50 flex-1 min-w-[200px]"
                                    data-testid={`action-job-${job.id}`}
                                  >
                                    <div className={`h-6 w-6 rounded flex items-center justify-center shrink-0 ${isEid ? "bg-amber-500/10" : "bg-blue-500/10"}`}>
                                      {isEid
                                        ? <Shield className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                        : <Stethoscope className="h-3 w-3 text-blue-600 dark:text-blue-400" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-medium">{job.category}</span>
                                        <StatusBadge status={job.status as any} />
                                      </div>
                                      {job.costSnapshot && (
                                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400">AED {job.costSnapshot}</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {job.status === "SentToVendor" && (
                                        <Button
                                          size="sm"
                                          className="gap-1 h-7 text-xs"
                                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); acceptMutation.mutate(job.id); }}
                                          disabled={isAccepting}
                                          data-testid={`button-accept-${job.id}`}
                                        >
                                          {isAccepting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                          Accept
                                        </Button>
                                      )}
                                      <Link href={detailUrl}>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-view-${job.id}`}>
                                          <ChevronRight className="h-3.5 w-3.5" />
                                        </Button>
                                      </Link>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <CheckCircle2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm font-medium text-foreground">No active work orders</p>
                      <p className="text-xs text-muted-foreground mt-1">New jobs will appear here when assigned</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Activity Feed */}
              <div>
                <h2 className="text-xs font-medium text-muted-foreground mb-3" data-testid="heading-activity">
                  Recent Activity
                </h2>
                {activityFeed.length > 0 ? (
                  <Card>
                    <div className="divide-y divide-border/50">
                      {activityFeed.map((item) => {
                        const isEid = item.category === "EID";
                        const detailUrl = isEid ? `/vendor/eid/${item.id}` : `/vendor/medical/${item.id}`;
                        return (
                          <Link key={item.id} href={detailUrl}>
                            <div className="flex items-center gap-3 p-3 hover-elevate cursor-pointer" data-testid={`activity-${item.id}`}>
                              <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${isEid ? "bg-amber-500/10" : "bg-blue-500/10"}`}>
                                {isEid
                                  ? <Shield className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                  : <Stethoscope className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium">{item.woNumber}</span>
                                  <StatusBadge status={item.status as any} />
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{item.applicantName}</p>
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                                {formatRelativeTime(item.timestamp)}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <p className="text-sm text-muted-foreground">No recent activity</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Quick Actions + Notifications */}
            <div className="lg:col-span-2 space-y-5">
              {/* Quick Actions */}
              <div>
                <h2 className="text-xs font-medium text-muted-foreground mb-3" data-testid="heading-quick-actions">
                  Quick Actions
                </h2>
                <div className="grid grid-cols-1 gap-2">
                  <Link href="/vendor/eid">
                    <Card className="hover-elevate cursor-pointer" data-testid="quick-action-eid">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Emirates ID Jobs</p>
                          <p className="text-xs text-muted-foreground">{stats?.activeEid || 0} active</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                  <Link href="/vendor/medical">
                    <Card className="hover-elevate cursor-pointer" data-testid="quick-action-medical">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                          <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Medical Jobs</p>
                          <p className="text-xs text-muted-foreground">{stats?.activeMedical || 0} active</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                  <Link href="/vendor/wallet">
                    <Card className="hover-elevate cursor-pointer" data-testid="quick-action-wallet">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-violet-500/10 flex items-center justify-center shrink-0">
                          <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Wallet & Transactions</p>
                          <p className="text-xs text-muted-foreground">Balance: AED {(balanceData?.balance || 0).toLocaleString()}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              </div>

              {/* Inline Notifications */}
              <div>
                <h2 className="text-xs font-medium text-muted-foreground mb-3" data-testid="heading-notifications">
                  Notifications
                </h2>
                {unreadNotifications.length > 0 ? (
                  <Card>
                    <div className="divide-y divide-border/50">
                      {unreadNotifications.map((n) => {
                        const jobUrl = n.relatedJobId
                          ? ((n as any).jobCategory === "Medical" ? `/vendor/medical/${n.relatedJobId}` : `/vendor/eid/${n.relatedJobId}`)
                          : null;
                        return (
                          <div
                            key={n.id}
                            className="p-3 hover-elevate cursor-pointer"
                            onClick={() => {
                              if (!n.isRead) markReadMutation.mutate(n.id);
                              if (jobUrl) window.location.href = jobUrl;
                            }}
                            data-testid={`inline-notification-${n.id}`}
                          >
                            <div className="flex items-start gap-2">
                              <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground">{n.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  {n.createdAt ? formatRelativeTime(n.createdAt) : ""}
                                </p>
                              </div>
                              {(n as any).jobCategory && (
                                <Badge variant="secondary" className={`text-[10px] shrink-0 no-default-hover-elevate no-default-active-elevate ${(n as any).jobCategory === "EID" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"}`}>
                                  {(n as any).jobCategory}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Bell className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No new notifications</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Urgent count */}
              {(stats?.urgent || 0) > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-md bg-red-500/10 border border-red-500/20" data-testid="stat-urgent-count">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-sm">
                    <span className="font-medium text-red-600 dark:text-red-400">{stats?.urgent}</span>
                    <span className="text-muted-foreground"> priority {stats?.urgent === 1 ? "job" : "jobs"} need attention</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

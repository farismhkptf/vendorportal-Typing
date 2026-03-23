import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Shield, Stethoscope, AlertTriangle, ArrowRight,
  CreditCard, Clock, CheckCircle2, Inbox, Loader2,
  Zap, Bell, ChevronRight, TrendingUp,
  Timer, Award, FileText
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
  };
  woGrouped: WoGroupedItem[];
  activityFeed: ActivityItem[];
}

interface PerformanceData {
  completionRate: number;
  avgTurnaroundHours: number;
  monthlyEarnings: number;
  totalJobsThisMonth: number;
  jobsByCategory: Record<string, number>;
  statusBreakdown: {
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
  };
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatJobAge(sentAt: string | null): string {
  if (!sentAt) return "";
  const diff = Date.now() - new Date(sentAt).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTurnaround(hours: number): string {
  if (hours < 1) return "<1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

export default function VendorDashboard() {
  const { user } = useVendorAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/vendor/dashboard"],
  });

  const { data: balanceData } = useQuery<{ balance: number }>({
    queryKey: ["/api/vendor/wallet/balance"],
  });

  const { data: notifications } = useQuery<VendorNotification[]>({
    queryKey: ["/api/vendor/notifications"],
  });

  const { data: perfData } = useQuery<PerformanceData>({
    queryKey: ["/api/vendor/performance"],
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
      navigate("/vendor/jobs");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const stats = data?.stats;
  const woGrouped = data?.woGrouped || [];
  const activityFeed = data?.activityFeed || [];
  const staleAlerts = data?.staleAlerts;
  const hasStaleAlerts = staleAlerts && staleAlerts.unacceptedJobs > 0;
  const unreadNotifications = (notifications || []).filter(n => !n.isRead).slice(0, 5);

  const awaitingAcceptanceWOs = woGrouped.filter(wo =>
    wo.jobs.some(j => j.status === "SubmittedToVendor")
  );
  const activeJobWOs = woGrouped.filter(wo =>
    wo.jobs.some(j => j.status === "InProcess")
  );
  const otherWOs = woGrouped.filter(wo =>
    !wo.jobs.some(j => j.status === "SubmittedToVendor") &&
    !wo.jobs.some(j => j.status === "InProcess")
  );

  function getSlaLabel(sentAt: string | null): { label: string; className: string } {
    if (!sentAt) return { label: "–", className: "text-muted-foreground" };
    const elapsedHours = (Date.now() - new Date(sentAt).getTime()) / 3600000;
    const remainingHours = 12 - elapsedHours;
    if (elapsedHours >= 12) {
      const lateBy = Math.round(elapsedHours - 12);
      return {
        label: lateBy > 0 ? `Late by ${lateBy}h` : "Late",
        className: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30",
      };
    }
    if (elapsedHours >= 8) {
      const hoursLeft = Math.ceil(remainingHours);
      return {
        label: `Due soon · ${hoursLeft}h left`,
        className: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30",
      };
    }
    const hoursLeft = Math.ceil(remainingHours);
    return {
      label: `${hoursLeft}h left`,
      className: "text-muted-foreground",
    };
  }

  const pipelineTotal = (stats?.pending || 0) + (stats?.inProgress || 0) + (stats?.completed || 0);
  const pipelineStages = [
    { key: "pending", label: "Pending", count: stats?.pending || 0, color: "bg-amber-500", dotColor: "bg-amber-400" },
    { key: "inProgress", label: "In Progress", count: stats?.inProgress || 0, color: "bg-blue-500", dotColor: "bg-blue-400" },
    { key: "completed", label: "Completed", count: stats?.completed || 0, color: "bg-emerald-500", dotColor: "bg-emerald-400" },
  ];

  const walletNotifs = unreadNotifications.filter(n => n.type === "wallet_topup" || n.type === "wallet_deduction");
  const jobNotifs = unreadNotifications.filter(n => n.type === "new_job" || n.type === "job_update");
  const commentNotifs = unreadNotifications.filter(n => n.type === "new_comment");
  const otherNotifs = unreadNotifications.filter(n =>
    !["wallet_topup", "wallet_deduction", "new_job", "job_update", "new_comment"].includes(n.type || "")
  );

  if (isLoading) {
    return (
      <div className="p-5 lg:p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-12 w-64 rounded-lg" />
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-8 max-w-5xl mx-auto" data-testid="vendor-dashboard">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground" data-testid="text-greeting">
          {getGreeting()}, {user?.name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
          {user?.vendorName && <span className="font-medium">{user.vendorName}</span>}
          {user?.vendorName && " · "}
          {(stats?.pending || 0) > 0
            ? `${stats?.pending} ${stats?.pending === 1 ? "job" : "jobs"} awaiting acceptance`
            : "You're all caught up"}
          {(stats?.pending || 0) > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[11px] font-bold bg-amber-500 text-white" data-testid="badge-awaiting-count">
              {stats?.pending}
            </span>
          )}
        </p>
      </div>

      {awaitingAcceptanceWOs.length > 0 && (
        <div className="mb-6" data-testid="section-awaiting-acceptance">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <Inbox className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-sm font-semibold text-foreground tracking-tight">Awaiting Acceptance</h2>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
              {awaitingAcceptanceWOs.length}
            </span>
          </div>
          <div className="space-y-3">
            {awaitingAcceptanceWOs.map((wo) => {
              const hasUrgent = wo.jobs.some(j => j.priority === "urgent");
              return (
                <Card
                  key={wo.woId}
                  className={`border-0 shadow-sm overflow-hidden ${hasUrgent ? "ring-1 ring-red-200 dark:ring-red-800/40" : "ring-1 ring-amber-200/60 dark:ring-amber-700/30"}`}
                  data-testid={`awaiting-wo-${wo.woId}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-semibold text-foreground">{wo.woNumber}</span>
                      {hasUrgent && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Urgent</Badge>}
                      <span className="text-xs text-muted-foreground ml-auto">{wo.applicantName}</span>
                    </div>
                    <div className="space-y-2">
                      {wo.jobs.filter(j => j.status === "SubmittedToVendor").map((job) => {
                        const isEid = job.category === "EID";
                        const isAccepting = acceptMutation.isPending && acceptMutation.variables === job.id;
                        const age = formatJobAge(job.sentAt);
                        const sla = getSlaLabel(job.sentAt);
                        return (
                          <div
                            key={job.id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-800/20"
                            data-testid={`awaiting-job-${job.id}`}
                          >
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isEid ? "bg-amber-100 dark:bg-amber-900/40" : "bg-blue-100 dark:bg-blue-900/40"}`}>
                              {isEid
                                ? <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                : <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-foreground">{job.category}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${sla.className}`} data-testid={`sla-label-${job.id}`}>
                                  {sla.label}
                                </span>
                              </div>
                              {age && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Clock className="h-3 w-3" />{age}
                                </span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              className="text-xs gap-1.5 shrink-0"
                              onClick={() => acceptMutation.mutate(job.id)}
                              disabled={isAccepting}
                              data-testid={`button-accept-${job.id}`}
                            >
                              {isAccepting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              Accept
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {pipelineTotal > 0 && (
        <div className="mb-6" data-testid="section-pipeline">
          <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/20">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Pipeline</span>
                <span className="text-xs text-muted-foreground">{pipelineTotal} {pipelineTotal === 1 ? "job" : "jobs"}</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden flex mb-4">
                {pipelineStages.map((seg) => {
                  if (seg.count === 0) return null;
                  const pct = Math.max((seg.count / pipelineTotal) * 100, 5);
                  return (
                    <div
                      key={seg.key}
                      className={`${seg.color} h-full transition-all duration-700 ease-out first:rounded-l-full last:rounded-r-full`}
                      style={{ width: `${pct}%` }}
                    />
                  );
                })}
              </div>
              <div className="flex items-center gap-6 sm:gap-8">
                {pipelineStages.map((seg) => (
                  <div key={seg.key} data-testid={`pipeline-${seg.key}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className={`h-2 w-2 rounded-full ${seg.dotColor}`} />
                      <span className="text-xs text-muted-foreground">{seg.label}</span>
                    </div>
                    <p className="text-xl font-bold text-foreground pl-4">{seg.count}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6" data-testid="section-metrics">
        <Link href="/wallet">
          <Card className="h-full cursor-pointer hover:shadow-md transition-shadow duration-200 border-0 shadow-sm" data-testid="metric-wallet">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                  <CreditCard className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
              <p className="text-xl font-bold text-foreground">AED {(balanceData?.balance || 0).toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Wallet Balance</p>
            </CardContent>
          </Card>
        </Link>
        <Card className="h-full border-0 shadow-sm" data-testid="metric-turnaround">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Timer className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-xl font-bold text-foreground">
              {perfData?.avgTurnaroundHours ? formatTurnaround(perfData.avgTurnaroundHours) : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Avg Turnaround</p>
          </CardContent>
        </Card>
        <Card className="h-full border-0 shadow-sm" data-testid="metric-completion">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-xl font-bold text-foreground">{perfData?.completionRate ?? 0}%</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Completion Rate</p>
          </CardContent>
        </Card>
        <Card className="h-full border-0 shadow-sm" data-testid="metric-monthly">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Award className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <p className="text-xl font-bold text-foreground">{perfData?.totalJobsThisMonth ?? 0}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">This Month</p>
          </CardContent>
        </Card>
      </div>

      {(stats?.urgent || 0) > 0 && (
        <Link href="/eid">
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-800/40 cursor-pointer hover:shadow-md transition-shadow duration-200" data-testid="alert-urgent">
            <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {stats?.urgent} priority {stats?.urgent === 1 ? "job" : "jobs"} need attention
              </p>
              <p className="text-xs text-muted-foreground">Overdue, action required</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground tracking-tight" data-testid="heading-action-queue">Active Work Orders</h2>
              {(activeJobWOs.length + otherWOs.length) > 0 && (
                <span className="text-xs text-muted-foreground">{activeJobWOs.length + otherWOs.length} {(activeJobWOs.length + otherWOs.length) === 1 ? "order" : "orders"}</span>
              )}
            </div>
            {(activeJobWOs.length + otherWOs.length) > 0 ? (
              <div className="space-y-3">
                {[...activeJobWOs, ...otherWOs].map((wo) => {
                  const hasUrgent = wo.jobs.some(j => j.priority === "urgent");
                  return (
                    <Card
                      key={wo.woId}
                      className={`border-0 shadow-sm overflow-hidden ${hasUrgent ? "ring-1 ring-red-200 dark:ring-red-800/40" : ""}`}
                      data-testid={`action-wo-${wo.woId}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm font-semibold text-foreground">{wo.woNumber}</span>
                          {hasUrgent && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Urgent</Badge>}
                          <span className="text-xs text-muted-foreground ml-auto">{wo.applicantName}</span>
                        </div>
                        <div className="space-y-2">
                          {wo.jobs.map((job) => {
                            const isEid = job.category === "EID";
                            const detailUrl = isEid ? `/eid/${job.id}` : `/medical/${job.id}`;
                            const isAccepting = acceptMutation.isPending && acceptMutation.variables === job.id;
                            const age = formatJobAge(job.sentAt);
                            const sla = (job.status === "SubmittedToVendor" || job.status === "InProcess")
                              ? getSlaLabel(job.sentAt)
                              : undefined;
                            return (
                              <Link key={job.id} href={detailUrl}>
                                <div
                                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                                  data-testid={`action-job-${job.id}`}
                                >
                                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isEid ? "bg-amber-100 dark:bg-amber-900/40" : "bg-blue-100 dark:bg-blue-900/40"}`}>
                                    {isEid
                                      ? <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                      : <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-medium text-foreground">{job.category}</span>
                                      <StatusBadge status={job.status as any} vendorContext />
                                      {sla && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${sla.className}`} data-testid={`sla-label-${job.id}`}>
                                          {sla.label}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5">
                                      {age && (
                                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                          <Clock className="h-3 w-3" />{age}
                                        </span>
                                      )}
                                      {job.costSnapshot != null && job.costSnapshot > 0 && (
                                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                          AED {job.costSnapshot}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : woGrouped.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No active work orders</p>
                  <p className="text-xs text-muted-foreground mt-1">New jobs will appear here when assigned</p>
                </CardContent>
              </Card>
            ) : null}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground tracking-tight mb-3" data-testid="heading-activity">Recent Activity</h2>
            {activityFeed.length > 0 ? (
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="divide-y divide-border/30">
                  {activityFeed.map((item) => {
                    const isEid = item.category === "EID";
                    const detailUrl = isEid ? `/eid/${item.id}` : `/medical/${item.id}`;
                    return (
                      <Link key={item.id} href={detailUrl}>
                        <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer" data-testid={`activity-${item.id}`}>
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isEid ? "bg-amber-100 dark:bg-amber-900/40" : "bg-blue-100 dark:bg-blue-900/40"}`}>
                            {isEid
                              ? <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              : <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{item.woNumber}</span>
                              <StatusBadge status={item.status as any} vendorContext />
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{item.applicantName}</p>
                          </div>
                          <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:block">
                            {formatRelativeTime(item.timestamp)}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            ) : (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                </CardContent>
              </Card>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-foreground tracking-tight mb-3">Navigate</h2>
            <div className="space-y-2">
              <Link href="/eid">
                <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200" data-testid="nav-eid">
                  <CardContent className="p-3.5 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                      <Shield className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Emirates ID</p>
                      <p className="text-[11px] text-muted-foreground">{stats?.activeEid || 0} active</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  </CardContent>
                </Card>
              </Link>
              <Link href="/medical">
                <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200" data-testid="nav-medical">
                  <CardContent className="p-3.5 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                      <Stethoscope className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Medical</p>
                      <p className="text-[11px] text-muted-foreground">{stats?.activeMedical || 0} active</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  </CardContent>
                </Card>
              </Link>
              <Link href="/wallet">
                <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200" data-testid="nav-wallet">
                  <CardContent className="p-3.5 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                      <CreditCard className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Wallet</p>
                      <p className="text-[11px] text-muted-foreground">AED {(balanceData?.balance || 0).toLocaleString()}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            </div>
          </section>

          {perfData && (perfData.statusBreakdown.completed > 0 || perfData.monthlyEarnings > 0) && (
            <section data-testid="section-performance">
              <h2 className="text-sm font-semibold text-foreground tracking-tight mb-3">Performance</h2>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm text-muted-foreground">Jobs Completed</span>
                    </div>
                    <span className="text-sm font-bold text-foreground" data-testid="text-perf-completed">{perfData.statusBreakdown.completed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-muted-foreground">Avg Turnaround</span>
                    </div>
                    <span className="text-sm font-bold text-foreground" data-testid="text-perf-turnaround">
                      {perfData.avgTurnaroundHours > 0 ? formatTurnaround(perfData.avgTurnaroundHours) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-violet-500" />
                      <span className="text-sm text-muted-foreground">Completion Rate</span>
                    </div>
                    <span className="text-sm font-bold text-foreground" data-testid="text-perf-rate">{perfData.completionRate}%</span>
                  </div>
                  {perfData.monthlyEarnings > 0 && (
                    <>
                      <div className="border-t border-border/30" />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-amber-500" />
                          <span className="text-sm text-muted-foreground">This Month</span>
                        </div>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-perf-earnings">
                          AED {perfData.monthlyEarnings.toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground tracking-tight" data-testid="heading-notifications">Notifications</h2>
              {unreadNotifications.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{unreadNotifications.length}</Badge>
              )}
            </div>
            {unreadNotifications.length > 0 ? (
              <div className="space-y-2">
                {jobNotifs.length > 0 && (
                  <NotificationGroup label="Jobs" items={jobNotifs} markReadMutation={markReadMutation} navigate={navigate} />
                )}
                {walletNotifs.length > 0 && (
                  <NotificationGroup label="Wallet" items={walletNotifs} markReadMutation={markReadMutation} navigate={navigate} />
                )}
                {commentNotifs.length > 0 && (
                  <NotificationGroup label="Comments" items={commentNotifs} markReadMutation={markReadMutation} navigate={navigate} />
                )}
                {otherNotifs.length > 0 && (
                  <NotificationGroup label="Other" items={otherNotifs} markReadMutation={markReadMutation} navigate={navigate} />
                )}
              </div>
            ) : (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-8 text-center">
                  <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <Bell className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">No new notifications</p>
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function NotificationGroup({
  label,
  items,
  markReadMutation,
  navigate,
}: {
  label: string;
  items: VendorNotification[];
  markReadMutation: any;
  navigate: (path: string) => void;
}) {
  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-1.5">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
      </div>
      <div className="divide-y divide-border/30">
        {items.map((n) => {
          const jobUrl = n.relatedJobId
            ? ((n as any).jobCategory === "Medical" ? `/medical/${n.relatedJobId}` : `/eid/${n.relatedJobId}`)
            : null;

          const iconConfig: Record<string, { icon: typeof Bell; bg: string; color: string }> = {
            new_job: { icon: Inbox, bg: "bg-blue-100 dark:bg-blue-900/40", color: "text-blue-600 dark:text-blue-400" },
            job_update: { icon: Zap, bg: "bg-blue-100 dark:bg-blue-900/40", color: "text-blue-600 dark:text-blue-400" },
            wallet_topup: { icon: ArrowRight, bg: "bg-emerald-100 dark:bg-emerald-900/40", color: "text-emerald-600 dark:text-emerald-400" },
            wallet_deduction: { icon: CreditCard, bg: "bg-red-100 dark:bg-red-900/40", color: "text-red-600 dark:text-red-400" },
            new_comment: { icon: FileText, bg: "bg-violet-100 dark:bg-violet-900/40", color: "text-violet-600 dark:text-violet-400" },
          };
          const style = iconConfig[n.type || ""] || { icon: Bell, bg: "bg-muted", color: "text-muted-foreground" };
          const Icon = style.icon;

          return (
            <div
              key={n.id}
              className="px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => {
                if (!n.isRead) markReadMutation.mutate(n.id);
                if (jobUrl) navigate(jobUrl);
              }}
              data-testid={`notification-${n.id}`}
            >
              <div className="flex items-start gap-3">
                <div className={`h-7 w-7 rounded-lg ${style.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon className={`h-3.5 w-3.5 ${style.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground leading-snug">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">{n.createdAt ? formatRelativeTime(n.createdAt) : ""}</p>
                </div>
                {!n.isRead && (
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

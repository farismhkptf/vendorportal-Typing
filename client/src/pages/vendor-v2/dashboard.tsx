import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Shield, Stethoscope, AlertTriangle, Wallet,
  Clock, CheckCircle2, TrendingUp, ArrowRight,
  Zap, CreditCard, Activity, ChevronRight, Timer
} from "lucide-react";
import { formatRelativeTime } from "@/lib/format-date";
import { useVendorAuth } from "@/hooks/use-vendor-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { GlassCard, GlassSection, GlassSkeleton, GlassEmpty } from "@/components/vendor-v2/layout";
import type { VendorNotification } from "@shared/schema";

interface WoGroupedItem {
  woId: string;
  woNumber: string;
  applicantName: string;
  companyName: string;
  applicantPhotoUrl: string | null;
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
  staleAlerts?: { unacceptedJobs: number };
  woGrouped: WoGroupedItem[];
  activityFeed: ActivityItem[];
}

interface PerformanceData {
  completionRate: number;
  avgTurnaroundHours: number;
  monthlyEarnings: number;
  totalJobsThisMonth: number;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getStatusClass(status: string): string {
  switch (status) {
    case "SubmittedToVendor": return "v2-status-new";
    case "InProcess": return "v2-status-inprogress";
    case "ReadyForScheduling":
    case "Returned": return "v2-status-completed";
    default: return "v2-status-default";
  }
}

function getDisplayStatus(status: string): string {
  switch (status) {
    case "SubmittedToVendor": return "New";
    case "InProcess": return "In Progress";
    case "ReadyForScheduling": return "Completed";
    case "Returned": return "Returned";
    default: return status;
  }
}

function formatAge(sentAt: string | null): string {
  if (!sentAt) return "";
  const hours = Math.floor((Date.now() - new Date(sentAt).getTime()) / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function V2Dashboard() {
  const { user } = useVendorAuth();
  const [, setLocation] = useLocation();

  const { data: dashData, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ["/api/vendor/dashboard"],
  });

  const { data: balanceData } = useQuery<{ balance: number }>({
    queryKey: ["/api/vendor/wallet/balance"],
  });

  const { data: perfData } = useQuery<PerformanceData>({
    queryKey: ["/api/vendor/performance"],
  });

  const { data: notifications } = useQuery<VendorNotification[]>({
    queryKey: ["/api/vendor/notifications"],
  });

  const acceptMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await apiRequest("POST", `/api/vendor/jobs/${jobId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs"] });
    },
  });

  const stats = dashData?.stats;
  const balance = balanceData?.balance ?? 0;
  const staleCount = dashData?.staleAlerts?.unacceptedJobs || 0;
  const urgentCount = stats?.urgent || 0;
  const pipelineTotal = (stats?.pending || 0) + (stats?.inProgress || 0) + (stats?.completed || 0);
  const pipelinePending = pipelineTotal ? ((stats?.pending || 0) / pipelineTotal) * 100 : 0;
  const pipelineActive = pipelineTotal ? ((stats?.inProgress || 0) / pipelineTotal) * 100 : 0;
  const pipelineDone = pipelineTotal ? ((stats?.completed || 0) / pipelineTotal) * 100 : 0;

  const recentActivity = [
    ...(dashData?.activityFeed || []).map(a => ({
      id: `act-${a.id}`,
      type: "job" as const,
      title: `${a.woNumber} · ${a.applicantName}`,
      description: `${a.category} — ${getDisplayStatus(a.status)}`,
      timestamp: a.timestamp,
      category: a.category,
    })),
    ...(notifications?.slice(0, 5) || []).map(n => ({
      id: `notif-${n.id}`,
      type: n.type as any,
      title: n.title || "",
      description: n.message || "",
      timestamp: n.createdAt as string,
      category: n.type === "wallet_topup" || n.type === "wallet_deduction" ? "wallet" : "other",
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  if (dashLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pt-4">
        <GlassSkeleton className="h-20 w-3/4" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <GlassSkeleton key={i} className="h-24" />)}
        </div>
        <GlassSkeleton className="h-16" />
        {[1, 2, 3].map(i => <GlassSkeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pt-2 pb-4 space-y-8">
      <div data-tour="greeting">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight" data-testid="text-v2-greeting">
          {getGreeting()}, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-slate-500 dark:text-white/50 text-sm mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          {stats && stats.pending > 0 && (
            <span className="text-amber-600 dark:text-amber-400/80"> · {stats.pending} pending</span>
          )}
        </p>
      </div>

      {(staleCount > 0 || urgentCount > 0) && (
        <div className="space-y-2">
          {staleCount > 0 && (
            <GlassCard accent="amber" className="p-4 v2-alert-pulse" data-testid="alert-stale-jobs">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{staleCount} job{staleCount > 1 ? "s" : ""} waiting over 12 hours</p>
                  <p className="text-xs text-slate-500 dark:text-white/50">Accept pending jobs to avoid delays</p>
                </div>
              </div>
            </GlassCard>
          )}
          {urgentCount > 0 && (
            <GlassCard accent="red" className="p-4 v2-alert-pulse" data-testid="alert-urgent-jobs">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{urgentCount} urgent job{urgentCount > 1 ? "s" : ""}</p>
                  <p className="text-xs text-slate-500 dark:text-white/50">Priority items need immediate attention</p>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      <section data-tour="metrics">
        <h3 className="text-xs font-semibold text-slate-400 dark:text-white/40 uppercase tracking-wider mb-3">Overview</h3>
        <div className="grid grid-cols-2 gap-3">
          <GlassCard
            className="p-4"
            onClick={() => setLocation("/wallet")}
            data-testid="metric-wallet"
          >
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              <span className="text-[11px] font-medium text-slate-400 dark:text-white/50 uppercase tracking-wider">Balance</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {balance.toLocaleString()} <span className="text-sm font-normal text-slate-400 dark:text-white/40">AED</span>
            </p>
          </GlassCard>

          <GlassCard className="p-4" data-testid="metric-active">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              <span className="text-[11px] font-medium text-slate-400 dark:text-white/50 uppercase tracking-wider">Active</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats?.inProgress || 0}
              <span className="text-sm font-normal text-slate-400 dark:text-white/40 ml-1">jobs</span>
            </p>
          </GlassCard>

          <GlassCard className="p-4" data-testid="metric-rate">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-purple-500 dark:text-purple-400" />
              <span className="text-[11px] font-medium text-slate-400 dark:text-white/50 uppercase tracking-wider">Rate</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {perfData?.completionRate?.toFixed(0) || 0}<span className="text-sm font-normal text-slate-400 dark:text-white/40">%</span>
            </p>
          </GlassCard>

          <GlassCard className="p-4" data-testid="metric-turnaround">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <span className="text-[11px] font-medium text-slate-400 dark:text-white/50 uppercase tracking-wider">Avg Time</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {perfData?.avgTurnaroundHours
                ? perfData.avgTurnaroundHours < 24
                  ? `${Math.round(perfData.avgTurnaroundHours)}h`
                  : `${(perfData.avgTurnaroundHours / 24).toFixed(1)}d`
                : "—"}
            </p>
          </GlassCard>
        </div>
      </section>

      {pipelineTotal > 0 && (
        <section data-tour="pipeline">
          <h3 className="text-xs font-semibold text-slate-400 dark:text-white/40 uppercase tracking-wider mb-3">Pipeline</h3>
          <GlassCard className="p-4" data-testid="pipeline-bar">
            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden flex">
              {pipelinePending > 0 && (
                <div className="h-full bg-amber-400/80 dark:bg-amber-400/70 rounded-l-full" style={{ width: `${pipelinePending}%` }} />
              )}
              {pipelineActive > 0 && (
                <div className="h-full bg-blue-400/80 dark:bg-blue-400/70" style={{ width: `${pipelineActive}%` }} />
              )}
              {pipelineDone > 0 && (
                <div className="h-full bg-emerald-400/80 dark:bg-emerald-400/70 rounded-r-full" style={{ width: `${pipelineDone}%` }} />
              )}
            </div>
            <div className="flex justify-between mt-2.5 text-[11px]">
              <span className="text-amber-600 dark:text-amber-400/80 font-medium">{stats?.pending || 0} Pending</span>
              <span className="text-blue-600 dark:text-blue-400/80 font-medium">{stats?.inProgress || 0} Active</span>
              <span className="text-emerald-600 dark:text-emerald-400/80 font-medium">{stats?.completed || 0} Done</span>
            </div>
          </GlassCard>
        </section>
      )}

      {dashData?.woGrouped && dashData.woGrouped.length > 0 && (
        <GlassSection title="Active Work Orders">
          <div className="space-y-2">
            {dashData.woGrouped.slice(0, 5).map(wo => (
              <GlassCard key={wo.woId} className="p-4" data-testid={`wo-group-${wo.woId}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="shrink-0">
                    {wo.applicantPhotoUrl ? (
                      <img
                        src={wo.applicantPhotoUrl}
                        alt={wo.applicantName}
                        className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10"
                        data-testid={`avatar-photo-${wo.woId}`}
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center ring-1 ring-white/10" data-testid={`avatar-initials-${wo.woId}`}>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-white/60">
                          {wo.applicantName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400 dark:text-white/50">{wo.woNumber}</span>
                      <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{wo.applicantName}</span>
                    </div>
                    {wo.companyName && (
                      <span className="text-[11px] text-slate-400 dark:text-white/40 truncate block" data-testid={`company-name-${wo.woId}`}>{wo.companyName}</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {wo.jobs.map(job => (
                    <div key={job.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {job.category === "EID" ? (
                          <Shield className="h-3.5 w-3.5 text-amber-500/70 dark:text-amber-400/70" />
                        ) : (
                          <Stethoscope className="h-3.5 w-3.5 text-teal-500/70 dark:text-teal-400/70" />
                        )}
                        <span className={`${getStatusClass(job.status)} v2-status-badge`}>
                          {getDisplayStatus(job.status)}
                        </span>
                        {job.sentAt && (
                          <span className="text-[11px] text-slate-300 dark:text-white/30">{formatAge(job.sentAt)}</span>
                        )}
                      </div>
                      {job.status === "SubmittedToVendor" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); acceptMutation.mutate(job.id); }}
                          className="glass-btn-primary text-xs px-3 py-1"
                          disabled={acceptMutation.isPending}
                          data-testid={`button-accept-${job.id}`}
                        >
                          Accept
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </GlassCard>
            ))}
          </div>
        </GlassSection>
      )}

      <GlassSection title="Activity Timeline">
        {recentActivity.length > 0 ? (
          <div className="space-y-1">
            {recentActivity.map((item, i) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors" data-testid={`timeline-item-${i}`}>
                <div className="mt-0.5 shrink-0">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                    item.category === "EID" ? "bg-amber-500/15" :
                    item.category === "Medical" ? "bg-teal-500/15" :
                    item.category === "wallet" ? "bg-emerald-500/15" :
                    "bg-slate-100 dark:bg-white/10"
                  }`}>
                    {item.category === "EID" ? <Shield className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" /> :
                     item.category === "Medical" ? <Stethoscope className="h-3.5 w-3.5 text-teal-500 dark:text-teal-400" /> :
                     item.category === "wallet" ? <CreditCard className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" /> :
                     <Zap className="h-3.5 w-3.5 text-slate-400 dark:text-white/50" />}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 dark:text-white/80 truncate">{item.title}</p>
                  <p className="text-xs text-slate-400 dark:text-white/40 truncate">{item.description}</p>
                </div>
                <span className="text-[11px] text-slate-300 dark:text-white/30 shrink-0 mt-0.5">{formatRelativeTime(item.timestamp)}</span>
              </div>
            ))}
          </div>
        ) : (
          <GlassEmpty
            icon={<Activity className="h-8 w-8" />}
            title="No recent activity"
            description="Your job updates and notifications will appear here"
          />
        )}
      </GlassSection>

      {perfData && (perfData.monthlyEarnings > 0 || perfData.totalJobsThisMonth > 0) && (
        <section>
          <h3 className="text-xs font-semibold text-slate-400 dark:text-white/40 uppercase tracking-wider mb-3">This Month</h3>
          <GlassCard className="p-4" data-testid="performance-summary">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{perfData.totalJobsThisMonth}</p>
                <p className="text-[11px] text-slate-400 dark:text-white/40">Jobs</p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{perfData.completionRate?.toFixed(0)}%</p>
                <p className="text-[11px] text-slate-400 dark:text-white/40">Rate</p>
              </div>
              {perfData.monthlyEarnings > 0 && (
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{perfData.monthlyEarnings.toLocaleString()}</p>
                  <p className="text-[11px] text-slate-400 dark:text-white/40">AED</p>
                </div>
              )}
            </div>
          </GlassCard>
        </section>
      )}
    </div>
  );
}

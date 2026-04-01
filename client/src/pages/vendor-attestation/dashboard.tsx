import { useQuery } from "@tanstack/react-query";
import { useAttestationVendorAuth } from "@/hooks/use-attestation-vendor-auth";
import { FileQuestion, Briefcase, CheckCircle2, Clock, Activity } from "lucide-react";
import { GlassCard, GlassSection, GlassSkeleton, GlassEmpty } from "@/components/vendor-v2/layout";
import { formatRelativeTime } from "@/lib/format-date";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface DashboardData {
  stats: {
    openInquiries: number;
    pendingQuote: number;
    pendingAcceptance: number;
    activeJobs: number;
    completedJobs: number;
  };
  recentActivity: Array<{
    id: string;
    type: "inquiry" | "job";
    title: string;
    description: string;
    timestamp: string;
  }>;
}

export default function AttestationDashboard() {
  const { user } = useAttestationVendorAuth();

  const { data: dash, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/attestation-vendor/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/attestation-vendor/dashboard", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pt-4">
        <GlassSkeleton className="h-20 w-3/4" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <GlassSkeleton key={i} className="h-24" />)}
        </div>
        <GlassSkeleton className="h-16" />
      </div>
    );
  }

  const stats = dash?.stats;

  return (
    <div className="max-w-2xl mx-auto pt-2 pb-4 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight" data-testid="text-attest-greeting">
          {getGreeting()}, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-slate-500 dark:text-white/50 text-sm mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      <section>
        <h3 className="text-xs font-semibold text-slate-400 dark:text-white/40 uppercase tracking-wider mb-3">Overview</h3>
        <div className="grid grid-cols-2 gap-3">
          <GlassCard className="p-4" data-testid="metric-open-inquiries">
            <div className="flex items-center gap-2 mb-2">
              <FileQuestion className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              <span className="text-[11px] font-medium text-slate-400 dark:text-white/50 uppercase tracking-wider">Open Inquiries</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats?.openInquiries || 0}
            </p>
          </GlassCard>

          <GlassCard className="p-4" data-testid="metric-pending-acceptance">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <span className="text-[11px] font-medium text-slate-400 dark:text-white/50 uppercase tracking-wider">Pending Accept</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats?.pendingAcceptance || 0}
              <span className="text-sm font-normal text-slate-400 dark:text-white/40 ml-1">jobs</span>
            </p>
          </GlassCard>

          <GlassCard className="p-4" data-testid="metric-active-jobs">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="h-4 w-4 text-purple-500 dark:text-purple-400" />
              <span className="text-[11px] font-medium text-slate-400 dark:text-white/50 uppercase tracking-wider">Active Jobs</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats?.activeJobs || 0}
            </p>
          </GlassCard>

          <GlassCard className="p-4" data-testid="metric-completed">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              <span className="text-[11px] font-medium text-slate-400 dark:text-white/50 uppercase tracking-wider">Completed</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats?.completedJobs || 0}
            </p>
          </GlassCard>
        </div>
      </section>

      <GlassSection title="Recent Activity">
        {dash?.recentActivity && dash.recentActivity.length > 0 ? (
          <div className="space-y-1">
            {dash.recentActivity.map((item, i) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors" data-testid={`activity-item-${i}`}>
                <div className="mt-0.5 shrink-0">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${item.type === "inquiry" ? "bg-blue-500/15" : "bg-purple-500/15"}`}>
                    {item.type === "inquiry" ? (
                      <FileQuestion className="h-3.5 w-3.5 text-blue-500" />
                    ) : (
                      <Briefcase className="h-3.5 w-3.5 text-purple-500" />
                    )}
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
            description="Your inquiry and job updates will appear here"
          />
        )}
      </GlassSection>
    </div>
  );
}

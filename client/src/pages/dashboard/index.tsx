import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Calendar, Wallet, Plus, Send, CheckCircle2, AlertTriangle, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/app-layout";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getGreeting } from "@/lib/greeting";
import { useAuth } from "@/hooks/use-auth";
import { DashboardSwitcher } from "@/components/dashboard-switcher";
import { CustodyDashboardWidget } from "@/components/custody/dashboard-widget";
import { type ActivityItem } from "@/components/ui/activity-timeline";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { queryKeys } from "@/lib/query-keys";
import { TypingJobsLane } from "./components/typing-jobs-lane";
import { AppointmentsLane } from "./components/appointments-lane";
import { NeedsAttentionSection } from "./components/needs-attention";
import { PipelineOverview } from "./components/pipeline-overview";
import { WeeklyOverviewChart, MyActivityPanel, IdleDraftJobsPanel, DelayedWorkOrdersAlert } from "./components/widgets";
import type { DashboardStats, TypingJobsSummary, AppointmentsSummary, WeeklyData } from "./components/types";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    document.title = "Keystone Admin Dashboard";
    return () => { document.title = "Keystone"; };
  }, []);

  useEffect(() => {
    if (user?.role === "Vendor") {
      navigate("/vendor/login");
    }
  }, [user?.role, navigate]);

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery<DashboardStats>({
    queryKey: queryKeys.dashboardStats,
    staleTime: 30000,
  });

  const { data: typingData, isLoading: typingLoading, isError: typingError, refetch: refetchTyping } = useQuery<TypingJobsSummary>({
    queryKey: queryKeys.dashboardTypingJobsSummary,
    staleTime: 30000,
  });

  const { data: appointmentsData, isLoading: appointmentsLoading, isError: appointmentsError, refetch: refetchAppointments } = useQuery<AppointmentsSummary>({
    queryKey: queryKeys.dashboardAppointmentsSummary,
    staleTime: 30000,
  });

  const { data: weeklyData } = useQuery<WeeklyData[]>({
    queryKey: queryKeys.dashboardWeeklyOverview,
    staleTime: 60000,
  });

  const { data: myActivity, isLoading: activityLoading } = useQuery<ActivityItem[]>({
    queryKey: queryKeys.activityMy,
    staleTime: 30000,
  });

  const { data: photoMap } = useQuery<Record<string, string>>({
    queryKey: queryKeys.workOrderPhotos,
    staleTime: 60000,
  });

  const activeJobs = (typingData?.counts.unaccepted || 0) + (typingData?.counts.inProgress || 0);

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground" data-testid="text-greeting">{getGreeting()}</p>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Keystone Admin Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {(user?.role === "Admin" || user?.role === "Client Relationship Manager") && <DashboardSwitcher active="admin" />}
            <Link href="/work-orders/new">
              <Button size="sm" className="gap-1.5" data-testid="button-new-work-order">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Work Order</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-6 space-y-6">
        {(statsError || typingError || appointmentsError) && (
          <QueryErrorState
            message="Some dashboard data failed to load."
            onRetry={() => {
              if (statsError) refetchStats();
              if (typingError) refetchTyping();
              if (appointmentsError) refetchAppointments();
            }}
          />
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            <>
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </>
          ) : (
            <>
              <StatCard
                title="Active Jobs"
                value={activeJobs}
                icon={<Send className="h-4 w-4" />}
                animationDelay={1}
                onClick={() => navigate("/typing-jobs")}
              />
              <StatCard
                title="Ready to Schedule"
                value={typingData?.counts.readyToSchedule || 0}
                icon={<CheckCircle2 className="h-4 w-4" />}
                animationDelay={2}
                onClick={() => navigate("/appointments")}
              />
              <StatCard
                title="Today's Appts"
                value={stats?.todayAppointments || 0}
                icon={<Calendar className="h-4 w-4" />}
                animationDelay={3}
                onClick={() => navigate("/appointments")}
              />
              <StatCard
                title="Wallet"
                value={`AED ${(stats?.walletBalance || 0).toLocaleString()}`}
                icon={<Wallet className="h-4 w-4" />}
                animationDelay={4}
                onClick={() => navigate("/vendor-wallet")}
              />
            </>
          )}
        </div>

        <NeedsAttentionSection navigate={navigate} />

        <DelayedWorkOrdersAlert navigate={navigate} />

        {user?.role === "Admin" && <IdleDraftJobsPanel navigate={navigate} />}

        {stats?.lowBalanceWarning && (
          <div 
            className="premium-card p-3 border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-r from-amber-50 to-amber-50/50 dark:from-amber-950/20 dark:to-amber-950/10 opacity-0 animate-fade-in"
            data-testid="alert-low-balance"
          >
            <div className="flex items-center gap-3">
              <div className="icon-container icon-container-sm !bg-amber-100 dark:!bg-amber-900/40 !text-amber-600 dark:!text-amber-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-amber-800 dark:text-amber-200">Low Wallet Balance</p>
              </div>
              <Link href="/vendor-wallet">
                <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-top-up">
                  Top Up
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        <PipelineOverview navigate={navigate} />

        <div className="section-divider" />

        <div className="grid xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 grid lg:grid-cols-2 gap-4">
            <TypingJobsLane data={typingData} isLoading={typingLoading} photoMap={photoMap} />
            <AppointmentsLane data={appointmentsData} isLoading={appointmentsLoading} photoMap={photoMap} />
          </div>
          <div className="space-y-4">
            {weeklyData && <WeeklyOverviewChart data={weeklyData} />}
            {(user?.role === "Admin" || user?.role === "Client Relationship Manager" || user?.role === "PRO" || user?.role === "PRO - Temporary") && (
              <CustodyDashboardWidget />
            )}
            <MyActivityPanel data={myActivity} isLoading={activityLoading} photoMap={photoMap} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

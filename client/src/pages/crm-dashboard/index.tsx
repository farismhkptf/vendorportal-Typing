import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Briefcase, Wallet, Clock, AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/app-layout";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getGreeting } from "@/lib/greeting";
import { useAuth } from "@/hooks/use-auth";
import { DashboardSwitcher } from "@/components/dashboard-switcher";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { QuickActionsSidebar } from "./components/quick-actions-sidebar";
import { TodayAppointmentsPanel, VendorJobsSection, BottomGrid, CrmActivityPanel } from "./components/bottom-panels";
import { AttentionList, PipelineBreakdownCard } from "./components/attention-list";
import { useCrmDashboardData } from "./components/use-crm-data";

export default function CrmDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  useEffect(() => {
    document.title = "Keystone Client Relation Manager Dashboard";
    return () => { document.title = "Keystone"; };
  }, []);

  const {
    companies, companiesLoading, companiesError, refetchCompanies,
    workOrdersLoading, workOrdersError, refetchWorkOrders,
    workOrders,
    appointmentsLoading, appointmentsError, refetchAppointments,
    staffList, walletBalance,
    activeWorkOrders, todayAppointments, attentionWorkOrders,
    pendingTypingJobs, companiesNeedingAttention, pendingDeletionRequests,
    vendorTypingStats, companyMap, vendorJobItems, vendorWorkOrders,
    pipelineBreakdown, recentActivity, activityLoading, isLoading,
  } = useCrmDashboardData();

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground" data-testid="text-greeting">{getGreeting()}</p>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight" data-testid="text-user-greeting">
              Keystone Client Relation Manager Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && <DashboardSwitcher active="crm" />}
            <Link href="/work-orders/new">
              <Button size="sm" className="gap-1.5" data-testid="button-new-work-order">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Work Order</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-6 space-y-5">

        {(companiesError || workOrdersError || appointmentsError) && (
          <QueryErrorState
            message="Some dashboard data failed to load."
            onRetry={() => {
              if (companiesError) refetchCompanies();
              if (workOrdersError) refetchWorkOrders();
              if (appointmentsError) refetchAppointments();
            }}
          />
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {isLoading ? (
            <>{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</>
          ) : (
            <>
              <StatCard title="Active Work Orders" value={activeWorkOrders.length} icon={<Briefcase className="h-4 w-4" />} animationDelay={1} onClick={() => navigate("/work-orders")} data-testid="stat-active-work-orders" />
              <StatCard title="Today's Appointments" value={todayAppointments.length} icon={<Clock className="h-4 w-4" />} animationDelay={2} onClick={() => navigate("/appointments")} data-testid="stat-today-appointments" />
              <StatCard title="Needs Attention" value={attentionWorkOrders.length} icon={<AlertTriangle className="h-4 w-4" />} animationDelay={3} data-testid="stat-attention-work-orders" />
              <StatCard title="Pending Typing Jobs" value={pendingTypingJobs} icon={<Clock className="h-4 w-4" />} animationDelay={4} onClick={() => navigate("/typing-jobs")} data-testid="stat-pending-typing-jobs" />
              <StatCard title="Vendor Wallet" value={`AED ${walletBalance.toLocaleString()}`} icon={<Wallet className="h-4 w-4" />} animationDelay={5} onClick={() => navigate("/vendor-wallet")} data-testid="stat-wallet-balance" />
            </>
          )}
        </div>

        <PipelineBreakdownCard breakdown={pipelineBreakdown} isLoading={workOrdersLoading} />

        <div className="grid lg:grid-cols-3 gap-4">
          <AttentionList workOrders={attentionWorkOrders} companyMap={companyMap} isLoading={workOrdersLoading} />

          <QuickActionsSidebar
            companiesCount={companies?.length || 0}
            walletBalance={walletBalance}
            isAdmin={isAdmin}
            pendingDeletionCount={pendingDeletionRequests.length}
            vendorTypingStats={vendorTypingStats}
          />
        </div>

        <TodayAppointmentsPanel appointments={todayAppointments} isLoading={appointmentsLoading} />

        <VendorJobsSection jobs={vendorJobItems} isLoading={workOrdersLoading} />

        <CrmActivityPanel activities={recentActivity} isLoading={activityLoading} />

        <BottomGrid
          activeWorkOrders={activeWorkOrders}
          vendorWorkOrders={vendorWorkOrders}
          companiesNeedingAttention={companiesNeedingAttention}
          staffList={staffList}
          totalCompanies={companies?.length || 0}
          totalWorkOrders={workOrders?.length || 0}
          walletBalance={walletBalance}
          workOrdersLoading={workOrdersLoading}
          companiesLoading={companiesLoading}
        />

      </div>
    </AppLayout>
  );
}

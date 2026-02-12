import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  FileText, 
  Calendar, 
  Wallet, 
  AlertTriangle, 
  Clock,
  Plus,
  ArrowRight,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/app-layout";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTableRow } from "@/components/ui/data-table-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getGreeting } from "@/lib/greeting";
import { toProperCase } from "@/lib/proper-case";

interface DashboardStats {
  totalWorkOrders: number;
  todayAppointments: number;
  pendingTypingJobs: number;
  walletBalance: number;
  lowBalanceWarning: boolean;
}

interface TodayAppointment {
  id: string;
  woNumber: string;
  applicantName: string;
  type: "Medical" | "EID";
  time: string;
  center: string;
}

interface RecentWorkOrder {
  id: string;
  woNumber: string;
  applicantName: string;
  companyName: string;
  status: "Draft" | "Scheduled" | "Sent" | "Completed" | "Cancelled";
  createdAt: string;
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: todayAppointments, isLoading: appointmentsLoading } = useQuery<TodayAppointment[]>({
    queryKey: ["/api/dashboard/today-appointments"],
  });

  const { data: recentWorkOrders, isLoading: workOrdersLoading } = useQuery<RecentWorkOrder[]>({
    queryKey: ["/api/dashboard/recent-work-orders"],
  });

  return (
    <AppLayout>
      {/* Header Section */}
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground" data-testid="text-greeting">{getGreeting()}</p>
            <h1 className="text-xl font-semibold text-foreground">
              Dashboard
            </h1>
          </div>
          <Link href="/work-orders/new">
            <Button size="sm" className="gap-1.5 rounded-lg" data-testid="button-new-work-order">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Work Order</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-6 space-y-4">
        {/* Low Balance Alert */}
        {stats?.lowBalanceWarning && (
          <div 
            className="premium-card p-3 border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10 opacity-0 animate-fade-in"
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
                <Button variant="outline" size="sm" className="gap-1.5 rounded-lg h-8" data-testid="button-top-up">
                  Top Up
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3">
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
                title="Work Orders"
                value={stats?.totalWorkOrders || 0}
                icon={<FileText className="h-4 w-4" />}
                animationDelay={1}
                onClick={() => navigate("/work-orders")}
              />
              <StatCard
                title="Today's Appts"
                value={stats?.todayAppointments || 0}
                icon={<Calendar className="h-4 w-4" />}
                animationDelay={2}
                onClick={() => navigate("/appointments")}
              />
              <StatCard
                title="Pending Jobs"
                value={stats?.pendingTypingJobs || 0}
                icon={<Clock className="h-4 w-4" />}
                animationDelay={3}
                onClick={() => navigate("/typing-jobs")}
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

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Today's Appointments */}
          <div className="space-y-3 opacity-0 animate-fade-in animate-delay-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">Today's Appointments</h2>
              <Link href="/appointments">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground rounded-lg">
                  View All
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            
            <div className="space-y-2">
              {appointmentsLoading ? (
                <>
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                </>
              ) : todayAppointments && todayAppointments.length > 0 ? (
                todayAppointments.map((apt) => (
                  <Link key={apt.id} href={`/work-orders/${apt.id}`}>
                    <DataTableRow>
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2.5">
                            <span className="font-medium text-foreground">{apt.woNumber}</span>
                            <StatusBadge status={apt.type} />
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{toProperCase(apt.applicantName)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-medium text-foreground">{apt.time}</p>
                          <p className="text-sm text-muted-foreground">{apt.center}</p>
                        </div>
                      </div>
                    </DataTableRow>
                  </Link>
                ))
              ) : (
                <EmptyState
                  icon={<Calendar className="h-6 w-6" />}
                  title="No appointments today"
                  description="There are no scheduled appointments for today."
                />
              )}
            </div>
          </div>

          {/* Recent Work Orders */}
          <div className="space-y-3 opacity-0 animate-fade-in animate-delay-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">Recent Work Orders</h2>
              <Link href="/work-orders">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground rounded-lg">
                  View All
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            
            <div className="space-y-3">
              {workOrdersLoading ? (
                <>
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                </>
              ) : recentWorkOrders && recentWorkOrders.length > 0 ? (
                recentWorkOrders.map((wo) => (
                  <Link key={wo.id} href={`/work-orders/${wo.id}`}>
                    <DataTableRow>
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2.5">
                            <span className="font-medium text-foreground">{wo.woNumber}</span>
                            <StatusBadge status={wo.status} />
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{toProperCase(wo.applicantName)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[120px]">{toProperCase(wo.companyName)}</span>
                          </div>
                        </div>
                      </div>
                    </DataTableRow>
                  </Link>
                ))
              ) : (
                <EmptyState
                  icon={<FileText className="h-6 w-6" />}
                  title="No work orders yet"
                  description="Create your first work order to get started."
                  action={
                    <Link href="/work-orders/new">
                      <Button size="sm" className="gap-2 rounded-xl">
                        <Plus className="h-4 w-4" />
                        New Work Order
                      </Button>
                    </Link>
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTableRow } from "@/components/ui/data-table-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

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
      <PageHeader 
        title="Dashboard" 
        subtitle="Welcome back! Here's what's happening today."
        actions={
          <Link href="/work-orders/new">
            <Button className="gap-2" data-testid="button-new-work-order">
              <Plus className="h-4 w-4" />
              New Work Order
            </Button>
          </Link>
        }
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Low Balance Alert */}
        {stats?.lowBalanceWarning && (
          <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/50" data-testid="alert-low-balance">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-orange-800 dark:text-orange-200">Low Vendor Wallet Balance</p>
                <p className="text-sm text-orange-600 dark:text-orange-300">
                  Wallet balance is below the threshold. Please top up to avoid service interruption.
                </p>
              </div>
              <Link href="/vendor-wallet">
                <Button variant="outline" size="sm" className="gap-2" data-testid="button-top-up">
                  Top Up Now
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Quick Search */}
        <Card className="border border-border/50 shadow-sm" data-testid="search-card">
          <CardContent className="p-4">
            <div className="relative">
              <Input
                type="search"
                placeholder="Search by WO number or applicant name..."
                className="pl-4 pr-4 h-12 text-base rounded-xl"
                data-testid="input-search"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            <>
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </>
          ) : (
            <>
              <StatCard
                title="Total Work Orders"
                value={stats?.totalWorkOrders || 0}
                icon={<FileText className="h-5 w-5" />}
              />
              <StatCard
                title="Today's Appointments"
                value={stats?.todayAppointments || 0}
                icon={<Calendar className="h-5 w-5" />}
              />
              <StatCard
                title="Pending Jobs"
                value={stats?.pendingTypingJobs || 0}
                icon={<Clock className="h-5 w-5" />}
              />
              <StatCard
                title="Wallet Balance"
                value={`AED ${(stats?.walletBalance || 0).toLocaleString()}`}
                icon={<Wallet className="h-5 w-5" />}
              />
            </>
          )}
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Today's Appointments */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Today's Appointments</h2>
              <Link href="/typing-jobs">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            
            <div className="space-y-3">
              {appointmentsLoading ? (
                <>
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-20 rounded-xl" />
                </>
              ) : todayAppointments && todayAppointments.length > 0 ? (
                todayAppointments.map((apt) => (
                  <Link key={apt.id} href={`/work-orders/${apt.id}`}>
                    <DataTableRow className="mb-0">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{apt.woNumber}</span>
                            <StatusBadge status={apt.type} />
                          </div>
                          <p className="text-sm text-muted-foreground">{apt.applicantName}</p>
                        </div>
                        <div className="text-right">
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Recent Work Orders</h2>
              <Link href="/work-orders">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            
            <div className="space-y-3">
              {workOrdersLoading ? (
                <>
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-20 rounded-xl" />
                </>
              ) : recentWorkOrders && recentWorkOrders.length > 0 ? (
                recentWorkOrders.map((wo) => (
                  <Link key={wo.id} href={`/work-orders/${wo.id}`}>
                    <DataTableRow className="mb-0">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{wo.woNumber}</span>
                            <StatusBadge status={wo.status} />
                          </div>
                          <p className="text-sm text-muted-foreground">{wo.applicantName}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5" />
                            {wo.companyName}
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
                      <Button size="sm" className="gap-2">
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

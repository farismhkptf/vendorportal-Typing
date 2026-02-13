import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Building2,
  FileText,
  Calendar,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/app-layout";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTableRow } from "@/components/ui/data-table-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getGreeting } from "@/lib/greeting";
import { toProperCase } from "@/lib/proper-case";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import type { Company, WorkOrder, Appointment } from "@shared/schema";

interface AppointmentWithDetails extends Appointment {
  workOrder?: {
    woNumber: string;
    applicantName: string;
    companyId: string;
  };
  center?: {
    name: string;
  };
}

function formatTime(datetime: string | Date): string {
  const d = new Date(datetime);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function isToday(datetime: string | Date): boolean {
  const d = new Date(datetime);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

export default function CrmDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: companies, isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: !!user?.staffId,
  });

  const { data: workOrders, isLoading: workOrdersLoading } = useQuery<WorkOrder[]>({
    queryKey: ["/api/work-orders"],
    enabled: !!user?.staffId,
  });

  const { data: allAppointments, isLoading: appointmentsLoading } = useQuery<AppointmentWithDetails[]>({
    queryKey: ["/api/appointments"],
    enabled: !!user?.staffId,
  });

  const myCompanies = useMemo(() => {
    if (!companies || !user?.staffId) return [];
    return companies.filter((c) => c.rmStaffId === user.staffId);
  }, [companies, user?.staffId]);

  const myCompanyIds = useMemo(() => {
    return new Set(myCompanies.map((c) => c.id));
  }, [myCompanies]);

  const myWorkOrders = useMemo(() => {
    if (!workOrders) return [];
    return workOrders.filter((wo) => myCompanyIds.has(wo.companyId));
  }, [workOrders, myCompanyIds]);

  const companyWoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    myWorkOrders.forEach((wo) => {
      counts[wo.companyId] = (counts[wo.companyId] || 0) + 1;
    });
    return counts;
  }, [myWorkOrders]);

  const todayAppointments = useMemo(() => {
    if (!allAppointments) return [];
    return allAppointments
      .filter((apt) => {
        const wo = apt.workOrder;
        if (!wo) return false;
        return myCompanyIds.has(wo.companyId) && isToday(apt.datetime) && apt.status !== "Cancelled";
      })
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  }, [allAppointments, myCompanyIds]);

  const companyNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    myCompanies.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [myCompanies]);

  if (!user?.staffId) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <Card className="p-8 max-w-md text-center space-y-4">
            <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground" data-testid="text-no-staff-link">
              Account Not Linked
            </h2>
            <p className="text-sm text-muted-foreground" data-testid="text-no-staff-message">
              Your account is not linked to a staff member. Please contact your admin.
            </p>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const isLoading = companiesLoading || workOrdersLoading || appointmentsLoading;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground" data-testid="text-greeting">{getGreeting()}</p>
            <h1 className="text-xl font-semibold text-foreground" data-testid="text-user-greeting">
              {user?.name || "Dashboard"}
            </h1>
          </div>
          <Link href="/work-orders/new">
            <Button size="sm" className="gap-1.5" data-testid="button-new-work-order">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">New Work Order</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-6 space-y-4">
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3">
          {isLoading ? (
            <>
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </>
          ) : (
            <>
              <StatCard
                title="My Companies"
                value={myCompanies.length}
                icon={<Building2 className="h-4 w-4" />}
                animationDelay={1}
                onClick={() => navigate("/companies")}
              />
              <StatCard
                title="My Work Orders"
                value={myWorkOrders.length}
                icon={<Briefcase className="h-4 w-4" />}
                animationDelay={2}
                onClick={() => navigate("/work-orders")}
              />
              <StatCard
                title="Today's Appointments"
                value={todayAppointments.length}
                icon={<Calendar className="h-4 w-4" />}
                animationDelay={3}
                onClick={() => navigate("/appointments")}
              />
            </>
          )}
        </div>

        <div className="space-y-3 opacity-0 animate-fade-in animate-delay-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">My Companies</h2>
              {!companiesLoading && (
                <span className="text-xs text-muted-foreground tabular-nums">({myCompanies.length})</span>
              )}
            </div>
            <Link href="/companies">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="link-view-all-companies">
                View All
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {companiesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          ) : myCompanies.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myCompanies.map((company, i) => (
                <Link key={company.id} href={`/companies/${company.id}`}>
                  <div
                    className="premium-card p-4 cursor-pointer hover-elevate opacity-0 animate-fade-in"
                    style={{ animationDelay: `${i * 60 + 200}ms` }}
                    data-testid={`card-company-${company.id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate" data-testid={`text-company-name-${company.id}`}>
                          {toProperCase(company.name)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <FileText className="h-3 w-3 text-muted-foreground/60" />
                          <span className="text-xs text-muted-foreground">
                            {companyWoCounts[company.id] || 0} work order{(companyWoCounts[company.id] || 0) !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="No companies assigned"
              description="You don't have any companies assigned to you yet."
              compact
            />
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-3 opacity-0 animate-fade-in animate-delay-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">Today's Appointments</h2>
                {!appointmentsLoading && (
                  <span className="text-xs text-muted-foreground tabular-nums">({todayAppointments.length})</span>
                )}
              </div>
              <Link href="/appointments">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="link-view-all-appointments">
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
              ) : todayAppointments.length > 0 ? (
                todayAppointments.map((apt, i) => (
                  <Link key={apt.id} href={`/work-orders/${apt.woId}`}>
                    <div
                      className="opacity-0 animate-fade-in"
                      style={{ animationDelay: `${i * 60 + 200}ms` }}
                    >
                      <DataTableRow>
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="font-medium text-foreground" data-testid={`text-apt-wo-${apt.id}`}>
                                {apt.workOrder?.woNumber || "--"}
                              </span>
                              <StatusBadge status={apt.type} />
                            </div>
                            <p className="text-sm text-muted-foreground truncate" data-testid={`text-apt-applicant-${apt.id}`}>
                              {toProperCase(apt.workOrder?.applicantName || "")}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-medium text-foreground" data-testid={`text-apt-time-${apt.id}`}>
                              {formatTime(apt.datetime)}
                            </p>
                            <p className="text-sm text-muted-foreground" data-testid={`text-apt-center-${apt.id}`}>
                              {apt.center?.name || "--"}
                            </p>
                          </div>
                        </div>
                      </DataTableRow>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState
                  icon={<Calendar className="h-6 w-6" />}
                  title="No appointments today"
                  description="There are no scheduled appointments for today."
                  compact
                />
              )}
            </div>
          </div>

          <div className="space-y-3 opacity-0 animate-fade-in animate-delay-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">My Work Orders</h2>
                {!workOrdersLoading && (
                  <span className="text-xs text-muted-foreground tabular-nums">({myWorkOrders.length})</span>
                )}
              </div>
              <Link href="/work-orders">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="link-view-all-work-orders">
                  View All
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>

            <div className="space-y-2">
              {workOrdersLoading ? (
                <>
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                </>
              ) : myWorkOrders.length > 0 ? (
                myWorkOrders.slice(0, 8).map((wo, i) => (
                  <Link key={wo.id} href={`/work-orders/${wo.id}`}>
                    <div
                      className="opacity-0 animate-fade-in"
                      style={{ animationDelay: `${i * 60 + 250}ms` }}
                    >
                      <DataTableRow>
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="font-medium text-foreground" data-testid={`text-wo-number-${wo.id}`}>
                                {wo.woNumber}
                              </span>
                              <StatusBadge status={wo.status} />
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="truncate" data-testid={`text-wo-applicant-${wo.id}`}>
                                {toProperCase(wo.applicantName)}
                              </span>
                              {companyNameMap[wo.companyId] && (
                                <>
                                  <span className="text-muted-foreground/40">|</span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Building2 className="h-3 w-3 text-muted-foreground/60" />
                                    <span className="truncate max-w-[120px]">
                                      {toProperCase(companyNameMap[wo.companyId])}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                        </div>
                      </DataTableRow>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState
                  icon={<FileText className="h-6 w-6" />}
                  title="No work orders"
                  description="No work orders found for your assigned companies."
                  compact
                />
              )}
              {myWorkOrders.length > 8 && (
                <div className="text-center pt-1">
                  <Link href="/work-orders">
                    <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="link-more-work-orders">
                      View all {myWorkOrders.length} work orders
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Calendar,
  Clock,
  ArrowRight,
  AlertCircle,
  Stethoscope,
  CreditCard,
  CheckCircle2,
  CalendarDays,
  CalendarPlus,
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
import { DashboardSwitcher } from "@/components/dashboard-switcher";
import type { Company, Appointment } from "@shared/schema";

interface AppointmentWithDetails extends Appointment {
  workOrder?: {
    id: string;
    woNumber: string;
    applicantName: string;
    companyId: string;
    company?: {
      name: string;
    };
  };
  center?: {
    id: string;
    name: string;
  };
}

function formatTime(datetime: string | Date): string {
  const d = new Date(datetime);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(datetime: string | Date): string {
  const d = new Date(datetime);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function isToday(datetime: string | Date): boolean {
  const d = new Date(datetime);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function isWithinNextDays(datetime: string | Date, days: number): boolean {
  const d = new Date(datetime);
  const now = new Date();
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days + 1);
  return d >= startOfTomorrow && d < endDate;
}

function isThisWeek(datetime: string | Date): boolean {
  const d = new Date(datetime);
  const now = new Date();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
}

function AppointmentItem({ apt, showDate, index }: { apt: AppointmentWithDetails; showDate?: boolean; index: number }) {
  const TypeIcon = apt.type === "Medical" ? Stethoscope : CreditCard;
  const typeColor = apt.type === "Medical"
    ? "text-rose-500 dark:text-rose-400"
    : "text-cyan-500 dark:text-cyan-400";

  return (
    <Link href={`/work-orders/${apt.woId}`}>
      <div
        className="opacity-0 animate-fade-in"
        style={{ animationDelay: `${index * 60 + 200}ms` }}
      >
        <DataTableRow>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                apt.type === "Medical"
                  ? "bg-rose-50 dark:bg-rose-950/40"
                  : "bg-cyan-50 dark:bg-cyan-950/40"
              )}>
                <TypeIcon className={cn("h-4 w-4", typeColor)} />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground" data-testid={`text-apt-wo-${apt.id}`}>
                    {apt.workOrder?.woNumber || "--"}
                  </span>
                  <StatusBadge status={apt.status as any} />
                </div>
                <p className="text-sm text-muted-foreground truncate" data-testid={`text-apt-applicant-${apt.id}`}>
                  {toProperCase(apt.workOrder?.applicantName || "")}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-medium text-foreground" data-testid={`text-apt-time-${apt.id}`}>
                {formatTime(apt.datetime)}
              </p>
              {showDate && (
                <p className="text-xs text-muted-foreground" data-testid={`text-apt-date-${apt.id}`}>
                  {formatDate(apt.datetime)}
                </p>
              )}
              <p className="text-sm text-muted-foreground truncate max-w-[140px]" data-testid={`text-apt-center-${apt.id}`}>
                {apt.center?.name || "--"}
              </p>
            </div>
          </div>
        </DataTableRow>
      </div>
    </Link>
  );
}

export default function MedicalDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  const { data: allAppointments, isLoading: appointmentsLoading } = useQuery<AppointmentWithDetails[]>({
    queryKey: ["/api/appointments"],
    enabled: isAdmin || !!user?.staffId,
  });

  const { data: companies, isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: isAdmin || !!user?.staffId,
  });

  const { data: rawSchedulingQueue } = useQuery<{ medical: any[]; eid: any[] }>({
    queryKey: ["/api/appointments/scheduling-queue"],
    enabled: isAdmin || !!user?.staffId,
  });

  const myCompanyIds = useMemo(() => {
    if (!companies) return new Set<string>();
    if (isAdmin) return new Set(companies.map((c) => c.id));
    if (!user?.staffId) return new Set<string>();
    return new Set(
      companies.filter((c) => c.assistStaffId === user.staffId).map((c) => c.id)
    );
  }, [companies, user?.staffId, isAdmin]);

  const schedulingQueue = useMemo(() => {
    if (!rawSchedulingQueue) return undefined;
    if (isAdmin) return rawSchedulingQueue;
    return {
      medical: rawSchedulingQueue.medical.filter((item: any) => item.companyId && myCompanyIds.has(item.companyId)),
      eid: rawSchedulingQueue.eid.filter((item: any) => item.companyId && myCompanyIds.has(item.companyId)),
    };
  }, [rawSchedulingQueue, myCompanyIds, isAdmin]);

  const myAppointments = useMemo(() => {
    if (!allAppointments) return [];
    if (isAdmin) return allAppointments;
    if (!user?.staffId) return [];
    return allAppointments.filter((apt) => {
      if (apt.assignedStaffId === user.staffId) return true;
      const companyId = apt.workOrder?.companyId;
      if (companyId && myCompanyIds.has(companyId)) return true;
      return false;
    });
  }, [allAppointments, user?.staffId, myCompanyIds, isAdmin]);

  const todayAppointments = useMemo(() => {
    return myAppointments
      .filter((apt) => isToday(apt.datetime) && apt.status !== "Cancelled")
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  }, [myAppointments]);

  const upcomingAppointments = useMemo(() => {
    return myAppointments
      .filter((apt) => isWithinNextDays(apt.datetime, 7) && apt.status !== "Cancelled")
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  }, [myAppointments]);

  const recentCompleted = useMemo(() => {
    return myAppointments
      .filter((apt) => apt.status === "Completed")
      .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
      .slice(0, 8);
  }, [myAppointments]);

  const thisWeekCount = useMemo(() => {
    return myAppointments.filter(
      (apt) => isThisWeek(apt.datetime) && apt.status !== "Cancelled"
    ).length;
  }, [myAppointments]);

  const completedThisWeek = useMemo(() => {
    return myAppointments.filter(
      (apt) => isThisWeek(apt.datetime) && apt.status === "Completed"
    ).length;
  }, [myAppointments]);

  if (!isAdmin && !user?.staffId) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <Card className="p-4 sm:p-8 max-w-md text-center space-y-4">
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

  const isLoading = appointmentsLoading || companiesLoading;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground" data-testid="text-greeting">{getGreeting()}</p>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight" data-testid="text-user-greeting">
              {isAdmin ? "Medical Dashboard" : (user?.name || "Dashboard")}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && <DashboardSwitcher active="medical" />}
            <Link href="/appointments">
              <Button size="sm" className="gap-1.5" data-testid="button-view-appointments">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">All Appointments</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isLoading ? (
            <>
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </>
          ) : (
            <>
              <StatCard
                title="Ready to Schedule"
                value={(schedulingQueue?.medical?.length || 0) + (schedulingQueue?.eid?.length || 0)}
                icon={<CalendarPlus className="h-4 w-4" />}
                animationDelay={1}
              />
              <StatCard
                title="Today's Appointments"
                value={todayAppointments.length}
                icon={<Calendar className="h-4 w-4" />}
                animationDelay={2}
                onClick={() => navigate("/appointments")}
              />
              <StatCard
                title="This Week"
                value={thisWeekCount}
                icon={<CalendarDays className="h-4 w-4" />}
                animationDelay={3}
              />
              <StatCard
                title="Completed This Week"
                value={completedThisWeek}
                icon={<CheckCircle2 className="h-4 w-4" />}
                animationDelay={4}
              />
            </>
          )}
        </div>

        {((schedulingQueue?.medical?.length || 0) + (schedulingQueue?.eid?.length || 0)) > 0 && (
          <div className="space-y-3 opacity-0 animate-fade-in animate-delay-2" data-testid="section-needs-scheduling">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarPlus className="h-4 w-4 text-amber-500" />
                <h2 className="text-base font-semibold text-foreground tracking-tight">Needs Scheduling</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  ({(schedulingQueue?.medical?.length || 0) + (schedulingQueue?.eid?.length || 0)})
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {schedulingQueue?.medical?.map((item: any, i: number) => (
                <Link key={`med-${item.woId}`} href={`/appointments/schedule-medical?wo=${item.woId}`}>
                  <div
                    className="opacity-0 animate-fade-in"
                    style={{ animationDelay: `${i * 60 + 200}ms` }}
                  >
                    <DataTableRow>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-rose-50 dark:bg-rose-950/40">
                            <Stethoscope className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground" data-testid={`text-queue-wo-${item.woNumber}`}>
                                {item.woNumber}
                              </span>
                              <StatusBadge status="Medical" />
                            </div>
                            <p className="text-sm text-muted-foreground truncate" data-testid={`text-queue-applicant-${item.woNumber}`}>
                              {toProperCase(item.applicantName)}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="gap-1.5 shrink-0" data-testid={`button-schedule-med-${item.woNumber}`}>
                          Schedule
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </DataTableRow>
                  </div>
                </Link>
              ))}
              {schedulingQueue?.eid?.map((item: any, i: number) => (
                <Link key={`eid-${item.woId}`} href={`/appointments/schedule-eid?wo=${item.woId}`}>
                  <div
                    className="opacity-0 animate-fade-in"
                    style={{ animationDelay: `${(i + (schedulingQueue?.medical?.length || 0)) * 60 + 200}ms` }}
                  >
                    <DataTableRow>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-cyan-50 dark:bg-cyan-950/40">
                            <CreditCard className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground" data-testid={`text-queue-wo-${item.woNumber}`}>
                                {item.woNumber}
                              </span>
                              <StatusBadge status="EID" />
                            </div>
                            <p className="text-sm text-muted-foreground truncate" data-testid={`text-queue-applicant-${item.woNumber}`}>
                              {toProperCase(item.applicantName)}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="gap-1.5 shrink-0" data-testid={`button-schedule-eid-${item.woNumber}`}>
                          Schedule
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </DataTableRow>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 opacity-0 animate-fade-in animate-delay-2" data-testid="section-today-appointments">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground tracking-tight">Today's Appointments</h2>
              {!isLoading && (
                <span className="text-xs text-muted-foreground tabular-nums">({todayAppointments.length})</span>
              )}
            </div>
            <Link href="/appointments">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="link-view-all-today">
                View All
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          <div className="space-y-2">
            {isLoading ? (
              <>
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
              </>
            ) : todayAppointments.length > 0 ? (
              todayAppointments.map((apt, i) => (
                <AppointmentItem key={apt.id} apt={apt} index={i} />
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

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-3 opacity-0 animate-fade-in animate-delay-3" data-testid="section-upcoming-appointments">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground tracking-tight">Upcoming Appointments</h2>
                {!isLoading && (
                  <span className="text-xs text-muted-foreground tabular-nums">({upcomingAppointments.length})</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {isLoading ? (
                <>
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                </>
              ) : upcomingAppointments.length > 0 ? (
                upcomingAppointments.slice(0, 8).map((apt, i) => (
                  <AppointmentItem key={apt.id} apt={apt} showDate index={i} />
                ))
              ) : (
                <EmptyState
                  icon={<Clock className="h-6 w-6" />}
                  title="No upcoming appointments"
                  description="There are no appointments in the next 7 days."
                  compact
                />
              )}
              {upcomingAppointments.length > 8 && (
                <div className="text-center pt-1">
                  <Link href="/appointments">
                    <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="link-more-upcoming">
                      View all {upcomingAppointments.length} upcoming
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 opacity-0 animate-fade-in animate-delay-4" data-testid="section-recent-completed">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground tracking-tight">Recent Completed</h2>
                {!isLoading && (
                  <span className="text-xs text-muted-foreground tabular-nums">({recentCompleted.length})</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {isLoading ? (
                <>
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                </>
              ) : recentCompleted.length > 0 ? (
                recentCompleted.map((apt, i) => (
                  <AppointmentItem key={apt.id} apt={apt} showDate index={i} />
                ))
              ) : (
                <EmptyState
                  icon={<CheckCircle2 className="h-6 w-6" />}
                  title="No completed appointments"
                  description="No appointments have been completed yet."
                  compact
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

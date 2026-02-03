import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Calendar, Clock, Plus, Stethoscope, 
  CheckCircle2, AlertCircle, Building2, User
} from "lucide-react";
import { formatDateWithWeekday } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/app-layout";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Appointment, WorkOrder, Center } from "@shared/schema";

interface AppointmentWithRelations extends Appointment {
  workOrder?: WorkOrder & { company?: { name: string } };
  center?: Center;
}

interface AppointmentStats {
  todayCount: number;
  upcomingCount: number;
  completedCount: number;
  cancelledCount: number;
}

export default function AppointmentsIndex() {
  const { data: appointments, isLoading } = useQuery<AppointmentWithRelations[]>({
    queryKey: ["/api/appointments"],
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const stats: AppointmentStats = {
    todayCount: appointments?.filter(a => {
      const aptDate = new Date(a.datetime);
      return aptDate >= today && aptDate < tomorrow && a.status === "Scheduled";
    }).length || 0,
    upcomingCount: appointments?.filter(a => {
      const aptDate = new Date(a.datetime);
      return aptDate >= tomorrow && a.status === "Scheduled";
    }).length || 0,
    completedCount: appointments?.filter(a => a.status === "Completed").length || 0,
    cancelledCount: appointments?.filter(a => a.status === "Cancelled").length || 0,
  };

  const todayAppointments = appointments?.filter(a => {
    const aptDate = new Date(a.datetime);
    return aptDate >= today && aptDate < tomorrow;
  }).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()) || [];

  const upcomingAppointments = appointments?.filter(a => {
    const aptDate = new Date(a.datetime);
    return aptDate >= tomorrow && a.status === "Scheduled";
  }).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()).slice(0, 10) || [];

  const formatTime = (datetime: string | Date) => {
    const d = typeof datetime === "string" ? new Date(datetime) : datetime;
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDateDisplay = (datetime: string | Date) => {
    return formatDateWithWeekday(datetime);
  };

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground" data-testid="page-title">
              Appointments
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage medical and EID appointment scheduling
            </p>
          </div>
          <Link href="/appointments/schedule-medical">
            <Button size="sm" className="gap-2 rounded-lg" data-testid="button-schedule-new">
              <Plus className="h-4 w-4" />
              Schedule New
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            title="Today"
            value={stats.todayCount}
            icon={<Calendar className="h-4 w-4" />}
            data-testid="stat-today"
          />
          <StatCard
            title="Upcoming"
            value={stats.upcomingCount}
            icon={<Clock className="h-4 w-4" />}
            data-testid="stat-upcoming"
          />
          <StatCard
            title="Completed"
            value={stats.completedCount}
            icon={<CheckCircle2 className="h-4 w-4" />}
            data-testid="stat-completed"
          />
          <StatCard
            title="Cancelled"
            value={stats.cancelledCount}
            icon={<AlertCircle className="h-4 w-4" />}
            data-testid="stat-cancelled"
          />
        </div>

        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Today's Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : todayAppointments.length > 0 ? (
              <div className="space-y-3">
                {todayAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-4 rounded-lg bg-muted/30 border border-border/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    data-testid={`appointment-today-${apt.id}`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="text-center min-w-[50px] sm:min-w-[60px]">
                        <p className="font-semibold text-foreground">{formatTime(apt.datetime)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <p className="font-medium text-foreground truncate">
                            {apt.workOrder?.applicantName || "Unknown"}
                          </p>
                          {apt.isVip && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                              VIP
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <p className="text-sm text-muted-foreground truncate">
                            {apt.workOrder?.company?.name || "Unknown Company"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                      <Badge variant={apt.status === "Scheduled" ? "default" : apt.status === "Completed" ? "secondary" : "destructive"}>
                        {apt.status}
                      </Badge>
                      <Link href={`/work-orders/${apt.woId}`}>
                        <Button variant="outline" size="sm" data-testid={`button-view-wo-${apt.id}`}>
                          View WO
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Calendar className="h-6 w-6" />}
                title="No appointments today"
                description="Schedule a new medical appointment to get started."
              />
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Upcoming Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : upcomingAppointments.length > 0 ? (
              <div className="space-y-3">
                {upcomingAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-4 rounded-lg bg-muted/30 border border-border/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    data-testid={`appointment-upcoming-${apt.id}`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="text-center min-w-[60px] sm:min-w-[80px]">
                        <p className="text-xs text-muted-foreground">{formatDateDisplay(apt.datetime)}</p>
                        <p className="font-semibold text-foreground">{formatTime(apt.datetime)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <p className="font-medium text-foreground truncate">
                            {apt.workOrder?.applicantName || "Unknown"}
                          </p>
                          {apt.isVip && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                              VIP
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <p className="text-sm text-muted-foreground truncate">
                            {apt.workOrder?.company?.name || "Unknown Company"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Link href={`/work-orders/${apt.woId}`} className="self-end sm:self-auto shrink-0">
                      <Button variant="outline" size="sm" data-testid={`button-view-wo-upcoming-${apt.id}`}>
                        View WO
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Clock className="h-6 w-6" />}
                title="No upcoming appointments"
                description="All upcoming appointments will appear here."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

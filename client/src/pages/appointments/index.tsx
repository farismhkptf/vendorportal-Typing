import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  Calendar, Clock, Stethoscope, CreditCard,
  CheckCircle2, AlertCircle, Building2, User,
  MoreHorizontal, RefreshCw, XCircle, MapPin
} from "lucide-react";
import { formatDateWithWeekday } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/app-layout";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toProperCase } from "@/lib/proper-case";
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
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "complete" | "cancel" | "reschedule";
    appointment: AppointmentWithRelations | null;
  }>({ open: false, type: "complete", appointment: null });

  const { data: appointments, isLoading } = useQuery<AppointmentWithRelations[]>({
    queryKey: ["/api/appointments"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/appointments/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
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
    cancelledCount: appointments?.filter(a => a.status === "Cancelled" || a.status === "Rescheduled").length || 0,
  };

  const todayAppointments = appointments?.filter(a => {
    const aptDate = new Date(a.datetime);
    return aptDate >= today && aptDate < tomorrow && a.status === "Scheduled";
  }).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()) || [];

  const upcomingAppointments = appointments?.filter(a => {
    const aptDate = new Date(a.datetime);
    return aptDate >= tomorrow && a.status === "Scheduled";
  }).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()).slice(0, 10) || [];

  const completedAppointments = appointments?.filter(a => a.status === "Completed")
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()).slice(0, 10) || [];

  const cancelledAppointments = appointments?.filter(a => a.status === "Cancelled" || a.status === "Rescheduled")
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()).slice(0, 10) || [];

  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      document.querySelectorAll("[data-highlight]").forEach(e => {
        e.classList.remove("ring-2", "ring-primary/40");
        e.removeAttribute("data-highlight");
      });
      el.setAttribute("data-highlight", "true");
      el.classList.add("ring-2", "ring-primary/40");
      highlightTimerRef.current = setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary/40");
        el.removeAttribute("data-highlight");
        highlightTimerRef.current = null;
      }, 1500);
    }
  }, []);

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

  const handleConfirmAction = async () => {
    const { type, appointment } = confirmDialog;
    if (!appointment) return;

    try {
      if (type === "reschedule") {
        await updateStatusMutation.mutateAsync({ id: appointment.id, status: "Rescheduled" });
        toast({ title: "Appointment marked as rescheduled", description: "Redirecting to schedule a new appointment..." });
        setConfirmDialog({ open: false, type: "complete", appointment: null });
        const scheduleUrl = appointment.type === "Medical" 
          ? `/appointments/schedule-medical?woId=${appointment.woId}`
          : `/appointments/schedule-eid?woId=${appointment.woId}`;
        navigate(scheduleUrl);
        return;
      }

      const status = type === "complete" ? "Completed" : "Cancelled";
      await updateStatusMutation.mutateAsync({ id: appointment.id, status });
      toast({ 
        title: `Appointment ${status.toLowerCase()}`,
        description: `The appointment has been marked as ${status.toLowerCase()}.`,
      });
      setConfirmDialog({ open: false, type: "complete", appointment: null });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update appointment",
        variant: "destructive",
      });
    }
  };

  const renderAppointmentCard = (apt: AppointmentWithRelations, showDate: boolean, showActions: boolean) => (
    <div
      key={apt.id}
      className="p-4 rounded-lg bg-muted/30 border border-border/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      data-testid={`appointment-card-${apt.id}`}
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
        <div className="text-center min-w-[50px] sm:min-w-[60px] shrink-0">
          {showDate && (
            <p className="text-xs text-muted-foreground">{formatDateDisplay(apt.datetime)}</p>
          )}
          <p className="font-semibold text-foreground">{formatTime(apt.datetime)}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="font-medium text-foreground truncate">
              {apt.workOrder?.applicantName ? toProperCase(apt.workOrder.applicantName) : "Unknown"}
            </p>
            <Badge variant="secondary" className="text-xs">
              {apt.type}
            </Badge>
            {apt.isVip && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                VIP
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground truncate">
                {apt.workOrder?.company?.name ? toProperCase(apt.workOrder.company.name) : "Unknown Company"}
              </p>
            </div>
            {apt.center?.name && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground truncate">
                  {apt.center.name}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
        {!showActions && (
          <Badge variant={
            apt.status === "Completed" ? "secondary" : 
            apt.status === "Cancelled" ? "destructive" : 
            apt.status === "Rescheduled" ? "outline" :
            "default"
          }>
            {apt.status}
          </Badge>
        )}
        {showActions && (
          <>
            <Button
              variant="default"
              size="sm"
              className="gap-1.5"
              onClick={() => setConfirmDialog({ open: true, type: "complete", appointment: apt })}
              data-testid={`button-complete-${apt.id}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Done
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setConfirmDialog({ open: true, type: "reschedule", appointment: apt })}
              data-testid={`button-reschedule-${apt.id}`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reschedule
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive"
              onClick={() => setConfirmDialog({ open: true, type: "cancel", appointment: apt })}
              data-testid={`button-cancel-${apt.id}`}
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </>
        )}
        <Link href={`/work-orders/${apt.woId}`}>
          <Button variant="ghost" size="sm" data-testid={`button-view-wo-${apt.id}`}>
            View WO
          </Button>
        </Link>
      </div>
    </div>
  );

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
          <div className="flex items-center gap-2">
            <Link href="/appointments/schedule-medical">
              <Button size="sm" variant="default" className="gap-2 rounded-lg" data-testid="button-schedule-medical">
                <Stethoscope className="h-4 w-4" />
                Medical
              </Button>
            </Link>
            <Link href="/appointments/schedule-eid">
              <Button size="sm" variant="outline" className="gap-2 rounded-lg" data-testid="button-schedule-eid">
                <CreditCard className="h-4 w-4" />
                Emirates ID
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="Today" value={stats.todayCount} icon={<Calendar className="h-4 w-4" />} onClick={() => scrollToSection("section-today")} />
          <StatCard title="Upcoming" value={stats.upcomingCount} icon={<Clock className="h-4 w-4" />} animationDelay={1} onClick={() => scrollToSection("section-upcoming")} />
          <StatCard title="Completed" value={stats.completedCount} icon={<CheckCircle2 className="h-4 w-4" />} animationDelay={2} onClick={() => scrollToSection("section-completed")} />
          <StatCard title="Cancelled" value={stats.cancelledCount} icon={<AlertCircle className="h-4 w-4" />} animationDelay={3} onClick={() => scrollToSection("section-cancelled")} />
        </div>

        <Card id="section-today" className="border border-border/50 shadow-sm rounded-xl scroll-mt-4 transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
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
                {todayAppointments.map((apt) => renderAppointmentCard(apt, false, true))}
              </div>
            ) : (
              <EmptyState
                icon={<Calendar className="h-6 w-6" />}
                title="No appointments today"
                description="Schedule a new appointment to get started."
              />
            )}
          </CardContent>
        </Card>

        <Card id="section-upcoming" className="border border-border/50 shadow-sm rounded-xl scroll-mt-4 transition-all duration-300">
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
                {upcomingAppointments.map((apt) => renderAppointmentCard(apt, true, true))}
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

        {completedAppointments.length > 0 && (
          <Card id="section-completed" className="border border-border/50 shadow-sm rounded-xl scroll-mt-4 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Completed
                <Badge variant="secondary" className="text-xs ml-1">{stats.completedCount}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {completedAppointments.map((apt) => renderAppointmentCard(apt, true, false))}
              </div>
            </CardContent>
          </Card>
        )}

        {cancelledAppointments.length > 0 && (
          <Card id="section-cancelled" className="border border-border/50 shadow-sm rounded-xl scroll-mt-4 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                Cancelled / Rescheduled
                <Badge variant="secondary" className="text-xs ml-1">{stats.cancelledCount}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {cancelledAppointments.map((apt) => renderAppointmentCard(apt, true, false))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, type: "complete", appointment: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.type === "complete" && "Mark as Completed"}
              {confirmDialog.type === "cancel" && "Cancel Appointment"}
              {confirmDialog.type === "reschedule" && "Reschedule Appointment"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {confirmDialog.appointment && (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Applicant:</span>{" "}
                  <span className="font-medium">{confirmDialog.appointment.workOrder?.applicantName ? toProperCase(confirmDialog.appointment.workOrder.applicantName) : "Unknown"}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Type:</span>{" "}
                  <span className="font-medium">{confirmDialog.appointment.type}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Date:</span>{" "}
                  <span className="font-medium">{formatDateDisplay(confirmDialog.appointment.datetime)} at {formatTime(confirmDialog.appointment.datetime)}</span>
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4">
              {confirmDialog.type === "complete" && "This will mark the appointment as completed."}
              {confirmDialog.type === "cancel" && "This will cancel the appointment. This action cannot be undone."}
              {confirmDialog.type === "reschedule" && "This will mark the current appointment as rescheduled and take you to schedule a new one for the same work order."}
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, type: "complete", appointment: null })}
              data-testid="button-dialog-cancel"
            >
              Go Back
            </Button>
            <Button
              variant={confirmDialog.type === "cancel" ? "destructive" : "default"}
              onClick={handleConfirmAction}
              disabled={updateStatusMutation.isPending}
              data-testid="button-dialog-confirm"
            >
              {updateStatusMutation.isPending ? "Processing..." : 
                confirmDialog.type === "complete" ? "Mark Completed" :
                confirmDialog.type === "cancel" ? "Cancel Appointment" :
                "Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

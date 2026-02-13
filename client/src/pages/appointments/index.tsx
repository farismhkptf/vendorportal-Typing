import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { 
  Calendar, Clock, Stethoscope, CreditCard,
  CheckCircle2, AlertCircle, Building2, User,
  MoreHorizontal, RefreshCw, XCircle, MapPin,
  Mail, MessageCircle, Copy, Check, Maximize2
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
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableToolbar } from "@/components/ui/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toProperCase } from "@/lib/proper-case";
import { generateMedicalAppointmentEmailHtml, MedicalAppointmentEmail } from "@/components/email-templates/medical-appointment-email";
import { generateEidAppointmentEmailHtml, EidAppointmentEmail } from "@/components/email-templates/eid-appointment-email";
import type { Appointment, WorkOrder, Center, Staff, Company, ServiceType } from "@shared/schema";

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

const formatTime12h = (time24: string) => {
  const [h, m] = time24.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
};

export default function AppointmentsIndex() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const searchParams = useSearch();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "complete" | "cancel" | "reschedule";
    appointment: AppointmentWithRelations | null;
  }>({ open: false, type: "complete", appointment: null });
  const [viewMessagesApt, setViewMessagesApt] = useState<AppointmentWithRelations | null>(null);
  const [messageCopied, setMessageCopied] = useState<"email" | "whatsapp" | null>(null);
  const [emailFullscreen, setEmailFullscreen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: appointments, isLoading } = useQuery<AppointmentWithRelations[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: staffList } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  useEffect(() => {
    if (!appointments || !searchParams) return;
    const params = new URLSearchParams(searchParams);
    const viewMessagesId = params.get("viewMessages");
    if (viewMessagesId) {
      const apt = appointments.find(a => a.id === viewMessagesId);
      if (apt) {
        setViewMessagesApt(apt);
        setMessageCopied(null);
      }
    }
  }, [appointments, searchParams]);

  const viewMessagesData = useMemo(() => {
    if (!viewMessagesApt) return null;
    const apt = viewMessagesApt;
    const wo = apt.workOrder;
    const center = apt.center;
    const company = wo?.companyId ? companies?.find(c => c.id === wo.companyId) : null;
    const assist = company?.assistStaffId ? staffList?.find(s => s.id === company.assistStaffId) : null;
    const crm = company?.rmStaffId ? staffList?.find(s => s.id === company.rmStaffId) : null;
    const serviceType = wo?.serviceTypeId ? serviceTypes?.find(st => st.id === wo.serviceTypeId) : null;
    const serviceName = serviceType?.name || (apt.type === "Medical" ? "Medical Examination" : "Emirates ID");
    
    const aptDate = new Date(apt.datetime);
    const formattedDate = aptDate.toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
    const formattedTime = aptDate.toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", hour12: true
    });

    const contactLines = [];
    if (assist) {
      const label = apt.type === "Medical" ? "Medical Assistant" : "Field Assistant";
      contactLines.push(`${label}: ${assist.name}${assist.phone ? ` - ${assist.phone}` : ""}`);
    }
    if (crm) {
      contactLines.push(`Client Relations: ${crm.name}${crm.phone ? ` - ${crm.phone}` : ""}`);
    }
    const contactSection = contactLines.length > 0 ? `Your P.R.O. Team:\n${contactLines.join("\n")}` : "";

    const centerLabel = apt.type === "Medical" ? "Medical Center" : "Emirates ID Center";
    const locationLink = center?.address 
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(center.address)}`
      : "";
    const assistanceSection = assist 
      ? `\u{1F464} Assistance: ${assist.name}\n\u{1F4DE} ${assist.phone || ""}` 
      : "";

    const emailBody = `Dear ${toProperCase(company?.name || wo?.company?.name || "")} Team,

We have scheduled ${apt.type === "Medical" ? "a medical" : "an Emirates ID"} appointment for your employee:

Applicant: ${toProperCase(wo?.applicantName || "")}
${wo?.applicantPhone ? `Contact: ${wo.applicantPhone}` : ""}

Appointment Details:
- Date: ${formattedDate}
- Time: ${formattedTime}
- ${centerLabel}: ${center?.name || "TBD"}
${center?.address ? `- Address: ${center.address}` : ""}
${center?.googleMapsUrl ? `- Location: ${center.googleMapsUrl}` : ""}
${apt.applicationNumber ? `- Application Number: ${apt.applicationNumber}` : ""}

${contactSection}

${apt.notes ? `Note: ${apt.notes}` : ""}

Please ensure the applicant arrives 15 minutes before the scheduled time with all required documents.
${apt.type === "EID" ? "\nOnce the Emirates ID process is completed, we will update you with the status.\n" : ""}
Best regards,
The P.R.O. Company\u2122`;

    const whatsappBody = `Hello \u{1F44B}

Your ${apt.type === "Medical" ? "medical" : "Emirates ID"} appointment has been scheduled successfully for the following work.

\u{1F4C4} WO: ${wo?.woNumber || ""}
\u{1F464} Applicant: ${toProperCase(wo?.applicantName || "")}
\u{1F3E2} Company: ${toProperCase(company?.name || wo?.company?.name || "")}
\u{1F9FE} Service: ${toProperCase(serviceName)}
${apt.applicationNumber ? `\u{1F522} Application No: ${apt.applicationNumber}` : ""}

${apt.type === "Medical" ? "\u{1F3E5}" : "\u{1FAAA}"} ${centerLabel}: ${center?.name || "TBD"}
\u{1F4C5} Date: ${formattedDate}
\u23F0 Time: ${formattedTime}
${center?.address ? `\u{1F4CD} Location: ${center.address}` : ""}
${locationLink ? `\u{1F5FA}\uFE0F Map: ${locationLink}` : ""}

${assistanceSection}

\u26A0\uFE0F *Important:*
\u2022 Please arrive at least *10 minutes before* the scheduled time.
\u2022 Please ensure the applicant brings their *original passport*.
${apt.notes ? `\u2022 ${apt.notes}` : ""}
${apt.type === "EID" ? "\nOnce the Emirates ID process is completed, we will update you with the status.\n" : ""}
Thank you,
*The P.R.O. Company\u2122*`;

    const emailHtmlProps = {
      woNumber: wo?.woNumber || "",
      companyName: toProperCase(company?.name || wo?.company?.name || ""),
      applicantName: toProperCase(wo?.applicantName || ""),
      serviceType: toProperCase(serviceName),
      centerName: center?.name || "TBD",
      centerAddress: center?.address || undefined,
      centerType: (center?.tier === "VIP" ? "VIP" : "Normal") as "Normal" | "VIP",
      appointmentDate: aptDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      appointmentTime: formattedTime,
      applicationNumber: apt.applicationNumber || undefined,
      crmName: crm?.name,
      crmPhone: crm?.phone || undefined,
      notes: apt.notes || undefined,
    };

    const medicalEmailProps = {
      ...emailHtmlProps,
      medicalAssistName: assist?.name,
      medicalAssistPhone: assist?.phone || undefined,
    };

    const eidEmailProps = {
      ...emailHtmlProps,
      assistName: assist?.name,
      assistPhone: assist?.phone || undefined,
    };

    return { emailBody, whatsappBody, medicalEmailProps, eidEmailProps, apt };
  }, [viewMessagesApt, companies, staffList, serviceTypes]);

  const handleCopyViewMessage = async (type: "email" | "whatsapp") => {
    if (!viewMessagesData) return;
    const { apt, emailBody, whatsappBody, medicalEmailProps, eidEmailProps } = viewMessagesData;

    if (type === "whatsapp") {
      await navigator.clipboard.writeText(whatsappBody);
    } else {
      const emailHtml = apt.type === "Medical"
        ? generateMedicalAppointmentEmailHtml(medicalEmailProps)
        : generateEidAppointmentEmailHtml(eidEmailProps);
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([emailHtml], { type: "text/html" }),
            "text/plain": new Blob([emailBody], { type: "text/plain" }),
          }),
        ]);
      } catch {
        await navigator.clipboard.writeText(emailBody);
      }
    }
    setMessageCopied(type);
    setTimeout(() => setMessageCopied(null), 2000);
    toast({
      title: "Copied!",
      description: `${type === "email" ? "Email (with formatting)" : "WhatsApp"} message copied to clipboard.`,
    });
  };

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

  const filteredAppointments = useMemo(() => {
    if (!appointments) return [];
    if (!search.trim()) return appointments;
    const q = search.toLowerCase();
    return appointments.filter(a => {
      const woNumber = a.workOrder?.woNumber?.toLowerCase() || "";
      const applicant = a.workOrder?.applicantName?.toLowerCase() || "";
      const centerName = a.center?.name?.toLowerCase() || "";
      return woNumber.includes(q) || applicant.includes(q) || centerName.includes(q);
    });
  }, [appointments, search]);

  const todayAppointments = useMemo(() =>
    filteredAppointments.filter(a => {
      const aptDate = new Date(a.datetime);
      return aptDate >= today && aptDate < tomorrow && a.status === "Scheduled";
    }).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()),
    [filteredAppointments, today, tomorrow]
  );

  const upcomingAppointments = useMemo(() =>
    filteredAppointments.filter(a => {
      const aptDate = new Date(a.datetime);
      return aptDate >= tomorrow && a.status === "Scheduled";
    }).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()),
    [filteredAppointments, tomorrow]
  );

  const completedAppointments = useMemo(() =>
    filteredAppointments.filter(a => a.status === "Completed")
      .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()),
    [filteredAppointments]
  );

  const cancelledAppointments = useMemo(() =>
    filteredAppointments.filter(a => a.status === "Cancelled" || a.status === "Rescheduled")
      .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()),
    [filteredAppointments]
  );

  const allFilteredAppointments = useMemo(() => [
    ...todayAppointments,
    ...upcomingAppointments,
    ...completedAppointments,
    ...cancelledAppointments,
  ], [todayAppointments, upcomingAppointments, completedAppointments, cancelledAppointments]);

  const getId = useCallback((apt: AppointmentWithRelations) => apt.id, []);

  const dt = useDataTable(allFilteredAppointments, {
    storageKey: "apt_list",
    defaultPageSize: 25,
    getId,
  });

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
          ? `/appointments/schedule-medical?wo=${appointment.woId}`
          : `/appointments/schedule-eid?wo=${appointment.woId}`;
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

  const formatShortDate = (datetime: string | Date) => {
    const d = typeof datetime === "string" ? new Date(datetime) : datetime;
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };

  const isComfortable = dt.density === "comfortable";

  const renderAppointmentCard = (apt: AppointmentWithRelations, showDate: boolean, showActions: boolean) => (
    <div
      key={apt.id}
      className="flex items-start gap-2"
      data-testid={`appointment-card-${apt.id}`}
    >
      <div className={isComfortable ? "pt-4" : "pt-2.5"}>
        <Checkbox
          checked={dt.selectedIds.has(apt.id)}
          onCheckedChange={() => dt.toggleSelected(apt.id)}
          aria-label={`Select appointment ${apt.workOrder?.applicantName || apt.id}`}
          data-testid={`checkbox-apt-${apt.id}`}
        />
      </div>
      <div
        className={`flex-1 min-w-0 ${isComfortable ? "p-4" : "p-2.5"} rounded-lg bg-muted/30 border border-border/30`}
      >
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-[110px] rounded-md bg-background border border-border/40 px-3 py-2 text-center">
          {showDate && (
            <p className="text-xs font-medium text-muted-foreground leading-tight">{formatShortDate(apt.datetime)}</p>
          )}
          <p className="text-lg font-bold text-foreground leading-snug tracking-tight">{formatTime(apt.datetime)}</p>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium text-sm text-foreground truncate">
              {apt.workOrder?.applicantName ? toProperCase(apt.workOrder.applicantName) : "Unknown"}
            </span>
            <Badge variant="secondary" className="text-xs">
              {apt.type}
            </Badge>
            {apt.isVip && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                VIP
              </Badge>
            )}
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
          </div>
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground truncate">
              {apt.workOrder?.company?.name ? toProperCase(apt.workOrder.company.name) : "Unknown Company"}
            </span>
          </div>
          {apt.center?.name && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground truncate">
                {apt.center.name}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/20 justify-end flex-wrap">
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
        {(apt.status === "Scheduled") && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => { setViewMessagesApt(apt); setMessageCopied(null); }}
            data-testid={`button-view-messages-${apt.id}`}
          >
            <Mail className="h-3.5 w-3.5" />
            Messages
          </Button>
        )}
        <Link href={`/work-orders/${apt.woId}`}>
          <Button variant="ghost" size="sm" data-testid={`button-view-wo-${apt.id}`}>
            View WO
          </Button>
        </Link>
      </div>
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

        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by WO number, applicant, or center..."
          density={dt.density}
          onDensityChange={dt.setDensity}
          totalItems={dt.totalItems}
          selectedCount={dt.selectedCount}
          onClearSelection={dt.clearSelection}
        />

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
              <div className="space-y-3 stagger-children">
                {todayAppointments.map((apt) => renderAppointmentCard(apt, false, true))}
              </div>
            ) : (
              <EmptyState
                icon={<Calendar className="h-6 w-6" />}
                title={search ? "No matching appointments today" : "No appointments today"}
                description={search ? "Try adjusting your search terms." : "Schedule a new appointment to get started."}
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
              <div className="space-y-3 stagger-children">
                {upcomingAppointments.map((apt) => renderAppointmentCard(apt, true, true))}
              </div>
            ) : (
              <EmptyState
                icon={<Clock className="h-6 w-6" />}
                title={search ? "No matching upcoming appointments" : "No upcoming appointments"}
                description={search ? "Try adjusting your search terms." : "All upcoming appointments will appear here."}
              />
            )}
          </CardContent>
        </Card>

        {(completedAppointments.length > 0 || search) && (
          <Card id="section-completed" className="border border-border/50 shadow-sm rounded-xl scroll-mt-4 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Completed
                {completedAppointments.length > 0 && (
                  <Badge variant="secondary" className="text-xs ml-1">{completedAppointments.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completedAppointments.length > 0 ? (
                <div className="space-y-3">
                  {completedAppointments.map((apt) => renderAppointmentCard(apt, true, false))}
                </div>
              ) : (
                <EmptyState
                  icon={<CheckCircle2 className="h-6 w-6" />}
                  title="No matching completed appointments"
                  description="Try adjusting your search terms."
                />
              )}
            </CardContent>
          </Card>
        )}

        {(cancelledAppointments.length > 0 || search) && (
          <Card id="section-cancelled" className="border border-border/50 shadow-sm rounded-xl scroll-mt-4 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                Cancelled / Rescheduled
                {cancelledAppointments.length > 0 && (
                  <Badge variant="secondary" className="text-xs ml-1">{cancelledAppointments.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cancelledAppointments.length > 0 ? (
                <div className="space-y-3">
                  {cancelledAppointments.map((apt) => renderAppointmentCard(apt, true, false))}
                </div>
              ) : (
                <EmptyState
                  icon={<XCircle className="h-6 w-6" />}
                  title="No matching cancelled appointments"
                  description="Try adjusting your search terms."
                />
              )}
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
      <Dialog open={!!viewMessagesApt} onOpenChange={(open) => { if (!open) { setViewMessagesApt(null); setEmailFullscreen(false); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewMessagesApt?.type === "Medical" ? (
                <Stethoscope className="h-5 w-5 text-emerald-600" />
              ) : (
                <CreditCard className="h-5 w-5 text-blue-600" />
              )}
              Appointment Messages
            </DialogTitle>
          </DialogHeader>

          {viewMessagesData && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                <div className="flex items-center gap-3 flex-wrap text-sm">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{toProperCase(viewMessagesApt?.workOrder?.applicantName || "")}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{toProperCase(viewMessagesApt?.workOrder?.company?.name || "")}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {viewMessagesApt ? formatDateDisplay(viewMessagesApt.datetime) : ""} at {viewMessagesApt ? formatTime(viewMessagesApt.datetime) : ""}
                    </span>
                  </div>
                </div>
              </div>

              <Tabs defaultValue="email">
                <TabsList className="w-full">
                  <TabsTrigger value="email" className="flex-1 gap-1.5" data-testid="tab-view-email">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </TabsTrigger>
                  <TabsTrigger value="whatsapp" className="flex-1 gap-1.5" data-testid="tab-view-whatsapp">
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="email" className="space-y-3 mt-3">
                  <div className="rounded-lg border border-border/50 overflow-hidden max-h-[40vh] overflow-y-auto">
                    <div className="p-1 scale-[0.85] origin-top-left" style={{ width: "117.6%" }}>
                      {viewMessagesApt?.type === "Medical" ? (
                        <MedicalAppointmentEmail {...viewMessagesData.medicalEmailProps} />
                      ) : (
                        <EidAppointmentEmail {...viewMessagesData.eidEmailProps} />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleCopyViewMessage("email")}
                      className="gap-2"
                      data-testid="button-copy-email-message"
                    >
                      {messageCopied === "email" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {messageCopied === "email" ? "Copied!" : "Copy Email"}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setEmailFullscreen(true)}
                      data-testid="button-email-fullscreen"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="whatsapp" className="space-y-3 mt-3">
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-4 max-h-[40vh] overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-foreground">
                      {viewMessagesData.whatsappBody}
                    </pre>
                  </div>
                  <Button
                    onClick={() => handleCopyViewMessage("whatsapp")}
                    className="gap-2"
                    data-testid="button-copy-whatsapp-message"
                  >
                    {messageCopied === "whatsapp" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {messageCopied === "whatsapp" ? "Copied!" : "Copy WhatsApp"}
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={emailFullscreen} onOpenChange={setEmailFullscreen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className={`px-6 py-4 border-b ${viewMessagesApt?.type === "Medical" ? "bg-gradient-to-r from-[#4a7c59] to-[#2d5a3d]" : "bg-gradient-to-r from-[#2563eb] to-[#1e40af]"}`}>
            <DialogTitle className="text-white flex items-center gap-2">
              {viewMessagesApt?.type === "Medical" ? (
                <Stethoscope className="h-5 w-5" />
              ) : (
                <CreditCard className="h-5 w-5" />
              )}
              Email Preview
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {viewMessagesData && viewMessagesApt?.type === "Medical" ? (
              <MedicalAppointmentEmail {...viewMessagesData.medicalEmailProps} />
            ) : viewMessagesData ? (
              <EidAppointmentEmail {...viewMessagesData.eidEmailProps} />
            ) : null}
          </div>
          <div className="px-6 py-4 border-t flex items-center justify-end gap-2">
            <Button
              onClick={() => handleCopyViewMessage("email")}
              className="gap-2"
              data-testid="button-fullscreen-copy-email"
            >
              {messageCopied === "email" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {messageCopied === "email" ? "Copied!" : "Copy Email"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

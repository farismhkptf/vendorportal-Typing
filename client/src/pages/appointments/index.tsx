import { Link, useLocation } from "wouter";
import {
  Stethoscope, CreditCard,
  ChevronLeft, ChevronRight, LayoutList, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/app-layout";
import { QueryErrorState } from "@/components/ui/query-error-state";
import {
  AppointmentConfirmationDialog,
  MessagesDialog,
  EmailDraftDialog,
  FullscreenPreviewDialog,
} from "./components/appointment-dialogs";
import { AppointmentStatsRow } from "./components/appointment-stats";
import { AppointmentCalendar } from "./components/appointment-calendar";
import { AppointmentToolbar } from "./components/appointment-toolbar";
import { AppointmentListSections } from "./components/appointment-list-sections";
import { useAppointmentMessages } from "./components/appointment-messages-handler";
import { useAppointmentsData } from "./components/use-appointments-data";
import { useAppointmentActions } from "./components/appointment-action-handlers";

export default function AppointmentsIndex() {
  const [, navigate] = useLocation();
  const data = useAppointmentsData();
  const actions = useAppointmentActions();
  const messages = useAppointmentMessages(
    data.companies, data.staffList, data.serviceTypes,
    data.searchParams, data.appointments, actions.toast,
  );

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight" data-testid="page-title">
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

        {data.appointmentsError && (
          <QueryErrorState message="Could not load appointments." onRetry={() => data.refetchAppointments()} />
        )}

        <AppointmentStatsRow stats={data.stats} scrollToSection={actions.scrollToSection} />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border/30">
            <Button variant={data.viewMode === "list" ? "secondary" : "ghost"} size="sm" className="gap-1.5 h-8 px-3" onClick={() => data.setViewMode("list")} data-testid="button-view-list">
              <LayoutList className="h-3.5 w-3.5" />
              List
            </Button>
            <Button variant={data.viewMode === "calendar" ? "secondary" : "ghost"} size="sm" className="gap-1.5 h-8 px-3" onClick={() => data.setViewMode("calendar")} data-testid="button-view-calendar">
              <CalendarDays className="h-3.5 w-3.5" />
              Calendar
            </Button>
          </div>
          {data.viewMode === "calendar" && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => data.navigateCalendar("prev")} data-testid="button-cal-prev">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => data.navigateCalendar("today")} data-testid="button-cal-today">
                Today
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => data.navigateCalendar("next")} data-testid="button-cal-next">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-muted-foreground ml-1">{data.calendarWeekLabel}</span>
            </div>
          )}
        </div>

        {data.viewMode === "calendar" && (
          <AppointmentCalendar calendarWeekDays={data.calendarWeekDays} onNavigateToWo={(woId) => navigate(`/work-orders/${woId}`)} />
        )}

        {data.viewMode === "list" && (<>
          <AppointmentToolbar
            search={data.search}
            onSearchChange={data.setSearch}
            density={data.dt.density}
            onDensityChange={data.dt.setDensity}
            totalItems={data.dt.totalItems}
            selectedCount={data.dt.selectedCount}
            onClearSelection={data.dt.clearSelection}
            typeFilter={data.typeFilter}
            onTypeFilterChange={data.setTypeFilter}
            statusFilter={data.statusFilter}
            onStatusFilterChange={data.setStatusFilter}
            dateRangeFilter={data.dateRangeFilter}
            onDateRangeFilterChange={data.setDateRangeFilter}
            onClearFilters={() => { data.setTypeFilter("all"); data.setStatusFilter("all"); data.setDateRangeFilter("all"); }}
            selectedIds={data.dt.selectedIds}
            allFilteredAppointments={data.allFilteredAppointments}
          />
          <AppointmentListSections
            readyJobsWithoutAppointment={data.readyJobsWithoutAppointment}
            todayAppointments={data.todayAppointments}
            upcomingAppointments={data.upcomingAppointments}
            completedAppointments={data.completedAppointments}
            cancelledAppointments={data.cancelledAppointments}
            isLoading={data.isLoading}
            search={data.search}
            isComfortable={data.dt.density === "comfortable"}
            selectedIds={data.dt.selectedIds}
            toggleSelected={data.dt.toggleSelected}
            staffList={data.staffList}
            woTypingStatusMap={data.woTypingStatusMap}
            photoMap={data.photoMap}
            downloadingDraft={messages.downloadingDraft}
            onConfirmDialog={actions.openConfirmDialog}
            onViewEmailDraft={messages.setViewEmailDraftApt}
            onViewMessages={messages.setViewMessagesApt}
            onDownloadAsJpg={messages.handleDownloadAsJpg}
            onCopyDetails={actions.handleCopyAptDetails}
          />
        </>)}
      </div>

      <AppointmentConfirmationDialog
        confirmDialog={actions.confirmDialog}
        onClose={() => actions.setConfirmDialog({ open: false, type: "complete", appointment: null })}
        onConfirm={actions.handleConfirmAction}
        isPending={actions.updateStatusMutation.isPending}
      />
      <MessagesDialog
        viewMessagesApt={messages.viewMessagesApt}
        onClose={() => { messages.setViewMessagesApt(null); messages.setEmailFullscreen(false); }}
        viewMessagesData={messages.viewMessagesData}
        viewEmailPreviewHtml={messages.viewEmailPreviewHtml}
        messageCopied={messages.messageCopied}
        onCopyMessage={messages.handleCopyViewMessage}
        onFullscreen={() => messages.setEmailFullscreen(true)}
      />
      <EmailDraftDialog
        viewEmailDraftApt={messages.viewEmailDraftApt}
        onClose={() => messages.setViewEmailDraftApt(null)}
        staffList={data.staffList}
      />
      <FullscreenPreviewDialog
        open={messages.emailFullscreen}
        onOpenChange={messages.setEmailFullscreen}
        viewMessagesApt={messages.viewMessagesApt}
        viewEmailPreviewHtml={messages.viewEmailPreviewHtml}
        messageCopied={messages.messageCopied}
        onCopyMessage={messages.handleCopyViewMessage}
      />
    </AppLayout>
  );
}

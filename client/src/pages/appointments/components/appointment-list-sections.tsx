import { Link } from "wouter";
import {
  Calendar, Clock, Stethoscope, CreditCard,
  CheckCircle2, XCircle, CalendarPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AppointmentCard } from "./appointment-card";
import { ReadyToScheduleCard } from "./ready-to-schedule-card";
import type { AppointmentWithRelations, ReadyToScheduleJob, AppointmentCardRenderProps } from "./types";

interface AppointmentListSectionsProps extends AppointmentCardRenderProps {
  readyJobsWithoutAppointment: ReadyToScheduleJob[];
  todayAppointments: AppointmentWithRelations[];
  upcomingAppointments: AppointmentWithRelations[];
  completedAppointments: AppointmentWithRelations[];
  cancelledAppointments: AppointmentWithRelations[];
  isLoading: boolean;
  search: string;
}

function RenderCard({ apt, showDate, showActions, cardProps }: {
  apt: AppointmentWithRelations;
  showDate: boolean;
  showActions: boolean;
  cardProps: AppointmentCardRenderProps;
}) {
  return (
    <AppointmentCard
      apt={apt}
      showDate={showDate}
      showActions={showActions}
      isComfortable={cardProps.isComfortable}
      selectedIds={cardProps.selectedIds}
      toggleSelected={cardProps.toggleSelected}
      staffList={cardProps.staffList}
      woTypingStatusMap={cardProps.woTypingStatusMap}
      photoMap={cardProps.photoMap}
      downloadingDraft={cardProps.downloadingDraft}
      onConfirmDialog={cardProps.onConfirmDialog}
      onViewEmailDraft={cardProps.onViewEmailDraft}
      onViewMessages={cardProps.onViewMessages}
      onDownloadAsJpg={cardProps.onDownloadAsJpg}
      onCopyDetails={cardProps.onCopyDetails}
    />
  );
}

export function AppointmentListSections({
  readyJobsWithoutAppointment,
  todayAppointments,
  upcomingAppointments,
  completedAppointments,
  cancelledAppointments,
  isLoading,
  search,
  ...cardProps
}: AppointmentListSectionsProps) {
  return (
    <>
      {readyJobsWithoutAppointment.length > 0 && (
        <Card id="section-ready" className="border border-amber-200/50 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-950/10 shadow-sm rounded-xl scroll-mt-4 transition-all duration-300">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarPlus className="h-5 w-5 text-amber-600" />
                Ready to Schedule
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs ml-1">
                  {readyJobsWithoutAppointment.length}
                </Badge>
              </CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Vendor work completed — these jobs need appointments scheduled
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 stagger-children">
              {readyJobsWithoutAppointment.map((job) => (
                <ReadyToScheduleCard key={job.id} job={job} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              {todayAppointments.map((apt) => (
                <RenderCard key={apt.id} apt={apt} showDate={false} showActions={true} cardProps={cardProps} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Calendar className="h-6 w-6" />}
              title={search ? "No matching appointments today" : "No appointments today"}
              description={search ? "Try adjusting your search terms." : "Schedule a new appointment to get started."}
              action={!search ? (
                <div className="flex gap-2">
                  <Link href="/appointments/schedule-medical">
                    <Button size="sm" variant="outline" className="gap-1.5" data-testid="button-empty-schedule-medical">
                      <Stethoscope className="h-3.5 w-3.5" />
                      Schedule Medical
                    </Button>
                  </Link>
                  <Link href="/appointments/schedule-eid">
                    <Button size="sm" variant="outline" className="gap-1.5" data-testid="button-empty-schedule-eid">
                      <CreditCard className="h-3.5 w-3.5" />
                      Schedule EID
                    </Button>
                  </Link>
                </div>
              ) : undefined}
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
              {upcomingAppointments.map((apt) => (
                <RenderCard key={apt.id} apt={apt} showDate={true} showActions={true} cardProps={cardProps} />
              ))}
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
                {completedAppointments.map((apt) => (
                  <RenderCard key={apt.id} apt={apt} showDate={true} showActions={false} cardProps={cardProps} />
                ))}
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
                {cancelledAppointments.map((apt) => (
                  <RenderCard key={apt.id} apt={apt} showDate={true} showActions={false} cardProps={cardProps} />
                ))}
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
    </>
  );
}

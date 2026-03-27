import { useCallback, useMemo } from "react";
import { CalendarCheck, CalendarX2, CalendarClock, CalendarMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TypingJob, WorkOrder, JobType, Appointment } from "@shared/schema";

export interface AppointmentWithCenter extends Appointment {
  center?: { name: string } | null;
}

export interface TypingJobWithRelations extends TypingJob {
  workOrder?: WorkOrder;
  jobType?: JobType;
}

export function useAppointmentStatus(allAppointments: AppointmentWithCenter[] | undefined) {
  const appointmentsByWoId = useMemo(() => {
    const map = new Map<string, AppointmentWithCenter[]>();
    if (!allAppointments) return map;
    for (const apt of allAppointments) {
      const list = map.get(apt.woId) || [];
      list.push(apt);
      map.set(apt.woId, list);
    }
    return map;
  }, [allAppointments]);

  const getAppointmentStatus = useCallback((job: TypingJobWithRelations) => {
    if (!job.workOrder) return null;
    const category = job.jobType?.category;
    const apts = appointmentsByWoId.get(job.workOrder.id);
    if (!apts || apts.length === 0) return { status: "none" as const, appointment: null };
    const relevant = category ? apts.filter(a => a.type === category) : apts;
    if (relevant.length === 0) return { status: "none" as const, appointment: null };
    const sorted = [...relevant].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latest = sorted[0];
    if (latest.status === "Completed") return { status: "completed" as const, appointment: latest };
    if (latest.status === "Cancelled") return { status: "cancelled" as const, appointment: latest };
    if (latest.status === "Rescheduled") return { status: "rescheduled" as const, appointment: latest };
    return { status: "scheduled" as const, appointment: latest };
  }, [appointmentsByWoId]);

  return { getAppointmentStatus };
}

interface AppointmentIndicatorProps {
  job: TypingJobWithRelations;
  compact?: boolean;
  getAppointmentStatus: (job: TypingJobWithRelations) => { status: "none" | "completed" | "cancelled" | "rescheduled" | "scheduled"; appointment: AppointmentWithCenter | null } | null;
}

export function AppointmentIndicator({ job, compact = false, getAppointmentStatus }: AppointmentIndicatorProps) {
  const aptInfo = getAppointmentStatus(job);
  if (!aptInfo) return null;
  const { status, appointment } = aptInfo;

  if (status === "none") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 text-muted-foreground no-default-hover-elevate no-default-active-elevate" data-testid={`apt-status-none-${job.id}`}>
            <CalendarMinus className="h-3 w-3" />
            {!compact && <span>Not Scheduled</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>No appointment scheduled</TooltipContent>
      </Tooltip>
    );
  }

  if (status === "completed") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 no-default-hover-elevate no-default-active-elevate" data-testid={`apt-status-completed-${job.id}`}>
            <CalendarCheck className="h-3 w-3" />
            {!compact && <span>Completed</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          Appointment completed
          {appointment?.center?.name && <> at {appointment.center.name}</>}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (status === "cancelled") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 no-default-hover-elevate no-default-active-elevate" data-testid={`apt-status-cancelled-${job.id}`}>
            <CalendarX2 className="h-3 w-3" />
            {!compact && <span>Cancelled</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Appointment cancelled</TooltipContent>
      </Tooltip>
    );
  }

  const dateStr = appointment?.datetime
    ? new Date(appointment.datetime).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : "";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="gap-1 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 no-default-hover-elevate no-default-active-elevate" data-testid={`apt-status-scheduled-${job.id}`}>
          <CalendarClock className="h-3 w-3" />
          {!compact && <span>{dateStr}</span>}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {status === "rescheduled" ? "Rescheduled" : "Scheduled"}: {appointment?.datetime ? new Date(appointment.datetime).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
        {appointment?.center?.name && <> at {appointment.center.name}</>}
      </TooltipContent>
    </Tooltip>
  );
}

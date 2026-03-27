import type { Appointment, WorkOrder, Center, TypingJob, JobType } from "@shared/schema";

export interface AppointmentWithRelations extends Appointment {
  workOrder?: WorkOrder & { company?: { name: string } };
  center?: Center;
}

export interface TypingJobWithRelations extends TypingJob {
  workOrder?: WorkOrder;
  jobType?: JobType | null;
}

export interface ReadyToScheduleJob extends TypingJob {
  workOrder?: WorkOrder & { company?: { name: string } };
  jobType?: JobType;
  vendor?: { name: string };
  hasAppointment: boolean;
}

export type WoTypingStatus = {
  medical: { status: string; completedAt?: string | Date | null } | null;
  eid: { status: string; completedAt?: string | Date | null } | null;
};

export interface AppointmentStats {
  todayCount: number;
  upcomingCount: number;
  completedCount: number;
  cancelledCount: number;
  readyToScheduleCount: number;
}

export interface AppointmentCardRenderProps {
  isComfortable: boolean;
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  staffList?: import("@shared/schema").Staff[];
  woTypingStatusMap: Map<string, WoTypingStatus>;
  photoMap?: Record<string, string>;
  downloadingDraft: boolean;
  onConfirmDialog: (type: "complete" | "cancel" | "reschedule" | "follow_up", appointment: AppointmentWithRelations) => void;
  onViewEmailDraft: (apt: AppointmentWithRelations) => void;
  onViewMessages: (apt: AppointmentWithRelations) => void;
  onDownloadAsJpg: (apt: AppointmentWithRelations, type: "email" | "whatsapp") => void;
  onCopyDetails: (apt: AppointmentWithRelations) => void;
}

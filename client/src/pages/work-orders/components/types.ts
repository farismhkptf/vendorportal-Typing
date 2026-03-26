import type { WorkOrder, Company, Appointment, TypingJob, JobType, ServiceType } from "@shared/schema";

export interface TypingJobWithType extends TypingJob {
  jobType?: JobType | null;
}

export interface WorkOrderEnriched extends WorkOrder {
  company?: Company;
  serviceType?: ServiceType;
  typingJobs?: TypingJobWithType[];
  appointments?: Appointment[];
}

export type ViewMode = "compact" | "cards" | "table" | "kanban";
export type SortByOption = "newest" | "oldest" | "wo_asc" | "wo_desc" | "applicant_asc" | "applicant_desc";
export type SpecialFilter = "all" | "needs_attention" | "med_not_scheduled" | "eid_not_scheduled" | "med_typing_pending" | "eid_typing_pending" | "awaiting_typing" | "need_scheduling" | "vip" | "completed";

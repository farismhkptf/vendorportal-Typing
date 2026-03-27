import type { WorkOrder, Company, Appointment, TypingJob, JobType, ServiceType, Staff, Center } from "@shared/schema";

export interface TypingJobWithType extends TypingJob {
  jobType?: JobType | null;
}

export interface WorkOrderEnriched extends WorkOrder {
  company?: Company;
  serviceType?: ServiceType;
  typingJobs?: TypingJobWithType[];
  appointments?: Appointment[];
}

export interface WorkOrderDetail extends WorkOrder {
  company?: Company & {
    rmStaff?: Staff;
    assistStaff?: Staff;
    emails?: Array<{ label: string; email: string; active: boolean }>;
    preferredMedicalCenter?: Center;
    preferredEidCenter?: Center;
  };
  appointments?: Appointment[];
  typingJobs?: TypingJobWithType[];
  serviceType?: ServiceType;
}

export type ViewMode = "compact" | "cards" | "table" | "kanban";
export type SortByOption = "newest" | "oldest" | "wo_asc" | "wo_desc" | "applicant_asc" | "applicant_desc";
export type SpecialFilter = "all" | "needs_attention" | "med_not_scheduled" | "eid_not_scheduled" | "med_typing_pending" | "eid_typing_pending" | "awaiting_typing" | "need_scheduling" | "vip" | "completed";

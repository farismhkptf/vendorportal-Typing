import type { Company, WorkOrder, Appointment } from "@shared/schema";

export interface DeletionRequest {
  id: string;
  entityType: string;
  entityLabel: string;
  reason: string;
  status: string;
  reviewNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

export interface TypingJobSummary {
  id: string;
  status: string;
  vendorId?: string | null;
  sentAt?: string | null;
  returnedAt?: string | null;
  urgent?: boolean;
  jobCode?: string;
  jobType?: { category?: string } | null;
  [key: string]: unknown;
}

export interface WorkOrderEnriched extends WorkOrder {
  typingJobs: TypingJobSummary[];
  appointments: Appointment[];
  company?: Company;
}

export interface CompanyEnriched extends Company {
  hasExpiringDocs: boolean;
}

export interface AppointmentWithDetails extends Appointment {
  workOrder?: {
    woNumber: string;
    applicantName: string;
    companyId: string;
    assignedStaffId?: string;
  };
  center?: {
    name: string;
  };
  assignedStaff?: {
    name: string;
  };
}

export interface StaffMember {
  id: string;
  name: string;
  roleTitle: string;
  status: string;
}

export interface Vendor {
  id: string;
  name: string;
  status: string;
  logoUrl?: string | null;
}

export interface DashStats {
  walletBalance?: number;
}

export interface DashboardStats {
  totalWorkOrders: number;
  todayAppointments: number;
  pendingTypingJobs: number;
  walletBalance: number;
  lowBalanceWarning: boolean;
}

export interface TypingJobStatusSummary {
  id: string;
  status: string;
  jobType?: { category: string } | null;
  returnedAt?: string | null;
  [key: string]: unknown;
}

export interface AppointmentSummary {
  id: string;
  woId: string;
  type: string;
  status: string;
  [key: string]: unknown;
}

export interface WorkOrderEnriched {
  id: string;
  woNumber: string;
  applicantName: string;
  status: string;
  companyId: string;
  isDelayed?: boolean;
  typingJobs: TypingJobStatusSummary[];
  appointments: AppointmentSummary[];
  [key: string]: unknown;
}

export interface TypingJobItem {
  id: string;
  jobCode: string;
  woId: string;
  woNumber: string;
  applicantName: string;
  vendorId: string | null;
  vendorName: string;
  vendorLogoUrl?: string | null;
  type: "Medical" | "EID";
  sentAt: string | null;
  hoursWaiting?: number;
  hoursElapsed?: number;
  urgent: boolean;
}

export interface ReadyToScheduleJob {
  id: string;
  jobCode: string;
  woId: string;
  woNumber: string;
  applicantName: string;
  type: "Medical" | "EID";
  completedAt: string;
}

export interface ReturnedTypingJobItem {
  id: string;
  jobCode: string;
  woId: string;
  woNumber: string;
  applicantName: string;
  vendorId: string | null;
  vendorName: string;
  vendorLogoUrl?: string | null;
  type: "Medical" | "EID";
  returnedAt: string | null;
  status: string;
  urgent: boolean;
}

export interface TypingJobsSummary {
  unaccepted: TypingJobItem[];
  inProgress: TypingJobItem[];
  readyToSchedule: ReadyToScheduleJob[];
  returned: ReturnedTypingJobItem[];
  counts: { unaccepted: number; inProgress: number; readyToSchedule: number; returned: number };
}

export interface AppointmentItem {
  id: string;
  woId: string;
  woNumber: string;
  applicantName: string;
  type: "Medical" | "EID";
  time: string;
  datetime?: string;
  center: string;
  status: string;
  date?: string;
  daysFromNow?: number;
}

export interface NeedsSchedulingItem {
  woId: string;
  woNumber: string;
  applicantName: string;
  companyName: string;
  types: string[];
}

export interface AppointmentsSummary {
  today: AppointmentItem[];
  upcoming: AppointmentItem[];
  needsScheduling: NeedsSchedulingItem[];
  counts: { today: number; upcoming: number; needsScheduling: number };
}

export interface WeeklyData {
  date: string;
  workOrders: number;
  appointments: number;
  typingJobs: number;
}

export interface IdleDraftJob {
  id: string;
  woId: string;
  woNumber: string | null;
  applicantName: string | null;
  companyName: string | null;
  jobTypeName: string | null;
  jobTypeCategory: string | null;
  hoursIdle: number | null;
  createdAt: string | null;
}

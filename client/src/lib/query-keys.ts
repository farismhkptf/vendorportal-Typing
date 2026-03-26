export const queryKeys = {
  workOrders: ["/api/work-orders"] as const,
  workOrder: (id: number | string) => ["/api/work-orders", id] as const,
  workOrderDocuments: (woId: number | string) => ["/api/work-orders", woId, "documents"] as const,
  workOrderPhotos: ["/api/work-orders/photos"] as const,

  companies: ["/api/companies"] as const,
  company: (id: number | string) => ["/api/companies", id] as const,
  companyEmails: (id: number | string) => ["/api/companies", id, "emails"] as const,

  appointments: ["/api/appointments"] as const,
  appointmentsSchedulingQueue: ["/api/appointments/scheduling-queue"] as const,

  typingJobs: (status: string) => [`/api/typing-jobs?status=${status}`] as const,

  vendors: ["/api/vendors"] as const,

  staff: ["/api/staff"] as const,

  dashboardStats: ["/api/dashboard/stats"] as const,
  dashboardTypingJobsSummary: ["/api/dashboard/typing-jobs-summary"] as const,
  dashboardAppointmentsSummary: ["/api/dashboard/appointments-summary"] as const,
  dashboardWeeklyOverview: ["/api/dashboard/weekly-overview"] as const,

  activity: ["/api/activity"] as const,
  activityMy: ["/api/activity/my"] as const,

  deletionRequests: ["/api/deletion-requests"] as const,

  custodyRecords: ["/api/custody/records"] as const,
  custodyRecordsSummary: ["/api/custody/records/summary"] as const,
  custodyWo: (woId: number | string) => ["/api/custody/wo", woId] as const,

  adminIdleDraftJobs: ["/api/admin/idle-draft-jobs"] as const,

  documentRequirements: ["/api/document-requirements"] as const,

  medicalCases: (woId: number | string) => ["/api/medical-cases", woId] as const,
  biometricsCases: (woId: number | string) => ["/api/biometrics-cases", woId] as const,

  reportsSummary: ["/api/reports/summary"] as const,

  serviceTypes: ["/api/service-types"] as const,
  typingJobsAll: ["/api/typing-jobs"] as const,
  typingJobsReadyToSchedule: ["/api/typing-jobs/ready-to-schedule"] as const,

  typingJob: (id: number | string) => ["/api/typing-jobs", id] as const,

  woNotes: (woId: number | string) => ["/api/wo-notes", woId] as const,

  auditLogs: (entityType: string, entityId: number | string) => ["/api/audit-logs", entityType, entityId] as const,

  jobTypes: ["/api/job-types"] as const,
  centers: ["/api/centers"] as const,
  staffUsers: ["/api/staff-users"] as const,
  vendorWallet: ["/api/vendor-wallet"] as const,
} as const;

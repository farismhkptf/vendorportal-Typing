import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, json, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
// User roles organized by category:
// Our Team: Admin, Client Relationship Manager, Medical Support, Medical Support - Temporary
// Vendors: Vendor
// Clients: Client Coordinator, Client Manager
export const userRoleEnum = pgEnum("user_role", [
  "Admin",
  "Client Relationship Manager",
  "Medical Support",
  "Medical Support - Temporary",
  "Vendor",
  "Client Coordinator",
  "Client Manager"
]);

// Role category helpers
export const ROLE_CATEGORIES = {
  "Our Team": [
    "Admin",
    "Client Relationship Manager",
    "Medical Support",
    "Medical Support - Temporary"
  ],
  "Vendors": [
    "Vendor"
  ],
  "Clients": [
    "Client Coordinator",
    "Client Manager"
  ]
} as const;

export const ALL_ROLES = [
  "Admin",
  "Client Relationship Manager",
  "Medical Support",
  "Medical Support - Temporary",
  "Vendor",
  "Client Coordinator",
  "Client Manager"
] as const;

export type UserRole = typeof ALL_ROLES[number];
export const centerTypeEnum = pgEnum("center_type", ["Medical", "EID", "Both"]);
export const centerAuthorityEnum = pgEnum("center_authority", ["DHA", "EHS", "ICP"]);
export const centerTierEnum = pgEnum("center_tier", ["Normal", "VIP"]);
export const woStatusEnum = pgEnum("wo_status", ["Inactive", "Draft", "Scheduled", "Completed", "Cancelled", "Delayed"]);
export const appointmentTypeEnum = pgEnum("appointment_type", ["Medical", "EID"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["Scheduled", "Completed", "Cancelled", "Rescheduled", "FollowUpRequired", "FollowUpScheduled", "FollowUpCompleted"]);
export const rescheduleStatusEnum = pgEnum("reschedule_status", ["New", "Accepted", "Closed"]);
export const typingJobStatusEnum = pgEnum("typing_job_status", [
  "Draft", "SubmittedToVendor", "InProcess", "Returned",
  "ReadyForScheduling", "OnHold", "Rejected", "Aborted"
]);
export const jobCategoryEnum = pgEnum("job_category", ["Medical", "EID"]);
export const fileDirectionEnum = pgEnum("file_direction", ["Input", "Output"]);
export const uploadedByTypeEnum = pgEnum("uploaded_by_type", ["Internal", "Vendor"]);
export const documentTypeEnum = pgEnum("document_type", [
  "PassportCopy",
  "Photo",
  "EntryPermit",
  "ChangeStatus",
  "CurrentResidency",
  "OldResidencyOrId",
  "CurrentEmiratesId",
  "SponsorEmiratesId",
  "BirthCertificate",
  "LostEmiratesId"
]);
export const documentStatusEnum = pgEnum("document_status", ["Pending", "Uploaded", "Verified"]);
export const serviceCategoryEnum = pgEnum("service_category", [
  "NewVisaInside",
  "NewVisaOutside",
  "GoldenVisa",
  "RenewVisa",
  "NewbornDependent",
  "LostReplaceEid"
]);
export const authorTypeEnum = pgEnum("author_type", ["Internal", "Vendor"]);
export const messageChannelEnum = pgEnum("message_channel", ["Email", "WhatsApp"]);
export const messageStatusEnum = pgEnum("message_status", ["Draft", "MarkedSent", "Failed"]);
export const walletEntryTypeEnum = pgEnum("wallet_entry_type", ["Topup", "Debit", "Reversal", "Adjustment"]);
export const staffStatusEnum = pgEnum("staff_status", ["Active", "OnLeave", "Cancelled", "TempActive", "TempInactive"]);
export const staffTypeEnum = pgEnum("staff_type", ["Permanent", "Temporary"]);
export const approvalStatusEnum = pgEnum("approval_status", ["Pending", "Approved", "Rejected"]);
export const changeNotificationStatusEnum = pgEnum("change_notification_status", ["pending", "reviewed", "dismissed"]);
export const passwordResetStatusEnum = pgEnum("password_reset_status", ["pending", "approved", "rejected"]);

// Medical Appointment Scheduling enums
export const medicalApptStatusEnum = pgEnum("medical_appt_status", [
  "SCHEDULED",
  "AWAITING_MEETING",
  "IN_PROCESS",
  "COMPLETED",
  "RESULT_DELAYED",
  "RESULT_ISSUED",
  "MEDICAL_FAILED",
  "NO_SHOW",
  "RETEST_REQUIRED",
  "CLOSED_ADMIN_OVERRIDE",
]);

export const cycleTypeEnum = pgEnum("cycle_type", ["Initial", "Reschedule", "Retest"]);
export const cycleOutcomeEnum = pgEnum("cycle_outcome", ["Passed", "Failed", "Pending"]);
export const medicalEventTypeEnum = pgEnum("medical_event_type", [
  "CYCLE_CREATED",
  "STATUS_CHANGED",
  "QR_CONFIRMED",
  "MANUAL_CONFIRMED",
  "CRM_HOLD_SET",
  "CRM_HOLD_REMOVED",
  "COMPLETED_MARKED",
  "RETEST_REQUIRED_SET",
  "ADMIN_OVERRIDE",
  "RESULT_ISSUED",
  "MEDICAL_FAILED",
  "TIMER_AWAITING_MEETING",
  "TIMER_NO_SHOW",
  "TIMER_RESULT_DELAYED",
]);

// Medical Cases table — links a work order to the medical scheduling scope
export const medicalCases = pgTable("medical_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  woId: varchar("wo_id").notNull().unique(),
  isOpen: boolean("is_open").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_medical_cases_wo_id").on(table.woId),
]);

// Appointment Cycles table — each scheduling attempt under a medical case
export const appointmentCycles = pgTable("appointment_cycles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull(),
  cycleNumber: integer("cycle_number").notNull().default(1),
  cycleType: cycleTypeEnum("cycle_type").notNull().default("Initial"),
  status: medicalApptStatusEnum("status").notNull().default("SCHEDULED"),
  appointmentTime: timestamp("appointment_time").notNull(),
  centerId: varchar("center_id"),
  assignedProId: varchar("assigned_pro_id"),
  outcome: cycleOutcomeEnum("outcome"),
  // Timer fields
  awaitingMeetingAt: timestamp("awaiting_meeting_at"),
  noShowAt: timestamp("no_show_at"),
  completedAt: timestamp("completed_at"),
  resultDelayedAt: timestamp("result_delayed_at"),
  resultIssuedAt: timestamp("result_issued_at"),
  // CRM hold
  crmHoldActive: boolean("crm_hold_active").notNull().default(false),
  crmHoldSetBy: varchar("crm_hold_set_by"),
  crmHoldSetAt: timestamp("crm_hold_set_at"),
  // QR / confirmation
  confirmedAt: timestamp("confirmed_at"),
  confirmedBy: varchar("confirmed_by"),
  confirmMethod: text("confirm_method"),
  // Admin override
  overrideReason: text("override_reason"),
  overrideBy: varchar("override_by"),
  overrideAt: timestamp("override_at"),
  // Creation
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_appointment_cycles_case_id").on(table.caseId),
]);

// Medical Appointment Events table — event log per cycle
export const medicalAppointmentEvents = pgTable("medical_appointment_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cycleId: varchar("cycle_id").notNull(),
  eventType: medicalEventTypeEnum("event_type").notNull(),
  actorId: varchar("actor_id"),
  actorRole: text("actor_role"),
  details: json("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_medical_events_cycle_id").on(table.cycleId),
]);

// EID Biometrics Appointment Scheduling enums
export const biometricsApptStatusEnum = pgEnum("biometrics_appt_status", [
  "SCHEDULED",
  "AWAITING_MEETING",
  "IN_PROCESS",
  "COMPLETED",
  "NO_SHOW",
  "RESCHEDULE_REQUIRED",
  "CLOSED_ADMIN_OVERRIDE",
]);

export const biometricsCycleTypeEnum = pgEnum("biometrics_cycle_type", ["Initial", "Reschedule"]);
export const biometricsCycleOutcomeEnum = pgEnum("biometrics_cycle_outcome", ["Completed", "NoShow", "Pending"]);
export const biometricsEventTypeEnum = pgEnum("biometrics_event_type", [
  "CYCLE_CREATED",
  "STATUS_CHANGED",
  "QR_CONFIRMED",
  "MANUAL_CONFIRMED",
  "CRM_HOLD_SET",
  "CRM_HOLD_REMOVED",
  "COMPLETED_MARKED",
  "PROOF_UPLOADED",
  "RESCHEDULE_REQUIRED_SET",
  "ADMIN_OVERRIDE",
  "TIMER_AWAITING_MEETING",
  "TIMER_NO_SHOW",
]);

// EID Biometrics Cases — links a work order to the biometrics scheduling scope
export const biometricsCases = pgTable("biometrics_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  woId: varchar("wo_id").notNull().unique(),
  isOpen: boolean("is_open").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_biometrics_cases_wo_id").on(table.woId),
]);

// EID Biometrics Appointment Cycles
export const biometricsAppointmentCycles = pgTable("biometrics_appointment_cycles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull(),
  cycleNumber: integer("cycle_number").notNull().default(1),
  cycleType: biometricsCycleTypeEnum("cycle_type").notNull().default("Initial"),
  status: biometricsApptStatusEnum("status").notNull().default("SCHEDULED"),
  appointmentTime: timestamp("appointment_time").notNull(),
  centerId: varchar("center_id"),
  assignedProId: varchar("assigned_pro_id"),
  outcome: biometricsCycleOutcomeEnum("outcome"),
  // Timer fields
  awaitingMeetingAt: timestamp("awaiting_meeting_at"),
  noShowAt: timestamp("no_show_at"),
  completedAt: timestamp("completed_at"),
  // CRM hold
  crmHoldActive: boolean("crm_hold_active").notNull().default(false),
  crmHoldSetBy: varchar("crm_hold_set_by"),
  crmHoldSetAt: timestamp("crm_hold_set_at"),
  // QR / confirmation
  confirmedAt: timestamp("confirmed_at"),
  confirmedBy: varchar("confirmed_by"),
  confirmMethod: text("confirm_method"),
  // Proof image
  proofImageUrl: text("proof_image_url"),
  proofUploadedAt: timestamp("proof_uploaded_at"),
  // Admin override
  overrideReason: text("override_reason"),
  overrideBy: varchar("override_by"),
  overrideAt: timestamp("override_at"),
  // Creation
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_biometrics_cycles_case_id").on(table.caseId),
]);

// EID Biometrics Appointment Events — event log per cycle
export const biometricsAppointmentEvents = pgTable("biometrics_appointment_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cycleId: varchar("cycle_id").notNull(),
  eventType: biometricsEventTypeEnum("event_type").notNull(),
  actorId: varchar("actor_id"),
  actorRole: text("actor_role"),
  details: json("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_biometrics_events_cycle_id").on(table.cycleId),
]);

// Client contact type for companies
export type ClientContact = {
  name: string;
  email: string;
  mobile: string;
};

// Center timing type for operating hours
export type DayTiming = {
  open?: string;      // Opening time in 24h format (e.g., "07:00")
  close?: string;     // Closing time in 24h format (e.g., "21:30")
  breakStart?: string; // Optional break start (e.g., Friday prayer)
  breakEnd?: string;   // Optional break end
  closed?: boolean;    // If center is closed this day
};

export type CenterTimings = {
  monday?: DayTiming;
  tuesday?: DayTiming;
  wednesday?: DayTiming;
  thursday?: DayTiming;
  friday?: DayTiming;
  saturday?: DayTiming;
  sunday?: DayTiming;
};

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("Medical Support"),
  staffId: varchar("staff_id"),
  vendorId: varchar("vendor_id"),
  active: boolean("active").notNull().default(true),
  managerPin: text("manager_pin").default("0000"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Staff table
export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  roleTitle: text("role_title").notNull(),
  staffType: staffTypeEnum("staff_type").notNull().default("Permanent"),
  phone: text("phone"),
  email: text("email"),
  status: staffStatusEnum("status").notNull().default("Active"),
  replacementId: varchar("replacement_id"), // Staff member covering when on leave
  leaveEndDate: text("leave_end_date"), // Date when leave ends (ISO format)
  active: boolean("active").notNull().default(true),
});

// Centers table
export const centers = pgTable("centers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: centerTypeEnum("type").notNull(),
  authority: centerAuthorityEnum("authority"), // DHA or EHS
  tier: centerTierEnum("tier").default("Normal"), // Normal or VIP
  address: text("address"),
  googleMapsUrl: text("google_maps_url"),
  area: text("area"),
  timingText: text("timing_text"), // Human-readable hours
  timings: json("timings").$type<CenterTimings>(), // Structured timing data
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
});

// Companies table
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tradeLicenseNumber: text("trade_license_number"),
  // Center preferences
  preferredMedicalCenterId: varchar("preferred_medical_center_id"),
  preferredMedicalCenterVipId: varchar("preferred_medical_center_vip_id"),
  preferredBiometricsCenterId: varchar("preferred_biometrics_center_id"),
  preferredBiometricsCenterVipId: varchar("preferred_biometrics_center_vip_id"),
  // Client contacts
  clientCoordinator: json("client_coordinator").$type<ClientContact>(),
  clientManager: json("client_manager").$type<ClientContact>(),
  // Our team assignments
  rmStaffId: varchar("rm_staff_id"),
  assistStaffId: varchar("assist_staff_id"),
  // Delivery address for Emirates ID
  deliveryAddress: text("delivery_address"),
  active: boolean("active").notNull().default(true),
});

// Company Emails table (max 3 per company enforced at app level)
export const companyEmails = pgTable("company_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  label: text("label").notNull(),
  email: text("email").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  index("idx_company_emails_company_id").on(table.companyId),
]);

// Service Types table
// Each service type defines what processing steps are required
export const serviceTypes = pgTable("service_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: serviceCategoryEnum("category"),
  requiresMedicalTyping: boolean("requires_medical_typing").notNull().default(false),
  requiresMedicalScheduling: boolean("requires_medical_scheduling").notNull().default(false),
  requiresIdTyping2Years: boolean("requires_id_typing_2_years").notNull().default(false),
  requiresIdTyping1Year: boolean("requires_id_typing_1_year").notNull().default(false),
  requiresIdTyping10Years: boolean("requires_id_typing_10_years").notNull().default(false),
  requiresIdBiometrics: boolean("requires_id_biometrics").notNull().default(false),
  isDependent: boolean("is_dependent").notNull().default(false),
  active: boolean("active").notNull().default(true),
});

// Work Order Documents table - documents linked to a work order
export const woDocuments = pgTable("wo_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  woId: varchar("wo_id").notNull(),
  documentType: documentTypeEnum("document_type").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  status: documentStatusEnum("status").notNull().default("Uploaded"),
  uploadedBy: varchar("uploaded_by"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  workdriveFileId: text("workdrive_file_id"),
  workdriveLink: text("workdrive_link"),
}, (table) => [
  index("idx_wo_documents_wo_id").on(table.woId),
]);

// Document Requirements table - defines which documents are required/optional per service category
export const documentRequirements = pgTable("document_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceCategory: serviceCategoryEnum("service_category").notNull(),
  documentType: documentTypeEnum("document_type").notNull(),
  isRequired: boolean("is_required").notNull().default(true),
  appliesToMedical: boolean("applies_to_medical").notNull().default(true),
  appliesToEid: boolean("applies_to_eid").notNull().default(true),
});

// Work Orders table
export const workOrders = pgTable("work_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  woNumber: varchar("wo_number", { length: 10 }).notNull().unique(),
  applicantName: text("applicant_name").notNull(),
  applicantPhone: text("applicant_phone"),
  applicantEmail: text("applicant_email"),
  isVip: boolean("is_vip").notNull().default(false),
  companyId: varchar("company_id").notNull(),
  serviceTypeId: varchar("service_type_id"),
  status: woStatusEnum("status").notNull().default("Inactive"),
  previousStatus: woStatusEnum("previous_status"),
  isMinor: boolean("is_minor").notNull().default(false),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Appointments table
export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  woId: varchar("wo_id").notNull(),
  type: appointmentTypeEnum("type").notNull(),
  isVip: boolean("is_vip").notNull().default(false),
  datetime: timestamp("datetime").notNull(),
  centerId: varchar("center_id"),
  assignedStaffId: varchar("assigned_staff_id"),
  applicationNumber: text("application_number"),
  notes: text("notes"),
  rescheduleToken: varchar("reschedule_token").unique(),
  status: appointmentStatusEnum("status").notNull().default("Scheduled"),
  emailDraft: text("email_draft"),
  messageSentAt: timestamp("message_sent_at"),
  messageSentBy: varchar("message_sent_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_appointments_wo_id").on(table.woId),
  index("idx_appointments_center_id").on(table.centerId),
  index("idx_appointments_assigned_staff_id").on(table.assignedStaffId),
]);

// Reschedule Requests table
export const rescheduleRequests = pgTable("reschedule_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appointmentId: varchar("appointment_id").notNull(),
  requestedDatetime: timestamp("requested_datetime").notNull(),
  notes: text("notes"),
  status: rescheduleStatusEnum("status").notNull().default("New"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_reschedule_requests_appointment_id").on(table.appointmentId),
]);

// Job Types table
export const jobTypes = pgTable("job_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: jobCategoryEnum("category").notNull(),
  cost: integer("cost").notNull(),
  active: boolean("active").notNull().default(true),
});

// Vendors table
export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  active: boolean("active").notNull().default(true),
  logoUrl: text("logo_url"),
});

// Typing Jobs table
export const typingJobs = pgTable("typing_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobCode: text("job_code"),
  woId: varchar("wo_id").notNull(),
  vendorId: varchar("vendor_id"),
  jobTypeId: varchar("job_type_id").notNull(),
  status: typingJobStatusEnum("status").notNull().default("Draft"),
  costSnapshot: integer("cost_snapshot"),
  sentAt: timestamp("sent_at"),
  returnedAt: timestamp("returned_at"),
  sentToClientAt: timestamp("sent_to_client_at"),
  vendorMistakeAt: timestamp("vendor_mistake_at"),
  vendorMistakeReason: text("vendor_mistake_reason"),
  createdBy: varchar("created_by"),
  previousStatus: typingJobStatusEnum("previous_status"),
  rejectedReason: text("rejected_reason"),
  urgent: boolean("urgent").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_typing_jobs_wo_id").on(table.woId),
  index("idx_typing_jobs_vendor_id").on(table.vendorId),
]);

// Typing Job Results table
export const typingJobResults = pgTable("typing_job_results", {
  typingJobId: varchar("typing_job_id").primaryKey(),
  applicationRefNo: text("application_ref_no"),
  centerName: text("center_name"),
  centerArea: text("center_area"),
  centerNotes: text("center_notes"),
  biometricsRequired: boolean("biometrics_required").default(false),
  biometricsDatetime: timestamp("biometrics_datetime"),
  biometricsCenter: text("biometrics_center"),
  vendorNotes: text("vendor_notes"),
});

// Typing Job Comments table
export const typingJobComments = pgTable("typing_job_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  typingJobId: varchar("typing_job_id").notNull(),
  authorType: authorTypeEnum("author_type").notNull(),
  authorUserId: varchar("author_user_id"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_typing_job_comments_typing_job_id").on(table.typingJobId),
]);

// Files table
export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  relatedType: text("related_type").notNull(),
  relatedId: varchar("related_id").notNull(),
  direction: fileDirectionEnum("direction").notNull(),
  workdriveFileId: text("workdrive_file_id"),
  workdriveLink: text("workdrive_link"),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type"),
  uploadedByType: uploadedByTypeEnum("uploaded_by_type").notNull(),
  uploadedByUserId: varchar("uploaded_by_user_id"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_files_related_id").on(table.relatedId),
]);

// Messages table
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  woId: varchar("wo_id").notNull(),
  appointmentId: varchar("appointment_id"),
  typingJobId: varchar("typing_job_id"),
  channel: messageChannelEnum("channel").notNull(),
  subject: text("subject"),
  bodyHtml: text("body_html"),
  bodyText: text("body_text"),
  toRecipients: json("to_recipients").$type<string[]>(),
  ccRecipients: json("cc_recipients").$type<string[]>(),
  status: messageStatusEnum("status").notNull().default("Draft"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
}, (table) => [
  index("idx_messages_wo_id").on(table.woId),
]);

// Work Order Internal Notes table
export const woNotes = pgTable("wo_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  woId: varchar("wo_id").notNull(),
  content: text("content").notNull(),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_wo_notes_wo_id").on(table.woId),
]);

// Vendor Wallet Ledger table
export const vendorWalletLedger = pgTable("vendor_wallet_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull(),
  entryType: walletEntryTypeEnum("entry_type").notNull(),
  typingJobId: varchar("typing_job_id"),
  amount: integer("amount").notNull(),
  note: text("note"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_vendor_wallet_ledger_vendor_id").on(table.vendorId),
  index("idx_vendor_wallet_ledger_typing_job_id").on(table.typingJobId),
]);

// Vendor Statements table
export const vendorStatements = pgTable("vendor_statements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  totalDebit: integer("total_debit").notNull().default(0),
  totalCredit: integer("total_credit").notNull().default(0),
  balanceDelta: integer("balance_delta").notNull().default(0),
});

// Vendor Invoices table
export const vendorInvoices = pgTable("vendor_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  invoiceFileWorkdriveId: text("invoice_file_workdrive_id"),
  invoiceLink: text("invoice_link"),
  amount: integer("amount").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// Vendor Approvals table
export const vendorApprovals = pgTable("vendor_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  typingJobId: varchar("typing_job_id").notNull(),
  vendorId: varchar("vendor_id").notNull(),
  calculatedAmount: integer("calculated_amount").notNull().default(0),
  adjustedAmount: integer("adjusted_amount"),
  status: approvalStatusEnum("status").notNull().default("Pending"),
  rejectedReason: text("rejected_reason"),
  approvedBy: varchar("approved_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => [
  index("idx_vendor_approvals_typing_job_id").on(table.typingJobId),
  index("idx_vendor_approvals_vendor_id").on(table.vendorId),
]);

// Vendor Notifications table
export const vendorNotifications = pgTable("vendor_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorUserId: varchar("vendor_user_id").notNull(),
  vendorId: varchar("vendor_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedJobId: varchar("related_job_id"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_vendor_notifications_vendor_user_id").on(table.vendorUserId),
  index("idx_vendor_notifications_vendor_id").on(table.vendorId),
]);

// App Settings table (single row)
export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromEmail: text("from_email").notNull().default("notifications@procompany.ae"),
  fromName: text("from_name").notNull().default("The P.R.O. Company"),
  replyToEmail: text("reply_to_email").notNull().default("operations@procompany.ae"),
  alwaysCc: json("always_cc").$type<string[]>().default(["faris@procompany.ae", "yasin@procompany.ae"]),
  testEmailRedirect: text("test_email_redirect"),
  lowBalanceThreshold: integer("low_balance_threshold").notNull().default(1000),
  masterPassword: text("master_password"),
  defaultVendorId: varchar("default_vendor_id"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  maintenanceMessage: text("maintenance_message"),
  whatsappNumber: text("whatsapp_number").default("+971509161815"),
  privacyPolicyHtml: text("privacy_policy_html"),
  termsOfServiceHtml: text("terms_of_service_html"),
  followUpCenter: text("follow_up_center"),
  vendorDelayThresholdHours: integer("vendor_delay_threshold_hours").notNull().default(48),
  logoUrl: text("logo_url"),
});

// Change notifications table (manager edits for admin review)
export const changeNotifications = pgTable("change_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  entityName: text("entity_name").notNull(),
  changedBy: varchar("changed_by").notNull(),
  changedByName: text("changed_by_name").notNull(),
  oldData: json("old_data"),
  newData: json("new_data"),
  status: changeNotificationStatusEnum("status").notNull().default("pending"),
  reviewedBy: varchar("reviewed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});

// Staff Notifications table
export const staffNotifications = pgTable("staff_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: varchar("related_entity_id"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_staff_notifications_user_id").on(table.userId),
]);

// Audit Log table
export const auditLog = pgTable("audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  userId: varchar("user_id"),
  details: json("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_audit_log_entity_id").on(table.entityId),
  index("idx_audit_log_user_id").on(table.userId),
]);

// Login Audit Log table
export const loginAuditLog = pgTable("login_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  email: text("email").notNull(),
  success: boolean("success").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  portal: text("portal").notNull().default("team"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Password Reset Requests table
export const passwordResetRequests = pgTable("password_reset_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  status: passwordResetStatusEnum("status").notNull().default("pending"),
  resolvedBy: varchar("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertStaffSchema = createInsertSchema(staff).omit({ id: true });
export const insertCenterSchema = createInsertSchema(centers).omit({ id: true });
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true });
export const insertCompanyEmailSchema = createInsertSchema(companyEmails).omit({ id: true });
export const insertServiceTypeSchema = createInsertSchema(serviceTypes).omit({ id: true });
export const insertWoDocumentSchema = createInsertSchema(woDocuments).omit({ id: true, uploadedAt: true });
export const insertDocumentRequirementSchema = createInsertSchema(documentRequirements).omit({ id: true });
export const insertWorkOrderSchema = createInsertSchema(workOrders).omit({ id: true, createdAt: true });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true });
export const insertRescheduleRequestSchema = createInsertSchema(rescheduleRequests).omit({ id: true, createdAt: true });
export const insertJobTypeSchema = createInsertSchema(jobTypes).omit({ id: true });
export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true });
export const insertTypingJobSchema = createInsertSchema(typingJobs).omit({ id: true, createdAt: true });
export const insertTypingJobResultSchema = createInsertSchema(typingJobResults);
export const insertTypingJobCommentSchema = createInsertSchema(typingJobComments).omit({ id: true, createdAt: true });
export const insertFileSchema = createInsertSchema(files).omit({ id: true, createdAt: true });
export const insertWoNoteSchema = createInsertSchema(woNotes).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertVendorWalletLedgerSchema = createInsertSchema(vendorWalletLedger).omit({ id: true, createdAt: true });
export const insertVendorStatementSchema = createInsertSchema(vendorStatements).omit({ id: true, generatedAt: true });
export const insertVendorInvoiceSchema = createInsertSchema(vendorInvoices).omit({ id: true, uploadedAt: true });
export const insertChangeNotificationSchema = createInsertSchema(changeNotifications).omit({ id: true, createdAt: true, reviewedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ id: true, createdAt: true });
export const insertVendorApprovalSchema = createInsertSchema(vendorApprovals).omit({ id: true, createdAt: true, resolvedAt: true });
export const insertVendorNotificationSchema = createInsertSchema(vendorNotifications).omit({ id: true, createdAt: true });
export const insertStaffNotificationSchema = createInsertSchema(staffNotifications).omit({ id: true, createdAt: true });
export const insertLoginAuditLogSchema = createInsertSchema(loginAuditLog).omit({ id: true, createdAt: true });
export const insertPasswordResetRequestSchema = createInsertSchema(passwordResetRequests).omit({ id: true, createdAt: true, resolvedAt: true });

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staff.$inferSelect;
export type InsertCenter = z.infer<typeof insertCenterSchema>;
export type Center = typeof centers.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompanyEmail = z.infer<typeof insertCompanyEmailSchema>;
export type CompanyEmail = typeof companyEmails.$inferSelect;
export type InsertServiceType = z.infer<typeof insertServiceTypeSchema>;
export type ServiceType = typeof serviceTypes.$inferSelect;
export type InsertWoDocument = z.infer<typeof insertWoDocumentSchema>;
export type WoDocument = typeof woDocuments.$inferSelect;
export type InsertDocumentRequirement = z.infer<typeof insertDocumentRequirementSchema>;
export type DocumentRequirement = typeof documentRequirements.$inferSelect;
export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;
export type WorkOrder = typeof workOrders.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertRescheduleRequest = z.infer<typeof insertRescheduleRequestSchema>;
export type RescheduleRequest = typeof rescheduleRequests.$inferSelect;
export type InsertJobType = z.infer<typeof insertJobTypeSchema>;
export type JobType = typeof jobTypes.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;
export type InsertTypingJob = z.infer<typeof insertTypingJobSchema>;
export type TypingJob = typeof typingJobs.$inferSelect;
export type InsertTypingJobResult = z.infer<typeof insertTypingJobResultSchema>;
export type TypingJobResult = typeof typingJobResults.$inferSelect;
export type InsertTypingJobComment = z.infer<typeof insertTypingJobCommentSchema>;
export type TypingJobComment = typeof typingJobComments.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;
export type InsertWoNote = z.infer<typeof insertWoNoteSchema>;
export type WoNote = typeof woNotes.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertVendorWalletLedger = z.infer<typeof insertVendorWalletLedgerSchema>;
export type VendorWalletLedger = typeof vendorWalletLedger.$inferSelect;
export type InsertVendorStatement = z.infer<typeof insertVendorStatementSchema>;
export type VendorStatement = typeof vendorStatements.$inferSelect;
export type InsertVendorInvoice = z.infer<typeof insertVendorInvoiceSchema>;
export type VendorInvoice = typeof vendorInvoices.$inferSelect;
export type InsertChangeNotification = z.infer<typeof insertChangeNotificationSchema>;
export type ChangeNotification = typeof changeNotifications.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLog.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type InsertVendorApproval = z.infer<typeof insertVendorApprovalSchema>;
export type VendorApproval = typeof vendorApprovals.$inferSelect;
export type InsertVendorNotification = z.infer<typeof insertVendorNotificationSchema>;
export type VendorNotification = typeof vendorNotifications.$inferSelect;
export type InsertStaffNotification = z.infer<typeof insertStaffNotificationSchema>;
export type StaffNotification = typeof staffNotifications.$inferSelect;
export type InsertLoginAuditLog = z.infer<typeof insertLoginAuditLogSchema>;
export type LoginAuditLog = typeof loginAuditLog.$inferSelect;
export type InsertPasswordResetRequest = z.infer<typeof insertPasswordResetRequestSchema>;
export type PasswordResetRequest = typeof passwordResetRequests.$inferSelect;

// Sheet Months — monthly Google Sheet tracking for work order imports
export const sheetMonths = pgTable("sheet_months", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  monthYear: varchar("month_year").notNull().unique(),
  sheetUrl: text("sheet_url"),
  status: varchar("status").notNull().default("open"),
  importedCount: integer("imported_count").notNull().default(0),
  lastRefreshedAt: timestamp("last_refreshed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSheetMonthSchema = createInsertSchema(sheetMonths).omit({ id: true, createdAt: true });
export type InsertSheetMonth = z.infer<typeof insertSheetMonthSchema>;
export type SheetMonth = typeof sheetMonths.$inferSelect;

// API Keys for external integrations
export const apiKeyTypeEnum = pgEnum("api_key_type", ["client", "crm"]);

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  type: apiKeyTypeEnum("type").notNull(),
  companyId: varchar("company_id").references(() => companies.id),
  staffId: varchar("staff_id").references(() => staff.id),
  active: boolean("active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ id: true, lastUsedAt: true, createdAt: true });
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

// Login schema
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Medical Scheduling insert schemas and types
export const insertMedicalCaseSchema = createInsertSchema(medicalCases).omit({ id: true, createdAt: true });
export type InsertMedicalCase = z.infer<typeof insertMedicalCaseSchema>;
export type MedicalCase = typeof medicalCases.$inferSelect;

export const insertAppointmentCycleSchema = createInsertSchema(appointmentCycles).omit({ id: true, createdAt: true });
export type InsertAppointmentCycle = z.infer<typeof insertAppointmentCycleSchema>;
export type AppointmentCycle = typeof appointmentCycles.$inferSelect;

export const insertMedicalEventSchema = createInsertSchema(medicalAppointmentEvents).omit({ id: true, createdAt: true });
export type InsertMedicalEvent = z.infer<typeof insertMedicalEventSchema>;
export type MedicalEvent = typeof medicalAppointmentEvents.$inferSelect;

export const FINAL_CYCLE_STATUSES = ["RESULT_ISSUED", "MEDICAL_FAILED", "CLOSED_ADMIN_OVERRIDE", "NO_SHOW"] as const;
export type MedicalApptStatus = "SCHEDULED" | "AWAITING_MEETING" | "IN_PROCESS" | "COMPLETED" | "RESULT_DELAYED" | "RESULT_ISSUED" | "MEDICAL_FAILED" | "NO_SHOW" | "RETEST_REQUIRED" | "CLOSED_ADMIN_OVERRIDE";

// EID Biometrics Scheduling insert schemas and types
export const insertBiometricsCaseSchema = createInsertSchema(biometricsCases).omit({ id: true, createdAt: true });
export type InsertBiometricsCase = z.infer<typeof insertBiometricsCaseSchema>;
export type BiometricsCase = typeof biometricsCases.$inferSelect;

export const insertBiometricsCycleSchema = createInsertSchema(biometricsAppointmentCycles).omit({ id: true, createdAt: true });
export type InsertBiometricsCycle = z.infer<typeof insertBiometricsCycleSchema>;
export type BiometricsCycle = typeof biometricsAppointmentCycles.$inferSelect;

export const insertBiometricsEventSchema = createInsertSchema(biometricsAppointmentEvents).omit({ id: true, createdAt: true });
export type InsertBiometricsEvent = z.infer<typeof insertBiometricsEventSchema>;
export type BiometricsEvent = typeof biometricsAppointmentEvents.$inferSelect;

export const FINAL_BIOMETRICS_STATUSES = ["COMPLETED", "NO_SHOW", "CLOSED_ADMIN_OVERRIDE"] as const;
export type BiometricsApptStatus = "SCHEDULED" | "AWAITING_MEETING" | "IN_PROCESS" | "COMPLETED" | "NO_SHOW" | "RESCHEDULE_REQUIRED" | "CLOSED_ADMIN_OVERRIDE";

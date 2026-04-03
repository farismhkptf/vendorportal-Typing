import { sql } from "drizzle-orm";
import { pgTable, pgSchema, text, varchar, integer, boolean, timestamp, json, jsonb, pgEnum, index, numeric, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Vendor schema — all Vendor Portal execution tables live here
export const vendorSchema = pgSchema("vendor");

// Enums
// User roles organized by category:
// Our Team: Admin, Client Relationship Manager, PRO, PRO - Temporary
// Vendors: Vendor
// Clients: Client Coordinator, Client Manager
// Renamed with vp_ prefix to avoid collision with Client Portal's public schema enum
export const userRoleEnum = pgEnum("vp_user_role", [
  "Admin",
  "Client Relationship Manager",
  "PRO",
  "PRO - Temporary",
  "Vendor",
  "Client Coordinator",
  "Client Manager"
]);

// Role category helpers
export const ROLE_CATEGORIES = {
  "Our Team": [
    "Admin",
    "Client Relationship Manager",
    "PRO",
    "PRO - Temporary"
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
  "PRO",
  "PRO - Temporary",
  "Vendor",
  "Client Coordinator",
  "Client Manager"
] as const;

export type UserRole = typeof ALL_ROLES[number];
export const centerTypeEnum = pgEnum("center_type", ["Medical", "EID", "Both"]);
export const centerAuthorityEnum = pgEnum("center_authority", ["DHA", "EHS", "ICP"]);
export const centerTierEnum = pgEnum("center_tier", ["Normal", "VIP"]);
export const woStatusEnum = pgEnum("wo_status", ["Draft", "AtVendor", "ReadyToSchedule", "Scheduled", "Completed", "Cancelled"]);
export const appointmentTypeEnum = pgEnum("appointment_type", ["Medical", "EID"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["Scheduled", "Completed", "Cancelled", "Rescheduled", "FollowUpRequired", "FollowUpScheduled", "FollowUpCompleted"]);
export const rescheduleStatusEnum = pgEnum("reschedule_status", ["New", "Accepted", "Closed"]);
export const typingJobStatusEnum = vendorSchema.enum("typing_job_status", [
  "Draft", "SubmittedToVendor", "InProcess", "Returned",
  "ReadyForScheduling", "OnHold", "Rejected", "Aborted"
]);
export const jobCategoryEnum = vendorSchema.enum("job_category", ["Medical", "EID"]);
export const fileDirectionEnum = vendorSchema.enum("file_direction", ["Input", "Output"]);
export const uploadedByTypeEnum = vendorSchema.enum("uploaded_by_type", ["Internal", "Vendor"]);
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
export const authorTypeEnum = vendorSchema.enum("author_type", ["Internal", "Vendor"]);
export const messageChannelEnum = pgEnum("message_channel", ["Email", "WhatsApp"]);
export const messageStatusEnum = pgEnum("message_status", ["Draft", "MarkedSent", "Failed"]);
export const walletEntryTypeEnum = pgEnum("wallet_entry_type", ["Topup", "Debit", "Reversal", "Adjustment"]);
export const staffStatusEnum = pgEnum("staff_status", ["Active", "OnLeave", "Cancelled", "TempActive", "TempInactive"]);
export const staffTypeEnum = pgEnum("staff_type", ["Permanent", "Temporary"]);
export const approvalStatusEnum = pgEnum("approval_status", ["Pending", "Approved", "Rejected"]);
export const changeNotificationStatusEnum = vendorSchema.enum("change_notification_status", ["pending", "reviewed", "dismissed"]);
export const passwordResetStatusEnum = pgEnum("password_reset_status", ["pending", "approved", "rejected"]);
export const deletionRequestStatusEnum = vendorSchema.enum("deletion_request_status", ["pending", "approved", "denied"]);

// Attestation enums
export const vendorTypeEnum = pgEnum("vendor_type", ["Typing", "Attestation"]);
export const documentClassEnum = pgEnum("document_class", ["Personal", "Business", "Both"]);
export const srStatusEnum = pgEnum("sr_status", ["Draft", "SentToVendor", "AcceptedByVendor", "InProgress", "Completed", "Cancelled"]);
export const physicalCustodyStatusEnum = pgEnum("physical_custody_status", ["WithClient", "WithUs", "WithVendor", "ReturnedToClient"]);
export const srStepStatusEnum = pgEnum("sr_step_status", ["Pending", "InProgress", "Done"]);

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
// Owned by Vendor Portal under vendor schema
export const medicalCases = vendorSchema.table("medical_cases", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  woId: uuid("work_order_id").notNull().unique(),
  isOpen: boolean("is_open").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_medical_cases_wo_id").on(table.woId),
]);

// Appointment Cycles table — each scheduling attempt under a medical case
// Owned by Vendor Portal under vendor schema
export const appointmentCycles = vendorSchema.table("appointment_cycles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: uuid("case_id").notNull(),
  cycleNumber: integer("cycle_number").notNull().default(1),
  cycleType: cycleTypeEnum("cycle_type").notNull().default("Initial"),
  status: medicalApptStatusEnum("status").notNull().default("SCHEDULED"),
  appointmentTime: timestamp("appointment_time").notNull(),
  centerId: uuid("center_id"),
  assignedProId: uuid("assigned_pro_id"),
  outcome: cycleOutcomeEnum("outcome"),
  // Timer fields
  awaitingMeetingAt: timestamp("awaiting_meeting_at"),
  noShowAt: timestamp("no_show_at"),
  completedAt: timestamp("completed_at"),
  resultDelayedAt: timestamp("result_delayed_at"),
  resultIssuedAt: timestamp("result_issued_at"),
  // CRM hold
  crmHoldActive: boolean("crm_hold_active").notNull().default(false),
  crmHoldSetBy: uuid("crm_hold_set_by"),
  crmHoldSetAt: timestamp("crm_hold_set_at"),
  // QR / confirmation
  confirmedAt: timestamp("confirmed_at"),
  confirmedBy: uuid("confirmed_by"),
  confirmMethod: text("confirm_method"),
  // Admin override
  overrideReason: text("override_reason"),
  overrideBy: uuid("override_by"),
  overrideAt: timestamp("override_at"),
  // Creation
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_appointment_cycles_case_id").on(table.caseId),
  index("idx_appointment_cycles_status").on(table.status),
]);

// Medical Appointment Events table — event log per cycle
// Owned by Vendor Portal under vendor schema
export const medicalAppointmentEvents = vendorSchema.table("medical_appointment_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  cycleId: uuid("cycle_id").notNull(),
  eventType: medicalEventTypeEnum("event_type").notNull(),
  actorId: uuid("actor_id"),
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
// Owned by Vendor Portal under vendor schema
export const biometricsCases = vendorSchema.table("biometrics_cases", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  woId: uuid("work_order_id").notNull().unique(),
  isOpen: boolean("is_open").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_biometrics_cases_wo_id").on(table.woId),
]);

// EID Biometrics Appointment Cycles
// Owned by Vendor Portal under vendor schema
export const biometricsAppointmentCycles = vendorSchema.table("biometrics_appointment_cycles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: uuid("case_id").notNull(),
  cycleNumber: integer("cycle_number").notNull().default(1),
  cycleType: biometricsCycleTypeEnum("cycle_type").notNull().default("Initial"),
  status: biometricsApptStatusEnum("status").notNull().default("SCHEDULED"),
  appointmentTime: timestamp("appointment_time").notNull(),
  centerId: uuid("center_id"),
  assignedProId: uuid("assigned_pro_id"),
  outcome: biometricsCycleOutcomeEnum("outcome"),
  // Timer fields
  awaitingMeetingAt: timestamp("awaiting_meeting_at"),
  noShowAt: timestamp("no_show_at"),
  completedAt: timestamp("completed_at"),
  // CRM hold
  crmHoldActive: boolean("crm_hold_active").notNull().default(false),
  crmHoldSetBy: uuid("crm_hold_set_by"),
  crmHoldSetAt: timestamp("crm_hold_set_at"),
  // QR / confirmation
  confirmedAt: timestamp("confirmed_at"),
  confirmedBy: uuid("confirmed_by"),
  confirmMethod: text("confirm_method"),
  // Proof image
  proofImageUrl: text("proof_image_url"),
  proofUploadedAt: timestamp("proof_uploaded_at"),
  // Admin override
  overrideReason: text("override_reason"),
  overrideBy: uuid("override_by"),
  overrideAt: timestamp("override_at"),
  // Creation
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_biometrics_cycles_case_id").on(table.caseId),
]);

// EID Biometrics Appointment Events — event log per cycle
// Owned by Vendor Portal under vendor schema
export const biometricsAppointmentEvents = vendorSchema.table("biometrics_appointment_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  cycleId: uuid("cycle_id").notNull(),
  eventType: biometricsEventTypeEnum("event_type").notNull(),
  actorId: uuid("actor_id"),
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
  role: userRoleEnum("role").notNull().default("PRO"),
  staffId: varchar("staff_id"),
  vendorId: varchar("vendor_id"),
  active: boolean("active").notNull().default(true),
  managerPin: text("manager_pin").default("0000"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Employee profile fields
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  personalEmail: text("personal_email"),
  eidNumber: text("eid_number"),
  profilePhotoUrl: text("profile_photo_url"),
  profileCompletedAt: timestamp("profile_completed_at"),
});

// Magic link tokens table
export const magicLinkTokens = pgTable("magic_link_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_magic_link_tokens_token_hash").on(table.tokenHash),
  index("idx_magic_link_tokens_email").on(table.email),
]);

export const insertMagicLinkTokenSchema = createInsertSchema(magicLinkTokens).omit({ id: true, createdAt: true });
export type InsertMagicLinkToken = z.infer<typeof insertMagicLinkTokenSchema>;
export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;

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
  leaveEndDate: timestamp("leave_end_date"),
  active: boolean("active").notNull().default(true),
});

// Centers table — Vendor Portal execution data
// Owned by Vendor Portal under vendor schema
export const centers = vendorSchema.table("centers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
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
}, (table) => [
  index("idx_companies_rm_staff_id").on(table.rmStaffId),
]);

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
  requiresAttestation: boolean("requires_attestation").notNull().default(false),
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
  status: woStatusEnum("status").notNull().default("Draft"),
  previousStatus: woStatusEnum("previous_status"),
  isDelayed: boolean("is_delayed").notNull().default(false),
  isMinor: boolean("is_minor").notNull().default(false),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_work_orders_status").on(table.status),
  index("idx_work_orders_company_id").on(table.companyId),
  index("idx_work_orders_created_at").on(table.createdAt),
]);

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
  index("idx_appointments_status").on(table.status),
  index("idx_appointments_datetime").on(table.datetime),
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

// Job Types table — Vendor Portal typing job catalog
// Owned by Vendor Portal under vendor schema
export const jobTypes = vendorSchema.table("job_types", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: jobCategoryEnum("category").notNull(),
  cost: integer("cost").notNull(),
  active: boolean("active").notNull().default(true),
});

// Vendors table — future: may be promoted to shared master data
// Owned by Vendor Portal under vendor schema
export const vendors = vendorSchema.table("vendors", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  active: boolean("active").notNull().default(true),
  logoUrl: text("logo_url"),
  vendorType: vendorTypeEnum("vendor_type").notNull().default("Typing"),
});

// Typing Jobs table — Vendor Portal execution data
// Owned by Vendor Portal under vendor schema
export const typingJobs = vendorSchema.table("typing_jobs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobCode: text("job_code"),
  woId: uuid("work_order_id").notNull(),
  vendorId: uuid("vendor_id"),
  jobTypeId: uuid("job_type_id").notNull(),
  assignedToUserId: uuid("assigned_to_user_id"),
  status: typingJobStatusEnum("status").notNull().default("Draft"),
  costSnapshot: integer("cost_snapshot"),
  sentAt: timestamp("sent_at"),
  returnedAt: timestamp("returned_at"),
  sentToClientAt: timestamp("sent_to_client_at"),
  vendorMistakeAt: timestamp("vendor_mistake_at"),
  vendorMistakeReason: text("vendor_mistake_reason"),
  createdBy: uuid("created_by"),
  previousStatus: typingJobStatusEnum("previous_status"),
  rejectedReason: text("rejected_reason"),
  urgent: boolean("urgent").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_typing_jobs_wo_id").on(table.woId),
  index("idx_typing_jobs_vendor_id").on(table.vendorId),
  index("idx_typing_jobs_status").on(table.status),
]);

// Typing Job Results table — Vendor Portal execution data
// Owned by Vendor Portal under vendor schema
export const typingJobResults = vendorSchema.table("typing_job_results", {
  typingJobId: uuid("typing_job_id").primaryKey(),
  applicationRefNo: text("application_ref_no"),
  centerName: text("center_name"),
  centerArea: text("center_area"),
  centerNotes: text("center_notes"),
  biometricsRequired: boolean("biometrics_required").default(false),
  biometricsDatetime: timestamp("biometrics_datetime"),
  biometricsCenter: text("biometrics_center"),
  vendorNotes: text("vendor_notes"),
});

// Typing Job Comments table — Vendor Portal execution data
// Owned by Vendor Portal under vendor schema
export const typingJobComments = vendorSchema.table("typing_job_comments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  typingJobId: uuid("typing_job_id").notNull(),
  authorType: authorTypeEnum("author_type").notNull(),
  authorUserId: uuid("author_user_id"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_typing_job_comments_typing_job_id").on(table.typingJobId),
]);

// Files table — Vendor Portal execution data
// Owned by Vendor Portal under vendor schema
export const files = vendorSchema.table("files", {
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
  index("idx_vendor_files_related_id").on(table.relatedId),
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

// Vendor Wallet Ledger table — Vendor Portal execution data
// Owned by Vendor Portal under vendor schema
export const vendorWalletLedger = vendorSchema.table("vendor_wallet_ledger", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: uuid("vendor_id").notNull(),
  entryType: walletEntryTypeEnum("entry_type").notNull(),
  typingJobId: uuid("typing_job_id"),
  amount: integer("amount").notNull(),
  note: text("note"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_vendor_wallet_ledger_vendor_id").on(table.vendorId),
  index("idx_vendor_wallet_ledger_typing_job_id").on(table.typingJobId),
]);

// Vendor Statements table — Vendor Portal execution data
// Owned by Vendor Portal under vendor schema
export const vendorStatements = vendorSchema.table("vendor_statements", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: uuid("vendor_id").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  totalDebit: integer("total_debit").notNull().default(0),
  totalCredit: integer("total_credit").notNull().default(0),
  balanceDelta: integer("balance_delta").notNull().default(0),
});

// Vendor Invoices table — Vendor Portal execution data
// Owned by Vendor Portal under vendor schema
export const vendorInvoices = vendorSchema.table("vendor_invoices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: uuid("vendor_id").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  invoiceFileWorkdriveId: text("invoice_file_workdrive_id"),
  invoiceLink: text("invoice_link"),
  amount: integer("amount").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// Vendor Approvals table — Vendor Portal execution data
// Owned by Vendor Portal under vendor schema
export const vendorApprovals = vendorSchema.table("vendor_approvals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  typingJobId: uuid("typing_job_id").notNull(),
  vendorId: uuid("vendor_id").notNull(),
  calculatedAmount: integer("calculated_amount").notNull().default(0),
  adjustedAmount: integer("adjusted_amount"),
  status: approvalStatusEnum("status").notNull().default("Pending"),
  rejectedReason: text("rejected_reason"),
  approvedBy: uuid("approved_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => [
  index("idx_vendor_approvals_typing_job_id").on(table.typingJobId),
  index("idx_vendor_approvals_vendor_id").on(table.vendorId),
]);

// Vendor Notifications table — persistent inbox; null readAt = unread; records never deleted on read
// Owned by Vendor Portal under vendor schema
export const vendorNotifications = vendorSchema.table("vendor_notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorUserId: uuid("vendor_user_id").notNull(),
  vendorId: uuid("vendor_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedJobId: uuid("related_job_id"),
  readAt: timestamp("read_at"), // null = unread; set once, never cleared
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_vendor_notifications_vendor_user_id").on(table.vendorUserId),
  index("idx_vendor_notifications_vendor_id").on(table.vendorId),
]);

// App Settings table — Vendor Portal configuration; all setting keys use vp_ prefix
// Owned by Vendor Portal under vendor schema
export const appSettings = vendorSchema.table("app_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  fromEmail: text("vp_from_email").notNull().default("notifications@procompany.ae"),
  fromName: text("vp_from_name").notNull().default("The P.R.O. Company"),
  replyToEmail: text("vp_reply_to_email").notNull().default("operations@procompany.ae"),
  alwaysCc: json("vp_always_cc").$type<string[]>().default(["faris@procompany.ae", "yasin@procompany.ae"]),
  testEmailRedirect: text("vp_test_email_redirect"),
  lowBalanceThreshold: integer("vp_low_balance_threshold").notNull().default(1000),
  masterPassword: text("vp_master_password"),
  defaultVendorId: uuid("vp_default_vendor_id"),
  maintenanceMode: boolean("vp_maintenance_mode").notNull().default(false),
  maintenanceMessage: text("vp_maintenance_message"),
  whatsappNumber: text("vp_whatsapp_number").default("+971509161815"),
  privacyPolicyHtml: text("vp_privacy_policy_html"),
  termsOfServiceHtml: text("vp_terms_of_service_html"),
  followUpCenter: text("vp_follow_up_center"),
  vendorDelayThresholdHours: integer("vp_vendor_delay_threshold_hours").notNull().default(48),
  logoUrl: text("vp_logo_url"),
});

// Change notifications table (manager edits for admin review)
// Owned by Vendor Portal under vendor schema
export const changeNotifications = vendorSchema.table("change_notifications", {
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
// Moved to vendor schema as part of vendor boundary enforcement
export const staffNotifications = vendorSchema.table("staff_notifications", {
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
  index("idx_vendor_staff_notifications_user_id").on(table.userId),
]);

// Audit Log table — Vendor Portal audit trail
// Owned by Vendor Portal under vendor schema
export const auditLog = vendorSchema.table("audit_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  userId: uuid("user_id"),
  details: json("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_audit_log_entity_id").on(table.entityId),
  index("idx_audit_log_user_id").on(table.userId),
  index("idx_audit_log_created_at").on(table.createdAt),
  index("idx_audit_log_entity_type").on(table.entityType),
]);

// Login Audit Log table — Vendor Portal login trail
// Owned by Vendor Portal under vendor schema
export const loginAuditLog = vendorSchema.table("login_audit_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id"),
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

// Attestation Categories table — admin-managed, replaces the old enum
// Owned by Vendor Portal under vendor schema
export const attestationCategories = vendorSchema.table("attestation_categories", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

// Attestation Services catalog table — Vendor Portal execution data
// Owned by Vendor Portal under vendor schema
export const attestationServices = vendorSchema.table("attestation_services", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  documentClassApplicability: documentClassEnum("document_class_applicability").notNull().default("Both"),
  basePriceAed: numeric("base_price_aed", { precision: 10, scale: 2 }).notNull().default("0"),
  timelineDays: integer("timeline_days"),
  description: text("description"),
  active: boolean("active").notNull().default(true),
});

// Attestation Service Variants table (e.g. per country/embassy)
// Owned by Vendor Portal under vendor schema
export const attestationServiceVariants = vendorSchema.table("attestation_service_variants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: uuid("service_id").notNull(),
  variantLabel: text("variant_label").notNull(),
  priceAed: numeric("price_aed", { precision: 10, scale: 2 }).notNull().default("0"),
  timelineDays: integer("timeline_days"),
  active: boolean("active").notNull().default(true),
}, (table) => [
  index("idx_attest_svc_variants_service_id").on(table.serviceId),
]);

// Attestation Service Step Definitions table — Vendor Portal execution data
// Owned by Vendor Portal under vendor schema
export const attestationServiceStepDefinitions = vendorSchema.table("attestation_service_step_definitions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: uuid("service_id").notNull(),
  stepOrder: integer("step_order").notNull(),
  stepName: text("step_name").notNull(),
  stepType: text("step_type").notNull(),
  description: text("description"),
}, (table) => [
  index("idx_attest_step_defs_service_id").on(table.serviceId),
]);

// Attestation Service Request status / custody enums (uses srStatusEnum for status column)

export const handoverDirectionEnum = pgEnum("handover_direction", [
  "ClientToUs", "UsToVendor", "VendorToUs", "UsToClient"
]);

// Attestation Service Requests table — Vendor Portal execution data
// Supports both catalog-based and inquiry-flow based SRs.
// attestationServiceId is nullable for inquiry-flow SRs (where service name is stored in serviceName).
// companyId and assignedProId are cross-schema FKs to public.companies / public.people (ON DELETE RESTRICT ON UPDATE CASCADE)
// Owned by Vendor Portal under vendor schema
export const attestationServiceRequests = vendorSchema.table("attestation_service_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  srNumber: varchar("sr_number", { length: 20 }).unique(),
  externalWoNumber: text("external_wo_number"),
  inquiryId: uuid("inquiry_id"),
  companyId: uuid("company_id").notNull(), // FK → public.companies ON DELETE RESTRICT ON UPDATE CASCADE
  applicantName: text("applicant_name"),
  documentName: text("document_name"),
  vendorId: uuid("vendor_id"),
  assignedProId: uuid("assigned_pro_id"), // FK → public.people ON DELETE RESTRICT ON UPDATE CASCADE
  attestationServiceId: uuid("attestation_service_id"),
  serviceVariantId: uuid("service_variant_id"),
  documentType: text("document_type"),
  documentNameDescription: text("document_name_description"),
  documentClass: documentClassEnum("document_class"),
  homeCountry: text("home_country"),
  originalDocumentInvolved: boolean("original_document_involved").notNull().default(false),
  status: srStatusEnum("status").notNull().default("Draft"),
  physicalCustodyStatus: physicalCustodyStatusEnum("physical_custody_status").notNull().default("WithClient"),
  currentCustodian: text("current_custodian"),
  currentResponsibleStaffId: uuid("current_responsible_staff_id"),
  serviceFeeAed: numeric("service_fee_aed", { precision: 10, scale: 2 }),
  feeSource: text("fee_source"),
  serviceName: text("service_name"),
  serviceNotes: text("service_notes"),
  internalNotes: text("internal_notes"),
  notes: text("notes"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_attestation_sr_company_id").on(table.companyId),
  index("idx_attestation_sr_vendor_id").on(table.vendorId),
  index("idx_attestation_sr_assigned_pro_id").on(table.assignedProId),
]);

// Attestation SR Steps table — Vendor Portal execution data
// Owned by Vendor Portal under vendor schema
export const attestationSrSteps = vendorSchema.table("attestation_sr_steps", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  srId: uuid("sr_id").notNull(),
  stepOrder: integer("step_order").notNull(),
  stepName: text("step_name").notNull(),
  stepType: text("step_type").notNull(),
  status: srStepStatusEnum("status").notNull().default("Pending"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
}, (table) => [
  index("idx_attest_sr_steps_sr_id").on(table.srId),
]);

// Attestation SR Activity Log — Vendor Portal execution data
// Owned by Vendor Portal under vendor schema
export const attestationSrActivityLog = vendorSchema.table("attestation_sr_activity_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  srId: uuid("sr_id").notNull(),
  action: text("action").notNull(),
  detail: text("detail"),
  performedBy: uuid("performed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_attest_sr_activity_sr_id").on(table.srId),
]);

// Vendor Users table — portal-local auth; future shared identity / SSO may replace this table
// Owned by Vendor Portal under vendor schema
export const vendorUsers = vendorSchema.table("vendor_users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: uuid("vendor_id").notNull(), // FK → vendor.vendors
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("operator"), // operator | admin
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_vendor_users_vendor_id").on(table.vendorId),
  index("idx_vendor_users_email").on(table.email),
]);

// Cross-Portal Events table — outbound signals from Vendor Portal to Client Portal
// Vendor Portal ONLY inserts rows with status='pending'; processed_at and status='sent'
// may ONLY be set by the Client Portal consumer. This constraint is enforced here via comment
// and enforced in SQL via the trigger in migration 0008.
// Owned by Vendor Portal under vendor schema.
// Strict lifecycle contract:
//   - Vendor Portal inserts rows with status='pending' (only).
//   - Client Portal consumer alone sets status='sent'/'failed', processed_at, last_attempt_at.
//   - No Vendor Portal code may set processed_at or status='sent'.
export const crossPortalEvents = vendorSchema.table("cross_portal_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  // Idempotency key — TEXT, non-nullable. Caller MUST provide a stable, unique string (e.g. a
  // deterministic composite key like 'typing_job.<uuid>.completed') to prevent duplicate inserts.
  // A unique constraint on this column enforces exactly-once delivery semantics.
  idempotencyKey: text("idempotency_key").notNull().unique(),
  // Source identifies which Vendor Portal subsystem produced the event
  sourceApp: text("source_app").notNull().default("vendor_portal"), // 'vendor_portal' always for this bus
  eventType: text("event_type").notNull(), // e.g. 'typing_job.completed', 'sr.status_changed'
  // Aggregate root being acted on
  aggregateType: text("aggregate_type").notNull(), // 'typing_job' | 'attestation_sr' | 'appointment_cycle'
  aggregateId: uuid("aggregate_id").notNull(),     // the root entity UUID
  payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
  // Cross-schema references (FK constraints enforced in SQL migration, not Drizzle ORM)
  workOrderId: uuid("work_order_id"), // FK → public.work_orders ON DELETE RESTRICT ON UPDATE CASCADE
  companyId: uuid("company_id"),      // FK → public.companies ON DELETE RESTRICT ON UPDATE CASCADE
  // Lifecycle — Vendor Portal sets status='pending' ONLY; Client Portal consumer owns transition
  status: text("status").notNull().default("pending"), // pending | sent | failed
  processedAt: timestamp("processed_at"),   // set ONLY by Client Portal consumer
  attemptCount: integer("attempt_count").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: uuid("created_by"), // vendor user who triggered the event
}, (table) => [
  index("idx_cross_portal_events_status").on(table.status),
  index("idx_cross_portal_events_work_order_id").on(table.workOrderId),
  index("idx_cross_portal_events_event_type").on(table.eventType),
  index("idx_cross_portal_events_created_at").on(table.createdAt),
  index("idx_cross_portal_events_aggregate").on(table.aggregateType, table.aggregateId),
]);

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
export const insertVendorUserSchema = createInsertSchema(vendorUsers).omit({ id: true, createdAt: true, lastLoginAt: true });
export const insertCrossPortalEventSchema = createInsertSchema(crossPortalEvents).omit({ id: true, createdAt: true, processedAt: true, attemptCount: true, lastAttemptAt: true, errorMessage: true });

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
export type InsertVendorUser = z.infer<typeof insertVendorUserSchema>;
export type VendorUser = typeof vendorUsers.$inferSelect;
export type InsertCrossPortalEvent = z.infer<typeof insertCrossPortalEventSchema>;
export type CrossPortalEvent = typeof crossPortalEvents.$inferSelect;
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

// Document Custody Log table
export const documentCustodyLog = pgTable("document_custody_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  srId: varchar("sr_id").notNull(),
  handoverDirection: handoverDirectionEnum("handover_direction").notNull(),
  counterpartyName: text("counterparty_name").notNull(),
  counterpartyContact: text("counterparty_contact").notNull(),
  counterpartyIdPhotoUrl: text("counterparty_id_photo_url"),
  counterpartySignatureUrl: text("counterparty_signature_url").notNull(),
  approverName: text("approver_name"),
  approverContact: text("approver_contact"),
  approverDesignation: text("approver_designation"),
  receivingStaffName: text("receiving_staff_name"),
  receivingStaffSignatureUrl: text("receiving_staff_signature_url"),
  recordedBy: varchar("recorded_by").notNull(),
  notes: text("notes"),
  acknowledgedAt: timestamp("acknowledged_at").defaultNow().notNull(),
}, (table) => [
  index("idx_document_custody_log_sr_id").on(table.srId),
]);

// ─── Document Custody Records ──────────────────────────────────────────────────
// Standalone custody record for tracking original document lifecycle.
// Can be linked to an attestation SR (srId) or a WO (woId), or standalone.

export const custodyDocCategoryEnum = pgEnum("custody_doc_category", [
  "MofaPersonal", "MofaBusiness", "LawyerAttestation", "EmbassyAttestation"
]);

export const custodyDocSubtypeEnum = pgEnum("custody_doc_subtype", [
  "BirthCertificate",
  "MarriageCertificate",
  "EmbassyAffidavit",
  "AcademicCertificate",
  "PersonalPOA",
  "TradeLicense",
  "MOA",
  "BusinessPOA",
  "InternalCompanyDocuments",
  "PassportCopy",
  "ResidencyCopy",
  "UtilityBill",
  "Other"
]);

export const custodyDocStageEnum = pgEnum("custody_doc_stage", [
  "WithClient", "WithUs", "WithVendor", "ReturnedToClient"
]);

// Document Custody Records — Owned by Vendor Portal under vendor schema
export const documentCustodyRecords = vendorSchema.table("document_custody_records", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  referenceNumber: varchar("reference_number", { length: 20 }).notNull().unique(),
  companyId: uuid("company_id").notNull(), // FK → public.companies ON DELETE RESTRICT ON UPDATE CASCADE
  woId: uuid("work_order_id"),              // FK → public.work_orders ON DELETE RESTRICT ON UPDATE CASCADE
  srId: uuid("sr_id"),                     // FK → vendor.attestation_sr
  docCategory: custodyDocCategoryEnum("doc_category").notNull(),
  docSubtype: custodyDocSubtypeEnum("doc_subtype").notNull(),
  docCustomName: text("doc_custom_name"),
  custodyStage: custodyDocStageEnum("custody_stage").notNull().default("WithClient"),
  notifyEmail: text("notify_email"),
  notes: text("notes"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_doc_custody_records_company_id").on(table.companyId),
  index("idx_doc_custody_records_wo_id").on(table.woId),
  index("idx_doc_custody_records_sr_id").on(table.srId),
]);

// Document Custody Handoffs — Owned by Vendor Portal under vendor schema
export const documentCustodyHandoffs = vendorSchema.table("document_custody_handoffs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  recordId: uuid("record_id").notNull(), // FK → vendor.document_custody_records
  fromStage: custodyDocStageEnum("from_stage").notNull(),
  toStage: custodyDocStageEnum("to_stage").notNull(),
  counterpartyName: text("counterparty_name").notNull(),
  counterpartyContact: text("counterparty_contact").notNull(),
  counterpartyIdPhotoUrl: text("counterparty_id_photo_url"),
  notes: text("notes"),
  performedBy: uuid("performed_by").notNull(),
  performedAt: timestamp("performed_at").defaultNow().notNull(),
}, (table) => [
  index("idx_doc_custody_handoffs_record_id").on(table.recordId),
]);

export const insertDocumentCustodyRecordSchema = createInsertSchema(documentCustodyRecords).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocumentCustodyRecord = z.infer<typeof insertDocumentCustodyRecordSchema>;
export type DocumentCustodyRecord = typeof documentCustodyRecords.$inferSelect;

export const insertDocumentCustodyHandoffSchema = createInsertSchema(documentCustodyHandoffs).omit({ id: true, performedAt: true });
export type InsertDocumentCustodyHandoff = z.infer<typeof insertDocumentCustodyHandoffSchema>;
export type DocumentCustodyHandoff = typeof documentCustodyHandoffs.$inferSelect;

// Helper constants for doc custody
export const CUSTODY_DOC_CATEGORY_LABELS: Record<string, string> = {
  MofaPersonal: "MOFA Attestation — Personal",
  MofaBusiness: "MOFA Attestation — Business",
  LawyerAttestation: "Lawyer Attestation",
  EmbassyAttestation: "Embassy Attestation",
};

export const CUSTODY_DOC_SUBTYPE_LABELS: Record<string, string> = {
  BirthCertificate: "Birth Certificate",
  MarriageCertificate: "Marriage Certificate",
  EmbassyAffidavit: "Embassy Affidavit",
  AcademicCertificate: "Academic Certificate",
  PersonalPOA: "Personal POA",
  TradeLicense: "Trade License",
  MOA: "MOA",
  BusinessPOA: "Business POA",
  InternalCompanyDocuments: "Internal Company Documents",
  PassportCopy: "Passport Copy",
  ResidencyCopy: "Residency Copy",
  UtilityBill: "Utility Bill",
  Other: "Other",
};

export const CUSTODY_DOC_STAGE_LABELS: Record<string, string> = {
  WithClient: "With Client",
  WithUs: "With Us",
  WithVendor: "With Vendor",
  ReturnedToClient: "Returned to Client",
};

// Document subtypes available per category
export const CUSTODY_DOC_SUBTYPES_BY_CATEGORY: Record<string, string[]> = {
  MofaPersonal: ["BirthCertificate", "MarriageCertificate", "EmbassyAffidavit", "AcademicCertificate", "PersonalPOA", "Other"],
  MofaBusiness: ["TradeLicense", "MOA", "BusinessPOA", "InternalCompanyDocuments", "Other"],
  LawyerAttestation: ["BirthCertificate", "MarriageCertificate", "EmbassyAffidavit", "AcademicCertificate", "PersonalPOA", "TradeLicense", "MOA", "BusinessPOA", "InternalCompanyDocuments", "PassportCopy", "ResidencyCopy", "UtilityBill", "Other"],
  EmbassyAttestation: ["BirthCertificate", "MarriageCertificate", "EmbassyAffidavit", "AcademicCertificate", "PersonalPOA", "TradeLicense", "MOA", "BusinessPOA", "InternalCompanyDocuments", "PassportCopy", "ResidencyCopy", "UtilityBill", "Other"],
};

// Deletion Requests table — moved to vendor schema as part of vendor boundary enforcement
export const deletionRequests = vendorSchema.table("deletion_requests", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // e.g. "work_order", "document", "note", "company_email"
  entityId: text("entity_id").notNull(),
  entityLabel: text("entity_label").notNull(), // human-readable description
  requestedBy: text("requested_by").notNull(), // user.id
  requestedByName: text("requested_by_name").notNull(),
  reason: text("reason").notNull(),
  status: deletionRequestStatusEnum("status").default("pending").notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDeletionRequestSchema = createInsertSchema(deletionRequests).omit({ id: true, createdAt: true, reviewedBy: true, reviewedAt: true, reviewNote: true });
export type InsertDeletionRequest = z.infer<typeof insertDeletionRequestSchema>;
export type DeletionRequest = typeof deletionRequests.$inferSelect;

// Attestation Categories insert schemas and types
export const insertAttestationCategorySchema = createInsertSchema(attestationCategories).omit({ id: true });
export type InsertAttestationCategory = z.infer<typeof insertAttestationCategorySchema>;
export type AttestationCategory = typeof attestationCategories.$inferSelect;

// Attestation insert schemas and types (Service Catalog)
export const insertAttestationServiceSchema = createInsertSchema(attestationServices).omit({ id: true });
export type InsertAttestationService = z.infer<typeof insertAttestationServiceSchema>;
export type AttestationService = typeof attestationServices.$inferSelect;

export const insertAttestationServiceVariantSchema = createInsertSchema(attestationServiceVariants).omit({ id: true });
export type InsertAttestationServiceVariant = z.infer<typeof insertAttestationServiceVariantSchema>;
export type AttestationServiceVariant = typeof attestationServiceVariants.$inferSelect;

export const insertAttestationServiceStepDefinitionSchema = createInsertSchema(attestationServiceStepDefinitions).omit({ id: true });
export type InsertAttestationServiceStepDefinition = z.infer<typeof insertAttestationServiceStepDefinitionSchema>;
export type AttestationServiceStepDefinition = typeof attestationServiceStepDefinitions.$inferSelect;

export const insertAttestationSrSchema = createInsertSchema(attestationServiceRequests).omit({ id: true, createdAt: true });
export type InsertAttestationSr = z.infer<typeof insertAttestationSrSchema>;
export type AttestationSr = typeof attestationServiceRequests.$inferSelect;

export const insertAttestationSrStepSchema = createInsertSchema(attestationSrSteps).omit({ id: true });
export type InsertAttestationSrStep = z.infer<typeof insertAttestationSrStepSchema>;
export type AttestationSrStep = typeof attestationSrSteps.$inferSelect;

export const insertAttestationSrActivityLogSchema = createInsertSchema(attestationSrActivityLog).omit({ id: true, createdAt: true });
export type InsertAttestationSrActivityLog = z.infer<typeof insertAttestationSrActivityLogSchema>;
export type AttestationSrActivityLog = typeof attestationSrActivityLog.$inferSelect;

// ─── Attestation Inquiry Flow ─────────────────────────────────────────────────

export const attestationInquiryStatusEnum = pgEnum("attestation_inquiry_status", [
  "Open", "QuoteReceived", "Accepted", "Rejected", "Converted"
]);

export const attestationDocumentClassEnum = pgEnum("attestation_document_class", [
  "Personal", "Business"
]);

// Attestation Inquiries table (pre-SR inquiry + quoting flow)
// Owned by Vendor Portal under vendor schema
// Cross-schema FKs (company_id → public.companies, vendor_id → vendor.vendors) enforced in SQL migration
export const attestationInquiries = vendorSchema.table("attestation_inquiries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: uuid("company_id").notNull(), // FK → public.companies ON DELETE RESTRICT ON UPDATE CASCADE
  applicantName: text("applicant_name"),
  vendorId: uuid("vendor_id").notNull(), // FK → vendor.vendors ON DELETE RESTRICT ON UPDATE CASCADE
  documentType: text("document_type").notNull(),
  documentNameDescription: text("document_name_description").notNull(),
  documentClass: attestationDocumentClassEnum("document_class").notNull(),
  homeCountry: text("home_country"),
  descriptionOfNeed: text("description_of_need").notNull(),
  externalWoNumber: text("external_wo_number"),
  status: attestationInquiryStatusEnum("status").notNull().default("Open"),
  rejectionReason: text("rejection_reason"),
  convertedToSrId: uuid("converted_to_sr_id"), // FK → vendor.attestation_sr
  createdBy: uuid("created_by"), // FK → public.users ON DELETE SET NULL
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_attestation_inquiries_company_id").on(table.companyId),
  index("idx_attestation_inquiries_vendor_id").on(table.vendorId),
  index("idx_attestation_inquiries_status").on(table.status),
]);

// Attestation Inquiry Quotes table (vendor quotes on inquiries)
// Owned by Vendor Portal under vendor schema
export const attestationInquiryQuotes = vendorSchema.table("attestation_inquiry_quotes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  inquiryId: uuid("inquiry_id").notNull(), // FK → vendor.attestation_inquiries ON DELETE CASCADE
  vendorId: uuid("vendor_id").notNull(),   // FK → vendor.vendors ON DELETE RESTRICT
  submittedByVendorUserId: uuid("submitted_by_vendor_user_id"), // FK → vendor.vendor_users
  quoteVersion: integer("quote_version").notNull().default(1),
  amountAed: integer("amount_aed").notNull(),
  timelineDays: integer("timeline_days").notNull(),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
}, (table) => [
  index("idx_attestation_quotes_inquiry_id").on(table.inquiryId),
]);

// Attestation insert schemas (Inquiry Flow)
export const insertAttestationInquirySchema = createInsertSchema(attestationInquiries).omit({ id: true, createdAt: true });
export type InsertAttestationInquiry = z.infer<typeof insertAttestationInquirySchema>;
export type AttestationInquiry = typeof attestationInquiries.$inferSelect;

export const insertAttestationInquiryQuoteSchema = createInsertSchema(attestationInquiryQuotes).omit({ id: true, submittedAt: true });
export type InsertAttestationInquiryQuote = z.infer<typeof insertAttestationInquiryQuoteSchema>;
export type AttestationInquiryQuote = typeof attestationInquiryQuotes.$inferSelect;

export const insertDocumentCustodyLogSchema = createInsertSchema(documentCustodyLog).omit({ id: true, acknowledgedAt: true });
export type InsertDocumentCustodyLog = z.infer<typeof insertDocumentCustodyLogSchema>;
export type DocumentCustodyLog = typeof documentCustodyLog.$inferSelect;

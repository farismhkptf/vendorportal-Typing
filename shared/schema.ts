import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, json, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["Admin", "Ops", "Viewer", "Vendor"]);
export const centerTypeEnum = pgEnum("center_type", ["Medical", "EID", "Both"]);
export const woStatusEnum = pgEnum("wo_status", ["Draft", "Scheduled", "Sent", "Completed", "Cancelled"]);
export const appointmentTypeEnum = pgEnum("appointment_type", ["Medical", "EID"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["Scheduled", "Completed", "Cancelled", "Rescheduled"]);
export const rescheduleStatusEnum = pgEnum("reschedule_status", ["New", "Accepted", "Closed"]);
export const typingJobStatusEnum = pgEnum("typing_job_status", [
  "Draft", "SentToVendor", "InProgress", "WaitingForDocs", 
  "Returned", "SentToClient", "VendorMistake", "Cancelled"
]);
export const jobCategoryEnum = pgEnum("job_category", ["Medical", "EID"]);
export const fileDirectionEnum = pgEnum("file_direction", ["Input", "Output"]);
export const uploadedByTypeEnum = pgEnum("uploaded_by_type", ["Internal", "Vendor"]);
export const authorTypeEnum = pgEnum("author_type", ["Internal", "Vendor"]);
export const messageChannelEnum = pgEnum("message_channel", ["Email", "WhatsApp"]);
export const messageStatusEnum = pgEnum("message_status", ["Draft", "MarkedSent", "Failed"]);
export const walletEntryTypeEnum = pgEnum("wallet_entry_type", ["Topup", "Debit", "Reversal", "Adjustment"]);
export const staffStatusEnum = pgEnum("staff_status", ["Active", "OnLeave", "TempActive", "TempInactive"]);

// Client contact type for companies
export type ClientContact = {
  name: string;
  email: string;
  mobile: string;
};

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("Viewer"),
  vendorId: varchar("vendor_id"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Staff table
export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  roleTitle: text("role_title").notNull(),
  phone: text("phone"),
  email: text("email"),
  status: staffStatusEnum("status").notNull().default("Active"),
  active: boolean("active").notNull().default(true),
});

// Centers table
export const centers = pgTable("centers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: centerTypeEnum("type").notNull(),
  googleMapsUrl: text("google_maps_url"),
  area: text("area"),
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
  // Client contacts
  clientCoordinator: json("client_coordinator").$type<ClientContact>(),
  clientManager: json("client_manager").$type<ClientContact>(),
  clientAccountant: json("client_accountant").$type<ClientContact>(),
  // Our team assignments
  rmStaffId: varchar("rm_staff_id"),
  assistStaffId: varchar("assist_staff_id"),
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
});

// Service Types table
export const serviceTypes = pgTable("service_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
});

// Work Orders table
export const workOrders = pgTable("work_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  woNumber: varchar("wo_number", { length: 10 }).notNull().unique(),
  applicantName: text("applicant_name").notNull(),
  companyId: varchar("company_id").notNull(),
  serviceTypeId: varchar("service_type_id"),
  status: woStatusEnum("status").notNull().default("Draft"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Appointments table
export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  woId: varchar("wo_id").notNull(),
  type: appointmentTypeEnum("type").notNull(),
  datetime: timestamp("datetime").notNull(),
  centerId: varchar("center_id"),
  assignedStaffId: varchar("assigned_staff_id"),
  rescheduleToken: varchar("reschedule_token").unique(),
  status: appointmentStatusEnum("status").notNull().default("Scheduled"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Reschedule Requests table
export const rescheduleRequests = pgTable("reschedule_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appointmentId: varchar("appointment_id").notNull(),
  requestedDatetime: timestamp("requested_datetime").notNull(),
  notes: text("notes"),
  status: rescheduleStatusEnum("status").notNull().default("New"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
});

// Typing Jobs table
export const typingJobs = pgTable("typing_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
});

// Files table
export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  relatedType: text("related_type").notNull(), // 'Appointment' or 'TypingJob'
  relatedId: varchar("related_id").notNull(),
  direction: fileDirectionEnum("direction").notNull(),
  workdriveFileId: text("workdrive_file_id"),
  workdriveLink: text("workdrive_link"),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type"),
  uploadedByType: uploadedByTypeEnum("uploaded_by_type").notNull(),
  uploadedByUserId: varchar("uploaded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
});

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
});

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

// App Settings table (single row)
export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromEmail: text("from_email").notNull().default("notifications@procompany.ae"),
  fromName: text("from_name").notNull().default("The P.R.O. Company"),
  replyToEmail: text("reply_to_email").notNull().default("operations@procompany.ae"),
  alwaysCc: json("always_cc").$type<string[]>().default(["faris@procompany.ae", "yasin@procompany.ae"]),
  lowBalanceThreshold: integer("low_balance_threshold").notNull().default(1000),
});

// Audit Log table
export const auditLog = pgTable("audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  userId: varchar("user_id"),
  details: json("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertStaffSchema = createInsertSchema(staff).omit({ id: true });
export const insertCenterSchema = createInsertSchema(centers).omit({ id: true });
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true });
export const insertCompanyEmailSchema = createInsertSchema(companyEmails).omit({ id: true });
export const insertServiceTypeSchema = createInsertSchema(serviceTypes).omit({ id: true });
export const insertWorkOrderSchema = createInsertSchema(workOrders).omit({ id: true, createdAt: true });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true });
export const insertRescheduleRequestSchema = createInsertSchema(rescheduleRequests).omit({ id: true, createdAt: true });
export const insertJobTypeSchema = createInsertSchema(jobTypes).omit({ id: true });
export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true });
export const insertTypingJobSchema = createInsertSchema(typingJobs).omit({ id: true, createdAt: true });
export const insertTypingJobResultSchema = createInsertSchema(typingJobResults);
export const insertTypingJobCommentSchema = createInsertSchema(typingJobComments).omit({ id: true, createdAt: true });
export const insertFileSchema = createInsertSchema(files).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertVendorWalletLedgerSchema = createInsertSchema(vendorWalletLedger).omit({ id: true, createdAt: true });
export const insertVendorStatementSchema = createInsertSchema(vendorStatements).omit({ id: true, generatedAt: true });
export const insertVendorInvoiceSchema = createInsertSchema(vendorInvoices).omit({ id: true, uploadedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ id: true, createdAt: true });

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
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertVendorWalletLedger = z.infer<typeof insertVendorWalletLedgerSchema>;
export type VendorWalletLedger = typeof vendorWalletLedger.$inferSelect;
export type InsertVendorStatement = z.infer<typeof insertVendorStatementSchema>;
export type VendorStatement = typeof vendorStatements.$inferSelect;
export type InsertVendorInvoice = z.infer<typeof insertVendorInvoiceSchema>;
export type VendorInvoice = typeof vendorInvoices.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLog.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;

// Login schema
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

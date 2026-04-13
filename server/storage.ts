import { 
  users, staff, centers, companies, companyEmails, serviceTypes, 
  workOrders, appointments, rescheduleRequests, jobTypes, vendors,
  typingJobs, typingJobResults, typingJobComments, files, messages, woNotes,
  vendorWalletLedger, vendorStatements, vendorInvoices, vendorApprovals, vendorNotifications, staffNotifications, appSettings, auditLog,
  woDocuments, documentRequirements, changeNotifications, loginAuditLog, passwordResetRequests,
  sheetMonths, apiKeys,
  medicalCases, appointmentCycles, medicalAppointmentEvents,
  biometricsCases, biometricsAppointmentCycles, biometricsAppointmentEvents,
  deletionRequests,
  attestationCategories, attestationServices, attestationServiceVariants, attestationServiceStepDefinitions,
  attestationServiceRequests, attestationSrSteps, attestationSrActivityLog,
  attestationInquiries, attestationInquiryQuotes,
  documentCustodyLog,
  documentCustodyRecords, documentCustodyHandoffs,
  magicLinkTokens,
  vendorUsers, crossPortalEvents,
  type User, type InsertUser, type Staff, type InsertStaff,
  type Center, type InsertCenter, type Company, type InsertCompany,
  type CompanyEmail, type InsertCompanyEmail, type ServiceType, type InsertServiceType,
  type WorkOrder, type InsertWorkOrder, type Appointment, type InsertAppointment,
  type RescheduleRequest, type InsertRescheduleRequest, type JobType, type InsertJobType,
  type Vendor, type InsertVendor, type TypingJob, type InsertTypingJob,
  type TypingJobResult, type InsertTypingJobResult, type TypingJobComment, type InsertTypingJobComment,
  type VendorWalletLedger, type InsertVendorWalletLedger, type AppSettings,
  type AuditLog, type InsertAuditLog, type InsertFile, type File,
  type WoDocument, type InsertWoDocument, type DocumentRequirement, type InsertDocumentRequirement,
  type WoNote, type InsertWoNote,
  type ChangeNotification, type InsertChangeNotification,
  type VendorApproval, type InsertVendorApproval,
  type VendorNotification, type InsertVendorNotification,
  type StaffNotification, type InsertStaffNotification,
  type LoginAuditLog, type InsertLoginAuditLog,
  type PasswordResetRequest, type InsertPasswordResetRequest,
  type SheetMonth,
  type ApiKey, type InsertApiKey,
  type MedicalCase, type InsertMedicalCase,
  type AppointmentCycle, type InsertAppointmentCycle,
  type MedicalEvent, type InsertMedicalEvent,
  type BiometricsCase, type InsertBiometricsCase,
  type BiometricsCycle, type InsertBiometricsCycle,
  type BiometricsEvent, type InsertBiometricsEvent,
  type DeletionRequest, type InsertDeletionRequest,
  type AttestationCategory, type InsertAttestationCategory,
  type AttestationService, type InsertAttestationService,
  type AttestationServiceVariant, type InsertAttestationServiceVariant,
  type AttestationServiceStepDefinition, type InsertAttestationServiceStepDefinition,
  type AttestationSr, type InsertAttestationSr,
  type AttestationSrStep, type InsertAttestationSrStep,
  type AttestationSrActivityLog, type InsertAttestationSrActivityLog,
  type AttestationInquiry, type InsertAttestationInquiry,
  type AttestationInquiryQuote, type InsertAttestationInquiryQuote,
  type DocumentCustodyLog, type InsertDocumentCustodyLog,
  type DocumentCustodyRecord, type InsertDocumentCustodyRecord,
  type DocumentCustodyHandoff, type InsertDocumentCustodyHandoff,
  type MagicLinkToken, type InsertMagicLinkToken,
  type VendorUser, type InsertVendorUser,
  type CrossPortalEvent, type InsertCrossPortalEvent,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, lt, sql, or, ilike, inArray, isNull, isNotNull } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  // Transaction wrapper
  transaction<T>(fn: (tx: typeof db) => Promise<T>): Promise<T>;

  // Users
  getUser(id: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  
  // Magic Link Tokens
  createMagicLinkToken(data: InsertMagicLinkToken): Promise<MagicLinkToken>;
  getMagicLinkTokenByHash(tokenHash: string): Promise<MagicLinkToken | undefined>;
  markMagicLinkTokenUsed(id: string): Promise<void>;
  consumeMagicLinkToken(id: string): Promise<boolean>;
  
  // Staff
  getStaff(): Promise<Staff[]>;
  getStaffById(id: string): Promise<Staff | undefined>;
  getStaffByIds(ids: string[]): Promise<Staff[]>;
  createStaff(data: InsertStaff): Promise<Staff>;
  updateStaff(id: string, data: Partial<InsertStaff>): Promise<Staff | undefined>;
  deleteStaff(id: string): Promise<boolean>;
  bulkDeleteStaff(ids: string[]): Promise<number>;
  
  // Centers
  getCenters(): Promise<Center[]>;
  getCenterById(id: string): Promise<Center | undefined>;
  getCentersByIds(ids: string[]): Promise<Center[]>;
  createCenter(data: InsertCenter): Promise<Center>;
  updateCenter(id: string, data: Partial<InsertCenter>): Promise<Center | undefined>;
  deleteCenter(id: string): Promise<boolean>;
  bulkDeleteCenters(ids: string[]): Promise<number>;
  
  // Companies
  getCompanies(): Promise<Company[]>;
  getCompaniesByIds(ids: string[]): Promise<Company[]>;
  getCompanyById(id: string): Promise<Company | undefined>;
  getCompanyByTradeLicenseNumber(tln: string): Promise<Company | undefined>;
  getCompanyByName(name: string): Promise<Company | undefined>;
  createCompany(data: InsertCompany): Promise<Company>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined>;
  getCompanyEmails(companyId: string): Promise<CompanyEmail[]>;
  getAllCompanyEmails(): Promise<CompanyEmail[]>;
  createCompanyEmail(data: InsertCompanyEmail): Promise<CompanyEmail>;
  updateCompanyEmail(id: string, data: Partial<InsertCompanyEmail>): Promise<CompanyEmail | undefined>;
  deleteCompanyEmail(id: string): Promise<boolean>;
  getWorkOrderCountsByCompany(): Promise<Record<string, number>>;
  
  // Service Types
  getServiceTypes(): Promise<ServiceType[]>;
  getServiceTypesByIds(ids: string[]): Promise<ServiceType[]>;
  getServiceTypeById(id: string): Promise<ServiceType | undefined>;
  createServiceType(data: InsertServiceType): Promise<ServiceType>;
  updateServiceType(id: string, data: Partial<InsertServiceType>): Promise<ServiceType | undefined>;
  deleteServiceType(id: string): Promise<boolean>;
  bulkCreateServiceTypes(names: string[]): Promise<ServiceType[]>;
  bulkDeleteServiceTypes(ids: string[]): Promise<number>;
  
  // Work Orders
  getWorkOrders(search?: string, status?: string): Promise<WorkOrder[]>;
  getRecentWorkOrders(limit: number): Promise<WorkOrder[]>;
  countDuplicateApplicants(applicantName: string): Promise<number>;
  getWorkOrderById(id: string): Promise<WorkOrder | undefined>;
  getWorkOrdersByIds(ids: string[]): Promise<WorkOrder[]>;
  getWorkOrderByWoNumber(woNumber: string): Promise<WorkOrder | undefined>;
  getWorkOrderByExternalId(externalId: string): Promise<WorkOrder | undefined>;
  getLastInboundWorkOrder(): Promise<WorkOrder | undefined>;
  createWorkOrder(data: InsertWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(id: string, data: Partial<InsertWorkOrder>): Promise<WorkOrder | undefined>;
  deleteWorkOrder(id: string): Promise<boolean>;
  getNextWoNumber(): Promise<string>;
  activateWorkOrder(id: string, isMinor: boolean): Promise<WorkOrder | undefined>;
  
  // Appointments
  getAppointmentById(id: string): Promise<Appointment | undefined>;
  getAppointmentsByWoId(woId: string): Promise<Appointment[]>;
  getAppointmentsByWoIds(woIds: string[]): Promise<Appointment[]>;
  getAppointmentByToken(token: string): Promise<Appointment | undefined>;
  createAppointment(data: InsertAppointment): Promise<Appointment>;
  createAppointmentWithWoUpdate(
    appointmentData: InsertAppointment,
    followUpAppointmentId: string | null,
    newWoStatus: string | null
  ): Promise<Appointment>;
  getTodayAppointments(): Promise<Appointment[]>;
  getUpcomingAppointments(days: number): Promise<Appointment[]>;
  getAllAppointments(): Promise<Appointment[]>;
  updateAppointment(id: string, data: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  getActiveAppointmentByWoAndType(woId: string, type: string): Promise<Appointment | undefined>;
  
  // Reschedule Requests
  createRescheduleRequest(data: InsertRescheduleRequest): Promise<RescheduleRequest>;
  
  // Job Types
  getJobTypes(): Promise<JobType[]>;
  getJobTypeById(id: string): Promise<JobType | undefined>;
  createJobType(data: InsertJobType): Promise<JobType>;
  updateJobType(id: string, data: Partial<InsertJobType>): Promise<JobType | undefined>;
  deleteJobType(id: string): Promise<boolean>;
  bulkDeleteJobTypes(ids: string[]): Promise<number>;
  
  // Vendors
  getVendors(): Promise<Vendor[]>;
  getVendorById(id: string): Promise<Vendor | undefined>;
  createVendor(data: InsertVendor): Promise<Vendor>;
  updateVendor(id: string, data: Partial<InsertVendor>): Promise<Vendor | undefined>;
  deleteVendor(id: string): Promise<boolean>;
  
  // Typing Jobs
  getTypingJobs(status?: string): Promise<TypingJob[]>;
  getTypingJobById(id: string): Promise<TypingJob | undefined>;
  getTypingJobsByWoId(woId: string): Promise<TypingJob[]>;
  getTypingJobsByWoIds(woIds: string[]): Promise<TypingJob[]>;
  getTypingJobsByVendorId(vendorId: string): Promise<TypingJob[]>;
  createTypingJob(data: InsertTypingJob): Promise<TypingJob>;
  updateTypingJob(id: string, data: Partial<InsertTypingJob>): Promise<TypingJob | undefined>;
  generateNextJobCode(category: "Medical" | "EID"): Promise<string>;
  
  // Typing Job Results
  getTypingJobResult(typingJobId: string): Promise<TypingJobResult | undefined>;
  getTypingJobResults(typingJobId: string): Promise<TypingJobResult | undefined>;
  createTypingJobResult(data: InsertTypingJobResult): Promise<TypingJobResult>;
  updateTypingJobResult(typingJobId: string, data: Partial<InsertTypingJobResult>): Promise<TypingJobResult | undefined>;
  
  // Typing Job Comments
  getTypingJobComments(typingJobId: string): Promise<TypingJobComment[]>;
  createTypingJobComment(data: InsertTypingJobComment): Promise<TypingJobComment>;
  
  // Files
  getFilesByRelated(relatedType: string, relatedId: string): Promise<File[]>;
  getAllFiles(): Promise<File[]>;
  getExpiringFiles(thresholdDate: Date): Promise<File[]>;
  createFile(data: InsertFile): Promise<File>;
  deleteFile(id: string): Promise<boolean>;
  
  // Vendor Wallet
  getWalletBalance(vendorId: string): Promise<number>;
  getWalletLedger(vendorId: string): Promise<VendorWalletLedger[]>;
  createWalletEntry(data: InsertVendorWalletLedger): Promise<VendorWalletLedger>;
  getMonthlyStats(vendorId: string): Promise<{ topups: number; spend: number }>;

  // Transactional: update typing job status + insert wallet debit atomically
  completeJobAndDebit(
    jobId: string,
    newJobStatus: string,
    walletEntry: InsertVendorWalletLedger
  ): Promise<{ job: TypingJob; ledgerEntry: VendorWalletLedger }>;

  // Transactional: update approval + update job status + insert wallet debit atomically
  approveJobAndDebit(
    approvalId: string,
    approvalUpdate: Partial<VendorApproval>,
    jobId: string,
    jobUpdate: Partial<InsertTypingJob>,
    walletEntry: InsertVendorWalletLedger | null
  ): Promise<{ approval: VendorApproval; job: TypingJob; ledgerEntry: VendorWalletLedger | null }>;
  
  // App Settings
  getAppSettings(): Promise<AppSettings | undefined>;
  updateAppSettings(data: Partial<AppSettings>): Promise<AppSettings | undefined>;
  
  // Work Order Notes
  getWoNotes(woId: string): Promise<WoNote[]>;
  createWoNote(data: InsertWoNote): Promise<WoNote>;
  deleteWoNote(id: string): Promise<boolean>;

  // Change Notifications
  createChangeNotification(data: InsertChangeNotification): Promise<ChangeNotification>;
  getChangeNotifications(): Promise<ChangeNotification[]>;
  getChangeNotification(id: string): Promise<ChangeNotification | undefined>;
  reviewChangeNotification(id: string, data: { status: string; reviewedBy: string }): Promise<ChangeNotification | undefined>;

  // Audit Log
  getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;
  getRecentAuditLogs(limit?: number): Promise<AuditLog[]>;
  getRecentAuditLogsByUser(userId: string, limit?: number): Promise<AuditLog[]>;
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;
  
  // Work Order Documents
  getWoDocuments(woId: string): Promise<WoDocument[]>;
  getAllWoDocuments(): Promise<WoDocument[]>;
  getExpiringWoDocuments(thresholdDate: Date): Promise<WoDocument[]>;
  getCompanyIdsWithExpiringDocs(thresholdDate: Date): Promise<Set<string>>;
  getWoPhotoMap(): Promise<Record<string, string>>;
  getUnsyncedWoDocuments(): Promise<WoDocument[]>;
  getWoDocumentById(id: string): Promise<WoDocument | undefined>;
  createWoDocument(data: InsertWoDocument): Promise<WoDocument>;
  updateWoDocument(id: string, data: Partial<InsertWoDocument>): Promise<WoDocument | undefined>;
  deleteWoDocument(id: string): Promise<boolean>;
  
  // Document Requirements
  getDocumentRequirements(): Promise<DocumentRequirement[]>;
  getDocumentRequirementsByCategory(category: string): Promise<DocumentRequirement[]>;
  createDocumentRequirement(data: InsertDocumentRequirement): Promise<DocumentRequirement>;
  seedDocumentRequirements(): Promise<{ added: number; skipped: number }>;
  updateServiceTypeCategories(): Promise<{ updated: number }>;
  
  // Auto-fill helpers
  getLastWorkOrderByCompany(companyId: string): Promise<WorkOrder | undefined>;
  
  // Vendor Approvals
  createVendorApproval(data: InsertVendorApproval): Promise<VendorApproval>;
  getVendorApprovalById(id: string): Promise<VendorApproval | undefined>;
  getVendorApprovalByJobId(typingJobId: string): Promise<VendorApproval | undefined>;
  getPendingVendorApprovals(): Promise<VendorApproval[]>;
  updateVendorApproval(id: string, data: Partial<VendorApproval>): Promise<VendorApproval>;
  
  // Vendor Notifications
  createVendorNotification(data: InsertVendorNotification): Promise<VendorNotification>;
  getVendorNotifications(vendorUserId: string, limit?: number): Promise<VendorNotification[]>;
  getUnreadNotificationCount(vendorUserId: string): Promise<number>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(vendorUserId: string): Promise<void>;

  // Staff Notifications
  createStaffNotification(data: InsertStaffNotification): Promise<StaffNotification>;
  getStaffNotifications(userId: string, limit?: number): Promise<StaffNotification[]>;
  getUnreadStaffNotificationCount(userId: string): Promise<number>;
  markStaffNotificationRead(id: string): Promise<void>;
  markAllStaffNotificationsRead(userId: string): Promise<void>;
  hasRecentNotification(type: string, relatedEntityId: string, withinHours: number, userId?: string): Promise<boolean>;

  // Login audit
  createLoginAuditEntry(data: InsertLoginAuditLog): Promise<LoginAuditLog>;
  getLoginAuditLog(limit?: number): Promise<LoginAuditLog[]>;
  getLoginAuditLogByUser(userId: string, limit?: number): Promise<LoginAuditLog[]>;

  // Password reset requests
  createPasswordResetRequest(data: InsertPasswordResetRequest): Promise<PasswordResetRequest>;
  getPasswordResetRequests(status?: string): Promise<PasswordResetRequest[]>;
  resolvePasswordResetRequest(id: string, resolvedBy: string): Promise<PasswordResetRequest>;

  // Deletion Requests
  createDeletionRequest(data: InsertDeletionRequest): Promise<DeletionRequest>;
  getDeletionRequests(status?: string): Promise<DeletionRequest[]>;
  getDeletionRequestsByUser(userId: string): Promise<DeletionRequest[]>;
  getDeletionRequestById(id: string): Promise<DeletionRequest | undefined>;
  updateDeletionRequest(id: string, data: Partial<DeletionRequest>): Promise<DeletionRequest | undefined>;
  getPendingDeletionRequestCount(): Promise<number>;

  // Vendor Users — vendor.vendor_users is the authoritative identity store for Vendor Portal logins
  getVendorUserByEmail(email: string): Promise<VendorUser | undefined>;
  getVendorUserById(id: string): Promise<VendorUser | undefined>;
  updateVendorUserLastLogin(id: string): Promise<void>;
  createVendorUser(data: InsertVendorUser): Promise<VendorUser>;
  updateVendorUser(id: string, data: Partial<VendorUser>): Promise<VendorUser | undefined>;
  getVendorUsers(activeOnly?: boolean): Promise<VendorUser[]>;

  // Cross-Portal Events — Vendor Portal publishes; Client Portal consumer reads and marks processed
  publishCrossPortalEvent(data: InsertCrossPortalEvent): Promise<CrossPortalEvent>;
  getPendingCrossPortalEvents(limit?: number): Promise<CrossPortalEvent[]>;
  getRecentCrossPortalEvents(limit?: number): Promise<CrossPortalEvent[]>;
  getFailedCrossPortalEventsCount(): Promise<number>;
  getFailedCrossPortalEvents(limit?: number): Promise<CrossPortalEvent[]>;
  updateCrossPortalEvent(id: string, data: Partial<CrossPortalEvent>): Promise<CrossPortalEvent | undefined>;
  getLastSuccessfulCrossPortalEvent(): Promise<CrossPortalEvent | undefined>;

  // Seed data
  seedData(): Promise<void>;
  
  // Seed real companies
  seedRealCompanies(): Promise<{ added: number; skipped: number }>;
  
  // Seed medical centers
  seedMedicalCenters(): Promise<{ added: number; skipped: number }>;
  
  // Seed service types
  seedServiceTypes(): Promise<{ added: number; skipped: number }>;
  seedVendorJobs(): Promise<{ added: number; skipped: number }>;
  seedStaff(): Promise<{ added: number; skipped: number }>;

  // Sheet Months
  getSheetMonths(): Promise<SheetMonth[]>;
  getSheetMonth(id: string): Promise<SheetMonth | undefined>;
  upsertSheetMonth(monthYear: string, data: { sheetUrl?: string }): Promise<SheetMonth>;
  closeSheetMonth(id: string): Promise<SheetMonth>;
  incrementSheetMonthImportedCount(id: string, count: number): Promise<SheetMonth>;
  touchSheetMonthRefresh(id: string): Promise<SheetMonth>;

  // API Keys
  getApiKeys(): Promise<ApiKey[]>;
  getApiKeyById(id: string): Promise<ApiKey | undefined>;
  getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined>;
  createApiKey(data: InsertApiKey): Promise<ApiKey>;
  updateApiKey(id: string, data: Partial<InsertApiKey>): Promise<ApiKey | undefined>;
  deleteApiKey(id: string): Promise<boolean>;
  touchApiKeyLastUsed(id: string): Promise<void>;

  // Medical Scheduling
  getMedicalCaseByWoId(woId: string): Promise<MedicalCase | undefined>;
  getMedicalCaseById(id: string): Promise<MedicalCase | undefined>;
  createMedicalCase(data: InsertMedicalCase): Promise<MedicalCase>;
  updateMedicalCase(id: string, data: Partial<InsertMedicalCase>): Promise<MedicalCase | undefined>;
  getCyclesByCase(caseId: string): Promise<AppointmentCycle[]>;
  getCycleById(id: string): Promise<AppointmentCycle | undefined>;
  createCycle(data: InsertAppointmentCycle): Promise<AppointmentCycle>;
  updateCycle(id: string, data: Partial<AppointmentCycle>): Promise<AppointmentCycle | undefined>;
  logMedicalEvent(data: InsertMedicalEvent): Promise<MedicalEvent>;
  getEventsByCycle(cycleId: string): Promise<MedicalEvent[]>;
  // Transactional: create new reschedule cycle + log both events atomically
  createRescheduleCycle(
    sourceCycleId: string,
    newCycleData: InsertAppointmentCycle,
    actorId: string,
    actorRole: string
  ): Promise<AppointmentCycle>;
  getCyclesDueForAwaitingMeeting(): Promise<AppointmentCycle[]>;
  getCyclesDueForNoShow(): Promise<AppointmentCycle[]>;
  getCyclesDueForResultDelayed(): Promise<AppointmentCycle[]>;
  getCyclesTodayByPro(proId: string): Promise<AppointmentCycle[]>;

  // EID Biometrics Scheduling
  getBiometricsCaseByWoId(woId: string): Promise<BiometricsCase | undefined>;
  getBiometricsCaseById(id: string): Promise<BiometricsCase | undefined>;
  createBiometricsCase(data: InsertBiometricsCase): Promise<BiometricsCase>;
  updateBiometricsCase(id: string, data: Partial<InsertBiometricsCase>): Promise<BiometricsCase | undefined>;
  getBiometricsCyclesByCase(caseId: string): Promise<BiometricsCycle[]>;
  getBiometricsCycleById(id: string): Promise<BiometricsCycle | undefined>;
  createBiometricsCycle(data: InsertBiometricsCycle): Promise<BiometricsCycle>;
  updateBiometricsCycle(id: string, data: Partial<BiometricsCycle>): Promise<BiometricsCycle | undefined>;
  logBiometricsEvent(data: InsertBiometricsEvent): Promise<BiometricsEvent>;
  getBiometricsEventsByCycle(cycleId: string): Promise<BiometricsEvent[]>;
  getBiometricsCyclesDueForAwaitingMeeting(): Promise<BiometricsCycle[]>;
  getBiometricsCyclesDueForNoShow(): Promise<BiometricsCycle[]>;

  // Attestation Categories
  getAttestationCategories(activeOnly?: boolean): Promise<AttestationCategory[]>;
  getAttestationCategoryById(id: string): Promise<AttestationCategory | undefined>;
  getAttestationCategoryByName(name: string): Promise<AttestationCategory | undefined>;
  createAttestationCategory(data: InsertAttestationCategory): Promise<AttestationCategory>;
  updateAttestationCategory(id: string, data: Partial<InsertAttestationCategory>): Promise<AttestationCategory | undefined>;
  deleteAttestationCategory(id: string): Promise<boolean>;
  renameAttestationCategoryInServices(oldName: string, newName: string): Promise<void>;
  seedAttestationCategories(): Promise<void>;

  // Attestation Services Catalog
  getAttestationServices(activeOnly?: boolean): Promise<AttestationService[]>;
  getAttestationServiceById(id: string): Promise<AttestationService | undefined>;
  getAttestationServiceByName(name: string): Promise<AttestationService | undefined>;
  createAttestationService(data: InsertAttestationService): Promise<AttestationService>;
  updateAttestationService(id: string, data: Partial<InsertAttestationService>): Promise<AttestationService | undefined>;
  getAttestationServiceVariants(serviceId: string): Promise<AttestationServiceVariant[]>;
  getAttestationServiceVariantById(id: string): Promise<AttestationServiceVariant | undefined>;
  createAttestationServiceVariant(data: InsertAttestationServiceVariant): Promise<AttestationServiceVariant>;
  updateAttestationServiceVariant(id: string, data: Partial<InsertAttestationServiceVariant>): Promise<AttestationServiceVariant | undefined>;
  deleteAttestationServiceVariant(id: string): Promise<boolean>;
  getAttestationServiceStepDefinitions(serviceId: string): Promise<AttestationServiceStepDefinition[]>;
  createAttestationServiceStepDefinition(data: InsertAttestationServiceStepDefinition): Promise<AttestationServiceStepDefinition>;
  updateAttestationServiceStepDefinition(id: string, data: Partial<InsertAttestationServiceStepDefinition>): Promise<AttestationServiceStepDefinition | undefined>;
  deleteAttestationServiceStepDefinition(id: string): Promise<boolean>;
  replaceAttestationServiceStepDefinitions(serviceId: string, steps: Omit<InsertAttestationServiceStepDefinition, 'serviceId'>[]): Promise<AttestationServiceStepDefinition[]>;

  // Attestation Service Requests
  getAttestationSrs(filters?: { assignedProId?: string; vendorId?: string; status?: string; companyId?: string }): Promise<AttestationSr[]>;
  getAttestationSrById(id: string): Promise<AttestationSr | undefined>;
  createAttestationSr(data: InsertAttestationSr): Promise<AttestationSr>;
  updateAttestationSr(id: string, data: Partial<AttestationSr>): Promise<AttestationSr | undefined>;
  getNextSrNumber(): Promise<string>;
  getAttestationSrSteps(srId: string): Promise<AttestationSrStep[]>;
  createAttestationSrStep(data: InsertAttestationSrStep): Promise<AttestationSrStep>;
  updateAttestationSrStep(id: string, data: Partial<InsertAttestationSrStep>): Promise<AttestationSrStep | undefined>;
  getAttestationSrActivityLog(srId: string): Promise<AttestationSrActivityLog[]>;
  createAttestationSrActivityLog(data: InsertAttestationSrActivityLog): Promise<AttestationSrActivityLog>;
  getAttestationVendors(): Promise<Vendor[]>;

  // Attestation Inquiries (inquiry/quote flow)
  createAttestationInquiry(data: InsertAttestationInquiry): Promise<AttestationInquiry>;
  getAttestationInquiries(filters?: { status?: string; companyId?: string; vendorId?: string }): Promise<AttestationInquiry[]>;
  getAttestationInquiryById(id: string): Promise<AttestationInquiry | undefined>;
  updateAttestationInquiry(id: string, data: Partial<AttestationInquiry>): Promise<AttestationInquiry | undefined>;

  // Attestation Inquiry Quotes
  createAttestationInquiryQuote(data: InsertAttestationInquiryQuote): Promise<AttestationInquiryQuote>;
  getLatestQuoteForInquiry(inquiryId: string): Promise<AttestationInquiryQuote | undefined>;
  getQuotesByInquiry(inquiryId: string): Promise<AttestationInquiryQuote[]>;
  getNextQuoteVersion(inquiryId: string): Promise<number>;

  // Document Custody Log
  getCustodyLogs(srId: string): Promise<DocumentCustodyLog[]>;
  createCustodyLog(data: InsertDocumentCustodyLog): Promise<DocumentCustodyLog>;
  createCustodyLogWithSrUpdate(data: InsertDocumentCustodyLog, srUpdate: Partial<AttestationSr>): Promise<{ log: DocumentCustodyLog; sr: AttestationSr }>;

  // Document Custody Records (new standalone lifecycle module)
  getDocumentCustodyRecords(filters?: { companyId?: string; woId?: string; custodyStage?: string; docCategory?: string; dateFrom?: Date; dateTo?: Date }): Promise<DocumentCustodyRecord[]>;
  getDocumentCustodyRecordById(id: string): Promise<DocumentCustodyRecord | undefined>;
  getDocumentCustodyRecordsByWoId(woId: string): Promise<DocumentCustodyRecord[]>;
  createDocumentCustodyRecord(data: InsertDocumentCustodyRecord): Promise<DocumentCustodyRecord>;
  updateDocumentCustodyRecord(id: string, data: Partial<InsertDocumentCustodyRecord>): Promise<DocumentCustodyRecord | undefined>;
  getNextCustodyRefNumber(): Promise<string>;
  getDocumentCustodyHandoffs(recordId: string): Promise<DocumentCustodyHandoff[]>;
  createDocumentCustodyHandoff(data: InsertDocumentCustodyHandoff): Promise<DocumentCustodyHandoff>;
  getDocumentCustodySummary(): Promise<{ withUs: number; withVendor: number; returnedThisMonth: number; overdue: number }>;
}

export class DatabaseStorage implements IStorage {
  // Transaction wrapper
  async transaction<T>(fn: (tx: typeof db) => Promise<T>): Promise<T> {
    return db.transaction(fn);
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  // Magic Link Tokens
  async createMagicLinkToken(data: InsertMagicLinkToken): Promise<MagicLinkToken> {
    const [token] = await db.insert(magicLinkTokens).values(data).returning();
    return token;
  }

  async getMagicLinkTokenByHash(tokenHash: string): Promise<MagicLinkToken | undefined> {
    const [token] = await db.select().from(magicLinkTokens).where(eq(magicLinkTokens.tokenHash, tokenHash));
    return token || undefined;
  }

  async markMagicLinkTokenUsed(id: string): Promise<void> {
    await db.update(magicLinkTokens).set({ usedAt: new Date() }).where(eq(magicLinkTokens.id, id));
  }

  async consumeMagicLinkToken(id: string): Promise<boolean> {
    const result = await db
      .update(magicLinkTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(magicLinkTokens.id, id), isNull(magicLinkTokens.usedAt)))
      .returning();
    return result.length > 0;
  }

  // Staff
  async getStaff(): Promise<Staff[]> {
    return db.select().from(staff).where(eq(staff.active, true));
  }

  async getStaffByIds(ids: string[]): Promise<Staff[]> {
    if (ids.length === 0) return [];
    return db.select().from(staff).where(inArray(staff.id, ids));
  }

  async getStaffById(id: string): Promise<Staff | undefined> {
    const [member] = await db.select().from(staff).where(eq(staff.id, id));
    return member || undefined;
  }

  async createStaff(data: InsertStaff): Promise<Staff> {
    const [member] = await db.insert(staff).values(data).returning();
    return member;
  }

  async updateStaff(id: string, data: Partial<InsertStaff>): Promise<Staff | undefined> {
    const [member] = await db.update(staff).set(data).where(eq(staff.id, id)).returning();
    return member || undefined;
  }

  async deleteStaff(id: string): Promise<boolean> {
    const existing = await this.getStaffById(id);
    if (!existing) return false;
    await db.update(appointments).set({ assignedStaffId: null }).where(eq(appointments.assignedStaffId, id));
    await db.update(companies).set({ rmStaffId: null }).where(eq(companies.rmStaffId, id));
    await db.update(companies).set({ assistStaffId: null }).where(eq(companies.assistStaffId, id));
    await db.delete(staff).where(eq(staff.id, id));
    return true;
  }

  async bulkDeleteStaff(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    await db.update(appointments).set({ assignedStaffId: null }).where(inArray(appointments.assignedStaffId, ids));
    await db.update(companies).set({ rmStaffId: null }).where(inArray(companies.rmStaffId, ids));
    await db.update(companies).set({ assistStaffId: null }).where(inArray(companies.assistStaffId, ids));
    const result = await db.delete(staff).where(inArray(staff.id, ids)).returning();
    return result.length;
  }

  // Centers
  async getCenters(): Promise<Center[]> {
    return db.select().from(centers).where(eq(centers.active, true));
  }

  async getCentersByIds(ids: string[]): Promise<Center[]> {
    if (ids.length === 0) return [];
    return db.select().from(centers).where(inArray(centers.id, ids));
  }

  async getCenterById(id: string): Promise<Center | undefined> {
    const [center] = await db.select().from(centers).where(eq(centers.id, id));
    return center || undefined;
  }

  async createCenter(data: InsertCenter): Promise<Center> {
    const [center] = await db.insert(centers).values(data as typeof centers.$inferInsert).returning();
    return center;
  }

  async updateCenter(id: string, data: Partial<InsertCenter>): Promise<Center | undefined> {
    const [center] = await db.update(centers).set(data as Partial<typeof centers.$inferInsert>).where(eq(centers.id, id)).returning();
    return center || undefined;
  }

  async deleteCenter(id: string): Promise<boolean> {
    const existing = await this.getCenterById(id);
    if (!existing) return false;
    await db.update(appointments).set({ centerId: null }).where(eq(appointments.centerId, id));
    await db.update(companies).set({ preferredMedicalCenterId: null }).where(eq(companies.preferredMedicalCenterId, id));
    await db.update(companies).set({ preferredMedicalCenterVipId: null }).where(eq(companies.preferredMedicalCenterVipId, id));
    await db.update(companies).set({ preferredBiometricsCenterId: null }).where(eq(companies.preferredBiometricsCenterId, id));
    await db.update(companies).set({ preferredBiometricsCenterVipId: null }).where(eq(companies.preferredBiometricsCenterVipId, id));
    await db.delete(centers).where(eq(centers.id, id));
    return true;
  }

  async bulkDeleteCenters(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    await db.update(appointments).set({ centerId: null }).where(inArray(appointments.centerId, ids));
    await db.update(companies).set({ preferredMedicalCenterId: null }).where(inArray(companies.preferredMedicalCenterId, ids));
    await db.update(companies).set({ preferredMedicalCenterVipId: null }).where(inArray(companies.preferredMedicalCenterVipId, ids));
    await db.update(companies).set({ preferredBiometricsCenterId: null }).where(inArray(companies.preferredBiometricsCenterId, ids));
    await db.update(companies).set({ preferredBiometricsCenterVipId: null }).where(inArray(companies.preferredBiometricsCenterVipId, ids));
    const result = await db.delete(centers).where(inArray(centers.id, ids)).returning();
    return result.length;
  }

  // Companies
  async getCompanies(): Promise<Company[]> {
    return db.select().from(companies).where(eq(companies.active, true));
  }

  async getCompaniesByIds(ids: string[]): Promise<Company[]> {
    if (ids.length === 0) return [];
    return db.select().from(companies).where(inArray(companies.id, ids));
  }

  async getCompanyById(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async getCompanyByTradeLicenseNumber(tln: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.tradeLicenseNumber, tln));
    return company || undefined;
  }

  async getCompanyByName(name: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies)
      .where(sql`lower(${companies.name}) = lower(${name})`);
    return company || undefined;
  }

  async createCompany(data: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(data).returning();
    return company;
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const [company] = await db.update(companies).set(data).where(eq(companies.id, id)).returning();
    return company || undefined;
  }

  async getCompanyEmails(companyId: string): Promise<CompanyEmail[]> {
    return db.select().from(companyEmails).where(eq(companyEmails.companyId, companyId));
  }

  async getAllCompanyEmails(): Promise<CompanyEmail[]> {
    return db.select().from(companyEmails);
  }

  async createCompanyEmail(data: InsertCompanyEmail): Promise<CompanyEmail> {
    const existing = await this.getCompanyEmails(data.companyId);
    if (existing.length >= 3) {
      throw new Error("Maximum 3 emails per company allowed");
    }
    const [email] = await db.insert(companyEmails).values(data).returning();
    return email;
  }

  async updateCompanyEmail(id: string, data: Partial<InsertCompanyEmail>): Promise<CompanyEmail | undefined> {
    const [updated] = await db.update(companyEmails).set(data).where(eq(companyEmails.id, id)).returning();
    return updated;
  }

  async deleteCompanyEmail(id: string): Promise<boolean> {
    const result = await db.delete(companyEmails).where(eq(companyEmails.id, id)).returning();
    return result.length > 0;
  }

  async getWorkOrderCountsByCompany(): Promise<Record<string, number>> {
    const results = await db
      .select({
        companyId: workOrders.companyId,
        count: sql<number>`count(*)::int`,
      })
      .from(workOrders)
      .groupBy(workOrders.companyId);
    
    const counts: Record<string, number> = {};
    results.forEach((r) => {
      counts[r.companyId] = r.count;
    });
    return counts;
  }

  // Service Types
  async getServiceTypes(): Promise<ServiceType[]> {
    return db.select().from(serviceTypes).where(eq(serviceTypes.active, true));
  }

  async createServiceType(data: InsertServiceType): Promise<ServiceType> {
    const [type] = await db.insert(serviceTypes).values(data).returning();
    return type;
  }

  async getServiceTypesByIds(ids: string[]): Promise<ServiceType[]> {
    if (ids.length === 0) return [];
    return db.select().from(serviceTypes).where(inArray(serviceTypes.id, ids));
  }

  async getServiceTypeById(id: string): Promise<ServiceType | undefined> {
    const [st] = await db.select().from(serviceTypes).where(eq(serviceTypes.id, id));
    return st || undefined;
  }

  async updateServiceType(id: string, data: Partial<InsertServiceType>): Promise<ServiceType | undefined> {
    const [st] = await db.update(serviceTypes).set(data).where(eq(serviceTypes.id, id)).returning();
    return st || undefined;
  }

  async deleteServiceType(id: string): Promise<boolean> {
    const existing = await this.getServiceTypeById(id);
    if (!existing) return false;
    await db.delete(serviceTypes).where(eq(serviceTypes.id, id));
    return true;
  }

  async bulkCreateServiceTypes(names: string[]): Promise<ServiceType[]> {
    if (names.length === 0) return [];
    const values = names.map(name => ({ name: name.trim() })).filter(v => v.name.length > 0);
    if (values.length === 0) return [];
    const result = await db.insert(serviceTypes).values(values).returning();
    return result;
  }

  async bulkDeleteServiceTypes(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await db.delete(serviceTypes).where(inArray(serviceTypes.id, ids)).returning();
    return result.length;
  }

  // Work Orders
  async getRecentWorkOrders(count: number): Promise<WorkOrder[]> {
    return db.select().from(workOrders).orderBy(desc(workOrders.createdAt)).limit(count);
  }

  async countDuplicateApplicants(applicantName: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(workOrders)
      .where(
        and(
          ilike(workOrders.applicantName, applicantName),
          sql`${workOrders.status} NOT IN ('Completed', 'Cancelled')`
        )
      );
    return Number(result[0]?.count || 0);
  }

  async getWorkOrders(search?: string, status?: string): Promise<WorkOrder[]> {
    let query = db.select().from(workOrders);
    
    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(workOrders.woNumber, `%${search}%`),
          ilike(workOrders.applicantName, `%${search}%`)
        )
      );
    }
    if (status && status !== "all") {
      conditions.push(eq(workOrders.status, status as typeof workOrders.status.enumValues[number]));
    }
    
    if (conditions.length > 0) {
      return db.select().from(workOrders).where(and(...conditions)).orderBy(desc(workOrders.createdAt));
    }
    
    return db.select().from(workOrders).orderBy(desc(workOrders.createdAt));
  }

  async getWorkOrderById(id: string): Promise<WorkOrder | undefined> {
    const [wo] = await db.select().from(workOrders).where(eq(workOrders.id, id));
    return wo || undefined;
  }

  async getWorkOrdersByIds(ids: string[]): Promise<WorkOrder[]> {
    if (ids.length === 0) return [];
    return db.select().from(workOrders).where(inArray(workOrders.id, ids));
  }

  async getWorkOrderByWoNumber(woNumber: string): Promise<WorkOrder | undefined> {
    const [wo] = await db.select().from(workOrders).where(eq(workOrders.woNumber, woNumber));
    return wo || undefined;
  }

  async getWorkOrderByExternalId(externalId: string): Promise<WorkOrder | undefined> {
    const [wo] = await db.select().from(workOrders).where(eq(workOrders.externalWoId, externalId));
    return wo || undefined;
  }

  async getLastInboundWorkOrder(): Promise<WorkOrder | undefined> {
    const [wo] = await db.select().from(workOrders)
      .where(isNotNull(workOrders.externalWoId))
      .orderBy(desc(workOrders.createdAt))
      .limit(1);
    return wo || undefined;
  }

  async createWorkOrder(data: InsertWorkOrder): Promise<WorkOrder> {
    const [wo] = await db.insert(workOrders).values(data).returning();
    return wo;
  }

  async updateWorkOrder(id: string, data: Partial<InsertWorkOrder>): Promise<WorkOrder | undefined> {
    const [wo] = await db.update(workOrders).set(data).where(eq(workOrders.id, id)).returning();
    return wo || undefined;
  }

  async deleteWorkOrder(id: string): Promise<boolean> {
    const existing = await this.getWorkOrderById(id);
    if (!existing) return false;
    
    const appts = await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.woId, id));
    const apptIds = appts.map(a => a.id);
    if (apptIds.length > 0) {
      await db.delete(rescheduleRequests).where(inArray(rescheduleRequests.appointmentId, apptIds));
      await db.delete(files).where(and(eq(files.relatedType, "Appointment"), inArray(files.relatedId, apptIds)));
    }

    const jobs = await db.select({ id: typingJobs.id }).from(typingJobs).where(eq(typingJobs.woId, id));
    const jobIds = jobs.map(j => j.id);
    if (jobIds.length > 0) {
      await db.delete(typingJobResults).where(inArray(typingJobResults.typingJobId, jobIds));
      await db.delete(typingJobComments).where(inArray(typingJobComments.typingJobId, jobIds));
      await db.delete(vendorApprovals).where(inArray(vendorApprovals.typingJobId, jobIds));
      await db.delete(vendorWalletLedger).where(inArray(vendorWalletLedger.typingJobId, jobIds));
      await db.delete(files).where(and(eq(files.relatedType, "TypingJob"), inArray(files.relatedId, jobIds)));
    }

    await db.delete(appointments).where(eq(appointments.woId, id));
    await db.delete(typingJobs).where(eq(typingJobs.woId, id));
    await db.delete(woDocuments).where(eq(woDocuments.woId, id));
    await db.delete(woNotes).where(eq(woNotes.woId, id));
    await db.delete(messages).where(eq(messages.woId, id));
    
    await db.delete(workOrders).where(eq(workOrders.id, id));
    return true;
  }

  async getNextWoNumber(): Promise<string> {
    const [result] = await db
      .select({ maxNum: sql<string>`MAX(SUBSTRING(wo_number FROM 2)::int)` })
      .from(workOrders);
    const nextNum = (parseInt(result?.maxNum || '0', 10) || 0) + 1;
    return `X${String(nextNum).padStart(5, '0')}`;
  }

  async activateWorkOrder(id: string, isMinor: boolean): Promise<WorkOrder | undefined> {
    const [wo] = await db
      .update(workOrders)
      .set({ isMinor })
      .where(eq(workOrders.id, id))
      .returning();
    return wo || undefined;
  }

  // Appointments
  async getAppointmentById(id: string): Promise<Appointment | undefined> {
    const [apt] = await db.select().from(appointments).where(eq(appointments.id, id));
    return apt || undefined;
  }

  async getAppointmentsByWoId(woId: string): Promise<Appointment[]> {
    return db.select().from(appointments).where(eq(appointments.woId, woId));
  }

  async getAppointmentsByWoIds(woIds: string[]): Promise<Appointment[]> {
    if (woIds.length === 0) return [];
    return db.select().from(appointments).where(inArray(appointments.woId, woIds));
  }

  async getAppointmentByToken(token: string): Promise<Appointment | undefined> {
    const [apt] = await db.select().from(appointments).where(eq(appointments.rescheduleToken, token));
    return apt || undefined;
  }

  async createAppointment(data: InsertAppointment): Promise<Appointment> {
    const [apt] = await db.insert(appointments).values(data).returning();
    return apt;
  }

  async createAppointmentWithWoUpdate(
    appointmentData: InsertAppointment,
    followUpAppointmentId: string | null,
    newWoStatus: string | null
  ): Promise<Appointment> {
    return db.transaction(async (tx) => {
      if (followUpAppointmentId) {
        await tx.update(appointments)
          .set({ status: "FollowUpScheduled" })
          .where(eq(appointments.id, followUpAppointmentId));
      }
      const [apt] = await tx.insert(appointments).values(appointmentData).returning();
      if (newWoStatus && apt.woId) {
        await tx.update(workOrders)
          .set({ status: newWoStatus as typeof workOrders.status.enumValues[number] })
          .where(eq(workOrders.id, apt.woId));
      }
      return apt;
    });
  }

  async getTodayAppointments(): Promise<Appointment[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return db.select().from(appointments).where(
      and(
        gte(appointments.datetime, today),
        lte(appointments.datetime, tomorrow),
        eq(appointments.status, "Scheduled")
      )
    );
  }

  async getUpcomingAppointments(days: number): Promise<Appointment[]> {
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endDate = new Date(tomorrow);
    endDate.setDate(endDate.getDate() + days);

    return db.select().from(appointments).where(
      and(
        gte(appointments.datetime, tomorrow),
        lt(appointments.datetime, endDate),
        eq(appointments.status, "Scheduled")
      )
    ).orderBy(appointments.datetime);
  }

  async getAllAppointments(): Promise<Appointment[]> {
    return db.select().from(appointments).orderBy(desc(appointments.datetime));
  }

  async updateAppointment(id: string, data: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const [apt] = await db.update(appointments).set(data).where(eq(appointments.id, id)).returning();
    return apt || undefined;
  }

  async getActiveAppointmentByWoAndType(woId: string, type: string): Promise<Appointment | undefined> {
    const [apt] = await db.select().from(appointments).where(
      and(
        eq(appointments.woId, woId),
        eq(appointments.type, type as typeof appointments.type.enumValues[number]),
        inArray(appointments.status, [
          "Scheduled",
          "Completed",
          "FollowUpRequired",
          "FollowUpScheduled",
          "FollowUpCompleted",
        ] as typeof appointments.status.enumValues[number][])
      )
    );
    return apt || undefined;
  }

  // Reschedule Requests
  async createRescheduleRequest(data: InsertRescheduleRequest): Promise<RescheduleRequest> {
    const [req] = await db.insert(rescheduleRequests).values(data).returning();
    return req;
  }

  // Job Types
  async getJobTypes(): Promise<JobType[]> {
    return db.select().from(jobTypes).where(eq(jobTypes.active, true));
  }

  async getJobTypeById(id: string): Promise<JobType | undefined> {
    const [jt] = await db.select().from(jobTypes).where(eq(jobTypes.id, id));
    return jt || undefined;
  }

  async createJobType(data: InsertJobType): Promise<JobType> {
    const [jt] = await db.insert(jobTypes).values(data).returning();
    return jt;
  }

  async updateJobType(id: string, data: Partial<InsertJobType>): Promise<JobType | undefined> {
    const [jt] = await db.update(jobTypes).set(data).where(eq(jobTypes.id, id)).returning();
    return jt || undefined;
  }

  async deleteJobType(id: string): Promise<boolean> {
    const existing = await this.getJobTypeById(id);
    if (!existing) return false;
    await db.delete(jobTypes).where(eq(jobTypes.id, id));
    return true;
  }

  async bulkDeleteJobTypes(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await db.delete(jobTypes).where(inArray(jobTypes.id, ids)).returning();
    return result.length;
  }

  // Vendors
  async getVendors(): Promise<Vendor[]> {
    return db.select().from(vendors).where(eq(vendors.active, true));
  }

  async getVendorById(id: string): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
    return vendor || undefined;
  }

  async createVendor(data: InsertVendor): Promise<Vendor> {
    const [vendor] = await db.insert(vendors).values(data).returning();
    return vendor;
  }

  async updateVendor(id: string, data: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const [vendor] = await db.update(vendors).set(data).where(eq(vendors.id, id)).returning();
    return vendor;
  }

  async deleteVendor(id: string): Promise<boolean> {
    await db.update(vendors).set({ active: false }).where(eq(vendors.id, id));
    return true;
  }

  // Typing Jobs
  async getTypingJobs(status?: string): Promise<TypingJob[]> {
    if (status && status !== "all") {
      return db.select().from(typingJobs).where(eq(typingJobs.status, status as typeof typingJobs.status.enumValues[number])).orderBy(desc(typingJobs.createdAt));
    }
    return db.select().from(typingJobs).orderBy(desc(typingJobs.createdAt));
  }

  async getTypingJobsByWoId(woId: string): Promise<TypingJob[]> {
    return db.select().from(typingJobs).where(eq(typingJobs.woId, woId));
  }

  async getTypingJobsByWoIds(woIds: string[]): Promise<TypingJob[]> {
    if (woIds.length === 0) return [];
    return db.select().from(typingJobs).where(inArray(typingJobs.woId, woIds));
  }

  async getTypingJobsByVendorId(vendorId: string): Promise<TypingJob[]> {
    return db.select().from(typingJobs).where(eq(typingJobs.vendorId, vendorId)).orderBy(desc(typingJobs.createdAt));
  }

  async createTypingJob(data: InsertTypingJob): Promise<TypingJob> {
    const [job] = await db.insert(typingJobs).values(data).returning();
    return job;
  }

  async getTypingJobById(id: string): Promise<TypingJob | undefined> {
    const [job] = await db.select().from(typingJobs).where(eq(typingJobs.id, id));
    return job;
  }

  async updateTypingJob(id: string, data: Partial<InsertTypingJob>): Promise<TypingJob | undefined> {
    const [job] = await db.update(typingJobs).set(data).where(eq(typingJobs.id, id)).returning();
    return job;
  }

  async generateNextJobCode(category: "Medical" | "EID"): Promise<string> {
    const prefix = category === "Medical" ? "M" : "E";
    const result = await db.select({ jobCode: typingJobs.jobCode })
      .from(typingJobs)
      .where(sql`${typingJobs.jobCode} LIKE ${prefix + '%'}`)
      .orderBy(desc(typingJobs.jobCode))
      .limit(1);
    
    if (result.length === 0 || !result[0].jobCode) {
      return `${prefix}00001`;
    }
    
    const lastCode = result[0].jobCode;
    const match = lastCode.match(/^[ME](\d+)$/);
    if (!match) {
      return `${prefix}00001`;
    }
    
    const nextNumber = parseInt(match[1], 10) + 1;
    return `${prefix}${nextNumber.toString().padStart(5, '0')}`;
  }

  // Typing Job Results
  async getTypingJobResult(typingJobId: string): Promise<TypingJobResult | undefined> {
    const [result] = await db.select().from(typingJobResults).where(eq(typingJobResults.typingJobId, typingJobId));
    return result;
  }

  async getTypingJobResults(typingJobId: string): Promise<TypingJobResult | undefined> {
    const [result] = await db.select().from(typingJobResults).where(eq(typingJobResults.typingJobId, typingJobId));
    return result;
  }

  async createTypingJobResult(data: InsertTypingJobResult): Promise<TypingJobResult> {
    const [result] = await db.insert(typingJobResults).values(data).returning();
    return result;
  }

  async updateTypingJobResult(typingJobId: string, data: Partial<InsertTypingJobResult>): Promise<TypingJobResult | undefined> {
    const [result] = await db.update(typingJobResults).set(data).where(eq(typingJobResults.typingJobId, typingJobId)).returning();
    return result;
  }

  // Typing Job Comments
  async getTypingJobComments(typingJobId: string): Promise<TypingJobComment[]> {
    return db.select().from(typingJobComments).where(eq(typingJobComments.typingJobId, typingJobId)).orderBy(desc(typingJobComments.createdAt));
  }

  async createTypingJobComment(data: InsertTypingJobComment): Promise<TypingJobComment> {
    const [comment] = await db.insert(typingJobComments).values(data).returning();
    return comment;
  }

  async getAllTypingJobComments(limit = 200): Promise<Array<TypingJobComment & { jobCode: string | null; woNumber: string | null; vendorId: string | null; vendorName: string | null; applicantName: string | null }>> {
    const rows = await db
      .select({
        id: typingJobComments.id,
        typingJobId: typingJobComments.typingJobId,
        authorType: typingJobComments.authorType,
        authorUserId: typingJobComments.authorUserId,
        message: typingJobComments.message,
        createdAt: typingJobComments.createdAt,
        jobCode: typingJobs.jobCode,
        vendorId: typingJobs.vendorId,
        vendorName: vendors.name,
        woNumber: workOrders.woNumber,
        applicantName: workOrders.applicantName,
      })
      .from(typingJobComments)
      .leftJoin(typingJobs, eq(typingJobComments.typingJobId, typingJobs.id))
      .leftJoin(vendors, eq(typingJobs.vendorId, vendors.id))
      .leftJoin(workOrders, eq(typingJobs.woId, workOrders.id))
      .orderBy(desc(typingJobComments.createdAt))
      .limit(limit);
    return rows;
  }

  async getUnreadVendorMessageCount(): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(typingJobComments)
      .where(eq(typingJobComments.authorType, "Vendor"));
    return Number(rows[0]?.count ?? 0);
  }

  // Files
  async getFilesByRelated(relatedType: string, relatedId: string): Promise<File[]> {
    return db.select().from(files).where(and(eq(files.relatedType, relatedType), eq(files.relatedId, relatedId))).orderBy(desc(files.createdAt));
  }

  async getAllFiles(): Promise<File[]> {
    return db.select().from(files).orderBy(desc(files.createdAt));
  }

  async getExpiringFiles(thresholdDate: Date): Promise<File[]> {
    return db.select().from(files)
      .where(and(isNotNull(files.expiresAt), lte(files.expiresAt, thresholdDate)))
      .orderBy(files.expiresAt);
  }

  async createFile(data: InsertFile): Promise<File> {
    const [file] = await db.insert(files).values(data).returning();
    return file;
  }

  async deleteFile(id: string): Promise<boolean> {
    const result = await db.delete(files).where(eq(files.id, id));
    return true;
  }

  // Vendor Wallet
  async getWalletBalance(vendorId: string): Promise<number> {
    const entries = await db.select().from(vendorWalletLedger).where(eq(vendorWalletLedger.vendorId, vendorId));
    return entries.reduce((balance, entry) => balance + entry.amount, 0);
  }

  async getWalletLedger(vendorId: string): Promise<VendorWalletLedger[]> {
    return db.select().from(vendorWalletLedger).where(eq(vendorWalletLedger.vendorId, vendorId)).orderBy(desc(vendorWalletLedger.createdAt));
  }

  async createWalletEntry(data: InsertVendorWalletLedger): Promise<VendorWalletLedger> {
    const [entry] = await db.insert(vendorWalletLedger).values(data).returning();
    return entry;
  }

  async getMonthlyStats(vendorId: string): Promise<{ topups: number; spend: number }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const entries = await db.select().from(vendorWalletLedger).where(
      and(
        eq(vendorWalletLedger.vendorId, vendorId),
        gte(vendorWalletLedger.createdAt, startOfMonth)
      )
    );
    
    let topups = 0;
    let spend = 0;
    
    for (const entry of entries) {
      if (entry.entryType === "Topup") {
        topups += entry.amount;
      } else if (entry.entryType === "Debit") {
        spend += entry.amount;
      }
    }
    
    return { topups, spend };
  }

  async completeJobAndDebit(
    jobId: string,
    newJobStatus: string,
    walletEntry: InsertVendorWalletLedger
  ): Promise<{ job: TypingJob; ledgerEntry: VendorWalletLedger }> {
    return db.transaction(async (tx) => {
      const [job] = await tx.update(typingJobs)
        .set({ status: newJobStatus as typeof typingJobs.status.enumValues[number] })
        .where(eq(typingJobs.id, jobId))
        .returning();
      if (!job) throw new Error(`Typing job ${jobId} not found during completion`);

      // Re-check balance inside the transaction to close the TOCTOU window
      const entries = await tx.select().from(vendorWalletLedger).where(eq(vendorWalletLedger.vendorId, walletEntry.vendorId));
      const currentBalance = entries.reduce((sum, e) => sum + e.amount, 0);
      const debitNeeded = Math.abs(walletEntry.amount);
      if (currentBalance < debitNeeded) {
        throw new Error(`Insufficient wallet balance: current balance is AED ${currentBalance}, required AED ${debitNeeded}`);
      }

      const [ledgerEntry] = await tx.insert(vendorWalletLedger).values(walletEntry).returning();
      return { job, ledgerEntry };
    });
  }

  async approveJobAndDebit(
    approvalId: string,
    approvalUpdate: Partial<VendorApproval>,
    jobId: string,
    jobUpdate: Partial<InsertTypingJob>,
    walletEntry: InsertVendorWalletLedger | null
  ): Promise<{ approval: VendorApproval; job: TypingJob; ledgerEntry: VendorWalletLedger | null }> {
    return db.transaction(async (tx) => {
      const [approval] = await tx.update(vendorApprovals)
        .set(approvalUpdate)
        .where(eq(vendorApprovals.id, approvalId))
        .returning();
      if (!approval) throw new Error(`Vendor approval ${approvalId} not found`);

      const [job] = await tx.update(typingJobs)
        .set(jobUpdate)
        .where(eq(typingJobs.id, jobId))
        .returning();
      if (!job) throw new Error(`Typing job ${jobId} not found`);

      let ledgerEntry: VendorWalletLedger | null = null;
      if (walletEntry) {
        // Re-check balance inside the transaction to close the TOCTOU window
        const entries = await tx.select().from(vendorWalletLedger).where(eq(vendorWalletLedger.vendorId, walletEntry.vendorId));
        const currentBalance = entries.reduce((sum, e) => sum + e.amount, 0);
        const debitNeeded = Math.abs(walletEntry.amount);
        if (currentBalance < debitNeeded) {
          throw new Error(`Insufficient wallet balance: current balance is AED ${currentBalance}, required AED ${debitNeeded}`);
        }
        const [entry] = await tx.insert(vendorWalletLedger).values(walletEntry).returning();
        ledgerEntry = entry;
      }

      return { approval, job, ledgerEntry };
    });
  }

  // App Settings
  async getAppSettings(): Promise<AppSettings | undefined> {
    const [settings] = await db.select().from(appSettings);
    return settings || undefined;
  }

  async updateAppSettings(data: Partial<AppSettings>): Promise<AppSettings | undefined> {
    const existing = await this.getAppSettings();
    if (existing) {
      const [updated] = await db.update(appSettings).set(data).where(eq(appSettings.id, existing.id)).returning();
      return updated || undefined;
    } else {
      const [created] = await db.insert(appSettings).values(data as typeof appSettings.$inferInsert).returning();
      return created || undefined;
    }
  }

  // Seed data (only in development) - minimal bootstrap only
  async createVendorApproval(data: InsertVendorApproval): Promise<VendorApproval> {
    const [result] = await db.insert(vendorApprovals).values(data).returning();
    return result;
  }

  async getVendorApprovalById(id: string): Promise<VendorApproval | undefined> {
    const [result] = await db.select().from(vendorApprovals).where(eq(vendorApprovals.id, id));
    return result;
  }

  async getVendorApprovalByJobId(typingJobId: string): Promise<VendorApproval | undefined> {
    const [result] = await db.select().from(vendorApprovals).where(eq(vendorApprovals.typingJobId, typingJobId));
    return result;
  }

  async getPendingVendorApprovals(): Promise<VendorApproval[]> {
    return db.select().from(vendorApprovals).where(eq(vendorApprovals.status, "Pending")).orderBy(vendorApprovals.createdAt);
  }

  async updateVendorApproval(id: string, data: Partial<VendorApproval>): Promise<VendorApproval> {
    const [result] = await db.update(vendorApprovals).set(data).where(eq(vendorApprovals.id, id)).returning();
    return result;
  }

  async seedData(): Promise<void> {
    // Only seed in development
    if (process.env.NODE_ENV === 'production') return;
    
    // Always ensure app settings exist (required for email configuration)
    const existingSettings = await db.select().from(appSettings);
    if (existingSettings.length === 0) {
      await db.insert(appSettings).values({
        fromEmail: "notifications@procompany.ae",
        fromName: "The P.R.O. Company",
        replyToEmail: "operations@procompany.ae",
        alwaysCc: [],
        lowBalanceThreshold: 1000,
      });
      console.log("App settings created!");
    }

    // Check if admin user already exists
    const existingUsers = await db.select().from(users).where(eq(users.role, "Admin"));
    if (existingUsers.length > 0) return;

    // Seed admin user (required for login)
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await db.insert(users).values({
      name: "Admin",
      email: "admin@procompany.ae",
      passwordHash: hashedPassword,
      role: "Admin",
    });

    console.log("Minimal bootstrap complete - admin user created!");
  }

  // Seed real companies from the provided spreadsheet data
  async seedRealCompanies(): Promise<{ added: number; skipped: number }> {
    // All company data from the spreadsheet
    const realCompanies = [
      // DUBAI MAINLAND COMPANIES
      { name: "LUME COLLECTIVE TECHNOLOGY LLC", clientCoordinator: { name: "Karishma", email: "hr@innovixtech.io", mobile: "" }, clientManager: { name: "Jania", email: "hr.manager@innovixtech.io", mobile: "" } },
      { name: "ROSE IDEAS TECH CO. L.L.C", clientCoordinator: { name: "Karishma", email: "hr@innovixtech.io", mobile: "" }, clientManager: { name: "Jania", email: "hr.manager@innovixtech.io", mobile: "" } },
      { name: "PETALS PAYMENT TECHNOLOGY CO L.L.C", clientCoordinator: { name: "Karishma", email: "hr@innovixtech.io", mobile: "" }, clientManager: { name: "Jania", email: "hr.manager@innovixtech.io", mobile: "" } },
      { name: "NITYO INFOTECH IT SERVICES EST.", clientCoordinator: { name: "Anand", email: "", mobile: "" }, clientManager: { name: "Anand", email: "", mobile: "" } },
      { name: "ASRL GENERAL TRADING L.L.C", clientCoordinator: { name: "Suwaid", email: "", mobile: "" }, clientManager: { name: "Suwaid", email: "", mobile: "" } },
      { name: "TRIP TO GO TOURISM L.L.C", clientCoordinator: { name: "Haris", email: "", mobile: "" }, clientManager: { name: "Haris", email: "", mobile: "" } },
      { name: "EASTERN FORTUNE INVESTMENTS L.L.C", clientCoordinator: { name: "HR", email: "hr@eastf.com", mobile: "" }, clientManager: { name: "Jomelyn Hernandez", email: "jomelyn@eastf.com", mobile: "" } },
      { name: "EASTERN WEALTH INVESTMENTS L.L.C", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" } },
      { name: "FIRST LUXURY FACILITIES MANAGEMENT SERVICES CO L.L.C", clientCoordinator: { name: "Jomelyn Hernandez", email: "jomelyn@eastf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" } },
      { name: "PAY TEN GLOBAL TECHNOLOGY L.L.C", clientCoordinator: { name: "Meghna", email: "meghna.santhosh@pay10.com", mobile: "" }, clientManager: { name: "Tasneem", email: "tasneem.lokhandwala@pay10.com", mobile: "" } },
      { name: "PAY TEN PAYMENT SERVICES PROVIDER L.L.C", clientCoordinator: { name: "Fatima", email: "fatma.alblooshi@pay10.ae", mobile: "" }, clientManager: { name: "Merna", email: "merna.mohamed@pay10.ae", mobile: "" } },
      { name: "POS10 TECHNOLOGIES L.L.C", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" } },
      { name: "FIRST EDGE TECHNOLOGIES CO LLC", clientCoordinator: { name: "Jomelyn Hernandez", email: "jomelyn@eastf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" } },
      { name: "FIRST PLUS PROPERTY CARE CO LLC", clientCoordinator: { name: "Jomelyn Hernandez", email: "jomelyn@eastf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" } },
      { name: "NEXTGEN TECHNOLOGIES EST", clientCoordinator: { name: "Jayaraj", email: "", mobile: "" }, clientManager: { name: "Jayaraj", email: "", mobile: "" } },
      { name: "BAITH DAHABI PROJECT MANAGEMENT SERVICES", clientCoordinator: { name: "", email: "", mobile: "" }, clientManager: { name: "", email: "", mobile: "" } },
      { name: "SKYGEN TRADING L.L.C - MAIN (MARINA)", clientCoordinator: { name: "Info", email: "info@skygentrading.com", mobile: "" }, clientManager: { name: "Sagar", email: "info@skygentrading.com", mobile: "" } },
      { name: "SKYGEN TRADING L.L.C - BRANCH 1 (JUMEIRA)", clientCoordinator: { name: "Info", email: "info@skygentrading.com", mobile: "" }, clientManager: { name: "Sagar", email: "info@skygentrading.com", mobile: "" } },
      { name: "SKYGEN TRADING L.L.C - BRANCH 2 (BLUEWATERS)", clientCoordinator: { name: "Info", email: "info@skygentrading.com", mobile: "" }, clientManager: { name: "Sagar", email: "info@skygentrading.com", mobile: "" } },
      { name: "CASPERWASP TECHNOLOGIES CO. L.L.C", clientCoordinator: { name: "Gopal", email: "", mobile: "" }, clientManager: { name: "Gopal", email: "", mobile: "" } },
      { name: "DZONE TRADING LLC", clientCoordinator: { name: "Rahul", email: "", mobile: "" }, clientManager: { name: "Rahul", email: "", mobile: "" } },
      { name: "DOLPHIN BLENDS PERFUMES & COSMETICS TRADING CO. L.L.C", clientCoordinator: { name: "Sajila", email: "", mobile: "" }, clientManager: { name: "Najeeb", email: "", mobile: "" } },
      { name: "MEKINA TECHNICAL SERVICES", clientCoordinator: { name: "Ajmal", email: "", mobile: "" }, clientManager: { name: "Ajmal", email: "", mobile: "" } },
      { name: "MUNTAJ TAHRIR PROJECT MANAGEMENT SERVICES EST", clientCoordinator: { name: "Shibeesh", email: "", mobile: "" }, clientManager: { name: "Deepthy", email: "", mobile: "" } },
      { name: "LORDE EVENT MANAGEMENT CO. L.L.C", clientCoordinator: { name: "Anand", email: "", mobile: "" }, clientManager: { name: "Anand", email: "", mobile: "" } },
      { name: "W C H E M DISINFECTION & STERILIZATION L.L.C", clientCoordinator: { name: "Vigi", email: "vigi@wchem.com", mobile: "" }, clientManager: { name: "Deena", email: "deenanaidu@yahoo.com", mobile: "" } },
      { name: "AUTO SKY CAR SERVICE LLC", clientCoordinator: { name: "Salsabeel", email: "", mobile: "" }, clientManager: { name: "Salsabeel", email: "", mobile: "" } },
      { name: "COSMOLINK TRADING LLC", clientCoordinator: { name: "Mithun", email: "", mobile: "" }, clientManager: { name: "Mithun", email: "", mobile: "" } },
      { name: "MISS OCD TECHNICAL SERVICES CO LLC SOC", clientCoordinator: { name: "Mandana Kareemi", email: "", mobile: "" }, clientManager: { name: "Mandana Kareemi", email: "", mobile: "" } },
      { name: "POS10 GLOBAL INVESTMENTS L.L.C", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" } },
      { name: "BLUME A I ARTIFICIAL INTELLIGENCE CONSULTANCIES L.L.C", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" } },
      { name: "ALPHA EDGE SECURITY CONSULTANCIES LLC S.O.C", clientCoordinator: { name: "Vibhor", email: "vibhor@eastf.com", mobile: "" }, clientManager: { name: "VB", email: "", mobile: "" } },
      { name: "COLIFE VACATION HOMES L.L.C", clientCoordinator: { name: "General", email: "lawyer@colife.ae", mobile: "" }, clientManager: { name: "Artem", email: "lawyer@colife.ae", mobile: "" } },
      { name: "COLIFE REAL ESTATE L.L.C", clientCoordinator: { name: "General", email: "lawyer@colife.ae", mobile: "" }, clientManager: { name: "Artem", email: "lawyer@colife.ae", mobile: "" } },
      { name: "RAGHAV MANAGEMENT SERVICES EST", clientCoordinator: { name: "Anand", email: "", mobile: "" }, clientManager: { name: "Anand", email: "", mobile: "" } },
      { name: "AYUR MINAR KOTTAKKAL AYURVEDIC MEDICAL CENTER", clientCoordinator: { name: "Jinu", email: "", mobile: "" }, clientManager: { name: "Sebastian", email: "", mobile: "" } },
      // COMPANIES THAT ARE NOT DUBAI MAINLAND
      { name: "QUANTRA GLOBAL FZE LLC (SPC)", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" } },
      { name: "EASTERN COLLECTIBLE FZCO (IFZA)", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" } },
      { name: "EASTERN WEALTH FOUNDATION - ABUDHABI", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" } },
      { name: "THE CREATIVE CLUB FZE", clientCoordinator: { name: "Jomelyn", email: "jomelyn@eastf.com", mobile: "" }, clientManager: { name: "Slim", email: "jomelyn@eastf.com", mobile: "" } },
      { name: "EASTERN FORTUNE LIMITED (RAK)", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" } },
      { name: "KSKA INVESTMENTS L.L.C S.O.C", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" } },
    ];

    let added = 0;
    let skipped = 0;

    for (const companyData of realCompanies) {
      // Check if company already exists by name
      const existing = await db.select().from(companies).where(eq(companies.name, companyData.name));
      
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Insert the company
      await db.insert(companies).values({
        name: companyData.name,
        clientCoordinator: companyData.clientCoordinator.name ? companyData.clientCoordinator : null,
        clientManager: companyData.clientManager.name ? companyData.clientManager : null,
      });
      added++;
    }

    console.log(`Real companies seeded: ${added} added, ${skipped} skipped`);
    return { added, skipped };
  }

  // Seed medical centers with complete data
  async seedMedicalCenters(): Promise<{ added: number; skipped: number }> {
    const medicalCentersData = [
      // DHA Centers - Normal Tier
      {
        name: "Karama Medical Fitness Center",
        type: "Medical" as const,
        authority: "DHA" as const,
        tier: "Normal" as const,
        address: "Fajer Building, 25, 24 Street, Al Karama, Bur Dubai, Dubai",
        area: "Al Karama",
        googleMapsUrl: "https://maps.google.com/?q=Al+Karama+Medical+Fitness+Center+Dubai",
        timingText: "Mon-Thu: 7AM-10PM, Fri: 7:30AM-12PM, Sat-Sun: Closed",
        timings: {
          monday: { open: "07:00", close: "22:00" },
          tuesday: { open: "07:00", close: "22:00" },
          wednesday: { open: "07:00", close: "22:00" },
          thursday: { open: "07:00", close: "22:00" },
          friday: { open: "07:30", close: "12:00" },
          saturday: { closed: true },
          sunday: { closed: true },
        },
      },
      {
        name: "Al Quoz Mall Medical Fitness Center",
        type: "Medical" as const,
        authority: "DHA" as const,
        tier: "Normal" as const,
        address: "Al Quoz Mall, Ground Floor, 17B St - Al Quoz Industrial Area 3, Dubai",
        area: "Al Quoz",
        googleMapsUrl: "https://goo.gl/maps/46yFpqctmD3A71QT7",
        timingText: "Mon-Thu: 7AM-9:30PM, Fri: 7AM-11:30AM & 2PM-9:30PM, Sat: 7AM-9:30PM, Sun: 7AM-3:30PM",
        timings: {
          monday: { open: "07:00", close: "21:30" },
          tuesday: { open: "07:00", close: "21:30" },
          wednesday: { open: "07:00", close: "21:30" },
          thursday: { open: "07:00", close: "21:30" },
          friday: { open: "07:00", close: "21:30", breakStart: "11:30", breakEnd: "14:00" },
          saturday: { open: "07:00", close: "21:30" },
          sunday: { open: "07:00", close: "15:30" },
        },
      },
      {
        name: "Al Nahda Medical Fitness Center",
        type: "Medical" as const,
        authority: "DHA" as const,
        tier: "Normal" as const,
        address: "Al Nahda Center, 99, 10 Street, Ground Floor, Al Qusais, Deira, Dubai",
        area: "Al Nahda",
        googleMapsUrl: "https://maps.google.com/?q=Al+Nahda+Medical+Fitness+Center+Dubai",
        timingText: "Mon-Thu: 7AM-9:30PM, Fri: 7:30-11:30AM & 2PM-9:30PM, Sat: 7AM-9:30PM, Sun: 7AM-2:30PM",
        timings: {
          monday: { open: "07:00", close: "21:30" },
          tuesday: { open: "07:00", close: "21:30" },
          wednesday: { open: "07:00", close: "21:30" },
          thursday: { open: "07:00", close: "21:30" },
          friday: { open: "07:30", close: "21:30", breakStart: "11:30", breakEnd: "14:00" },
          saturday: { open: "07:00", close: "21:30" },
          sunday: { open: "07:00", close: "14:30" },
        },
      },
      {
        name: "Rashidiya Medical Fitness Center",
        type: "Medical" as const,
        authority: "DHA" as const,
        tier: "Normal" as const,
        address: "Building 25/1, 33A Street, Al Rashidiya, Deira, Dubai",
        area: "Al Rashidiya",
        googleMapsUrl: "https://maps.google.com/?q=Al+Rashidiya+Medical+Fitness+Center+Dubai",
        timingText: "Mon-Thu: 7AM-10PM, Fri: 7:30AM-12PM, Sat-Sun: Closed",
        timings: {
          monday: { open: "07:00", close: "22:00" },
          tuesday: { open: "07:00", close: "22:00" },
          wednesday: { open: "07:00", close: "22:00" },
          thursday: { open: "07:00", close: "22:00" },
          friday: { open: "07:30", close: "12:00" },
          saturday: { closed: true },
          sunday: { closed: true },
        },
      },
      // DHA Centers - VIP Tier
      {
        name: "City Walk Medical Fitness Center (Smart Salem)",
        type: "Medical" as const,
        authority: "DHA" as const,
        tier: "VIP" as const,
        address: "Building 23B, City Walk, 23B, Al Nuzha Street, Dubai",
        area: "City Walk",
        googleMapsUrl: "https://g.co/kgs/GhBpkcD",
        timingText: "Mon-Thu: 7AM-10PM, Fri: 7:30AM-12PM & 2PM-10PM, Sat: 7AM-10PM, Sun: Closed",
        timings: {
          monday: { open: "07:00", close: "22:00" },
          tuesday: { open: "07:00", close: "22:00" },
          wednesday: { open: "07:00", close: "22:00" },
          thursday: { open: "07:00", close: "22:00" },
          friday: { open: "07:30", close: "22:00", breakStart: "12:00", breakEnd: "14:00" },
          saturday: { open: "07:00", close: "22:00" },
          sunday: { closed: true },
        },
      },
      {
        name: "Index Medical Fitness Center (DIFC) - Smart Salem",
        type: "Medical" as const,
        authority: "DHA" as const,
        tier: "VIP" as const,
        address: "Index Tower, Happiness Street, Trade Centre - DIFC, Dubai",
        area: "DIFC",
        googleMapsUrl: "https://maps.google.com/?q=Smart+Salem+Index+Tower+DIFC+Dubai",
        timingText: "Mon-Thu: 7AM-8PM, Fri: 7:30AM-12PM, Sat-Sun: Closed",
        timings: {
          monday: { open: "07:00", close: "20:00" },
          tuesday: { open: "07:00", close: "20:00" },
          wednesday: { open: "07:00", close: "20:00" },
          thursday: { open: "07:00", close: "20:00" },
          friday: { open: "07:30", close: "12:00" },
          saturday: { closed: true },
          sunday: { closed: true },
        },
      },
      {
        name: "Dubai Knowledge Park - Smart Salem",
        type: "Medical" as const,
        authority: "DHA" as const,
        tier: "VIP" as const,
        address: "G09A, Ground Floor, Block No. 12, Dubai Knowledge Park (Al Sufouh 2), Dubai",
        area: "Dubai Knowledge Park",
        googleMapsUrl: "https://goo.gl/maps/pV5Z2VH8kQZcNwpL6",
        timingText: "Tue-Thu: 7AM-9:30PM, Fri: 7:30-11:30AM & 4PM-8PM, Sun: 7AM-2:30PM, Mon/Sat: Closed",
        timings: {
          monday: { closed: true },
          tuesday: { open: "07:00", close: "21:30" },
          wednesday: { open: "07:00", close: "21:30" },
          thursday: { open: "07:00", close: "21:30" },
          friday: { open: "07:30", close: "20:00", breakStart: "11:30", breakEnd: "16:00" },
          saturday: { closed: true },
          sunday: { open: "07:00", close: "14:30" },
        },
      },
      // EHS Centers - Normal Tier
      {
        name: "Salah Al Din Medical Examination Center",
        type: "Medical" as const,
        authority: "EHS" as const,
        tier: "Normal" as const,
        address: "173, Salah Al Din Road, Deira (Muteena), Dubai",
        area: "Deira",
        googleMapsUrl: "https://maps.google.com/?q=Salah+Al+Din+Medical+Examination+Center+Dubai",
        timingText: "Mon-Fri: 7:30AM-8:15PM, Sat: 8AM-5:15PM, Sun: Closed",
        timings: {
          monday: { open: "07:30", close: "20:15" },
          tuesday: { open: "07:30", close: "20:15" },
          wednesday: { open: "07:30", close: "20:15" },
          thursday: { open: "07:30", close: "20:15" },
          friday: { open: "07:30", close: "20:15" },
          saturday: { open: "08:00", close: "17:15" },
          sunday: { closed: true },
        },
      },
      {
        name: "Al Nuaimiya Medical Examination Center",
        type: "Medical" as const,
        authority: "EHS" as const,
        tier: "Normal" as const,
        address: "50, Kuwait Street, Al Nuaimeya 2, City Center Sector, Ajman",
        area: "Ajman",
        googleMapsUrl: "https://maps.google.com/?q=Al+Nuaimiya+Medical+Examination+Center+Ajman",
        timingText: "Sat-Thu: 8AM-8PM, Fri: 8AM-12PM & 2:30PM-8PM, Sun: Closed",
        timings: {
          monday: { open: "08:00", close: "20:00" },
          tuesday: { open: "08:00", close: "20:00" },
          wednesday: { open: "08:00", close: "20:00" },
          thursday: { open: "08:00", close: "20:00" },
          friday: { open: "08:00", close: "20:00", breakStart: "12:00", breakEnd: "14:30" },
          saturday: { open: "08:00", close: "20:00" },
          sunday: { closed: true },
        },
      },
      {
        name: "RAKEZ Medical Fitness Centre",
        type: "Medical" as const,
        authority: "EHS" as const,
        tier: "Normal" as const,
        address: "RAKEZ Service Centre, Amenity Centre, Al Jazeera Al Hamra Industrial Area, Ras Al Khaimah",
        area: "Ras Al Khaimah",
        googleMapsUrl: "https://maps.google.com/?q=RAKEZ+Medical+Fitness+Centre+Ras+Al+Khaimah",
        timingText: "Mon-Fri: 8AM-4PM, Sat: 9AM-2PM, Sun: Closed",
        timings: {
          monday: { open: "08:00", close: "16:00" },
          tuesday: { open: "08:00", close: "16:00" },
          wednesday: { open: "08:00", close: "16:00" },
          thursday: { open: "08:00", close: "16:00" },
          friday: { open: "08:00", close: "16:00" },
          saturday: { open: "09:00", close: "14:00" },
          sunday: { closed: true },
        },
      },
    ];

    let added = 0;
    let skipped = 0;

    for (const centerData of medicalCentersData) {
      // Check if center already exists by name
      const existing = await db.select().from(centers).where(eq(centers.name, centerData.name));
      
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Insert the center
      await db.insert(centers).values(centerData);
      added++;
    }

    console.log(`Medical centers seeded: ${added} added, ${skipped} skipped`);
    return { added, skipped };
  }

  // Helper to determine category from service type name
  private getCategoryFromName(name: string): "NewVisaInside" | "NewVisaOutside" | "GoldenVisa" | "RenewVisa" | "NewbornDependent" | "LostReplaceEid" | null {
    const upperName = name.toUpperCase();
    
    if (upperName.includes("GOLDEN VISA")) return "GoldenVisa";
    if (upperName.includes("RENEW")) return "RenewVisa";
    if (upperName.includes("NEW BORN") || upperName.includes("NEWBORN")) return "NewbornDependent";
    if (upperName.includes("LOST") || upperName.includes("REPLACE")) return "LostReplaceEid";
    if (upperName.includes("- INSIDE") || upperName.includes("-INSIDE")) return "NewVisaInside";
    if (upperName.includes("- OUTSIDE") || upperName.includes("-OUTSIDE")) return "NewVisaOutside";
    // Default new visas without location specified
    if (upperName.includes("NEW ") && !upperName.includes("RENEW")) return "NewVisaOutside";
    
    return null;
  }

  async seedServiceTypes(): Promise<{ added: number; skipped: number }> {
    // Service types with their requirement flags
    const serviceTypesData: Array<{
      name: string;
      requiresMedicalTyping: boolean;
      requiresMedicalScheduling: boolean;
      requiresIdTyping2Years: boolean;
      requiresIdTyping1Year: boolean;
      requiresIdTyping10Years: boolean;
      requiresIdBiometrics: boolean;
    }> = [
      { name: "NEW EMPLOYMENT VISA - INSIDE", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: true, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: true },
      { name: "NEW EMPLOYMENT VISA - OUTSIDE", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: true, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: true },
      { name: "RENEW EMPLOYMENT VISA", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: true, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: false },
      { name: "GOLDEN VISA - DLD CUBE", requiresMedicalTyping: false, requiresMedicalScheduling: true, requiresIdTyping2Years: false, requiresIdTyping1Year: false, requiresIdTyping10Years: true, requiresIdBiometrics: true },
      { name: "GOLDEN VISA FOR DEPENDENT - DLD CUBE (NOT PARENT)", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: false, requiresIdTyping1Year: false, requiresIdTyping10Years: true, requiresIdBiometrics: true },
      { name: "GOLDEN VISA FOR DEPENDENT - DLD CUBE (PARENT)", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: false, requiresIdTyping1Year: false, requiresIdTyping10Years: true, requiresIdBiometrics: true },
      { name: "THIRD PARTY VISA", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: true, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: true },
      { name: "NEW PARENT VISA - INSIDE", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: false, requiresIdTyping1Year: true, requiresIdTyping10Years: false, requiresIdBiometrics: true },
      { name: "NEW PARENT VISA - OUTSIDE", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: false, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: true },
      { name: "NEW DEPENDENT VISA - INSIDE (NOT PARENT)", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: true, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: true },
      { name: "NEW DEPENDENT VISA - OUTSIDE (NOT PARENT)", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: true, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: true },
      { name: "RENEW DEPENDENT VISA", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: true, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: false },
      { name: "NEW PARTNER VISA - INSIDE", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: true, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: false },
      { name: "NEW PARTNER VISA - OUTSIDE", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: true, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: false },
      { name: "RENEW PARTNER VISA", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: true, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: false },
      { name: "GOLDEN VISA - MANAGER", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: false, requiresIdTyping1Year: false, requiresIdTyping10Years: true, requiresIdBiometrics: true },
      { name: "GOLDEN VISA - CULTURE", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: false, requiresIdTyping1Year: false, requiresIdTyping10Years: true, requiresIdBiometrics: true },
      { name: "GOLDEN VISA - STUDENT", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: false, requiresIdTyping1Year: false, requiresIdTyping10Years: true, requiresIdBiometrics: true },
      { name: "GOLDEN VISA FOR DEPENDENT - MANAGER", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: false, requiresIdTyping1Year: false, requiresIdTyping10Years: true, requiresIdBiometrics: true },
      { name: "GOLDEN VISA FOR DEPENDENT - CULTURE", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: false, requiresIdTyping1Year: false, requiresIdTyping10Years: true, requiresIdBiometrics: true },
      { name: "GOLDEN VISA FOR DEPENDENT - STUDENT", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: false, requiresIdTyping1Year: false, requiresIdTyping10Years: true, requiresIdBiometrics: true },
      { name: "LOST/REPLACE EMIRATES ID APPLICATION", requiresMedicalTyping: false, requiresMedicalScheduling: false, requiresIdTyping2Years: true, requiresIdTyping1Year: true, requiresIdTyping10Years: true, requiresIdBiometrics: true },
      { name: "NEW IFZ FREEZONE EMPLOYMENT VISA - INSIDE", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: true, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: true },
      { name: "NEW IFZ FREEZONE EMPLOYMENT VISA - OUTSIDE", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: true, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: true },
      { name: "VIP MEDICAL", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: false, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: false },
      { name: "NEW BORN DEPENDENT VISA", requiresMedicalTyping: false, requiresMedicalScheduling: false, requiresIdTyping2Years: true, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: true },
      { name: "SPC FREEZONE EMPLOYMENT VISA - INSIDE", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: true, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: true },
      { name: "SPC FREEZONE EMPLOYMENT VISA - OUTSIDE", requiresMedicalTyping: true, requiresMedicalScheduling: true, requiresIdTyping2Years: true, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: true },
    ];

    let added = 0;
    let skipped = 0;

    for (const stData of serviceTypesData) {
      // Check if service type already exists by name
      const existing = await db.select().from(serviceTypes).where(eq(serviceTypes.name, stData.name));
      
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Insert the service type with category
      const category = this.getCategoryFromName(stData.name);
      await db.insert(serviceTypes).values({ ...stData, category });
      added++;
    }

    console.log(`Service types seeded: ${added} added, ${skipped} skipped`);
    return { added, skipped };
  }

  async updateServiceTypeCategories(): Promise<{ updated: number }> {
    // Get all service types without a category
    const allTypes = await db.select().from(serviceTypes);
    let updated = 0;

    for (const st of allTypes) {
      const category = this.getCategoryFromName(st.name);
      if (category && st.category !== category) {
        await db.update(serviceTypes).set({ category }).where(eq(serviceTypes.id, st.id));
        updated++;
      }
    }

    console.log(`Service type categories updated: ${updated}`);
    return { updated };
  }

  async seedVendorJobs(): Promise<{ added: number; skipped: number }> {
    // Vendor jobs with their costs from the spreadsheet
    const vendorJobsData: Array<{
      name: string;
      category: "Medical" | "EID";
      cost: number;
    }> = [
      { name: "MEDICAL APPLICATION NORMAL", category: "Medical", cost: 290 },
      { name: "MEDICAL APPLICATION VIP", category: "Medical", cost: 720 },
      { name: "EMIRATES ID APPLICATION 2 YEAR", category: "EID", cost: 370 },
      { name: "EMIRATES ID APPLICATION 1 YEAR", category: "EID", cost: 270 },
      { name: "EMIRATES ID APPLICATION 10 YEAR", category: "EID", cost: 1200 },
      { name: "LOST / REPLACE EMIRATES ID", category: "EID", cost: 470 },
    ];

    let added = 0;
    let skipped = 0;

    for (const jobData of vendorJobsData) {
      // Check if vendor job already exists by name
      const existing = await db.select().from(jobTypes).where(eq(jobTypes.name, jobData.name));
      
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Insert the vendor job
      await db.insert(jobTypes).values(jobData);
      added++;
    }

    console.log(`Vendor jobs seeded: ${added} added, ${skipped} skipped`);
    return { added, skipped };
  }

  async seedStaff(): Promise<{ added: number; skipped: number }> {
    // Staff members from the spreadsheet
    const staffData: Array<{
      name: string;
      roleTitle: string;
      staffType: "Permanent" | "Temporary";
      status: "Active" | "OnLeave" | "Cancelled" | "TempActive" | "TempInactive";
      phone: string;
      email: string;
    }> = [
      // Permanent Staff (4) - default to Active
      { name: "Faris MHKP", roleTitle: "CEO", staffType: "Permanent", status: "Active", phone: "0509161815", email: "faris@procompany.ae" },
      { name: "Yasin Aboo", roleTitle: "Client Relation Manager", staffType: "Permanent", status: "Active", phone: "0551558435", email: "yasin@procompany.ae" },
      { name: "Shahul Hameed", roleTitle: "Medical Assistant Support", staffType: "Permanent", status: "Active", phone: "0568115077", email: "operations@procompany.ae" },
      { name: "Amal Hussain", roleTitle: "P.R.O.", staffType: "Permanent", status: "Active", phone: "0562125789", email: "amal@procompany.ae" },
      // Temporary Staff (2) - default to TempInactive (Inactive)
      { name: "Varghese Cherian", roleTitle: "Medical Assistant Support", staffType: "Temporary", status: "TempInactive", phone: "0585177911", email: "operations@procompany.ae" },
      { name: "Shahzad Roshan", roleTitle: "Medical Assistant Support", staffType: "Temporary", status: "TempInactive", phone: "0509423896", email: "operations@procompany.ae" },
    ];

    let added = 0;
    let skipped = 0;

    for (const staffMember of staffData) {
      // Check if staff member already exists by name
      const existing = await db.select().from(staff).where(eq(staff.name, staffMember.name));
      
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Insert the staff member
      await db.insert(staff).values(staffMember);
      added++;
    }

    console.log(`Staff seeded: ${added} added, ${skipped} skipped`);
    return { added, skipped };
  }

  // Work Order Notes
  async getWoNotes(woId: string): Promise<WoNote[]> {
    return db.select()
      .from(woNotes)
      .where(eq(woNotes.woId, woId))
      .orderBy(desc(woNotes.createdAt));
  }

  async createWoNote(data: InsertWoNote): Promise<WoNote> {
    const [note] = await db.insert(woNotes).values(data).returning();
    return note;
  }

  async deleteWoNote(id: string): Promise<boolean> {
    const result = await db.delete(woNotes).where(eq(woNotes.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Audit Log
  async getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return db.select()
      .from(auditLog)
      .where(and(
        eq(auditLog.entityType, entityType),
        eq(auditLog.entityId, entityId)
      ))
      .orderBy(desc(auditLog.createdAt));
  }

  async getRecentAuditLogs(limit: number = 20): Promise<AuditLog[]> {
    return db.select()
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);
  }

  async getRecentAuditLogsByUser(userId: string, limit: number = 20): Promise<AuditLog[]> {
    return db.select()
      .from(auditLog)
      .where(eq(auditLog.userId, userId))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);
  }

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLog).values(data).returning();
    return log;
  }

  // Change Notifications
  async createChangeNotification(data: InsertChangeNotification): Promise<ChangeNotification> {
    const [notification] = await db.insert(changeNotifications).values(data).returning();
    return notification;
  }

  async getChangeNotifications(): Promise<ChangeNotification[]> {
    return db.select().from(changeNotifications).orderBy(desc(changeNotifications.createdAt));
  }

  async getChangeNotification(id: string): Promise<ChangeNotification | undefined> {
    const [notification] = await db.select().from(changeNotifications).where(eq(changeNotifications.id, id));
    return notification || undefined;
  }

  async reviewChangeNotification(id: string, data: { status: string; reviewedBy: string }): Promise<ChangeNotification | undefined> {
    const [notification] = await db.update(changeNotifications)
      .set({ status: data.status, reviewedBy: data.reviewedBy, reviewedAt: new Date() })
      .where(eq(changeNotifications.id, id))
      .returning();
    return notification || undefined;
  }

  // Auto-fill helpers
  async getLastWorkOrderByCompany(companyId: string): Promise<WorkOrder | undefined> {
    const [wo] = await db.select()
      .from(workOrders)
      .where(eq(workOrders.companyId, companyId))
      .orderBy(desc(workOrders.createdAt))
      .limit(1);
    return wo || undefined;
  }

  // Work Order Documents
  async getWoDocuments(woId: string): Promise<WoDocument[]> {
    return db.select().from(woDocuments).where(eq(woDocuments.woId, woId)).orderBy(desc(woDocuments.uploadedAt));
  }

  async getAllWoDocuments(): Promise<WoDocument[]> {
    return db.select().from(woDocuments).orderBy(desc(woDocuments.uploadedAt));
  }

  async getExpiringWoDocuments(thresholdDate: Date): Promise<WoDocument[]> {
    return db.select().from(woDocuments)
      .where(and(isNotNull(woDocuments.expiresAt), lte(woDocuments.expiresAt, thresholdDate)))
      .orderBy(woDocuments.expiresAt);
  }

  async getCompanyIdsWithExpiringDocs(thresholdDate: Date): Promise<Set<string>> {
    const now = new Date();
    const rows = await db
      .select({ companyId: workOrders.companyId })
      .from(woDocuments)
      .innerJoin(workOrders, eq(woDocuments.woId, workOrders.id))
      .where(
        and(
          isNotNull(woDocuments.expiresAt),
          gte(woDocuments.expiresAt, now),
          lte(woDocuments.expiresAt, thresholdDate)
        )
      );
    return new Set(rows.map(r => r.companyId).filter(Boolean) as string[]);
  }

  async getWoPhotoMap(): Promise<Record<string, string>> {
    const photoDocs = await db.select({
      woId: woDocuments.woId,
      fileUrl: woDocuments.fileUrl,
    }).from(woDocuments).where(
      and(
        eq(woDocuments.documentType, "Photo"),
        isNotNull(woDocuments.fileUrl)
      )
    ).orderBy(desc(woDocuments.uploadedAt));

    const photoMap: Record<string, string> = {};
    for (const doc of photoDocs) {
      if (doc.woId && doc.fileUrl && !photoMap[doc.woId]) {
        photoMap[doc.woId] = doc.fileUrl;
      }
    }
    return photoMap;
  }

  async getUnsyncedWoDocuments(): Promise<WoDocument[]> {
    return db.select().from(woDocuments).where(isNull(woDocuments.workdriveLink)).orderBy(desc(woDocuments.uploadedAt));
  }

  async getWoDocumentById(id: string): Promise<WoDocument | undefined> {
    const [doc] = await db.select().from(woDocuments).where(eq(woDocuments.id, id));
    return doc || undefined;
  }

  async createWoDocument(data: InsertWoDocument): Promise<WoDocument> {
    const [doc] = await db.insert(woDocuments).values(data).returning();
    return doc;
  }

  async updateWoDocument(id: string, data: Partial<InsertWoDocument>): Promise<WoDocument | undefined> {
    const [doc] = await db.update(woDocuments).set(data).where(eq(woDocuments.id, id)).returning();
    return doc || undefined;
  }

  async deleteWoDocument(id: string): Promise<boolean> {
    const result = await db.delete(woDocuments).where(eq(woDocuments.id, id));
    return true;
  }

  // Document Requirements
  async getDocumentRequirements(): Promise<DocumentRequirement[]> {
    return db.select().from(documentRequirements);
  }

  async getDocumentRequirementsByCategory(category: string): Promise<DocumentRequirement[]> {
    return db.select().from(documentRequirements).where(eq(documentRequirements.serviceCategory, category as typeof documentRequirements.serviceCategory.enumValues[number]));
  }

  async createDocumentRequirement(data: InsertDocumentRequirement): Promise<DocumentRequirement> {
    const [req] = await db.insert(documentRequirements).values(data).returning();
    return req;
  }

  // Vendor Notifications
  async createVendorNotification(data: InsertVendorNotification): Promise<VendorNotification> {
    const [result] = await db.insert(vendorNotifications).values(data).returning();
    return result;
  }

  async getVendorNotifications(vendorUserId: string, limit = 50): Promise<VendorNotification[]> {
    return db.select().from(vendorNotifications)
      .where(eq(vendorNotifications.vendorUserId, vendorUserId))
      .orderBy(desc(vendorNotifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCount(vendorUserId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(vendorNotifications)
      .where(and(
        eq(vendorNotifications.vendorUserId, vendorUserId),
        isNull(vendorNotifications.readAt)
      ));
    return result[0]?.count || 0;
  }

  async markNotificationRead(id: string): Promise<void> {
    // Only update if readAt is not already set (read-once semantics)
    await db.update(vendorNotifications)
      .set({ readAt: new Date() })
      .where(and(
        eq(vendorNotifications.id, id),
        isNull(vendorNotifications.readAt)
      ));
  }

  async markAllNotificationsRead(vendorUserId: string): Promise<void> {
    await db.update(vendorNotifications)
      .set({ readAt: new Date() })
      .where(and(
        eq(vendorNotifications.vendorUserId, vendorUserId),
        isNull(vendorNotifications.readAt)
      ));
  }

  async createStaffNotification(data: InsertStaffNotification): Promise<StaffNotification> {
    const [result] = await db.insert(staffNotifications).values(data).returning();
    return result;
  }

  async getStaffNotifications(userId: string, limit = 50): Promise<StaffNotification[]> {
    return db.select().from(staffNotifications)
      .where(eq(staffNotifications.userId, userId))
      .orderBy(desc(staffNotifications.createdAt))
      .limit(limit);
  }

  async getUnreadStaffNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(staffNotifications)
      .where(and(
        eq(staffNotifications.userId, userId),
        eq(staffNotifications.isRead, false)
      ));
    return result[0]?.count || 0;
  }

  async markStaffNotificationRead(id: string): Promise<void> {
    await db.update(staffNotifications).set({ isRead: true }).where(eq(staffNotifications.id, id));
  }

  async markAllStaffNotificationsRead(userId: string): Promise<void> {
    await db.update(staffNotifications)
      .set({ isRead: true })
      .where(eq(staffNotifications.userId, userId));
  }

  async hasRecentNotification(type: string, relatedEntityId: string, withinHours: number, userId?: string): Promise<boolean> {
    const cutoff = new Date(Date.now() - withinHours * 3600000);
    const conditions = [
      eq(staffNotifications.type, type),
      eq(staffNotifications.relatedEntityId, relatedEntityId),
      sql`${staffNotifications.createdAt} > ${cutoff}`,
    ];
    if (userId) {
      conditions.push(eq(staffNotifications.userId, userId));
    }
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(staffNotifications)
      .where(and(...conditions));
    return (result[0]?.count || 0) > 0;
  }

  async createLoginAuditEntry(data: InsertLoginAuditLog): Promise<LoginAuditLog> {
    const [entry] = await db.insert(loginAuditLog).values(data).returning();
    return entry;
  }

  async getLoginAuditLog(limit: number = 100): Promise<LoginAuditLog[]> {
    return db.select().from(loginAuditLog).orderBy(desc(loginAuditLog.createdAt)).limit(limit);
  }

  async getLoginAuditLogByUser(userId: string, limit: number = 10): Promise<LoginAuditLog[]> {
    return db.select().from(loginAuditLog)
      .where(eq(loginAuditLog.userId, userId))
      .orderBy(desc(loginAuditLog.createdAt))
      .limit(limit);
  }

  async createPasswordResetRequest(data: InsertPasswordResetRequest): Promise<PasswordResetRequest> {
    const [request] = await db.insert(passwordResetRequests).values(data).returning();
    return request;
  }

  async getPasswordResetRequests(status?: string): Promise<PasswordResetRequest[]> {
    const conditions = status ? [eq(passwordResetRequests.status, status)] : [];
    const requests = conditions.length > 0
      ? await db.select().from(passwordResetRequests).where(and(...conditions)).orderBy(desc(passwordResetRequests.createdAt))
      : await db.select().from(passwordResetRequests).orderBy(desc(passwordResetRequests.createdAt));

    const enriched = await Promise.all(
      requests.map(async (req) => {
        const user = await this.getUser(req.userId);
        return {
          ...req,
          userName: user?.name || "Unknown",
          userEmail: user?.email || "Unknown",
        };
      })
    );
    return enriched as (PasswordResetRequest & { userName: string; userEmail: string })[];
  }

  async resolvePasswordResetRequest(id: string, resolvedBy: string): Promise<PasswordResetRequest> {
    const [updated] = await db.update(passwordResetRequests)
      .set({ status: "resolved", resolvedBy, resolvedAt: new Date() })
      .where(eq(passwordResetRequests.id, id))
      .returning();
    return updated;
  }

  async seedDocumentRequirements(): Promise<{ added: number; skipped: number }> {
    // Check if any requirements exist
    const existing = await db.select().from(documentRequirements);
    if (existing.length > 0) {
      return { added: 0, skipped: existing.length };
    }

    // Document requirements based on service categories
    const requirements: Array<{
      serviceCategory: "NewVisaInside" | "NewVisaOutside" | "GoldenVisa" | "RenewVisa" | "NewbornDependent" | "LostReplaceEid";
      documentType: "PassportCopy" | "Photo" | "EntryPermit" | "ChangeStatus" | "CurrentResidency" | "OldResidencyOrId" | "CurrentEmiratesId" | "SponsorEmiratesId" | "BirthCertificate" | "LostEmiratesId";
      isRequired: boolean;
      appliesToMedical: boolean;
      appliesToEid: boolean;
    }> = [
      // New Visa Inside - requires Entry Permit + Change Status
      { serviceCategory: "NewVisaInside", documentType: "PassportCopy", isRequired: true, appliesToMedical: true, appliesToEid: true },
      { serviceCategory: "NewVisaInside", documentType: "Photo", isRequired: true, appliesToMedical: true, appliesToEid: true },
      { serviceCategory: "NewVisaInside", documentType: "EntryPermit", isRequired: true, appliesToMedical: true, appliesToEid: true },
      { serviceCategory: "NewVisaInside", documentType: "ChangeStatus", isRequired: true, appliesToMedical: true, appliesToEid: true },

      // New Visa Outside - requires Entry Permit only
      { serviceCategory: "NewVisaOutside", documentType: "PassportCopy", isRequired: true, appliesToMedical: true, appliesToEid: true },
      { serviceCategory: "NewVisaOutside", documentType: "Photo", isRequired: true, appliesToMedical: true, appliesToEid: true },
      { serviceCategory: "NewVisaOutside", documentType: "EntryPermit", isRequired: true, appliesToMedical: true, appliesToEid: true },

      // Golden Visa - Old Residency/ID optional
      { serviceCategory: "GoldenVisa", documentType: "PassportCopy", isRequired: true, appliesToMedical: true, appliesToEid: true },
      { serviceCategory: "GoldenVisa", documentType: "Photo", isRequired: true, appliesToMedical: true, appliesToEid: true },
      { serviceCategory: "GoldenVisa", documentType: "OldResidencyOrId", isRequired: false, appliesToMedical: true, appliesToEid: true },

      // Renew Visa - requires Current Residency
      { serviceCategory: "RenewVisa", documentType: "PassportCopy", isRequired: true, appliesToMedical: true, appliesToEid: true },
      { serviceCategory: "RenewVisa", documentType: "Photo", isRequired: true, appliesToMedical: true, appliesToEid: true },
      { serviceCategory: "RenewVisa", documentType: "CurrentResidency", isRequired: true, appliesToMedical: true, appliesToEid: true },
      { serviceCategory: "RenewVisa", documentType: "CurrentEmiratesId", isRequired: false, appliesToMedical: false, appliesToEid: true },
      { serviceCategory: "RenewVisa", documentType: "SponsorEmiratesId", isRequired: false, appliesToMedical: false, appliesToEid: true },

      // Newborn Dependent - requires Birth Certificate + Sponsor ID
      { serviceCategory: "NewbornDependent", documentType: "PassportCopy", isRequired: true, appliesToMedical: true, appliesToEid: true },
      { serviceCategory: "NewbornDependent", documentType: "Photo", isRequired: true, appliesToMedical: true, appliesToEid: true },
      { serviceCategory: "NewbornDependent", documentType: "SponsorEmiratesId", isRequired: true, appliesToMedical: true, appliesToEid: true },
      { serviceCategory: "NewbornDependent", documentType: "BirthCertificate", isRequired: true, appliesToMedical: true, appliesToEid: true },

      // Lost/Replace EID - requires Lost EID + Residency
      { serviceCategory: "LostReplaceEid", documentType: "PassportCopy", isRequired: true, appliesToMedical: false, appliesToEid: true },
      { serviceCategory: "LostReplaceEid", documentType: "Photo", isRequired: true, appliesToMedical: false, appliesToEid: true },
      { serviceCategory: "LostReplaceEid", documentType: "LostEmiratesId", isRequired: true, appliesToMedical: false, appliesToEid: true },
      { serviceCategory: "LostReplaceEid", documentType: "CurrentResidency", isRequired: true, appliesToMedical: false, appliesToEid: true },
    ];

    for (const req of requirements) {
      await db.insert(documentRequirements).values(req);
    }

    console.log(`Document requirements seeded: ${requirements.length} added`);
    return { added: requirements.length, skipped: 0 };
  }

  // Sheet Months
  async getSheetMonths(): Promise<SheetMonth[]> {
    return db.select().from(sheetMonths).orderBy(desc(sheetMonths.monthYear));
  }

  async getSheetMonth(id: string): Promise<SheetMonth | undefined> {
    const [row] = await db.select().from(sheetMonths).where(eq(sheetMonths.id, id));
    return row || undefined;
  }

  async upsertSheetMonth(monthYear: string, data: { sheetUrl?: string }): Promise<SheetMonth> {
    const existing = await db.select().from(sheetMonths).where(eq(sheetMonths.monthYear, monthYear));
    if (existing.length > 0) {
      const [updated] = await db.update(sheetMonths)
        .set({ sheetUrl: data.sheetUrl })
        .where(eq(sheetMonths.monthYear, monthYear))
        .returning();
      return updated;
    }
    const [created] = await db.insert(sheetMonths).values({ monthYear, sheetUrl: data.sheetUrl }).returning();
    return created;
  }

  async closeSheetMonth(id: string): Promise<SheetMonth> {
    const [updated] = await db.update(sheetMonths)
      .set({ status: "closed" })
      .where(eq(sheetMonths.id, id))
      .returning();
    return updated;
  }

  async incrementSheetMonthImportedCount(id: string, count: number): Promise<SheetMonth> {
    const [updated] = await db.update(sheetMonths)
      .set({ importedCount: sql`${sheetMonths.importedCount} + ${count}`, lastRefreshedAt: new Date() })
      .where(eq(sheetMonths.id, id))
      .returning();
    return updated;
  }

  async touchSheetMonthRefresh(id: string): Promise<SheetMonth> {
    const [updated] = await db.update(sheetMonths)
      .set({ lastRefreshedAt: new Date() })
      .where(eq(sheetMonths.id, id))
      .returning();
    return updated;
  }

  // API Keys
  async getApiKeys(): Promise<ApiKey[]> {
    return db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  }

  async getApiKeyById(id: string): Promise<ApiKey | undefined> {
    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return row || undefined;
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.key, keyHash));
    return row || undefined;
  }

  async createApiKey(data: InsertApiKey): Promise<ApiKey> {
    const [created] = await db.insert(apiKeys).values(data).returning();
    return created;
  }

  async updateApiKey(id: string, data: Partial<InsertApiKey>): Promise<ApiKey | undefined> {
    const [updated] = await db.update(apiKeys).set(data).where(eq(apiKeys.id, id)).returning();
    return updated || undefined;
  }

  async deleteApiKey(id: string): Promise<boolean> {
    const result = await db.delete(apiKeys).where(eq(apiKeys.id, id));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  async touchApiKeyLastUsed(id: string): Promise<void> {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
  }

  // Medical Scheduling
  async getMedicalCaseByWoId(woId: string): Promise<MedicalCase | undefined> {
    const [row] = await db.select().from(medicalCases).where(eq(medicalCases.woId, woId));
    return row || undefined;
  }

  async getMedicalCaseById(id: string): Promise<MedicalCase | undefined> {
    const [row] = await db.select().from(medicalCases).where(eq(medicalCases.id, id));
    return row || undefined;
  }

  async createMedicalCase(data: InsertMedicalCase): Promise<MedicalCase> {
    const [row] = await db.insert(medicalCases).values(data).returning();
    return row;
  }

  async updateMedicalCase(id: string, data: Partial<InsertMedicalCase>): Promise<MedicalCase | undefined> {
    const [row] = await db.update(medicalCases).set(data).where(eq(medicalCases.id, id)).returning();
    return row || undefined;
  }

  async getCyclesByCase(caseId: string): Promise<AppointmentCycle[]> {
    return db.select().from(appointmentCycles)
      .where(eq(appointmentCycles.caseId, caseId))
      .orderBy(desc(appointmentCycles.cycleNumber));
  }

  async getCycleById(id: string): Promise<AppointmentCycle | undefined> {
    const [row] = await db.select().from(appointmentCycles).where(eq(appointmentCycles.id, id));
    return row || undefined;
  }

  async createCycle(data: InsertAppointmentCycle): Promise<AppointmentCycle> {
    const [row] = await db.insert(appointmentCycles).values(data).returning();
    return row;
  }

  async updateCycle(id: string, data: Partial<AppointmentCycle>): Promise<AppointmentCycle | undefined> {
    const [row] = await db.update(appointmentCycles).set(data).where(eq(appointmentCycles.id, id)).returning();
    return row || undefined;
  }

  async logMedicalEvent(data: InsertMedicalEvent): Promise<MedicalEvent> {
    const [row] = await db.insert(medicalAppointmentEvents).values(data).returning();
    return row;
  }

  async createRescheduleCycle(
    sourceCycleId: string,
    newCycleData: InsertAppointmentCycle,
    actorId: string,
    actorRole: string
  ): Promise<AppointmentCycle> {
    return db.transaction(async (tx) => {
      const [newCycle] = await tx.insert(appointmentCycles).values(newCycleData).returning();

      await tx.insert(medicalAppointmentEvents).values({
        cycleId: newCycle.id,
        eventType: "CYCLE_CREATED",
        actorId,
        actorRole,
        details: {
          cycleType: "Reschedule",
          rescheduledFromCycleId: sourceCycleId,
          appointmentTime: newCycleData.appointmentTime?.toISOString(),
        },
      });

      await tx.insert(medicalAppointmentEvents).values({
        cycleId: sourceCycleId,
        eventType: "STATUS_CHANGED",
        actorId,
        actorRole,
        details: {
          from: "NO_SHOW",
          action: "superseded_by_new_cycle",
          newCycleId: newCycle.id,
        },
      });

      return newCycle;
    });
  }

  async getEventsByCycle(cycleId: string): Promise<MedicalEvent[]> {
    return db.select().from(medicalAppointmentEvents)
      .where(eq(medicalAppointmentEvents.cycleId, cycleId))
      .orderBy(medicalAppointmentEvents.createdAt);
  }

  async getCyclesDueForAwaitingMeeting(): Promise<AppointmentCycle[]> {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    return db.select().from(appointmentCycles).where(
      and(
        eq(appointmentCycles.status, "SCHEDULED"),
        lte(appointmentCycles.appointmentTime, fiveMinAgo)
      )
    );
  }

  async getCyclesDueForNoShow(): Promise<AppointmentCycle[]> {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    return db.select().from(appointmentCycles).where(
      and(
        eq(appointmentCycles.status, "AWAITING_MEETING"),
        lte(appointmentCycles.awaitingMeetingAt, thirtyMinAgo),
        eq(appointmentCycles.crmHoldActive, false)
      )
    );
  }

  async getCyclesDueForResultDelayed(): Promise<AppointmentCycle[]> {
    const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);
    return db.select().from(appointmentCycles).where(
      and(
        eq(appointmentCycles.status, "COMPLETED"),
        lte(appointmentCycles.completedAt, thirtyHoursAgo)
      )
    );
  }

  async getCyclesTodayByPro(proId: string): Promise<AppointmentCycle[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return db.select().from(appointmentCycles).where(
      and(
        eq(appointmentCycles.assignedProId, proId),
        gte(appointmentCycles.appointmentTime, today),
        lt(appointmentCycles.appointmentTime, tomorrow)
      )
    ).orderBy(appointmentCycles.appointmentTime);
  }

  // EID Biometrics Scheduling
  async getBiometricsCaseByWoId(woId: string): Promise<BiometricsCase | undefined> {
    const [row] = await db.select().from(biometricsCases).where(eq(biometricsCases.woId, woId));
    return row || undefined;
  }

  async getBiometricsCaseById(id: string): Promise<BiometricsCase | undefined> {
    const [row] = await db.select().from(biometricsCases).where(eq(biometricsCases.id, id));
    return row || undefined;
  }

  async createBiometricsCase(data: InsertBiometricsCase): Promise<BiometricsCase> {
    const [row] = await db.insert(biometricsCases).values(data).returning();
    return row;
  }

  async updateBiometricsCase(id: string, data: Partial<InsertBiometricsCase>): Promise<BiometricsCase | undefined> {
    const [row] = await db.update(biometricsCases).set(data).where(eq(biometricsCases.id, id)).returning();
    return row || undefined;
  }

  async getBiometricsCyclesByCase(caseId: string): Promise<BiometricsCycle[]> {
    return db.select().from(biometricsAppointmentCycles)
      .where(eq(biometricsAppointmentCycles.caseId, caseId))
      .orderBy(desc(biometricsAppointmentCycles.cycleNumber));
  }

  async getBiometricsCycleById(id: string): Promise<BiometricsCycle | undefined> {
    const [row] = await db.select().from(biometricsAppointmentCycles).where(eq(biometricsAppointmentCycles.id, id));
    return row || undefined;
  }

  async createBiometricsCycle(data: InsertBiometricsCycle): Promise<BiometricsCycle> {
    const [row] = await db.insert(biometricsAppointmentCycles).values(data).returning();
    return row;
  }

  async updateBiometricsCycle(id: string, data: Partial<BiometricsCycle>): Promise<BiometricsCycle | undefined> {
    const [row] = await db.update(biometricsAppointmentCycles).set(data).where(eq(biometricsAppointmentCycles.id, id)).returning();
    return row || undefined;
  }

  async logBiometricsEvent(data: InsertBiometricsEvent): Promise<BiometricsEvent> {
    const [row] = await db.insert(biometricsAppointmentEvents).values(data).returning();
    return row;
  }

  async getBiometricsEventsByCycle(cycleId: string): Promise<BiometricsEvent[]> {
    return db.select().from(biometricsAppointmentEvents)
      .where(eq(biometricsAppointmentEvents.cycleId, cycleId))
      .orderBy(biometricsAppointmentEvents.createdAt);
  }

  async getBiometricsCyclesDueForAwaitingMeeting(): Promise<BiometricsCycle[]> {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    return db.select().from(biometricsAppointmentCycles).where(
      and(
        eq(biometricsAppointmentCycles.status, "SCHEDULED"),
        lte(biometricsAppointmentCycles.appointmentTime, fiveMinAgo)
      )
    );
  }

  async getBiometricsCyclesDueForNoShow(): Promise<BiometricsCycle[]> {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    return db.select().from(biometricsAppointmentCycles).where(
      and(
        eq(biometricsAppointmentCycles.status, "AWAITING_MEETING"),
        lte(biometricsAppointmentCycles.awaitingMeetingAt, thirtyMinAgo),
        eq(biometricsAppointmentCycles.crmHoldActive, false)
      )
    );
  }

  async createDeletionRequest(data: InsertDeletionRequest): Promise<DeletionRequest> {
    const [row] = await db.insert(deletionRequests).values(data).returning();
    return row;
  }

  async getDeletionRequests(status?: string): Promise<DeletionRequest[]> {
    if (status) {
      return db.select().from(deletionRequests)
        .where(eq(deletionRequests.status, status as typeof deletionRequests.status.enumValues[number]))
        .orderBy(desc(deletionRequests.createdAt));
    }
    return db.select().from(deletionRequests).orderBy(desc(deletionRequests.createdAt));
  }

  async getDeletionRequestsByUser(userId: string): Promise<DeletionRequest[]> {
    return db.select().from(deletionRequests)
      .where(eq(deletionRequests.requestedBy, userId))
      .orderBy(desc(deletionRequests.createdAt));
  }

  async getDeletionRequestById(id: string): Promise<DeletionRequest | undefined> {
    const [row] = await db.select().from(deletionRequests).where(eq(deletionRequests.id, id));
    return row || undefined;
  }

  async updateDeletionRequest(id: string, data: Partial<DeletionRequest>): Promise<DeletionRequest | undefined> {
    const [row] = await db.update(deletionRequests).set(data).where(eq(deletionRequests.id, id)).returning();
    return row || undefined;
  }

  async getPendingDeletionRequestCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(deletionRequests)
      .where(eq(deletionRequests.status, "pending"));
    return Number(result?.count || 0);
  }

  // Vendor Users — vendor.vendor_users is the authoritative identity store for Vendor Portal logins
  async getVendorUserByEmail(email: string): Promise<VendorUser | undefined> {
    const [row] = await db.select().from(vendorUsers).where(eq(vendorUsers.email, email)).limit(1);
    return row;
  }

  async getVendorUserById(id: string): Promise<VendorUser | undefined> {
    const [row] = await db.select().from(vendorUsers).where(eq(vendorUsers.id, id)).limit(1);
    return row;
  }

  async updateVendorUserLastLogin(id: string): Promise<void> {
    await db.update(vendorUsers)
      .set({ lastLoginAt: new Date() })
      .where(eq(vendorUsers.id, id));
  }

  async createVendorUser(data: InsertVendorUser): Promise<VendorUser> {
    const [row] = await db.insert(vendorUsers).values(data).returning();
    return row;
  }

  async updateVendorUser(id: string, data: Partial<VendorUser>): Promise<VendorUser | undefined> {
    const [row] = await db.update(vendorUsers)
      .set(data)
      .where(eq(vendorUsers.id, id))
      .returning();
    return row;
  }

  async getVendorUsers(activeOnly = false): Promise<VendorUser[]> {
    if (activeOnly) {
      return db.select().from(vendorUsers).where(eq(vendorUsers.active, true));
    }
    return db.select().from(vendorUsers);
  }

  // Cross-Portal Events — Vendor Portal publishes; Client Portal consumer reads and marks processed
  async publishCrossPortalEvent(data: InsertCrossPortalEvent): Promise<CrossPortalEvent> {
    const [row] = await db.insert(crossPortalEvents).values({
      ...data,
      status: "pending", // Vendor Portal ALWAYS inserts as pending; only CP consumer may set status=sent
    }).returning();
    return row;
  }

  async getPendingCrossPortalEvents(limit = 100): Promise<CrossPortalEvent[]> {
    return db.select().from(crossPortalEvents)
      .where(eq(crossPortalEvents.status, "pending"))
      .orderBy(crossPortalEvents.createdAt)
      .limit(limit);
  }

  async getRecentCrossPortalEvents(limit = 50): Promise<CrossPortalEvent[]> {
    return db.select().from(crossPortalEvents)
      .orderBy(desc(crossPortalEvents.createdAt))
      .limit(limit);
  }

  async getFailedCrossPortalEventsCount(): Promise<number> {
    const [row] = await db.select({ count: sql<number>`count(*)` })
      .from(crossPortalEvents)
      .where(eq(crossPortalEvents.status, "failed"));
    return Number(row?.count || 0);
  }

  async getFailedCrossPortalEvents(limit = 100): Promise<CrossPortalEvent[]> {
    return db.select().from(crossPortalEvents)
      .where(and(eq(crossPortalEvents.status, "failed"), lt(crossPortalEvents.attemptCount, 5)))
      .orderBy(crossPortalEvents.createdAt)
      .limit(limit);
  }

  async updateCrossPortalEvent(id: string, data: Partial<CrossPortalEvent>): Promise<CrossPortalEvent | undefined> {
    const [row] = await db.update(crossPortalEvents).set(data).where(eq(crossPortalEvents.id, id)).returning();
    return row || undefined;
  }

  async getLastSuccessfulCrossPortalEvent(): Promise<CrossPortalEvent | undefined> {
    const [row] = await db.select().from(crossPortalEvents)
      .where(eq(crossPortalEvents.status, "sent"))
      .orderBy(desc(crossPortalEvents.processedAt))
      .limit(1);
    return row || undefined;
  }

  // Attestation Categories
  async getAttestationCategories(activeOnly = false): Promise<AttestationCategory[]> {
    if (activeOnly) {
      return db.select().from(attestationCategories).where(eq(attestationCategories.active, true)).orderBy(attestationCategories.sortOrder, attestationCategories.name);
    }
    return db.select().from(attestationCategories).orderBy(attestationCategories.sortOrder, attestationCategories.name);
  }

  async getAttestationCategoryById(id: string): Promise<AttestationCategory | undefined> {
    const [row] = await db.select().from(attestationCategories).where(eq(attestationCategories.id, id));
    return row || undefined;
  }

  async getAttestationCategoryByName(name: string): Promise<AttestationCategory | undefined> {
    const [row] = await db.select().from(attestationCategories).where(eq(attestationCategories.name, name));
    return row || undefined;
  }

  async createAttestationCategory(data: InsertAttestationCategory): Promise<AttestationCategory> {
    const [row] = await db.insert(attestationCategories).values(data).returning();
    return row;
  }

  async updateAttestationCategory(id: string, data: Partial<InsertAttestationCategory>): Promise<AttestationCategory | undefined> {
    const [row] = await db.update(attestationCategories).set(data).where(eq(attestationCategories.id, id)).returning();
    return row || undefined;
  }

  async deleteAttestationCategory(id: string): Promise<boolean> {
    const result = await db.delete(attestationCategories).where(eq(attestationCategories.id, id)).returning();
    return result.length > 0;
  }

  async renameAttestationCategoryInServices(oldName: string, newName: string): Promise<void> {
    await db.update(attestationServices).set({ category: newName }).where(eq(attestationServices.category, oldName));
    await db.update(attestationServiceStepDefinitions).set({ stepType: newName }).where(eq(attestationServiceStepDefinitions.stepType, oldName));
    await db.update(attestationSrSteps).set({ stepType: newName }).where(eq(attestationSrSteps.stepType, oldName));
  }

  async seedAttestationCategories(): Promise<void> {
    const existingCategories = await db.select().from(attestationCategories);
    if (existingCategories.length > 0) return;
    const defaults = [
      { name: "MofaUAE", sortOrder: 0, active: true },
      { name: "MofaHomeCountry", sortOrder: 1, active: true },
      { name: "Embassy", sortOrder: 2, active: true },
      { name: "Lawyer", sortOrder: 3, active: true },
      { name: "Other", sortOrder: 4, active: true },
    ];
    await db.insert(attestationCategories).values(defaults);
  }

  // Attestation Services Catalog
  async getAttestationServices(activeOnly = false): Promise<AttestationService[]> {
    if (activeOnly) {
      return db.select().from(attestationServices).where(eq(attestationServices.active, true)).orderBy(attestationServices.name);
    }
    return db.select().from(attestationServices).orderBy(attestationServices.name);
  }

  async getAttestationServiceById(id: string): Promise<AttestationService | undefined> {
    const [row] = await db.select().from(attestationServices).where(eq(attestationServices.id, id));
    return row || undefined;
  }

  async getAttestationServiceByName(name: string): Promise<AttestationService | undefined> {
    const [row] = await db.select().from(attestationServices).where(eq(attestationServices.name, name));
    return row || undefined;
  }

  async createAttestationService(data: InsertAttestationService): Promise<AttestationService> {
    const [row] = await db.insert(attestationServices).values(data).returning();
    return row;
  }

  async updateAttestationService(id: string, data: Partial<InsertAttestationService>): Promise<AttestationService | undefined> {
    const [row] = await db.update(attestationServices).set(data).where(eq(attestationServices.id, id)).returning();
    return row || undefined;
  }

  async getAttestationServiceVariants(serviceId: string): Promise<AttestationServiceVariant[]> {
    return db.select().from(attestationServiceVariants)
      .where(eq(attestationServiceVariants.serviceId, serviceId))
      .orderBy(attestationServiceVariants.variantLabel);
  }

  async getAttestationServiceVariantById(id: string): Promise<AttestationServiceVariant | undefined> {
    const [row] = await db.select().from(attestationServiceVariants).where(eq(attestationServiceVariants.id, id));
    return row || undefined;
  }

  async createAttestationServiceVariant(data: InsertAttestationServiceVariant): Promise<AttestationServiceVariant> {
    const [row] = await db.insert(attestationServiceVariants).values(data).returning();
    return row;
  }

  async updateAttestationServiceVariant(id: string, data: Partial<InsertAttestationServiceVariant>): Promise<AttestationServiceVariant | undefined> {
    const [row] = await db.update(attestationServiceVariants).set(data).where(eq(attestationServiceVariants.id, id)).returning();
    return row || undefined;
  }

  async deleteAttestationServiceVariant(id: string): Promise<boolean> {
    const result = await db.delete(attestationServiceVariants).where(eq(attestationServiceVariants.id, id)).returning();
    return result.length > 0;
  }

  async getAttestationServiceStepDefinitions(serviceId: string): Promise<AttestationServiceStepDefinition[]> {
    return db.select().from(attestationServiceStepDefinitions)
      .where(eq(attestationServiceStepDefinitions.serviceId, serviceId))
      .orderBy(attestationServiceStepDefinitions.stepOrder);
  }

  async createAttestationServiceStepDefinition(data: InsertAttestationServiceStepDefinition): Promise<AttestationServiceStepDefinition> {
    const [row] = await db.insert(attestationServiceStepDefinitions).values(data).returning();
    return row;
  }

  async updateAttestationServiceStepDefinition(id: string, data: Partial<InsertAttestationServiceStepDefinition>): Promise<AttestationServiceStepDefinition | undefined> {
    const [row] = await db.update(attestationServiceStepDefinitions).set(data).where(eq(attestationServiceStepDefinitions.id, id)).returning();
    return row || undefined;
  }

  async deleteAttestationServiceStepDefinition(id: string): Promise<boolean> {
    const result = await db.delete(attestationServiceStepDefinitions).where(eq(attestationServiceStepDefinitions.id, id)).returning();
    return result.length > 0;
  }

  async replaceAttestationServiceStepDefinitions(serviceId: string, steps: Omit<InsertAttestationServiceStepDefinition, 'serviceId'>[]): Promise<AttestationServiceStepDefinition[]> {
    await db.delete(attestationServiceStepDefinitions).where(eq(attestationServiceStepDefinitions.serviceId, serviceId));
    if (steps.length === 0) return [];
    const rows = await db.insert(attestationServiceStepDefinitions)
      .values(steps.map(s => ({ ...s, serviceId })))
      .returning();
    return rows;
  }

  // Attestation Service Requests
  async getAttestationSrs(filters?: { assignedProId?: string; vendorId?: string; status?: string; companyId?: string }): Promise<AttestationSr[]> {
    const conditions = [];
    if (filters?.assignedProId) conditions.push(eq(attestationServiceRequests.assignedProId, filters.assignedProId));
    if (filters?.vendorId) conditions.push(eq(attestationServiceRequests.vendorId, filters.vendorId));
    if (filters?.status) conditions.push(eq(attestationServiceRequests.status, filters.status as typeof attestationServiceRequests.status.enumValues[number]));
    if (filters?.companyId) conditions.push(eq(attestationServiceRequests.companyId, filters.companyId));
    if (conditions.length > 0) {
      return db.select().from(attestationServiceRequests).where(and(...conditions)).orderBy(desc(attestationServiceRequests.createdAt));
    }
    return db.select().from(attestationServiceRequests).orderBy(desc(attestationServiceRequests.createdAt));
  }

  async getAttestationSrById(id: string): Promise<AttestationSr | undefined> {
    const [row] = await db.select().from(attestationServiceRequests).where(eq(attestationServiceRequests.id, id));
    return row || undefined;
  }

  async createAttestationSr(data: InsertAttestationSr): Promise<AttestationSr> {
    const [row] = await db.insert(attestationServiceRequests).values(data).returning();
    return row;
  }

  async updateAttestationSr(id: string, data: Partial<AttestationSr>): Promise<AttestationSr | undefined> {
    const [row] = await db.update(attestationServiceRequests).set(data).where(eq(attestationServiceRequests.id, id)).returning();
    return row || undefined;
  }

  async getNextSrNumber(): Promise<string> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(attestationServiceRequests);
    const count = Number(result?.count || 0);
    const padded = String(count + 1).padStart(5, "0");
    return `ASR-${padded}`;
  }

  async getAttestationSrSteps(srId: string): Promise<AttestationSrStep[]> {
    return db.select().from(attestationSrSteps)
      .where(eq(attestationSrSteps.srId, srId))
      .orderBy(attestationSrSteps.stepOrder);
  }

  async createAttestationSrStep(data: InsertAttestationSrStep): Promise<AttestationSrStep> {
    const [row] = await db.insert(attestationSrSteps).values(data).returning();
    return row;
  }

  async updateAttestationSrStep(id: string, data: Partial<InsertAttestationSrStep>): Promise<AttestationSrStep | undefined> {
    const [row] = await db.update(attestationSrSteps).set(data).where(eq(attestationSrSteps.id, id)).returning();
    return row || undefined;
  }

  async getAttestationVendors(): Promise<Vendor[]> {
    return db.select().from(vendors).where(and(eq(vendors.vendorType, "Attestation"), eq(vendors.active, true)));
  }

  async getAttestationSrActivityLog(srId: string): Promise<AttestationSrActivityLog[]> {
    return db.select().from(attestationSrActivityLog)
      .where(eq(attestationSrActivityLog.srId, srId))
      .orderBy(desc(attestationSrActivityLog.createdAt));
  }

  async createAttestationSrActivityLog(data: InsertAttestationSrActivityLog): Promise<AttestationSrActivityLog> {
    const [row] = await db.insert(attestationSrActivityLog).values(data).returning();
    return row;
  }

  // Document Custody Log
  async getCustodyLogs(srId: string): Promise<DocumentCustodyLog[]> {
    return db.select().from(documentCustodyLog)
      .where(eq(documentCustodyLog.srId, srId))
      .orderBy(documentCustodyLog.acknowledgedAt);
  }

  async createCustodyLog(data: InsertDocumentCustodyLog): Promise<DocumentCustodyLog> {
    const [row] = await db.insert(documentCustodyLog).values(data).returning();
    return row;
  }

  async createCustodyLogWithSrUpdate(
    data: InsertDocumentCustodyLog,
    srUpdate: Partial<AttestationSr>
  ): Promise<{ log: DocumentCustodyLog; sr: AttestationSr }> {
    const [logRow] = await db.insert(documentCustodyLog).values(data).returning();
    const [srRow] = await db.update(attestationServiceRequests)
      .set(srUpdate)
      .where(eq(attestationServiceRequests.id, data.srId))
      .returning();
    return { log: logRow, sr: srRow };
  }

  // Attestation Inquiries
  async createAttestationInquiry(data: InsertAttestationInquiry): Promise<AttestationInquiry> {
    const [row] = await db.insert(attestationInquiries).values(data as typeof attestationInquiries.$inferInsert).returning();
    return row;
  }

  async getAttestationInquiries(filters?: { status?: string; companyId?: string; vendorId?: string }): Promise<AttestationInquiry[]> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(attestationInquiries.status, filters.status as typeof attestationInquiries.status.enumValues[number]));
    if (filters?.companyId) conditions.push(eq(attestationInquiries.companyId, filters.companyId));
    if (filters?.vendorId) conditions.push(eq(attestationInquiries.vendorId, filters.vendorId));
    const query = db.select().from(attestationInquiries);
    if (conditions.length > 0) {
      return query.where(and(...conditions)).orderBy(desc(attestationInquiries.createdAt));
    }
    return query.orderBy(desc(attestationInquiries.createdAt));
  }

  async getAttestationInquiryById(id: string): Promise<AttestationInquiry | undefined> {
    const [row] = await db.select().from(attestationInquiries).where(eq(attestationInquiries.id, id));
    return row || undefined;
  }

  async updateAttestationInquiry(id: string, data: Partial<AttestationInquiry>): Promise<AttestationInquiry | undefined> {
    const [row] = await db.update(attestationInquiries).set(data as Partial<typeof attestationInquiries.$inferInsert>).where(eq(attestationInquiries.id, id)).returning();
    return row || undefined;
  }

  // Attestation Inquiry Quotes
  async createAttestationInquiryQuote(data: InsertAttestationInquiryQuote): Promise<AttestationInquiryQuote> {
    const [row] = await db.insert(attestationInquiryQuotes).values(data as typeof attestationInquiryQuotes.$inferInsert).returning();
    return row;
  }

  async getLatestQuoteForInquiry(inquiryId: string): Promise<AttestationInquiryQuote | undefined> {
    const rows = await db.select().from(attestationInquiryQuotes)
      .where(eq(attestationInquiryQuotes.inquiryId, inquiryId))
      .orderBy(desc(attestationInquiryQuotes.quoteVersion))
      .limit(1);
    return rows[0] || undefined;
  }

  async getQuotesByInquiry(inquiryId: string): Promise<AttestationInquiryQuote[]> {
    return db.select().from(attestationInquiryQuotes)
      .where(eq(attestationInquiryQuotes.inquiryId, inquiryId))
      .orderBy(desc(attestationInquiryQuotes.quoteVersion));
  }

  async getNextQuoteVersion(inquiryId: string): Promise<number> {
    const [result] = await db.select({ maxVer: sql<number>`coalesce(max(${attestationInquiryQuotes.quoteVersion}), 0)` })
      .from(attestationInquiryQuotes)
      .where(eq(attestationInquiryQuotes.inquiryId, inquiryId));
    return (Number(result?.maxVer || 0)) + 1;
  }

  // Document Custody Records (new standalone lifecycle module)
  async getDocumentCustodyRecords(filters?: { companyId?: string; woId?: string; custodyStage?: string; docCategory?: string; dateFrom?: Date; dateTo?: Date }): Promise<DocumentCustodyRecord[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filters?.companyId) conditions.push(eq(documentCustodyRecords.companyId, filters.companyId));
    if (filters?.woId) conditions.push(eq(documentCustodyRecords.woId, filters.woId));
    if (filters?.custodyStage) conditions.push(eq(documentCustodyRecords.custodyStage, filters.custodyStage as typeof documentCustodyRecords.custodyStage.enumValues[number]));
    if (filters?.docCategory) conditions.push(eq(documentCustodyRecords.docCategory, filters.docCategory as typeof documentCustodyRecords.docCategory.enumValues[number]));
    if (filters?.dateFrom) conditions.push(gte(documentCustodyRecords.createdAt, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(documentCustodyRecords.createdAt, filters.dateTo));

    if (conditions.length > 0) {
      return db.select().from(documentCustodyRecords).where(and(...conditions)).orderBy(desc(documentCustodyRecords.createdAt));
    }
    return db.select().from(documentCustodyRecords).orderBy(desc(documentCustodyRecords.createdAt));
  }

  async getDocumentCustodyRecordById(id: string): Promise<DocumentCustodyRecord | undefined> {
    const [row] = await db.select().from(documentCustodyRecords).where(eq(documentCustodyRecords.id, id));
    return row || undefined;
  }

  async getDocumentCustodyRecordsByWoId(woId: string): Promise<DocumentCustodyRecord[]> {
    return db.select().from(documentCustodyRecords).where(eq(documentCustodyRecords.woId, woId)).orderBy(desc(documentCustodyRecords.createdAt));
  }

  async createDocumentCustodyRecord(data: InsertDocumentCustodyRecord): Promise<DocumentCustodyRecord> {
    const [row] = await db.insert(documentCustodyRecords).values(data as typeof documentCustodyRecords.$inferInsert).returning();
    return row;
  }

  async updateDocumentCustodyRecord(id: string, data: Partial<InsertDocumentCustodyRecord>): Promise<DocumentCustodyRecord | undefined> {
    const [row] = await db.update(documentCustodyRecords)
      .set({ ...(data as Partial<typeof documentCustodyRecords.$inferInsert>), updatedAt: new Date() })
      .where(eq(documentCustodyRecords.id, id))
      .returning();
    return row || undefined;
  }

  async getNextCustodyRefNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CDC-${year}-`;
    const [result] = await db.select({ maxRef: sql<string>`max(reference_number)` })
      .from(documentCustodyRecords)
      .where(ilike(documentCustodyRecords.referenceNumber, `${prefix}%`));
    const maxRef = result?.maxRef;
    let nextNum = 1;
    if (maxRef) {
      const parts = maxRef.split("-");
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }
    return `${prefix}${String(nextNum).padStart(4, "0")}`;
  }

  async getDocumentCustodyHandoffs(recordId: string): Promise<DocumentCustodyHandoff[]> {
    return db.select().from(documentCustodyHandoffs)
      .where(eq(documentCustodyHandoffs.recordId, recordId))
      .orderBy(documentCustodyHandoffs.performedAt);
  }

  async createDocumentCustodyHandoff(data: InsertDocumentCustodyHandoff): Promise<DocumentCustodyHandoff> {
    const [row] = await db.insert(documentCustodyHandoffs).values(data as typeof documentCustodyHandoffs.$inferInsert).returning();
    return row;
  }

  async getDocumentCustodySummary(): Promise<{ withUs: number; withVendor: number; returnedThisMonth: number; overdue: number }> {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const overdueThreshold = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 14 days

    const [withUsResult] = await db.select({ count: sql<number>`count(*)` })
      .from(documentCustodyRecords).where(eq(documentCustodyRecords.custodyStage, "WithUs"));
    const [withVendorResult] = await db.select({ count: sql<number>`count(*)` })
      .from(documentCustodyRecords).where(eq(documentCustodyRecords.custodyStage, "WithVendor"));
    const [returnedResult] = await db.select({ count: sql<number>`count(*)` })
      .from(documentCustodyRecords).where(
        and(eq(documentCustodyRecords.custodyStage, "ReturnedToClient"), gte(documentCustodyRecords.updatedAt, firstOfMonth))
      );
    const [overdueResult] = await db.select({ count: sql<number>`count(*)` })
      .from(documentCustodyRecords).where(
        and(
          or(eq(documentCustodyRecords.custodyStage, "WithUs"), eq(documentCustodyRecords.custodyStage, "WithVendor")),
          lte(documentCustodyRecords.updatedAt, overdueThreshold)
        )
      );

    return {
      withUs: Number(withUsResult?.count || 0),
      withVendor: Number(withVendorResult?.count || 0),
      returnedThisMonth: Number(returnedResult?.count || 0),
      overdue: Number(overdueResult?.count || 0),
    };
  }
}

export const storage = new DatabaseStorage();

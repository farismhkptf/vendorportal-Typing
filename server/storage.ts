import { 
  users, staff, centers, companies, companyEmails, serviceTypes, 
  workOrders, appointments, rescheduleRequests, jobTypes, vendors,
  typingJobs, typingJobResults, typingJobComments, files, messages, woNotes,
  vendorWalletLedger, vendorStatements, vendorInvoices, appSettings, auditLog,
  woDocuments, documentRequirements,
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
  type WoNote, type InsertWoNote
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, or, ilike, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  
  // Staff
  getStaff(): Promise<Staff[]>;
  getStaffById(id: string): Promise<Staff | undefined>;
  createStaff(data: InsertStaff): Promise<Staff>;
  updateStaff(id: string, data: Partial<InsertStaff>): Promise<Staff | undefined>;
  deleteStaff(id: string): Promise<boolean>;
  bulkDeleteStaff(ids: string[]): Promise<number>;
  
  // Centers
  getCenters(): Promise<Center[]>;
  getCenterById(id: string): Promise<Center | undefined>;
  createCenter(data: InsertCenter): Promise<Center>;
  updateCenter(id: string, data: Partial<InsertCenter>): Promise<Center | undefined>;
  deleteCenter(id: string): Promise<boolean>;
  bulkDeleteCenters(ids: string[]): Promise<number>;
  
  // Companies
  getCompanies(): Promise<Company[]>;
  getCompanyById(id: string): Promise<Company | undefined>;
  createCompany(data: InsertCompany): Promise<Company>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined>;
  getCompanyEmails(companyId: string): Promise<CompanyEmail[]>;
  createCompanyEmail(data: InsertCompanyEmail): Promise<CompanyEmail>;
  getWorkOrderCountsByCompany(): Promise<Record<string, number>>;
  
  // Service Types
  getServiceTypes(): Promise<ServiceType[]>;
  getServiceTypeById(id: string): Promise<ServiceType | undefined>;
  createServiceType(data: InsertServiceType): Promise<ServiceType>;
  updateServiceType(id: string, data: Partial<InsertServiceType>): Promise<ServiceType | undefined>;
  deleteServiceType(id: string): Promise<boolean>;
  bulkCreateServiceTypes(names: string[]): Promise<ServiceType[]>;
  bulkDeleteServiceTypes(ids: string[]): Promise<number>;
  
  // Work Orders
  getWorkOrders(search?: string, status?: string): Promise<WorkOrder[]>;
  getWorkOrderById(id: string): Promise<WorkOrder | undefined>;
  getWorkOrderByWoNumber(woNumber: string): Promise<WorkOrder | undefined>;
  createWorkOrder(data: InsertWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(id: string, data: Partial<InsertWorkOrder>): Promise<WorkOrder | undefined>;
  deleteWorkOrder(id: string): Promise<boolean>;
  getNextWoNumber(): Promise<string>;
  
  // Appointments
  getAppointmentsByWoId(woId: string): Promise<Appointment[]>;
  getAppointmentByToken(token: string): Promise<Appointment | undefined>;
  createAppointment(data: InsertAppointment): Promise<Appointment>;
  getTodayAppointments(): Promise<Appointment[]>;
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
  getTypingJobsByVendorId(vendorId: string): Promise<TypingJob[]>;
  createTypingJob(data: InsertTypingJob): Promise<TypingJob>;
  updateTypingJob(id: string, data: Partial<InsertTypingJob>): Promise<TypingJob | undefined>;
  generateNextJobCode(category: "Medical" | "EID"): Promise<string>;
  
  // Typing Job Results
  getTypingJobResult(typingJobId: string): Promise<TypingJobResult | undefined>;
  createTypingJobResult(data: InsertTypingJobResult): Promise<TypingJobResult>;
  updateTypingJobResult(typingJobId: string, data: Partial<InsertTypingJobResult>): Promise<TypingJobResult | undefined>;
  
  // Typing Job Comments
  getTypingJobComments(typingJobId: string): Promise<TypingJobComment[]>;
  createTypingJobComment(data: InsertTypingJobComment): Promise<TypingJobComment>;
  
  // Files
  getFilesByRelated(relatedType: string, relatedId: string): Promise<File[]>;
  createFile(data: InsertFile): Promise<File>;
  deleteFile(id: string): Promise<boolean>;
  
  // Vendor Wallet
  getWalletBalance(vendorId: string): Promise<number>;
  getWalletLedger(vendorId: string): Promise<VendorWalletLedger[]>;
  createWalletEntry(data: InsertVendorWalletLedger): Promise<VendorWalletLedger>;
  getMonthlyStats(vendorId: string): Promise<{ topups: number; spend: number }>;
  
  // App Settings
  getAppSettings(): Promise<AppSettings | undefined>;
  updateAppSettings(data: Partial<AppSettings>): Promise<AppSettings | undefined>;
  
  // Work Order Notes
  getWoNotes(woId: string): Promise<WoNote[]>;
  createWoNote(data: InsertWoNote): Promise<WoNote>;
  deleteWoNote(id: string): Promise<boolean>;

  // Audit Log
  getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;
  getRecentAuditLogs(limit?: number): Promise<AuditLog[]>;
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;
  
  // Work Order Documents
  getWoDocuments(woId: string): Promise<WoDocument[]>;
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
}

export class DatabaseStorage implements IStorage {
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

  // Staff
  async getStaff(): Promise<Staff[]> {
    return db.select().from(staff).where(eq(staff.active, true));
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
    await db.delete(staff).where(eq(staff.id, id));
    return true;
  }

  async bulkDeleteStaff(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await db.delete(staff).where(inArray(staff.id, ids)).returning();
    return result.length;
  }

  // Centers
  async getCenters(): Promise<Center[]> {
    return db.select().from(centers).where(eq(centers.active, true));
  }

  async getCenterById(id: string): Promise<Center | undefined> {
    const [center] = await db.select().from(centers).where(eq(centers.id, id));
    return center || undefined;
  }

  async createCenter(data: InsertCenter): Promise<Center> {
    const [center] = await db.insert(centers).values(data as any).returning();
    return center;
  }

  async updateCenter(id: string, data: Partial<InsertCenter>): Promise<Center | undefined> {
    const [center] = await db.update(centers).set(data as any).where(eq(centers.id, id)).returning();
    return center || undefined;
  }

  async deleteCenter(id: string): Promise<boolean> {
    const existing = await this.getCenterById(id);
    if (!existing) return false;
    await db.delete(centers).where(eq(centers.id, id));
    return true;
  }

  async bulkDeleteCenters(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await db.delete(centers).where(inArray(centers.id, ids)).returning();
    return result.length;
  }

  // Companies
  async getCompanies(): Promise<Company[]> {
    return db.select().from(companies).where(eq(companies.active, true));
  }

  async getCompanyById(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
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

  async createCompanyEmail(data: InsertCompanyEmail): Promise<CompanyEmail> {
    const existing = await this.getCompanyEmails(data.companyId);
    if (existing.length >= 3) {
      throw new Error("Maximum 3 emails per company allowed");
    }
    const [email] = await db.insert(companyEmails).values(data).returning();
    return email;
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
      conditions.push(eq(workOrders.status, status as any));
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

  async getWorkOrderByWoNumber(woNumber: string): Promise<WorkOrder | undefined> {
    const [wo] = await db.select().from(workOrders).where(eq(workOrders.woNumber, woNumber));
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
    
    // Cascade delete related records first
    await db.delete(appointments).where(eq(appointments.woId, id));
    await db.delete(typingJobs).where(eq(typingJobs.woId, id));
    
    // Delete the work order itself
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

  // Appointments
  async getAppointmentsByWoId(woId: string): Promise<Appointment[]> {
    return db.select().from(appointments).where(eq(appointments.woId, woId));
  }

  async getAppointmentByToken(token: string): Promise<Appointment | undefined> {
    const [apt] = await db.select().from(appointments).where(eq(appointments.rescheduleToken, token));
    return apt || undefined;
  }

  async createAppointment(data: InsertAppointment): Promise<Appointment> {
    const [apt] = await db.insert(appointments).values(data).returning();
    return apt;
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
        eq(appointments.type, type as any),
        inArray(appointments.status, ["Scheduled", "Completed"])
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
      return db.select().from(typingJobs).where(eq(typingJobs.status, status as any)).orderBy(desc(typingJobs.createdAt));
    }
    return db.select().from(typingJobs).orderBy(desc(typingJobs.createdAt));
  }

  async getTypingJobsByWoId(woId: string): Promise<TypingJob[]> {
    return db.select().from(typingJobs).where(eq(typingJobs.woId, woId));
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

  // Files
  async getFilesByRelated(relatedType: string, relatedId: string): Promise<File[]> {
    return db.select().from(files).where(and(eq(files.relatedType, relatedType), eq(files.relatedId, relatedId))).orderBy(desc(files.createdAt));
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
    
    return entries.reduce((balance, entry) => {
      if (entry.entryType === "Topup" || entry.entryType === "Reversal") {
        return balance + entry.amount;
      } else if (entry.entryType === "Debit") {
        return balance - entry.amount;
      }
      return balance;
    }, 0);
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
      const [created] = await db.insert(appSettings).values(data as any).returning();
      return created || undefined;
    }
  }

  // Seed data (only in development) - minimal bootstrap only
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
      { name: "LUME COLLECTIVE TECHNOLOGY LLC", clientCoordinator: { name: "Karishma", email: "hr@innovixtech.io", mobile: "" }, clientManager: { name: "Jania", email: "hr.manager@innovixtech.io", mobile: "" }, clientAccountant: { name: "Tony", email: "admin.1@innovixtech.io", mobile: "" } },
      { name: "ROSE IDEAS TECH CO. L.L.C", clientCoordinator: { name: "Karishma", email: "hr@innovixtech.io", mobile: "" }, clientManager: { name: "Jania", email: "hr.manager@innovixtech.io", mobile: "" }, clientAccountant: { name: "Tony", email: "admin.1@innovixtech.io", mobile: "" } },
      { name: "PETALS PAYMENT TECHNOLOGY CO L.L.C", clientCoordinator: { name: "Karishma", email: "hr@innovixtech.io", mobile: "" }, clientManager: { name: "Jania", email: "hr.manager@innovixtech.io", mobile: "" }, clientAccountant: { name: "Tony", email: "admin.1@innovixtech.io", mobile: "" } },
      { name: "NITYO INFOTECH IT SERVICES EST.", clientCoordinator: { name: "Anand", email: "", mobile: "" }, clientManager: { name: "Anand", email: "", mobile: "" }, clientAccountant: { name: "Anand", email: "", mobile: "" } },
      { name: "ASRL GENERAL TRADING L.L.C", clientCoordinator: { name: "Suwaid", email: "", mobile: "" }, clientManager: { name: "Suwaid", email: "", mobile: "" }, clientAccountant: { name: "Suwaid", email: "", mobile: "" } },
      { name: "TRIP TO GO TOURISM L.L.C", clientCoordinator: { name: "Haris", email: "", mobile: "" }, clientManager: { name: "Haris", email: "", mobile: "" }, clientAccountant: { name: "Haris", email: "", mobile: "" } },
      { name: "EASTERN FORTUNE INVESTMENTS L.L.C", clientCoordinator: { name: "HR", email: "hr@eastf.com", mobile: "" }, clientManager: { name: "Jomelyn Hernandez", email: "jomelyn@eastf.com", mobile: "" }, clientAccountant: { name: "Ellen", email: "finance@eastf.com", mobile: "" } },
      { name: "EASTERN WEALTH INVESTMENTS L.L.C", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientAccountant: { name: "Ellen", email: "finance@eastf.com", mobile: "" } },
      { name: "FIRST LUXURY FACILITIES MANAGEMENT SERVICES CO L.L.C", clientCoordinator: { name: "Jomelyn Hernandez", email: "jomelyn@eastf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientAccountant: { name: "Ellen", email: "finance@eastf.com", mobile: "" } },
      { name: "PAY TEN GLOBAL TECHNOLOGY L.L.C", clientCoordinator: { name: "Meghna", email: "meghna.santhosh@pay10.com", mobile: "" }, clientManager: { name: "Tasneem", email: "tasneem.lokhandwala@pay10.com", mobile: "" }, clientAccountant: { name: "Jason", email: "globalpayroll@pay10.com", mobile: "" } },
      { name: "PAY TEN PAYMENT SERVICES PROVIDER L.L.C", clientCoordinator: { name: "Fatima", email: "fatma.alblooshi@pay10.ae", mobile: "" }, clientManager: { name: "Merna", email: "merna.mohamed@pay10.ae", mobile: "" }, clientAccountant: { name: "Jason", email: "finance@pay10.ae", mobile: "" } },
      { name: "POS10 TECHNOLOGIES L.L.C", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientAccountant: { name: "Ellen", email: "finance@eastf.com", mobile: "" } },
      { name: "FIRST EDGE TECHNOLOGIES CO LLC", clientCoordinator: { name: "Jomelyn Hernandez", email: "jomelyn@eastf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientAccountant: { name: "Ellen", email: "finance@eastf.com", mobile: "" } },
      { name: "FIRST PLUS PROPERTY CARE CO LLC", clientCoordinator: { name: "Jomelyn Hernandez", email: "jomelyn@eastf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientAccountant: { name: "Ellen", email: "", mobile: "" } },
      { name: "NEXTGEN TECHNOLOGIES EST", clientCoordinator: { name: "Jayaraj", email: "", mobile: "" }, clientManager: { name: "Jayaraj", email: "", mobile: "" }, clientAccountant: { name: "Jayaraj", email: "", mobile: "" } },
      { name: "BAITH DAHABI PROJECT MANAGEMENT SERVICES", clientCoordinator: { name: "", email: "", mobile: "" }, clientManager: { name: "", email: "", mobile: "" }, clientAccountant: { name: "", email: "", mobile: "" } },
      { name: "SKYGEN TRADING L.L.C - MAIN (MARINA)", clientCoordinator: { name: "Info", email: "info@skygentrading.com", mobile: "" }, clientManager: { name: "Sagar", email: "info@skygentrading.com", mobile: "" }, clientAccountant: { name: "Accounts", email: "accounts@skygentrading.com", mobile: "" } },
      { name: "SKYGEN TRADING L.L.C - BRANCH 1 (JUMEIRA)", clientCoordinator: { name: "Info", email: "info@skygentrading.com", mobile: "" }, clientManager: { name: "Sagar", email: "info@skygentrading.com", mobile: "" }, clientAccountant: { name: "Accounts", email: "accounts@skygentrading.com", mobile: "" } },
      { name: "SKYGEN TRADING L.L.C - BRANCH 2 (BLUEWATERS)", clientCoordinator: { name: "Info", email: "info@skygentrading.com", mobile: "" }, clientManager: { name: "Sagar", email: "info@skygentrading.com", mobile: "" }, clientAccountant: { name: "Accounts", email: "accounts@skygentrading.com", mobile: "" } },
      { name: "CASPERWASP TECHNOLOGIES CO. L.L.C", clientCoordinator: { name: "Gopal", email: "", mobile: "" }, clientManager: { name: "Gopal", email: "", mobile: "" }, clientAccountant: { name: "Gopal", email: "", mobile: "" } },
      { name: "DZONE TRADING LLC", clientCoordinator: { name: "Rahul", email: "", mobile: "" }, clientManager: { name: "Rahul", email: "", mobile: "" }, clientAccountant: { name: "Rahul", email: "", mobile: "" } },
      { name: "DOLPHIN BLENDS PERFUMES & COSMETICS TRADING CO. L.L.C", clientCoordinator: { name: "Sajila", email: "", mobile: "" }, clientManager: { name: "Najeeb", email: "", mobile: "" }, clientAccountant: { name: "Najeeb", email: "", mobile: "" } },
      { name: "MEKINA TECHNICAL SERVICES", clientCoordinator: { name: "Ajmal", email: "", mobile: "" }, clientManager: { name: "Ajmal", email: "", mobile: "" }, clientAccountant: { name: "Ajmal", email: "", mobile: "" } },
      { name: "MUNTAJ TAHRIR PROJECT MANAGEMENT SERVICES EST", clientCoordinator: { name: "Shibeesh", email: "", mobile: "" }, clientManager: { name: "Deepthy", email: "", mobile: "" }, clientAccountant: { name: "Shibeesh", email: "", mobile: "" } },
      { name: "LORDE EVENT MANAGEMENT CO. L.L.C", clientCoordinator: { name: "Anand", email: "", mobile: "" }, clientManager: { name: "Anand", email: "", mobile: "" }, clientAccountant: { name: "Anand", email: "", mobile: "" } },
      { name: "W C H E M DISINFECTION & STERILIZATION L.L.C", clientCoordinator: { name: "Vigi", email: "vigi@wchem.com", mobile: "" }, clientManager: { name: "Deena", email: "deenanaidu@yahoo.com", mobile: "" }, clientAccountant: { name: "Deena", email: "deenanaidu@yahoo.com", mobile: "" } },
      { name: "AUTO SKY CAR SERVICE LLC", clientCoordinator: { name: "Salsabeel", email: "", mobile: "" }, clientManager: { name: "Salsabeel", email: "", mobile: "" }, clientAccountant: { name: "Salsabeel", email: "", mobile: "" } },
      { name: "COSMOLINK TRADING LLC", clientCoordinator: { name: "Mithun", email: "", mobile: "" }, clientManager: { name: "Mithun", email: "", mobile: "" }, clientAccountant: { name: "Mithun", email: "", mobile: "" } },
      { name: "MISS OCD TECHNICAL SERVICES CO LLC SOC", clientCoordinator: { name: "Mandana Kareemi", email: "", mobile: "" }, clientManager: { name: "Mandana Kareemi", email: "", mobile: "" }, clientAccountant: { name: "Mandana Kareemi", email: "", mobile: "" } },
      { name: "POS10 GLOBAL INVESTMENTS L.L.C", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientAccountant: { name: "Aditya", email: "aditya@easf.com", mobile: "" } },
      { name: "BLUME A I ARTIFICIAL INTELLIGENCE CONSULTANCIES L.L.C", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientAccountant: { name: "Aditya", email: "aditya@easf.com", mobile: "" } },
      { name: "ALPHA EDGE SECURITY CONSULTANCIES LLC S.O.C", clientCoordinator: { name: "Vibhor", email: "vibhor@eastf.com", mobile: "" }, clientManager: { name: "VB", email: "", mobile: "" }, clientAccountant: { name: "Isa", email: "", mobile: "" } },
      { name: "COLIFE VACATION HOMES L.L.C", clientCoordinator: { name: "General", email: "lawyer@colife.ae", mobile: "" }, clientManager: { name: "Artem", email: "lawyer@colife.ae", mobile: "" }, clientAccountant: { name: "Arun Tomy", email: "arun.accounts@colife.ae", mobile: "" } },
      { name: "COLIFE REAL ESTATE L.L.C", clientCoordinator: { name: "General", email: "lawyer@colife.ae", mobile: "" }, clientManager: { name: "Artem", email: "lawyer@colife.ae", mobile: "" }, clientAccountant: { name: "Arun Tomy", email: "arun.accounts@colife.ae", mobile: "" } },
      { name: "RAGHAV MANAGEMENT SERVICES EST", clientCoordinator: { name: "Anand", email: "", mobile: "" }, clientManager: { name: "Anand", email: "", mobile: "" }, clientAccountant: { name: "Anand", email: "", mobile: "" } },
      { name: "AYUR MINAR KOTTAKKAL AYURVEDIC MEDICAL CENTER", clientCoordinator: { name: "Jinu", email: "", mobile: "" }, clientManager: { name: "Sebastian", email: "", mobile: "" }, clientAccountant: { name: "Sebastian", email: "", mobile: "" } },
      // COMPANIES THAT ARE NOT DUBAI MAINLAND
      { name: "QUANTRA GLOBAL FZE LLC (SPC)", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientAccountant: { name: "Ellen", email: "finance@eastf.com", mobile: "" } },
      { name: "EASTERN COLLECTIBLE FZCO (IFZA)", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientAccountant: { name: "Ellen", email: "finance@eastf.com", mobile: "" } },
      { name: "EASTERN WEALTH FOUNDATION - ABUDHABI", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientAccountant: { name: "Ellen", email: "finance@eastf.com", mobile: "" } },
      { name: "THE CREATIVE CLUB FZE", clientCoordinator: { name: "Jomelyn", email: "jomelyn@eastf.com", mobile: "" }, clientManager: { name: "Slim", email: "jomelyn@eastf.com", mobile: "" }, clientAccountant: { name: "Jomelyn", email: "jomelyn@eastf.com", mobile: "" } },
      { name: "EASTERN FORTUNE LIMITED (RAK)", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientAccountant: { name: "Aditya", email: "aditya@easf.com", mobile: "" } },
      { name: "KSKA INVESTMENTS L.L.C S.O.C", clientCoordinator: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientManager: { name: "Aditya", email: "aditya@easf.com", mobile: "" }, clientAccountant: { name: "Aditya", email: "aditya@easf.com", mobile: "" } },
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
        clientAccountant: companyData.clientAccountant.name ? companyData.clientAccountant : null,
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

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLog).values(data).returning();
    return log;
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
    return db.select().from(documentRequirements).where(eq(documentRequirements.serviceCategory, category as any));
  }

  async createDocumentRequirement(data: InsertDocumentRequirement): Promise<DocumentRequirement> {
    const [req] = await db.insert(documentRequirements).values(data).returning();
    return req;
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
}

export const storage = new DatabaseStorage();

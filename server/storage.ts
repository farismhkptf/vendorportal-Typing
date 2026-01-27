import { 
  users, staff, centers, companies, companyEmails, serviceTypes, 
  workOrders, appointments, rescheduleRequests, jobTypes, vendors,
  typingJobs, typingJobResults, typingJobComments, files, messages,
  vendorWalletLedger, vendorStatements, vendorInvoices, appSettings, auditLog,
  type User, type InsertUser, type Staff, type InsertStaff,
  type Center, type InsertCenter, type Company, type InsertCompany,
  type CompanyEmail, type InsertCompanyEmail, type ServiceType, type InsertServiceType,
  type WorkOrder, type InsertWorkOrder, type Appointment, type InsertAppointment,
  type RescheduleRequest, type InsertRescheduleRequest, type JobType, type InsertJobType,
  type Vendor, type InsertVendor, type TypingJob, type InsertTypingJob,
  type TypingJobResult, type InsertTypingJobResult, type TypingJobComment, type InsertTypingJobComment,
  type VendorWalletLedger, type InsertVendorWalletLedger, type AppSettings
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, or, ilike } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Staff
  getStaff(): Promise<Staff[]>;
  getStaffById(id: string): Promise<Staff | undefined>;
  createStaff(data: InsertStaff): Promise<Staff>;
  updateStaff(id: string, data: Partial<InsertStaff>): Promise<Staff | undefined>;
  deleteStaff(id: string): Promise<boolean>;
  
  // Centers
  getCenters(): Promise<Center[]>;
  getCenterById(id: string): Promise<Center | undefined>;
  createCenter(data: InsertCenter): Promise<Center>;
  
  // Companies
  getCompanies(): Promise<Company[]>;
  getCompanyById(id: string): Promise<Company | undefined>;
  createCompany(data: InsertCompany): Promise<Company>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined>;
  getCompanyEmails(companyId: string): Promise<CompanyEmail[]>;
  createCompanyEmail(data: InsertCompanyEmail): Promise<CompanyEmail>;
  
  // Service Types
  getServiceTypes(): Promise<ServiceType[]>;
  createServiceType(data: InsertServiceType): Promise<ServiceType>;
  
  // Work Orders
  getWorkOrders(search?: string, status?: string): Promise<WorkOrder[]>;
  getWorkOrderById(id: string): Promise<WorkOrder | undefined>;
  createWorkOrder(data: InsertWorkOrder): Promise<WorkOrder>;
  getNextWoNumber(): Promise<string>;
  
  // Appointments
  getAppointmentsByWoId(woId: string): Promise<Appointment[]>;
  getAppointmentByToken(token: string): Promise<Appointment | undefined>;
  createAppointment(data: InsertAppointment): Promise<Appointment>;
  getTodayAppointments(): Promise<Appointment[]>;
  
  // Reschedule Requests
  createRescheduleRequest(data: InsertRescheduleRequest): Promise<RescheduleRequest>;
  
  // Job Types
  getJobTypes(): Promise<JobType[]>;
  getJobTypeById(id: string): Promise<JobType | undefined>;
  
  // Vendors
  getVendors(): Promise<Vendor[]>;
  getVendorById(id: string): Promise<Vendor | undefined>;
  createVendor(data: InsertVendor): Promise<Vendor>;
  
  // Typing Jobs
  getTypingJobs(status?: string): Promise<TypingJob[]>;
  getTypingJobsByWoId(woId: string): Promise<TypingJob[]>;
  getTypingJobsByVendorId(vendorId: string): Promise<TypingJob[]>;
  createTypingJob(data: InsertTypingJob): Promise<TypingJob>;
  
  // Vendor Wallet
  getWalletBalance(vendorId: string): Promise<number>;
  getWalletLedger(vendorId: string): Promise<VendorWalletLedger[]>;
  createWalletEntry(data: InsertVendorWalletLedger): Promise<VendorWalletLedger>;
  getMonthlyStats(vendorId: string): Promise<{ topups: number; spend: number }>;
  
  // App Settings
  getAppSettings(): Promise<AppSettings | undefined>;
  
  // Seed data
  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
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

  // Centers
  async getCenters(): Promise<Center[]> {
    return db.select().from(centers).where(eq(centers.active, true));
  }

  async getCenterById(id: string): Promise<Center | undefined> {
    const [center] = await db.select().from(centers).where(eq(centers.id, id));
    return center || undefined;
  }

  async createCenter(data: InsertCenter): Promise<Center> {
    const [center] = await db.insert(centers).values(data).returning();
    return center;
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

  // Service Types
  async getServiceTypes(): Promise<ServiceType[]> {
    return db.select().from(serviceTypes).where(eq(serviceTypes.active, true));
  }

  async createServiceType(data: InsertServiceType): Promise<ServiceType> {
    const [type] = await db.insert(serviceTypes).values(data).returning();
    return type;
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

  async createWorkOrder(data: InsertWorkOrder): Promise<WorkOrder> {
    const [wo] = await db.insert(workOrders).values(data).returning();
    return wo;
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

  // Seed data (only in development)
  async seedData(): Promise<void> {
    // Only seed in development
    if (process.env.NODE_ENV === 'production') return;
    
    // Check if already seeded
    const existingStaff = await db.select().from(staff);
    if (existingStaff.length > 0) return;

    // Seed staff
    await db.insert(staff).values([
      { name: "Faris", roleTitle: "Admin", email: "faris@procompany.ae" },
      { name: "Yasin", roleTitle: "Ops Manager", email: "yasin@procompany.ae" },
      { name: "Amal", roleTitle: "PRO", email: "amal@procompany.ae" },
      { name: "Shahul", roleTitle: "PRO", email: "shahul@procompany.ae" },
    ]);

    // Seed job types with fixed costs
    await db.insert(jobTypes).values([
      { name: "Medical Typing – Normal", category: "Medical", cost: 290 },
      { name: "Medical Typing – VIP", category: "Medical", cost: 720 },
      { name: "Emirates ID Application – 1 Year", category: "EID", cost: 270 },
      { name: "Emirates ID Application – 2 Year", category: "EID", cost: 370 },
      { name: "Emirates ID Application – 10 Years", category: "EID", cost: 1200 },
      { name: "Emirates ID Replacement", category: "EID", cost: 470 },
    ]);

    // Seed vendor
    const [vendor] = await db.insert(vendors).values({
      name: "Default Vendor",
      contactPerson: "Vendor Contact",
      email: "vendor@example.com",
    }).returning();

    // Seed vendor user
    await db.insert(users).values({
      name: "Vendor User",
      email: "vendor@procompany.ae",
      passwordHash: "vendor123", // In production, this should be hashed
      role: "Vendor",
      vendorId: vendor.id,
    });

    // Seed admin user
    await db.insert(users).values({
      name: "Admin",
      email: "admin@procompany.ae",
      passwordHash: "admin123", // In production, this should be hashed
      role: "Admin",
    });

    // Seed app settings
    await db.insert(appSettings).values({
      fromEmail: "notifications@procompany.ae",
      fromName: "The P.R.O. Company",
      replyToEmail: "operations@procompany.ae",
      alwaysCc: ["faris@procompany.ae", "yasin@procompany.ae"],
      lowBalanceThreshold: 1000,
    });

    // Seed sample centers
    await db.insert(centers).values([
      { name: "AMER Center - Dubai Mall", type: "Both", area: "Downtown Dubai" },
      { name: "DHA Medical Fitness Center", type: "Medical", area: "Al Barsha" },
      { name: "ICA Emirates ID Center", type: "EID", area: "Al Twar" },
    ]);

    // Seed sample company
    const [company] = await db.insert(companies).values({
      name: "Sample Company LLC",
    }).returning();

    await db.insert(companyEmails).values([
      { companyId: company.id, label: "HR", email: "hr@samplecompany.ae", sortOrder: 0 },
      { companyId: company.id, label: "Admin", email: "admin@samplecompany.ae", sortOrder: 1 },
    ]);

    // Seed sample service types
    await db.insert(serviceTypes).values([
      { name: "New Employment Visa" },
      { name: "Visa Renewal" },
      { name: "Visa Cancellation" },
      { name: "Status Change" },
    ]);

    // Add initial wallet topup
    await db.insert(vendorWalletLedger).values({
      vendorId: vendor.id,
      entryType: "Topup",
      amount: 5000,
      note: "Initial advance top-up",
    });

    console.log("Database seeded successfully!");
  }
}

export const storage = new DatabaseStorage();

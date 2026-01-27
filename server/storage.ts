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
  
  // Seed real companies
  seedRealCompanies(): Promise<{ added: number; skipped: number }>;
  
  // Seed medical centers
  seedMedicalCenters(): Promise<{ added: number; skipped: number }>;
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

    // Real companies will be seeded separately via the seedRealCompanies function
    // (removed sample company)

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
}

export const storage = new DatabaseStorage();

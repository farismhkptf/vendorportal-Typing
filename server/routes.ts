import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import ExcelJS from 'exceljs';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { z } from "zod";
import { 
  insertWorkOrderSchema, insertCompanySchema, insertStaffSchema,
  insertCenterSchema, insertServiceTypeSchema, insertJobTypeSchema, loginSchema,
  insertAppointmentSchema, insertTypingJobSchema, insertWoNoteSchema,
  insertTypingJobCommentSchema, insertFileSchema,
  type CenterTimings, type InsertVendorNotification, type InsertStaffNotification,
  type Staff, type WoDocument, type AppSettings, ROLE_CATEGORIES
} from "@shared/schema";
import { validateAppointmentTime, getAvailableTimeSlots, isCenterOpenOnDate } from "@shared/scheduling";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { toProperCase } from "./proper-case";
import { executeTransition, validateTransition, type Actor, type TypingJobStatus } from "./typing-job-machine";
import { WalletService } from "./wallet-service";
import { registerExternalRoutes, hashApiKey } from "./external-routes";
import { syncFileToWorkDrive, isWorkDriveConfigured, testWorkDriveConnection, getOrCreateExportFolder, uploadFileToWorkDrive } from "./zoho-workdrive";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import { buildAppointmentEmail } from "./email-templates/appointment-confirmation";
import { sendEmail, isEmailConfigured } from "./email-service";
import UAParser from "ua-parser-js";
import { generateAppointmentPass } from "./apple-pass";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function addJsonSheet(workbook: ExcelJS.Workbook, data: Record<string, any>[], name: string) {
  const ws = workbook.addWorksheet(name);
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  ws.addRow(headers);
  data.forEach(row => ws.addRow(headers.map(h => row[h] ?? "")));
}

function addAoaSheet(workbook: ExcelJS.Workbook, data: any[][], name: string, colWidths?: number[]) {
  const ws = workbook.addWorksheet(name);
  ws.addRows(data);
  if (colWidths) {
    colWidths.forEach((width, i) => { ws.getColumn(i + 1).width = width; });
  }
}

function excelSheetToJson(ws: ExcelJS.Worksheet): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  let headers: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = (row.values as any[]).slice(1);
    if (rowNumber === 1) {
      headers = values.map(v => v?.toString() ?? "");
      return;
    }
    const obj: Record<string, any> = {};
    headers.forEach((header, i) => {
      const val = values[i];
      if (val === null || val === undefined) {
        obj[header] = "";
      } else if (typeof val === 'object' && 'text' in val) {
        obj[header] = val.text;
      } else if (typeof val === 'object' && 'result' in val) {
        obj[header] = val.result?.toString() ?? "";
      } else {
        obj[header] = val;
      }
    });
    rows.push(obj);
  });
  return rows;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];
  
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current);
        current = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(current);
        current = '';
        if (row.some(cell => cell.trim())) rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else {
        current += ch;
      }
    }
  }
  if (current || row.length > 0) {
    row.push(current);
    if (row.some(cell => cell.trim())) rows.push(row);
  }
  return rows;
}

const topupSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  amount: z.number().positive(),
  note: z.string().optional(),
});

const rescheduleSubmitSchema = z.object({
  requestedDatetime: z.string(),
  notes: z.string().optional(),
});

const vendorLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { data: T } | { error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return { error: result.error.errors.map(e => e.message).join(", ") };
  }
  return { data: result.data };
}

const loginRateMap = new Map<string, { count: number; resetAt: number; blockedUntil: number }>();
const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW = 60 * 1000;
const LOGIN_BLOCK_DURATION = 5 * 60 * 1000;

function loginRateLimit(req: any, res: any, next: any) {
  const ip = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  const now = Date.now();
  const entry = loginRateMap.get(ip);

  if (entry && now < entry.blockedUntil) {
    const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
    return res.status(429).json({ message: `Too many login attempts. Try again in ${retryAfter} seconds.` });
  }

  if (entry && now > entry.resetAt) {
    loginRateMap.delete(ip);
  }

  next();
}

function recordFailedLogin(ip: string) {
  const now = Date.now();
  const entry = loginRateMap.get(ip) || { count: 0, resetAt: now + LOGIN_RATE_WINDOW, blockedUntil: 0 };
  entry.count++;
  if (entry.count >= LOGIN_RATE_LIMIT) {
    entry.blockedUntil = now + LOGIN_BLOCK_DURATION;
  }
  loginRateMap.set(ip, entry);
}

function clearFailedLogins(ip: string) {
  loginRateMap.delete(ip);
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validateEmailField(email: string | null | undefined): boolean {
  if (!email || email.trim() === "") return true;
  return emailRegex.test(email);
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

function requireVendorAuth(req: any, res: any, next: any) {
  if (!req.session?.vendorUserId) {
    return res.status(401).json({ message: "Vendor authentication required" });
  }
  next();
}

function requireRole(...roles: string[]) {
  return async (req: any, res: any, next: any) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
}

const requireOpsRole = requireRole("Admin", "Client Relationship Manager");

async function checkAndAutoTransitionWorkOrder(woId: string): Promise<void> {
  try {
    const wo = await storage.getWorkOrderById(woId);
    if (!wo || wo.status === "Completed" || wo.status === "Cancelled") return;
    if (!wo.serviceTypeId) return;

    const serviceType = await storage.getServiceTypeById(wo.serviceTypeId);
    if (!serviceType) return;

    const jobs = await storage.getTypingJobsByWoId(woId);
    const appts = await storage.getAppointmentsByWoId(woId);

    const activeJobs = jobs.filter(j => j.status !== "Aborted");
    const vendorStatuses = ["SubmittedToVendor", "InProcess"];
    const terminalJobStatuses = ["ReadyForScheduling", "Returned"];

    const medJobs = activeJobs.filter(j => (j.jobCode || "").startsWith("M"));
    const eidJobs = activeJobs.filter(j => (j.jobCode || "").startsWith("E"));
    const medAppts = appts.filter(a => a.type === "Medical" && a.status !== "Cancelled" && a.status !== "Rescheduled");
    const eidAppts = appts.filter(a => a.type === "EID" && a.status !== "Cancelled" && a.status !== "Rescheduled");

    const needsMedical = !wo.isMinor && (serviceType.requiresMedicalTyping || serviceType.requiresMedicalScheduling);
    const needsEid = serviceType.requiresIdTyping2Years || serviceType.requiresIdTyping1Year
      || serviceType.requiresIdTyping10Years || serviceType.requiresIdBiometrics;

    let newStatus: "AtVendor" | "ReadyToSchedule" | null = null;

    const hasVendorJobs = activeJobs.some(j => vendorStatuses.includes(j.status));
    if (hasVendorJobs && wo.status === "Draft") {
      newStatus = "AtVendor";
    }

    const medTypingDone = !serviceType.requiresMedicalTyping || !needsMedical
      || (medJobs.length > 0 && medJobs.every(j => terminalJobStatuses.includes(j.status)));
    const eidTypingDone = !(serviceType.requiresIdTyping2Years || serviceType.requiresIdTyping1Year || serviceType.requiresIdTyping10Years)
      || (eidJobs.length > 0 && eidJobs.every(j => terminalJobStatuses.includes(j.status)));
    const hasAnyJobs = medJobs.length > 0 || eidJobs.length > 0;
    const allRequiredTypingDone = hasAnyJobs && medTypingDone && eidTypingDone;

    if (allRequiredTypingDone && medAppts.length === 0 && eidAppts.length === 0
        && (wo.status === "AtVendor" || wo.status === "Draft")) {
      newStatus = "ReadyToSchedule";
    }

    if (newStatus && newStatus !== wo.status) {
      await storage.updateWorkOrder(woId, { status: newStatus });
      await storage.createAuditLog({
        action: "auto_status_transition",
        entityType: "work_order",
        entityId: woId,
        userId: null,
        details: { from: wo.status, to: newStatus, applicantName: wo.applicantName, woNumber: wo.woNumber },
      });
      console.log(`[auto-transition] Work order ${wo.woNumber} transitioned ${wo.status} → ${newStatus}`);
    }
  } catch (err) {
    console.error("[auto-transition] Error:", err);
  }
}

async function checkAndAutoCompleteWorkOrder(woId: string): Promise<boolean> {
  try {
    const wo = await storage.getWorkOrderById(woId);
    if (!wo || wo.status === "Completed" || wo.status === "Cancelled") return false;
    if (!wo.serviceTypeId) return false;

    const serviceType = await storage.getServiceTypeById(wo.serviceTypeId);
    if (!serviceType) return false;

    const jobs = await storage.getTypingJobsByWoId(woId);
    const appts = await storage.getAppointmentsByWoId(woId);

    const terminalJobStatuses = ["ReadyForScheduling", "Returned"];
    const terminalApptStatuses = ["Completed", "FollowUpCompleted"];

    const needsMedical = serviceType.requiresMedicalTyping || serviceType.requiresMedicalScheduling;
    const needsEid = serviceType.requiresIdTyping2Years || serviceType.requiresIdTyping1Year || serviceType.requiresIdTyping10Years || serviceType.requiresIdBiometrics;

    if (needsMedical) {
      const medicalJobs = jobs.filter(j => {
        const code = j.jobCode || "";
        return code.startsWith("M");
      });
      const medicalAppts = appts.filter(a => a.type === "Medical");

      if (serviceType.requiresMedicalTyping) {
        if (medicalJobs.length === 0) return false;
        const allDone = medicalJobs.every(j => terminalJobStatuses.includes(j.status));
        if (!allDone) return false;
      }
      if (serviceType.requiresMedicalScheduling) {
        if (medicalAppts.length === 0) return false;
        const hasCompletedAppt = medicalAppts.some(a => terminalApptStatuses.includes(a.status));
        if (!hasCompletedAppt) return false;
      }
    }

    if (needsEid) {
      const eidJobs = jobs.filter(j => {
        const code = j.jobCode || "";
        return code.startsWith("E");
      });
      const eidAppts = appts.filter(a => a.type === "EID");

      const needsEidTyping = serviceType.requiresIdTyping2Years || serviceType.requiresIdTyping1Year || serviceType.requiresIdTyping10Years;
      if (needsEidTyping) {
        if (eidJobs.length === 0) return false;
        const allDone = eidJobs.every(j => terminalJobStatuses.includes(j.status));
        if (!allDone) return false;
      }
      if (serviceType.requiresIdBiometrics) {
        if (eidAppts.length === 0) return false;
        const hasCompletedAppt = eidAppts.some(a => terminalApptStatuses.includes(a.status));
        if (!hasCompletedAppt) return false;
      }
    }

    await storage.updateWorkOrder(woId, { status: "Completed" });
    await storage.createAuditLog({
      action: "auto_completed",
      entityType: "work_order",
      entityId: woId,
      userId: null,
      details: { reason: "All required tracks completed", applicantName: wo.applicantName, woNumber: wo.woNumber },
    });
    console.log(`[auto-complete] Work order ${wo.woNumber} auto-completed`);
    return true;
  } catch (err) {
    console.error("[auto-complete] Error checking work order completion:", err);
    return false;
  }
}

async function notifyStaffByRoles(roles: string[], notification: Omit<InsertStaffNotification, 'userId'>) {
  try {
    const allUsers = await storage.getUsers();
    const staffUsers = allUsers.filter(u => u.active && roles.includes(u.role));
    for (const user of staffUsers) {
      await storage.createStaffNotification({
        ...notification,
        userId: user.id,
      });
    }
  } catch (error) {
    console.error("Failed to create staff notification:", error);
  }
}

async function notifySingleUser(userId: string, notification: Omit<InsertStaffNotification, 'userId'>) {
  try {
    await storage.createStaffNotification({ ...notification, userId });
  } catch (error) {
    console.error("Failed to create single-user staff notification:", error);
  }
}

async function checkAndMarkDelayedWorkOrders(): Promise<number> {
  try {
    const settings = await storage.getAppSettings();
    const thresholdHours = settings?.vendorDelayThresholdHours ?? 48;
    const thresholdMs = thresholdHours * 3600000;
    const now = Date.now();

    const allWos = await storage.getWorkOrders();
    const activeWos = allWos.filter(wo =>
      wo.status !== "Completed" && wo.status !== "Cancelled"
    );

    let markedCount = 0;

    for (const wo of activeWos) {
      const jobs = await storage.getTypingJobsByWoId(wo.id);
      const vendorJobs = jobs.filter(j =>
        (j.status === "SubmittedToVendor" || j.status === "InProcess") && j.sentAt
      );

      const shouldBeDelayed = vendorJobs.some(j =>
        (now - new Date(j.sentAt!).getTime()) > thresholdMs
      );

      if (shouldBeDelayed && !wo.isDelayed) {
        await storage.updateWorkOrder(wo.id, { isDelayed: true });
        await storage.createAuditLog({
          action: "auto_delayed",
          entityType: "work_order",
          entityId: wo.id,
          userId: null,
          details: { reason: `Vendor exceeded ${thresholdHours}h threshold`, applicantName: wo.applicantName, woNumber: wo.woNumber },
        });
        console.log(`[delay-check] Work order ${wo.woNumber} flagged as delayed`);

        notifyStaffByRoles(["Admin", "Client Relationship Manager"], {
          type: "wo_delayed",
          title: "Work Order Delayed",
          message: `Work order ${wo.woNumber} (${wo.applicantName}) flagged as delayed — vendor exceeded ${thresholdHours}h threshold`,
          relatedEntityType: "work_order",
          relatedEntityId: wo.id,
        });

        markedCount++;
      } else if (!shouldBeDelayed && wo.isDelayed) {
        await storage.updateWorkOrder(wo.id, { isDelayed: false });
        await storage.createAuditLog({
          action: "delay_resolved",
          entityType: "work_order",
          entityId: wo.id,
          userId: null,
          details: { reason: "All vendor jobs resolved", applicantName: wo.applicantName, woNumber: wo.woNumber },
        });
        console.log(`[delay-check] Work order ${wo.woNumber} delay flag cleared`);
      }
    }

    return markedCount;
  } catch (err) {
    console.error("[delay-check] Error checking for delayed work orders:", err);
    return 0;
  }
}

async function revertDelayedWorkOrder(woId: string): Promise<void> {
  try {
    const wo = await storage.getWorkOrderById(woId);
    if (!wo || !wo.isDelayed) return;

    const settings = await storage.getAppSettings();
    const thresholdMs = (settings?.vendorDelayThresholdHours ?? 48) * 3600000;
    const now = Date.now();

    const jobs = await storage.getTypingJobsByWoId(woId);
    const stillOverdue = jobs.some(j =>
      (j.status === "SubmittedToVendor" || j.status === "InProcess") &&
      j.sentAt &&
      (now - new Date(j.sentAt).getTime()) > thresholdMs
    );

    if (stillOverdue) return;

    await storage.updateWorkOrder(woId, { isDelayed: false });
    await storage.createAuditLog({
      action: "delay_resolved",
      entityType: "work_order",
      entityId: woId,
      userId: null,
      details: { reason: "All vendor jobs resolved", applicantName: wo.applicantName, woNumber: wo.woNumber },
    });
    console.log(`[delay-check] Work order ${wo.woNumber} delay flag cleared`);
  } catch (err) {
    console.error("[delay-check] Error reverting delayed work order:", err);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register object storage routes
  registerObjectStorageRoutes(app);

  // Register external API routes (for client dashboard / CRM integrations)
  registerExternalRoutes(app);
  
  // Seed database on startup
  await storage.seedData();

  // Run delay detection every 15 minutes
  setInterval(() => {
    checkAndMarkDelayedWorkOrders().catch(err =>
      console.error("[delay-check] Interval error:", err)
    );
  }, 15 * 60 * 1000);
  // Also run once on startup (after a short delay to let DB settle)
  setTimeout(() => {
    checkAndMarkDelayedWorkOrders().catch(err =>
      console.error("[delay-check] Initial check error:", err)
    );
  }, 5000);

  const sentApptReminders = new Set<string>();
  let lastApptReminderPruneDate = "";

  async function checkAppointmentsTomorrow() {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);
      const dateKey = tomorrow.toISOString().slice(0, 10);

      if (lastApptReminderPruneDate !== dateKey) {
        sentApptReminders.clear();
        lastApptReminderPruneDate = dateKey;
      }

      const allAppointments = await storage.getAllAppointments();
      const tomorrowAppts = allAppointments.filter(a => {
        const d = new Date(a.datetime);
        return d >= tomorrow && d < dayAfter && a.status === "Scheduled";
      });

      let sent = 0;
      for (const appt of tomorrowAppts) {
        const dedupeKey = `${dateKey}:${appt.id}`;
        if (sentApptReminders.has(dedupeKey)) continue;
        sentApptReminders.add(dedupeKey);

        const wo = await storage.getWorkOrderById(appt.woId);
        notifyStaffByRoles(["Admin", "Medical Support", "Medical Support - Temporary"], {
          type: "appointment_tomorrow",
          title: "Appointment Tomorrow",
          message: `${appt.type} appointment tomorrow for ${wo?.applicantName || "applicant"} (${wo?.woNumber || ""})`,
          relatedEntityType: "appointment",
          relatedEntityId: appt.id,
        });
        sent++;
      }
      if (sent > 0) {
        console.log(`[appt-reminder] Sent ${sent} appointment reminders`);
      }
    } catch (err) {
      console.error("[appt-reminder] Error:", err);
    }
  }

  setInterval(() => {
    checkAppointmentsTomorrow().catch(err =>
      console.error("[appt-reminder] Interval error:", err)
    );
  }, 6 * 60 * 60 * 1000);
  setTimeout(() => {
    checkAppointmentsTomorrow().catch(err =>
      console.error("[appt-reminder] Initial check error:", err)
    );
  }, 10000);

  async function notifyVendorUsers(vendorId: string, notification: Omit<InsertVendorNotification, 'vendorUserId' | 'vendorId'>) {
    try {
      const allUsers = await storage.getUsers();
      const vendorUsers = allUsers.filter(u => u.vendorId === vendorId && u.active);
      for (const user of vendorUsers) {
        await storage.createVendorNotification({
          ...notification,
          vendorUserId: user.id,
          vendorId: vendorId,
        });
      }
    } catch (error) {
      console.error("Failed to create notification:", error);
    }
  }

  const walletService = new WalletService(storage, notifyVendorUsers);

  // ========== Dashboard ==========
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const workOrders = await storage.getWorkOrders();
      const todayAppointments = await storage.getTodayAppointments();
      // Count Draft typing jobs as "pending" - these need to be submitted to vendor
      const pendingJobs = await storage.getTypingJobs("Draft");
      const vendors = await storage.getVendors();
      
      let walletBalance = 0;
      let lowBalanceWarning = false;
      
      if (vendors.length > 0) {
        const settings = await storage.getAppSettings();
        const balances = await Promise.all(vendors.map(v => storage.getWalletBalance(v.id)));
        walletBalance = balances.reduce((sum, b) => sum + b, 0);
        lowBalanceWarning = balances.some(b => b < (settings?.lowBalanceThreshold || 1000));
      }

      res.json({
        totalWorkOrders: workOrders.length,
        todayAppointments: todayAppointments.length,
        pendingTypingJobs: pendingJobs.length,
        walletBalance,
        lowBalanceWarning,
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/today-appointments", requireAuth, async (req, res) => {
    try {
      const appointments = await storage.getTodayAppointments();
      if (appointments.length === 0) return res.json([]);

      const woIds = [...new Set(appointments.map(a => a.woId))];

      const [bulkWOs, allCenters] = await Promise.all([
        storage.getWorkOrdersByIds(woIds),
        storage.getCenters(),
      ]);

      const woMap = new Map(bulkWOs.map(wo => [wo.id, wo]));
      const centerMap = new Map(allCenters.map(c => [c.id, c]));

      const result = appointments.map((apt) => {
        const wo = woMap.get(apt.woId);
        const center = apt.centerId ? centerMap.get(apt.centerId) : null;
        return {
          id: wo?.id || apt.id,
          woNumber: wo?.woNumber || "N/A",
          applicantName: wo?.applicantName || "N/A",
          type: apt.type,
          time: new Date(apt.datetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          center: center?.name || "TBD",
        };
      });
      res.json(result);
    } catch (error) {
      console.error("Today appointments error:", error);
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.get("/api/dashboard/recent-work-orders", requireAuth, async (req, res) => {
    try {
      const recent = await storage.getRecentWorkOrders(5);
      if (recent.length === 0) return res.json([]);

      const allJobTypes = await storage.getJobTypes();
      const jobTypeMap = new Map(allJobTypes.map(jt => [jt.id, jt]));

      const allCompanies = await storage.getCompanies();
      const companyMap = new Map(allCompanies.map(c => [c.id, c]));

      const enrichments = await Promise.all(
        recent.map(async (wo) => {
          const [typingJobs, appointments] = await Promise.all([
            storage.getTypingJobsByWoId(wo.id),
            storage.getAppointmentsByWoId(wo.id),
          ]);
          return { woId: wo.id, typingJobs, appointments };
        })
      );
      const enrichMap = new Map(enrichments.map(e => [e.woId, e]));

      const result = recent.map((wo) => {
        const company = companyMap.get(wo.companyId);
        const { typingJobs, appointments } = enrichMap.get(wo.id)!;

        const medTypingJobs = typingJobs.filter(j => jobTypeMap.get(j.jobTypeId)?.category === "Medical");
        const eidTypingJobs = typingJobs.filter(j => jobTypeMap.get(j.jobTypeId)?.category === "EID");
        const medAppts = appointments.filter(a => a.type === "Medical" && a.status !== "Cancelled" && a.status !== "Rescheduled");
        const eidAppts = appointments.filter(a => a.type === "EID" && a.status !== "Cancelled" && a.status !== "Rescheduled");

        const latestMedTyping = medTypingJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        const latestEidTyping = eidTypingJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        const latestMedAppt = medAppts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        const latestEidAppt = eidAppts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        return {
          id: wo.id,
          woNumber: wo.woNumber,
          applicantName: wo.applicantName,
          companyName: company?.name || "N/A",
          status: wo.status,
          createdAt: wo.createdAt,
          medicalTyping: latestMedTyping?.status || null,
          medicalAppt: latestMedAppt?.status || null,
          eidTyping: latestEidTyping?.status || null,
          eidAppt: latestEidAppt?.status || null,
        };
      });
      res.json(result);
    } catch (error) {
      console.error("Recent work orders error:", error);
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  app.get("/api/dashboard/weekly-overview", requireAuth, async (req, res) => {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const [allWOs, allAppointments, allTypingJobs] = await Promise.all([
        storage.getWorkOrders(),
        storage.getAllAppointments(),
        storage.getTypingJobs(),
      ]);
      
      const days: { date: string; workOrders: number; appointments: number; typingJobs: number }[] = [];
      
      for (let i = 6; i >= 0; i--) {
        const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = day.toISOString().split("T")[0];
        const dayStart = new Date(dateStr + "T00:00:00.000Z");
        const dayEnd = new Date(dateStr + "T23:59:59.999Z");
        
        const wos = allWOs.filter(wo => {
          const d = new Date(wo.createdAt);
          return d >= dayStart && d <= dayEnd;
        });
        
        const appts = allAppointments.filter(a => {
          const d = new Date(a.datetime);
          return d >= dayStart && d <= dayEnd;
        });
        
        const tjs = allTypingJobs.filter(tj => {
          if (!tj.returnedAt) return false;
          const d = new Date(tj.returnedAt);
          return d >= dayStart && d <= dayEnd;
        });
        
        days.push({
          date: dateStr,
          workOrders: wos.length,
          appointments: appts.length,
          typingJobs: tjs.length,
        });
      }
      
      res.json(days);
    } catch (error) {
      console.error("Weekly overview error:", error);
      res.status(500).json({ message: "Failed to fetch weekly overview" });
    }
  });

  app.get("/api/work-orders/photos", requireAuth, async (req, res) => {
    try {
      const photoMap = await storage.getWoPhotoMap();
      res.json(photoMap);
    } catch (error) {
      console.error("WO photos error:", error);
      res.status(500).json({ message: "Failed to fetch photos" });
    }
  });

  app.get("/api/activity", requireAuth, async (req, res) => {
    try {
      const logs = await storage.getRecentAuditLogs(15);
      res.json(logs);
    } catch (error) {
      console.error("Activity feed error:", error);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  app.get("/api/activity/my", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const logs = await storage.getRecentAuditLogsByUser(userId, 20);
      const user = await storage.getUser(userId);
      const enriched = logs.map(log => ({
        ...log,
        userName: user?.name || undefined,
      }));
      res.json(enriched);
    } catch (error) {
      console.error("My activity feed error:", error);
      res.status(500).json({ message: "Failed to fetch user activity" });
    }
  });

  app.get("/api/search", requireAuth, async (req, res) => {
    try {
      const q = ((req.query.q || req.query["0"] || "") as string).toLowerCase().trim();
      if (q.length < 2) {
        return res.json({ workOrders: [], companies: [], staff: [], typingJobs: [] });
      }

      const [workOrders, companies, staffList, allTypingJobs] = await Promise.all([
        storage.getWorkOrders(q),
        storage.getCompanies(),
        storage.getStaff(),
        storage.getTypingJobs(),
      ]);

      const allWoIds = Array.from(new Set(allTypingJobs.map(j => j.woId)));
      const allJobWos = await Promise.all(allWoIds.map(id => storage.getWorkOrderById(id)));
      const jobWoMap = new Map(allJobWos.filter(Boolean).map(wo => [wo!.id, wo!]));

      const filteredTypingJobs = allTypingJobs.filter(j => {
        const wo = jobWoMap.get(j.woId);
        return (j.jobCode && j.jobCode.toLowerCase().includes(q)) ||
          (wo?.applicantName?.toLowerCase().includes(q)) ||
          (wo?.woNumber?.toLowerCase().includes(q));
      }).slice(0, 5);

      const filteredCompanies = companies
        .filter(c => c.name.toLowerCase().includes(q))
        .slice(0, 5)
        .map(c => ({ id: c.id, name: c.name }));

      const filteredStaff = staffList
        .filter(s => s.name.toLowerCase().includes(q))
        .slice(0, 5)
        .map(s => ({ id: s.id, name: s.name, role: s.roleTitle || "" }));

      const companyMap = new Map(companies.map(c => [c.id, c.name]));

      const topWos = workOrders.slice(0, 5);

      res.json({
        workOrders: topWos.map(wo => ({
          id: wo.id,
          woNumber: wo.woNumber,
          applicantName: wo.applicantName,
          status: wo.status,
          companyName: wo.companyId ? (companyMap.get(wo.companyId) || "") : "",
        })),
        typingJobs: filteredTypingJobs.map(j => {
          const wo = jobWoMap.get(j.woId);
          return {
            id: j.id,
            jobCode: j.jobCode,
            woNumber: wo?.woNumber || "",
            applicantName: wo?.applicantName || "",
            status: j.status,
          };
        }),
        companies: filteredCompanies,
        staff: filteredStaff,
      });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  app.get("/api/reports/summary", requireOpsRole, async (req, res) => {
    try {
      const [allWorkOrders, allTypingJobs, allCompanies, allVendors, allJobTypes] = await Promise.all([
        storage.getWorkOrders(),
        storage.getTypingJobs(),
        storage.getCompanies(),
        storage.getVendors(),
        storage.getJobTypes(),
      ]);

      const jobTypeMap = new Map(allJobTypes.map(jt => [jt.id, jt]));

      const overview = {
        totalWorkOrders: allWorkOrders.length,
        activeWorkOrders: allWorkOrders.filter(wo => wo.status !== "Completed" && wo.status !== "Cancelled").length,
        completedWorkOrders: allWorkOrders.filter(wo => wo.status === "Completed").length,
        totalTypingJobs: allTypingJobs.length,
        completedTypingJobs: allTypingJobs.filter(j => j.status === "ReadyForScheduling" || j.status === "Returned").length,
        totalCompanies: allCompanies.length,
        totalVendors: allVendors.length,
      };

      const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const currentYear = new Date().getFullYear();
      const woMonthly = Array(12).fill(0);
      const tjMonthly = Array(12).fill(0);

      for (const wo of allWorkOrders) {
        const d = new Date(wo.createdAt);
        if (d.getFullYear() === currentYear) {
          woMonthly[d.getMonth()]++;
        }
      }
      for (const tj of allTypingJobs) {
        const d = new Date(tj.createdAt);
        if (d.getFullYear() === currentYear) {
          tjMonthly[d.getMonth()]++;
        }
      }

      const vendorJobsMap = new Map<string, typeof allTypingJobs>();
      for (const tj of allTypingJobs) {
        if (tj.vendorId) {
          if (!vendorJobsMap.has(tj.vendorId)) vendorJobsMap.set(tj.vendorId, []);
          vendorJobsMap.get(tj.vendorId)!.push(tj);
        }
      }

      const turnaroundByVendor = allVendors.map(v => {
        const jobs = vendorJobsMap.get(v.id) || [];
        const completedJobs = jobs.filter(j => j.status === "ReadyForScheduling" || j.status === "Returned");
        let totalHours = 0;
        let countWithTime = 0;
        for (const j of completedJobs) {
          const start = j.sentAt ? new Date(j.sentAt).getTime() : 0;
          const end = j.returnedAt ? new Date(j.returnedAt).getTime() : (j.sentToClientAt ? new Date(j.sentToClientAt).getTime() : 0);
          if (start && end && end > start) {
            totalHours += (end - start) / 3600000;
            countWithTime++;
          }
        }
        return {
          vendorName: v.name,
          avgHours: countWithTime > 0 ? Math.round((totalHours / countWithTime) * 10) / 10 : 0,
          totalJobs: jobs.length,
          completionRate: jobs.length > 0 ? Math.round((completedJobs.length / jobs.length) * 100) : 0,
        };
      });

      const jobsByCategory: Record<string, number> = {};
      for (const tj of allTypingJobs) {
        const jt = jobTypeMap.get(tj.jobTypeId);
        const cat = jt?.category || "Other";
        jobsByCategory[cat] = (jobsByCategory[cat] || 0) + 1;
      }

      const woStatusDist: Record<string, number> = {};
      for (const wo of allWorkOrders) {
        woStatusDist[wo.status] = (woStatusDist[wo.status] || 0) + 1;
      }
      const tjStatusDist: Record<string, number> = {};
      for (const tj of allTypingJobs) {
        tjStatusDist[tj.status] = (tjStatusDist[tj.status] || 0) + 1;
      }

      const companyCounts: Record<string, { name: string; count: number }> = {};
      for (const wo of allWorkOrders) {
        if (!companyCounts[wo.companyId]) {
          const comp = allCompanies.find(c => c.id === wo.companyId);
          companyCounts[wo.companyId] = { name: comp?.name || "Unknown", count: 0 };
        }
        companyCounts[wo.companyId].count++;
      }
      const topCompanies = Object.values(companyCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(c => ({ name: c.name, woCount: c.count }));

      res.json({
        overview,
        monthly: { labels: monthLabels, workOrders: woMonthly, typingJobs: tjMonthly },
        turnaroundByVendor,
        jobsByCategory,
        statusDistribution: { wo: woStatusDist, tj: tjStatusDist },
        topCompanies,
      });
    } catch (error) {
      console.error("Reports summary error:", error);
      res.status(500).json({ message: "Failed to fetch reports summary" });
    }
  });

  app.get("/api/dashboard/pipeline", requireAuth, async (req, res) => {
    try {
      const workOrders = await storage.getWorkOrders();
      const pipeline = {
        draft: 0,
        scheduled: 0,
        completed: 0,
        cancelled: 0,
        total: workOrders.length,
      };
      for (const wo of workOrders) {
        const key = wo.status.toLowerCase() as keyof typeof pipeline;
        if (key in pipeline && key !== "total") {
          pipeline[key]++;
        }
      }
      res.json(pipeline);
    } catch (error) {
      console.error("Dashboard pipeline error:", error);
      res.status(500).json({ message: "Failed to fetch pipeline" });
    }
  });

  app.get("/api/dashboard/action-center", requireAuth, async (req, res) => {
    try {
      const [readyToScheduleJobs, unacceptedJobs, workOrders] = await Promise.all([
        storage.getTypingJobs("ReadyForScheduling"),
        storage.getTypingJobs("SubmittedToVendor"),
        storage.getWorkOrders(),
      ]);

      const fiveDaysAgo = Date.now() - 5 * 86400000;
      const overdueItems = workOrders.filter(
        wo => wo.status === "Draft" && new Date(wo.createdAt).getTime() < fiveDaysAgo
      );

      res.json({
        pendingApprovals: 0,
        readyToSchedule: readyToScheduleJobs.length,
        unacceptedJobs: unacceptedJobs.length,
        overdueItems: overdueItems.length,
      });
    } catch (error) {
      console.error("Dashboard action-center error:", error);
      res.status(500).json({ message: "Failed to fetch action center data" });
    }
  });

  app.get("/api/dashboard/needs-attention", requireAuth, async (req, res) => {
    try {
      const workOrders = await storage.getWorkOrders();
      const items: Array<{
        id: string;
        woNumber: string;
        applicantName: string;
        reason: string;
        severity: "warning" | "urgent";
        daysOld: number;
      }> = [];

      const jobTypes = await storage.getJobTypes();
      const jobTypeMap = new Map(jobTypes.map(jt => [jt.id, jt]));

      for (const wo of workOrders) {
        if (wo.status === "Completed" || wo.status === "Cancelled") continue;
        const daysOld = Math.floor((Date.now() - new Date(wo.createdAt).getTime()) / 86400000);
        const typingJobs = await storage.getTypingJobsByWoId(wo.id);
        const appointments = await storage.getAppointmentsByWoId(wo.id);

        if (daysOld > 7 && wo.status === "Draft") {
          items.push({
            id: wo.id,
            woNumber: wo.woNumber,
            applicantName: wo.applicantName,
            reason: "Stale draft — no progress for over a week",
            severity: "warning",
            daysOld,
          });
          continue;
        }

        const activeAppointments = appointments.filter(a => a.status !== "Cancelled" && a.status !== "Rescheduled");
        const hasMedAppt = activeAppointments.some(a => a.type === "Medical");
        const hasEidAppt = activeAppointments.some(a => a.type === "EID");

        const returnedMed = typingJobs.some(j => {
          const jt = jobTypeMap.get(j.jobTypeId);
          return jt?.category === "Medical" && (j.status === "ReadyForScheduling" || j.status === "Returned");
        });
        const returnedEid = typingJobs.some(j => {
          const jt = jobTypeMap.get(j.jobTypeId);
          return jt?.category === "EID" && (j.status === "ReadyForScheduling" || j.status === "Returned");
        });

        if (returnedMed && !hasMedAppt) {
          items.push({
            id: wo.id,
            woNumber: wo.woNumber,
            applicantName: wo.applicantName,
            reason: "Medical typing done — schedule appointment",
            severity: "urgent",
            daysOld,
          });
        } else if (returnedEid && !hasEidAppt) {
          items.push({
            id: wo.id,
            woNumber: wo.woNumber,
            applicantName: wo.applicantName,
            reason: "EID typing done — schedule appointment",
            severity: "urgent",
            daysOld,
          });
        }
      }

      items.sort((a, b) => {
        if (a.severity === "urgent" && b.severity !== "urgent") return -1;
        if (b.severity === "urgent" && a.severity !== "urgent") return 1;
        return b.daysOld - a.daysOld;
      });

      res.json(items.slice(0, 8));
    } catch (error) {
      console.error("Dashboard needs-attention error:", error);
      res.status(500).json({ message: "Failed to fetch needs-attention items" });
    }
  });

  app.get("/api/dashboard/stale-jobs", requireAuth, async (req, res) => {
    try {
      const now = Date.now();
      const [sentToVendorJobs, inProgressJobs, allJobTypes] = await Promise.all([
        storage.getTypingJobs("SubmittedToVendor"),
        storage.getTypingJobs("InProcess"),
        storage.getJobTypes(),
      ]);

      const enrichJob = async (job: typeof sentToVendorJobs[0]) => {
        const wo = await storage.getWorkOrderById(job.woId);
        return { wo, job };
      };

      const unacceptedOver24h = (await Promise.all(
        sentToVendorJobs
          .filter(j => j.sentAt && (now - new Date(j.sentAt).getTime()) > 24 * 3600000)
          .map(enrichJob)
      )).map(({ wo, job }) => ({
        id: job.id,
        jobCode: job.jobCode || "",
        woNumber: wo?.woNumber || "N/A",
        applicantName: wo?.applicantName || "N/A",
        sentAt: job.sentAt,
        hoursWaiting: Math.round((now - new Date(job.sentAt!).getTime()) / 3600000),
      }));

      const today8am = new Date();
      today8am.setHours(8, 0, 0, 0);

      const delayedJobs = [...sentToVendorJobs, ...inProgressJobs]
        .filter(j => j.sentAt && new Date(j.sentAt).getTime() < today8am.getTime());

      const delayed = (await Promise.all(
        delayedJobs.map(enrichJob)
      )).map(({ wo, job }) => ({
        id: job.id,
        jobCode: job.jobCode || "",
        woNumber: wo?.woNumber || "N/A",
        applicantName: wo?.applicantName || "N/A",
        sentAt: job.sentAt,
        status: job.status,
      }));

      res.json({ unacceptedOver24h, waitingForDocsOver48h: [], delayed });
    } catch (error) {
      console.error("Dashboard stale-jobs error:", error);
      res.status(500).json({ message: "Failed to fetch stale jobs" });
    }
  });

  app.get("/api/dashboard/upcoming-appointments", requireAuth, async (req, res) => {
    try {
      const upcomingAppts = await storage.getUpcomingAppointments(5);
      const result = await Promise.all(
        upcomingAppts.map(async (apt) => {
          const wo = await storage.getWorkOrderById(apt.woId);
          const center = apt.centerId ? await storage.getCenterById(apt.centerId) : null;
          const aptDate = new Date(apt.datetime);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const daysFromNow = Math.ceil((aptDate.getTime() - today.getTime()) / 86400000);
          return {
            id: wo?.id || apt.id,
            woNumber: wo?.woNumber || "N/A",
            applicantName: wo?.applicantName || "N/A",
            type: apt.type,
            time: aptDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
            date: aptDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
            center: center?.name || "TBD",
            daysFromNow,
          };
        })
      );
      res.json(result);
    } catch (error) {
      console.error("Upcoming appointments error:", error);
      res.status(500).json({ message: "Failed to fetch upcoming appointments" });
    }
  });

  // ========== Dashboard: Typing Jobs Summary ==========
  app.get("/api/dashboard/typing-jobs-summary", requireAuth, async (req, res) => {
    try {
      const now = Date.now();
      const [sentToVendorJobs, inProgressJobs, readyToScheduleJobs, returnedJobs, rejectedJobs, allJobTypes, allVendors] = await Promise.all([
        storage.getTypingJobs("SubmittedToVendor"),
        storage.getTypingJobs("InProcess"),
        storage.getTypingJobs("ReadyForScheduling"),
        storage.getTypingJobs("Returned"),
        storage.getTypingJobs("Rejected"),
        storage.getJobTypes(),
        storage.getVendors(),
      ]);

      const jobTypeMap = new Map(allJobTypes.map(jt => [jt.id, jt]));
      const vendorMap = new Map(allVendors.map(v => [v.id, v]));

      const enrichJob = async (job: typeof sentToVendorJobs[0]) => {
        const wo = await storage.getWorkOrderById(job.woId);
        const vendor = job.vendorId ? vendorMap.get(job.vendorId) : null;
        const jt = jobTypeMap.get(job.jobTypeId);
        return { wo, vendor, job, category: jt?.category || "Unknown" };
      };

      const unaccepted = (await Promise.all(sentToVendorJobs.map(enrichJob))).map(({ wo, vendor, job, category }) => ({
        id: job.id,
        jobCode: job.jobCode || "",
        woId: wo?.id || "",
        woNumber: wo?.woNumber || "N/A",
        applicantName: wo?.applicantName || "N/A",
        vendorName: vendor?.name || "Unassigned",
        type: category as "Medical" | "EID",
        sentAt: job.sentAt,
        hoursWaiting: job.sentAt ? Math.round((now - new Date(job.sentAt).getTime()) / 3600000) : 0,
        urgent: job.urgent || false,
      }));

      const inProgress = (await Promise.all(inProgressJobs.map(enrichJob))).map(({ wo, vendor, job, category }) => ({
        id: job.id,
        jobCode: job.jobCode || "",
        woId: wo?.id || "",
        woNumber: wo?.woNumber || "N/A",
        applicantName: wo?.applicantName || "N/A",
        vendorName: vendor?.name || "Unassigned",
        type: category as "Medical" | "EID",
        sentAt: job.sentAt,
        hoursElapsed: job.sentAt ? Math.round((now - new Date(job.sentAt).getTime()) / 3600000) : 0,
        urgent: job.urgent || false,
      }));

      const readyWoIds = readyToScheduleJobs.map(j => j.woId);
      const readyAppointments = readyWoIds.length > 0 ? await storage.getAppointmentsByWoIds(readyWoIds) : [];
      const appointedWoTypes = new Set(
        readyAppointments
          .filter(a => a.status !== "Cancelled" && a.status !== "Rescheduled")
          .map(a => `${a.woId}-${a.type}`)
      );

      const readyToSchedule = (await Promise.all(readyToScheduleJobs.map(enrichJob)))
        .filter(({ wo, job, category }) => {
          const apptType = category === "Medical" ? "Medical" : "EID";
          return !appointedWoTypes.has(`${job.woId}-${apptType}`);
        })
        .map(({ wo, job, category }) => ({
          id: job.id,
          jobCode: job.jobCode || "",
          woId: wo?.id || "",
          woNumber: wo?.woNumber || "N/A",
          applicantName: wo?.applicantName || "N/A",
          type: category as "Medical" | "EID",
          completedAt: job.returnedAt || job.createdAt,
        }));

      const returnedAndRejectedJobs = [...returnedJobs, ...rejectedJobs];
      const returned = (await Promise.all(returnedAndRejectedJobs.map(enrichJob)))
        .map(({ wo, vendor, job, category }) => ({
          id: job.id,
          jobCode: job.jobCode || "",
          woId: wo?.id || "",
          woNumber: wo?.woNumber || "N/A",
          applicantName: wo?.applicantName || "N/A",
          vendorName: vendor?.name || "Unassigned",
          type: category as "Medical" | "EID",
          returnedAt: job.returnedAt,
          status: job.status,
          urgent: job.urgent || false,
        }))
        .sort((a, b) => {
          const aTime = a.returnedAt ? new Date(a.returnedAt).getTime() : 0;
          const bTime = b.returnedAt ? new Date(b.returnedAt).getTime() : 0;
          return bTime - aTime;
        });

      res.json({
        unaccepted,
        inProgress,
        readyToSchedule,
        returned,
        counts: {
          unaccepted: unaccepted.length,
          inProgress: inProgress.length,
          readyToSchedule: readyToSchedule.length,
          returned: returned.length,
        },
      });
    } catch (error) {
      console.error("Dashboard typing-jobs-summary error:", error);
      res.status(500).json({ message: "Failed to fetch typing jobs summary" });
    }
  });

  // ========== Dashboard: Appointments Summary ==========
  app.get("/api/dashboard/appointments-summary", requireAuth, async (req, res) => {
    try {
      const [todayAppts, upcomingAppts, readyToScheduleJobs, allJobTypes] = await Promise.all([
        storage.getTodayAppointments(),
        storage.getUpcomingAppointments(5),
        storage.getTypingJobs("ReadyForScheduling"),
        storage.getJobTypes(),
      ]);

      const jobTypeMap = new Map(allJobTypes.map(jt => [jt.id, jt]));

      const enrichAppointment = async (apt: typeof todayAppts[0]) => {
        const wo = await storage.getWorkOrderById(apt.woId);
        const center = apt.centerId ? await storage.getCenterById(apt.centerId) : null;
        return { apt, wo, center };
      };

      const today = (await Promise.all(todayAppts.map(enrichAppointment))).map(({ apt, wo, center }) => ({
        id: apt.id,
        woId: wo?.id || "",
        woNumber: wo?.woNumber || "N/A",
        applicantName: wo?.applicantName || "N/A",
        type: apt.type,
        time: new Date(apt.datetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        datetime: apt.datetime,
        center: center?.name || "TBD",
        status: apt.status,
      }));

      const upcoming = (await Promise.all(upcomingAppts.map(enrichAppointment))).map(({ apt, wo, center }) => {
        const aptDate = new Date(apt.datetime);
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const daysFromNow = Math.ceil((aptDate.getTime() - todayDate.getTime()) / 86400000);
        return {
          id: apt.id,
          woId: wo?.id || "",
          woNumber: wo?.woNumber || "N/A",
          applicantName: wo?.applicantName || "N/A",
          type: apt.type,
          time: aptDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          date: aptDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
          center: center?.name || "TBD",
          status: apt.status,
          daysFromNow,
        };
      });

      const readyWoIds = readyToScheduleJobs.map(j => j.woId);
      const readyAppointments = readyWoIds.length > 0 ? await storage.getAppointmentsByWoIds(readyWoIds) : [];
      const appointedWoTypes = new Set(
        readyAppointments
          .filter(a => a.status !== "Cancelled" && a.status !== "Rescheduled")
          .map(a => `${a.woId}-${a.type}`)
      );

      const needsSchedulingMap = new Map<string, { woId: string; woNumber: string; applicantName: string; companyName: string; types: string[] }>();

      for (const job of readyToScheduleJobs) {
        const jt = jobTypeMap.get(job.jobTypeId);
        const apptType = jt?.category === "Medical" ? "Medical" : "EID";
        if (appointedWoTypes.has(`${job.woId}-${apptType}`)) continue;

        if (apptType === "EID") {
          const result = await storage.getTypingJobResult(job.id);
          if (!result?.biometricsRequired) continue;
        }

        if (!needsSchedulingMap.has(job.woId)) {
          const wo = await storage.getWorkOrderById(job.woId);
          const company = wo?.companyId ? await storage.getCompanyById(wo.companyId) : null;
          needsSchedulingMap.set(job.woId, {
            woId: wo?.id || job.woId,
            woNumber: wo?.woNumber || "N/A",
            applicantName: wo?.applicantName || "N/A",
            companyName: company?.name || "N/A",
            types: [],
          });
        }
        needsSchedulingMap.get(job.woId)!.types.push(apptType);
      }

      const needsScheduling = Array.from(needsSchedulingMap.values());

      res.json({
        today,
        upcoming,
        needsScheduling,
        counts: {
          today: today.length,
          upcoming: upcoming.length,
          needsScheduling: needsScheduling.length,
        },
      });
    } catch (error) {
      console.error("Dashboard appointments-summary error:", error);
      res.status(500).json({ message: "Failed to fetch appointments summary" });
    }
  });

  // ========== Scheduling Queue ==========
  app.get("/api/appointments/scheduling-queue", requireAuth, async (req, res) => {
    try {
      const [readyJobs, allJobTypes, allAppointments] = await Promise.all([
        storage.getTypingJobs("ReadyForScheduling"),
        storage.getJobTypes(),
        storage.getAllAppointments(),
      ]);

      const jobTypeMap = new Map(allJobTypes.map(jt => [jt.id, jt]));

      const activeApptSet = new Set(
        allAppointments
          .filter(a => a.status !== "Cancelled" && a.status !== "Rescheduled")
          .map(a => `${a.woId}-${a.type}`)
      );

      const medicalQueue: any[] = [];
      const eidQueue: any[] = [];

      for (const job of readyJobs) {
        const jt = jobTypeMap.get(job.jobTypeId);
        if (!jt) continue;
        const apptType = jt.category === "Medical" ? "Medical" : "EID";

        if (activeApptSet.has(`${job.woId}-${apptType}`)) continue;

        const result = await storage.getTypingJobResult(job.id);

        if (apptType === "EID" && !result?.biometricsRequired) continue;

        const wo = await storage.getWorkOrderById(job.woId);
        if (!wo) continue;
        const company = wo.companyId ? await storage.getCompanyById(wo.companyId) : null;

        const queueItem = {
          typingJobId: job.id,
          jobCode: job.jobCode,
          woId: wo.id,
          woNumber: wo.woNumber,
          applicantName: wo.applicantName,
          applicantPhone: wo.applicantPhone,
          applicantEmail: wo.applicantEmail,
          isVip: wo.isVip || false,
          serviceTypeId: wo.serviceTypeId,
          companyId: company?.id || null,
          companyName: company?.name || null,
          preferredMedicalCenterId: company?.preferredMedicalCenterId || null,
          preferredMedicalCenterVipId: company?.preferredMedicalCenterVipId || null,
          preferredBiometricsCenterId: company?.preferredBiometricsCenterId || null,
          preferredBiometricsCenterVipId: company?.preferredBiometricsCenterVipId || null,
          assistStaffId: company?.assistStaffId || null,
          rmStaffId: company?.rmStaffId || null,
          applicationRefNo: result?.applicationRefNo || null,
          biometricsRequired: result?.biometricsRequired || false,
          biometricsDatetime: result?.biometricsDatetime || null,
          biometricsCenter: result?.biometricsCenter || null,
          notes: result?.vendorNotes || null,
          returnedAt: job.returnedAt || null,
          completedAt: job.returnedAt || null,
          readyAt: job.returnedAt || job.createdAt || null,
        };

        if (apptType === "Medical") {
          medicalQueue.push(queueItem);
        } else {
          eidQueue.push(queueItem);
        }
      }

      res.json({ medical: medicalQueue, eid: eidQueue });
    } catch (error) {
      console.error("Scheduling queue error:", error);
      res.status(500).json({ message: "Failed to fetch scheduling queue" });
    }
  });

  // ========== Work Orders ==========
  let lastDelayCheck = 0;
  app.get("/api/work-orders", requireAuth, async (req, res) => {
    try {
      const now = Date.now();
      if (now - lastDelayCheck > 5 * 60 * 1000) {
        lastDelayCheck = now;
        checkAndMarkDelayedWorkOrders().catch(() => {});
      }
      const { search, status } = req.query;
      const workOrdersList = await storage.getWorkOrders(
        search as string | undefined,
        status as string | undefined
      );

      if (workOrdersList.length === 0) {
        return res.json([]);
      }

      const woIds = workOrdersList.map(wo => wo.id);
      const companyIds = Array.from(new Set(workOrdersList.map(wo => wo.companyId).filter(Boolean)));
      const serviceTypeIds = Array.from(new Set(workOrdersList.map(wo => wo.serviceTypeId).filter((id): id is string => !!id)));

      const [allCompanies, allServiceTypes, allTypingJobs, allAppointments, allJobTypes] = await Promise.all([
        companyIds.length > 0 ? storage.getCompaniesByIds(companyIds) : Promise.resolve([]),
        serviceTypeIds.length > 0 ? storage.getServiceTypesByIds(serviceTypeIds) : Promise.resolve([]),
        storage.getTypingJobsByWoIds(woIds),
        storage.getAppointmentsByWoIds(woIds),
        storage.getJobTypes(),
      ]);

      const companyMap = new Map(allCompanies.map(c => [c.id, c]));
      const serviceTypeMap = new Map(allServiceTypes.map(st => [st.id, st]));
      const jobTypeMap = new Map(allJobTypes.map(jt => [jt.id, jt]));
      const typingJobsByWo = new Map<string, any[]>();
      for (const job of allTypingJobs) {
        const list = typingJobsByWo.get(job.woId) || [];
        list.push({ ...job, jobType: job.jobTypeId ? jobTypeMap.get(job.jobTypeId) || null : null });
        typingJobsByWo.set(job.woId, list);
      }
      const appointmentsByWo = new Map<string, any[]>();
      for (const apt of allAppointments) {
        const list = appointmentsByWo.get(apt.woId) || [];
        list.push(apt);
        appointmentsByWo.set(apt.woId, list);
      }

      const result = workOrdersList.map(wo => ({
        ...wo,
        company: companyMap.get(wo.companyId),
        serviceType: wo.serviceTypeId ? serviceTypeMap.get(wo.serviceTypeId) : undefined,
        typingJobs: typingJobsByWo.get(wo.id) || [],
        appointments: appointmentsByWo.get(wo.id) || [],
      }));

      res.json(result);
    } catch (error) {
      console.error("Work orders error:", error);
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  app.post("/api/work-orders/bulk-status", requireOpsRole, async (req, res) => {
    try {
      const bulkStatusSchema = z.object({
        ids: z.array(z.string()).min(1),
        status: z.enum(["Draft", "AtVendor", "ReadyToSchedule", "Scheduled", "Completed", "Cancelled"]),
      });
      const validation = validateBody(bulkStatusSchema, req.body);
      if ("error" in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const { ids, status } = validation.data;
      let updated = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const id of ids) {
        try {
          const wo = await storage.updateWorkOrder(id, { status });
          if (!wo) {
            failed++;
            errors.push(`Work order ${id} not found`);
            continue;
          }
          await storage.createAuditLog({
            entityType: "work_order",
            entityId: id,
            action: "status_changed",
            userId: (req as any).session?.userId || null,
            details: { newStatus: status, bulkAction: true, applicantName: wo.applicantName, woNumber: wo.woNumber },
          });

          if (status === "Cancelled") {
            const jobs = await storage.getTypingJobsByWoId(wo.id);
            for (const job of jobs) {
              if (job.vendorId) {
                await notifyVendorUsers(job.vendorId, {
                  type: 'wo_status_change',
                  title: 'Work Order ' + status,
                  message: `Work order ${wo.woNumber} has been ${status.toLowerCase()}`,
                  relatedJobId: job.id,
                });
              }
            }
          }

          updated++;
        } catch (err: any) {
          failed++;
          errors.push(`Failed to update ${id}: ${err.message || "Unknown error"}`);
        }
      }

      res.json({ updated, failed, errors });
    } catch (error) {
      console.error("Bulk status update error:", error);
      res.status(500).json({ message: "Failed to bulk update work order statuses" });
    }
  });

  app.get("/api/work-orders/check-duplicate", requireAuth, async (req, res) => {
    try {
      const applicantName = (req.query.applicantName as string || "").trim();
      if (!applicantName) {
        return res.json({ duplicates: [] });
      }
      const workOrders = await storage.getWorkOrders();
      const matches = workOrders.filter(
        wo =>
          wo.applicantName.toLowerCase() === applicantName.toLowerCase() &&
          wo.status !== "Completed" &&
          wo.status !== "Cancelled"
      );
      const duplicates = await Promise.all(
        matches.map(async (wo) => {
          const company = await storage.getCompanyById(wo.companyId);
          return {
            id: wo.id,
            woNumber: wo.woNumber,
            applicantName: wo.applicantName,
            companyName: company?.name || "N/A",
            status: wo.status,
            createdAt: wo.createdAt,
          };
        })
      );
      res.json({ duplicates });
    } catch (error) {
      console.error("Check duplicate error:", error);
      res.status(500).json({ message: "Failed to check duplicates" });
    }
  });

  app.get("/api/work-orders/:id", requireAuth, async (req, res) => {
    try {
      const wo = await storage.getWorkOrderById(req.params.id);
      if (!wo) {
        return res.status(404).json({ message: "Work order not found" });
      }

      const company = await storage.getCompanyById(wo.companyId);
      const appointments = await storage.getAppointmentsByWoId(wo.id);
      const typingJobsRaw = await storage.getTypingJobsByWoId(wo.id);
      
      // Include typing job results and job type info
      const typingJobs = await Promise.all(
        typingJobsRaw.map(async (job) => {
          const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
          const result = await storage.getTypingJobResult(job.id);
          return { ...job, jobType, result };
        })
      );

      let companyWithDetails = null;
      if (company) {
        const emails = await storage.getCompanyEmails(company.id);
        const rmStaff = company.rmStaffId ? await storage.getStaffById(company.rmStaffId) : null;
        const assistStaff = company.assistStaffId ? await storage.getStaffById(company.assistStaffId) : null;
        const preferredMedicalCenter = company.preferredMedicalCenterId 
          ? await storage.getCenterById(company.preferredMedicalCenterId) 
          : null;
        const preferredMedicalCenterVip = company.preferredMedicalCenterVipId 
          ? await storage.getCenterById(company.preferredMedicalCenterVipId) 
          : null;
        const preferredBiometricsCenter = company.preferredBiometricsCenterId 
          ? await storage.getCenterById(company.preferredBiometricsCenterId) 
          : null;
        const preferredBiometricsCenterVip = company.preferredBiometricsCenterVipId 
          ? await storage.getCenterById(company.preferredBiometricsCenterVipId) 
          : null;
        
        companyWithDetails = {
          ...company,
          emails,
          rmStaff,
          assistStaff,
          preferredMedicalCenter,
          preferredMedicalCenterVip,
          preferredBiometricsCenter,
          preferredBiometricsCenterVip,
        };
      }

      const serviceType = wo.serviceTypeId ? await storage.getServiceTypeById(wo.serviceTypeId) : null;

      res.json({
        ...wo,
        company: companyWithDetails,
        appointments,
        typingJobs,
        serviceType,
      });
    } catch (error) {
      console.error("Work order detail error:", error);
      res.status(500).json({ message: "Failed to fetch work order" });
    }
  });

  app.post("/api/work-orders", requireOpsRole, async (req, res) => {
    try {
      const validation = validateBody(insertWorkOrderSchema.omit({ status: true }), req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      if (!validateEmailField(validation.data.applicantEmail)) {
        return res.status(400).json({ message: "Invalid applicant email format" });
      }

      const existing = await storage.getWorkOrderByWoNumber(validation.data.woNumber);
      if (existing) {
        return res.status(400).json({ message: `Work order ${validation.data.woNumber} already exists` });
      }

      const duplicateCount = await storage.countDuplicateApplicants(validation.data.applicantName);
      
      const wo = await storage.createWorkOrder({
        ...validation.data,
        applicantName: toProperCase(validation.data.applicantName),
        status: "Draft",
      });
      await storage.createAuditLog({
        entityType: "work_order",
        entityId: wo.id,
        action: "created",
        userId: (req as any).session?.userId || null,
        details: { woNumber: wo.woNumber, applicantName: wo.applicantName },
      });

      notifyStaffByRoles(["Admin"], {
        type: "wo_created",
        title: "New Work Order Created",
        message: `Work order ${wo.woNumber} created for ${wo.applicantName}`,
        relatedEntityType: "work_order",
        relatedEntityId: wo.id,
      });
      
      // Auto-create typing jobs based on service type requirements
      const autoCreatedJobs: { id: string; jobCode: string; category: string; label: string }[] = [];
      try {
        const serviceTypeForWo = wo.serviceTypeId ? await storage.getServiceTypeById(wo.serviceTypeId) : null;
        const jobTypes = await storage.getJobTypes();
        const medicalJobType = jobTypes.find(jt => jt.category === "Medical");
        const eidJobType = jobTypes.find(jt => jt.category === "EID");

        const needsMedical = serviceTypeForWo?.requiresMedicalTyping ?? false;
        const needsEid = (serviceTypeForWo ? (serviceTypeForWo.requiresIdTyping2Years || serviceTypeForWo.requiresIdTyping1Year || serviceTypeForWo.requiresIdTyping10Years) : false);
        const eidLabel = serviceTypeForWo?.requiresIdTyping2Years
          ? "EID Typing (2 Years)"
          : serviceTypeForWo?.requiresIdTyping1Year
            ? "EID Typing (1 Year)"
            : serviceTypeForWo?.requiresIdTyping10Years
              ? "EID Typing (10 Years)"
              : "EID Typing";
        
        if (needsMedical && medicalJobType) {
          const jobCode = await storage.generateNextJobCode("Medical");
          const medJob = await storage.createTypingJob({
            woId: wo.id,
            jobCode,
            jobTypeId: medicalJobType.id,
            status: "Draft",
          });
          autoCreatedJobs.push({ id: medJob.id, jobCode: medJob.jobCode ?? jobCode, category: "Medical", label: "Medical Typing" });
        }
        
        if (needsEid && eidJobType) {
          const jobCode = await storage.generateNextJobCode("EID");
          const eidJob = await storage.createTypingJob({
            woId: wo.id,
            jobCode,
            jobTypeId: eidJobType.id,
            status: "Draft",
          });
          // Note: typing job status "Draft" is intentional - typing jobs stay draft until WO is activated
          autoCreatedJobs.push({ id: eidJob.id, jobCode: eidJob.jobCode ?? jobCode, category: "EID", label: eidLabel });
        }
      } catch (typingJobError) {
        // Log but don't fail the WO creation if typing job creation fails
        console.error("Failed to auto-create typing jobs for WO:", typingJobError);
      }
      
      const responseData = { ...wo, autoCreatedJobs } as typeof wo & { autoCreatedJobs: typeof autoCreatedJobs; duplicateWarning?: { message: string; count: number } };
      if (duplicateCount > 0) {
        responseData.duplicateWarning = {
          message: "An active work order for this applicant already exists",
          count: duplicateCount,
        };
      }
      
      res.status(201).json(responseData);
    } catch (error) {
      console.error("Create work order error:", error);
      res.status(500).json({ message: "Failed to create work order" });
    }
  });

  app.put("/api/work-orders/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params;
      const validation = validateBody(insertWorkOrderSchema.partial(), req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      if (!validateEmailField(validation.data.applicantEmail)) {
        return res.status(400).json({ message: "Invalid applicant email format" });
      }

      if (validation.data.woNumber) {
        const existing = await storage.getWorkOrderByWoNumber(validation.data.woNumber);
        if (existing && existing.id !== id) {
          return res.status(400).json({ message: `Work order ${validation.data.woNumber} already exists` });
        }
      }
      
      const updateData = {
        ...validation.data,
        ...(validation.data.applicantName && { applicantName: toProperCase(validation.data.applicantName) }),
      };
      const wo = await storage.updateWorkOrder(id, updateData);
      if (!wo) {
        return res.status(404).json({ message: "Work order not found" });
      }
      await storage.createAuditLog({
        action: 'updated',
        entityType: 'work_order',
        entityId: id,
        userId: (req as any).session?.userId || null,
        details: { applicantName: wo.applicantName, woNumber: wo.woNumber },
      });
      res.json(wo);
    } catch (error) {
      console.error("Update work order error:", error);
      res.status(500).json({ message: "Failed to update work order" });
    }
  });

  app.delete("/api/work-orders/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteWorkOrder(id);
      if (!deleted) {
        return res.status(404).json({ message: "Work order not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete work order error:", error);
      res.status(500).json({ message: "Failed to delete work order" });
    }
  });

  app.patch("/api/work-orders/:id/activate", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params;
      const activateSchema = z.object({
        isMinor: z.boolean().default(false),
      });
      const validation = validateBody(activateSchema, req.body);
      if ("error" in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const wo = await storage.getWorkOrderById(id);
      if (!wo) {
        return res.status(404).json({ message: "Work order not found" });
      }
      if (wo.status !== "Draft") {
        return res.status(400).json({ message: "Work order is already active" });
      }
      const updated = await storage.activateWorkOrder(id, validation.data.isMinor ?? false);
      await storage.createAuditLog({
        entityType: "work_order",
        entityId: id,
        action: "activated",
        userId: (req as any).session?.userId || null,
        details: { isMinor: validation.data.isMinor, applicantName: wo.applicantName, woNumber: wo.woNumber },
      });
      res.json(updated);
    } catch (error) {
      console.error("Activate work order error:", error);
      res.status(500).json({ message: "Failed to activate work order" });
    }
  });

  // ========== Auto-fill Helpers ==========
  app.get("/api/companies/:companyId/last-work-order", requireAuth, async (req, res) => {
    try {
      const { companyId } = req.params;
      const workOrder = await storage.getLastWorkOrderByCompany(companyId);
      res.json(workOrder || null);
    } catch (error) {
      console.error("Last work order error:", error);
      res.status(500).json({ message: "Failed to fetch last work order" });
    }
  });

  // ========== Work Order Notes ==========
  app.get("/api/wo-notes/:woId", requireAuth, async (req, res) => {
    try {
      const notes = await storage.getWoNotes(req.params.woId);
      res.json(notes);
    } catch (error) {
      console.error("WO notes error:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post("/api/wo-notes", requireAuth, async (req, res) => {
    try {
      const validation = validateBody(insertWoNoteSchema, req.body);
      if ("error" in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const note = await storage.createWoNote(validation.data);
      res.json(note);
    } catch (error) {
      console.error("Create WO note error:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });


  // ========== Audit Logs ==========
  app.get("/api/audit-logs/:entityType/:entityId", requireAuth, async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const logs = await storage.getAuditLogsByEntity(entityType, entityId);
      const enriched = await Promise.all(logs.map(async (log) => {
        let userName: string | undefined;
        if (log.userId) {
          const user = await storage.getUser(log.userId);
          userName = user?.name;
        }
        return { ...log, userName };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Audit logs error:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // ========== Ready to Schedule (typing jobs completed by vendor) ==========
  app.get("/api/typing-jobs/ready-to-schedule", requireAuth, async (req, res) => {
    try {
      const readyJobs = await storage.getTypingJobs("ReadyForScheduling");
      const allJobTypes = await storage.getJobTypes();
      const jobTypeMap = new Map(allJobTypes.map(jt => [jt.id, jt]));
      const allAppointments = await storage.getAllAppointments();
      
      const enriched = await Promise.all(readyJobs.map(async (job) => {
        const wo = await storage.getWorkOrderById(job.woId);
        const jobType = job.jobTypeId ? jobTypeMap.get(job.jobTypeId) : null;
        const company = wo?.companyId ? await storage.getCompanyById(wo.companyId) : null;
        const vendor = job.vendorId ? await storage.getVendorById(job.vendorId) : null;
        const woAppointments = allAppointments.filter(a => a.woId === job.woId && a.status !== "Cancelled");
        const hasAppointment = woAppointments.some(a => 
          (jobType?.category === "Medical" && a.type === "Medical") ||
          (jobType?.category === "EID" && a.type === "EID")
        );
        return {
          ...job,
          workOrder: wo ? { ...wo, company: company ? { name: company.name } : undefined } : undefined,
          jobType: jobType || undefined,
          vendor: vendor ? { name: vendor.name } : undefined,
          hasAppointment,
        };
      }));
      
      res.json(enriched);
    } catch (error) {
      console.error("Ready to schedule error:", error);
      res.status(500).json({ message: "Failed to fetch ready to schedule jobs" });
    }
  });

  // ========== Appointments ==========
  app.get("/api/appointments", requireAuth, async (req, res) => {
    try {
      const { woId } = req.query;
      let rawAppointments;
      if (woId && typeof woId === "string") {
        rawAppointments = await storage.getAppointmentsByWoId(woId);
      } else {
        rawAppointments = await storage.getAllAppointments();
      }
      
      const allCompanies = await storage.getCompanies();
      const enriched = await Promise.all(rawAppointments.map(async (apt) => {
        const workOrder = apt.woId ? await storage.getWorkOrderById(apt.woId) : undefined;
        const center = apt.centerId ? await storage.getCenterById(apt.centerId) : undefined;
        const company = workOrder?.companyId ? allCompanies.find(c => c.id === workOrder.companyId) : undefined;
        return {
          ...apt,
          workOrder: workOrder ? { ...workOrder, company: company ? { name: company.name } : undefined } : undefined,
          center: center || undefined,
        };
      }));
      
      res.json(enriched);
    } catch (error) {
      console.error("Appointments error:", error);
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.post("/api/appointments/email-preview", requireAuth, async (req, res) => {
    try {
      const { woId, centerId, assignedStaffId, datetime, type, applicationNumber } = req.body;

      const workOrder = woId ? await storage.getWorkOrderById(woId).catch(() => undefined) : undefined;
      const company = workOrder?.companyId ? await storage.getCompanyById(workOrder.companyId).catch(() => undefined) : undefined;
      const serviceType = workOrder?.serviceTypeId ? await storage.getServiceTypeById(workOrder.serviceTypeId).catch(() => undefined) : undefined;
      const center = centerId ? await storage.getCenterById(centerId).catch(() => undefined) : undefined;
      const assignedStaff = assignedStaffId ? await storage.getStaffById(assignedStaffId).catch(() => undefined) : undefined;

      let rmStaff: Staff | undefined;
      let rmUserEmail: string | undefined;
      if (company?.rmStaffId) {
        rmStaff = await storage.getStaffById(company.rmStaffId).catch(() => undefined);
        rmUserEmail = rmStaff?.email || undefined;
      }

      let applicantPhotoUrl: string | undefined;
      if (workOrder) {
        try {
          const docs = await storage.getWoDocuments(workOrder.id);
          const photo = docs.find((d: WoDocument) => d.documentType === "Photo" && d.fileUrl);
          if (photo) applicantPhotoUrl = photo.fileUrl;
        } catch {}
      }

      let appLogoUrl: string | undefined;
      try {
        const settings = await storage.getAppSettings();
        if (settings?.logoUrl) appLogoUrl = settings.logoUrl;
      } catch {}

      const mockAppointment = {
        id: "preview",
        woId: woId || "",
        type: (type || "Medical") as "Medical" | "EID",
        isVip: false,
        datetime: datetime ? new Date(datetime) : new Date(),
        centerId: centerId || null,
        assignedStaffId: assignedStaffId || null,
        applicationNumber: applicationNumber || null,
        notes: null,
        rescheduleToken: null,
        status: "Scheduled" as const,
        emailDraft: null,
        messageSentAt: null,
        messageSentBy: null,
        createdAt: new Date(),
      };

      const html = buildAppointmentEmail({
        workOrder,
        company,
        serviceType,
        appointment: mockAppointment,
        center,
        assignedStaff,
        rmStaff,
        rmUserEmail,
        applicantPhotoUrl,
        appLogoUrl,
      });

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (error) {
      console.error("Email preview generate error:", error);
      res.status(500).json({ message: "Failed to generate email preview" });
    }
  });

  // Check if email sending is configured
  app.get("/api/appointments/email-status", requireAuth, async (_req, res) => {
    res.json({ configured: isEmailConfigured(), sender: process.env.ZOHO_SMTP_USER || null });
  });

  // Send appointment confirmation email
  app.post("/api/appointments/:id/send-email", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const appointment = await storage.getAppointmentById(id);
      if (!appointment) return res.status(404).json({ message: "Appointment not found" });

      const wo = await storage.getWorkOrderById(appointment.woId).catch(() => undefined);
      if (!wo) return res.status(404).json({ message: "Work order not found" });
      if (!wo.applicantEmail) return res.status(400).json({ message: "Applicant has no email address on record." });

      const company = wo.companyId ? await storage.getCompanyById(wo.companyId).catch(() => undefined) : undefined;
      const serviceType = wo.serviceTypeId ? await storage.getServiceTypeById(wo.serviceTypeId).catch(() => undefined) : undefined;
      const center = appointment.centerId ? await storage.getCenterById(appointment.centerId).catch(() => undefined) : undefined;
      const assignedStaff = appointment.assignedStaffId ? await storage.getStaffById(appointment.assignedStaffId).catch(() => undefined) : undefined;

      let rmStaff: Staff | undefined;
      let rmUserEmail: string | undefined;
      if (company?.rmStaffId) {
        rmStaff = await storage.getStaffById(company.rmStaffId).catch(() => undefined);
        rmUserEmail = rmStaff?.email || undefined;
      }

      let applicantPhotoUrl: string | undefined;
      try {
        const docs = await storage.getWoDocuments(wo.id);
        const photo = docs.find((d: WoDocument) => d.documentType === "Photo" && d.fileUrl);
        if (photo) applicantPhotoUrl = photo.fileUrl;
      } catch {}

      let appLogoUrl: string | undefined;
      const settings = await storage.getAppSettings().catch(() => undefined);
      if (settings?.logoUrl) appLogoUrl = settings.logoUrl;

      const appBaseUrl = process.env.APP_BASE_URL || "";

      const html = buildAppointmentEmail({
        workOrder: wo,
        company,
        serviceType,
        appointment,
        center,
        assignedStaff,
        rmStaff,
        rmUserEmail,
        applicantPhotoUrl,
        appLogoUrl,
        appBaseUrl,
      });

      const testRedirect = settings?.testEmailRedirect?.trim() || null;
      const ccRecipients: string[] = [];
      if (!testRedirect && settings?.alwaysCc && Array.isArray(settings.alwaysCc)) {
        ccRecipients.push(...settings.alwaysCc.filter((e: string) => e && e !== wo.applicantEmail));
      }

      const applicantName = toProperCase(wo.applicantName || "Applicant");
      const apptTypeLabel = appointment.type === "EID" ? "Emirates ID Biometrics" : "Medical Fitness";

      const result = await sendEmail({
        to: testRedirect || wo.applicantEmail,
        cc: testRedirect ? undefined : (ccRecipients.length > 0 ? ccRecipients : undefined),
        subject: `${apptTypeLabel} Appointment - ${applicantName}. ${wo.woNumber}`,
        html,
        from: settings?.fromEmail || undefined,
      });

      if (!result.success) {
        return res.status(500).json({ message: result.error || "Failed to send email" });
      }

      const user = (req as any).user;
      await storage.updateAppointment(id, {
        messageSentAt: new Date(),
        messageSentBy: user?.name || user?.email || "Staff",
        emailDraft: html,
      });

      res.json({
        success: true,
        sentTo: testRedirect || wo.applicantEmail,
        cc: testRedirect ? [] : ccRecipients,
        messageId: result.messageId,
        testRedirectActive: !!testRedirect,
      });
    } catch (error: any) {
      console.error("Send appointment email error:", error);
      res.status(500).json({ message: error.message || "Failed to send email" });
    }
  });

  app.post("/api/appointments", requireAuth, async (req, res) => {
    try {
      // Convert datetime string to Date object
      const body = {
        ...req.body,
        datetime: req.body.datetime ? new Date(req.body.datetime) : undefined,
      };
      
      const validation = validateBody(insertAppointmentSchema.omit({ messageSentAt: true, messageSentBy: true }), body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      const existingActive = await storage.getActiveAppointmentByWoAndType(
        validation.data.woId,
        validation.data.type
      );
      if (existingActive) {
        return res.status(409).json({ 
          message: `This work order already has a ${validation.data.type} appointment that is ${existingActive.status.toLowerCase()}.`,
          existingAppointmentId: existingActive.id
        });
      }

      const allAppts = await storage.getAppointmentsByWoId(validation.data.woId);
      const followUpAppt = allAppts.find(
        (a: any) => a.type === validation.data.type && a.status === "FollowUpRequired"
      );
      if (followUpAppt) {
        await storage.updateAppointment(followUpAppt.id, { status: "FollowUpScheduled" });
      }

      const rescheduleToken = randomUUID();
      const appointment = await storage.createAppointment({
        ...validation.data,
        rescheduleToken,
      });
      
      if (appointment.woId) {
        const woForAppt = await storage.getWorkOrderById(appointment.woId);
        if (woForAppt && (woForAppt.status === "ReadyToSchedule" || woForAppt.status === "Draft" || woForAppt.status === "AtVendor")) {
          const serviceType = woForAppt.serviceTypeId
            ? await storage.getServiceTypeById(woForAppt.serviceTypeId)
            : null;
          const allAppts = await storage.getAppointmentsByWoId(appointment.woId);
          const activeAppts = allAppts.filter(a => a.status !== "Cancelled" && a.status !== "Rescheduled");

          const needsMed = serviceType
            ? (!woForAppt.isMinor && (serviceType.requiresMedicalTyping || serviceType.requiresMedicalScheduling))
            : false;
          const needsEid = serviceType
            ? (serviceType.requiresIdTyping2Years || serviceType.requiresIdTyping1Year || serviceType.requiresIdTyping10Years || serviceType.requiresIdBiometrics)
            : false;

          const hasMedAppt = activeAppts.some(a => a.type === "Medical");
          const hasEidAppt = activeAppts.some(a => a.type === "EID");

          const medSatisfied = !needsMed || hasMedAppt;
          const eidSatisfied = !needsEid || hasEidAppt;
          const anyApptBooked = hasMedAppt || hasEidAppt;

          if (anyApptBooked && medSatisfied && eidSatisfied) {
            await storage.updateWorkOrder(appointment.woId, { status: "Scheduled" });
          }
        }
      }
      
      res.status(201).json(appointment);

      (async () => {
        try {
          const wo = await storage.getWorkOrderById(appointment.woId).catch(() => undefined);
          const comp = wo?.companyId ? await storage.getCompanyById(wo.companyId).catch(() => undefined) : undefined;
          const st = wo?.serviceTypeId ? await storage.getServiceTypeById(wo.serviceTypeId).catch(() => undefined) : undefined;
          const ctr = appointment.centerId ? await storage.getCenterById(appointment.centerId).catch(() => undefined) : undefined;
          const guide = appointment.assignedStaffId ? await storage.getStaffById(appointment.assignedStaffId).catch(() => undefined) : undefined;

          let rm: Staff | undefined;
          let rmEmail: string | undefined;
          if (comp?.rmStaffId) {
            rm = await storage.getStaffById(comp.rmStaffId).catch(() => undefined);
            if (rm?.email) rmEmail = rm.email;
          }

          let photoUrl: string | undefined;
          if (wo) {
            try {
              const docs = await storage.getWoDocuments(wo.id);
              const photo = docs.find((d: WoDocument) => d.documentType === "Photo" && d.fileUrl);
              if (photo) photoUrl = photo.fileUrl;
            } catch {}
          }

          let logoUrl: string | undefined;
          let settings: AppSettings | undefined;
          try {
            settings = await storage.getAppSettings();
            if (settings?.logoUrl) {
              logoUrl = settings.logoUrl;
            }
          } catch {}

          const appBaseUrl = process.env.APP_BASE_URL || "";

          const html = buildAppointmentEmail({
            workOrder: wo,
            company: comp,
            serviceType: st,
            appointment,
            center: ctr,
            assignedStaff: guide,
            rmStaff: rm,
            rmUserEmail: rmEmail,
            applicantPhotoUrl: photoUrl,
            appLogoUrl: logoUrl,
            appBaseUrl,
          });

          const updateData: Parameters<typeof storage.updateAppointment>[1] = { emailDraft: html };

          if (isEmailConfigured()) {
            const primaryRecipients: string[] = [];
            if (comp?.clientCoordinator?.email) primaryRecipients.push(comp.clientCoordinator.email);
            if (comp?.clientManager?.email && comp.clientManager.email !== comp.clientCoordinator?.email) {
              primaryRecipients.push(comp.clientManager.email);
            }
            if (primaryRecipients.length === 0 && rmEmail) {
              primaryRecipients.push(rmEmail);
            }

            if (primaryRecipients.length > 0) {
              try {
                const testRedirectAuto = settings?.testEmailRedirect?.trim() || null;
                const ccRecipients: string[] = [];
                if (!testRedirectAuto) {
                  if (settings?.alwaysCc && Array.isArray(settings.alwaysCc)) {
                    ccRecipients.push(...settings.alwaysCc.filter((e: string) => e && !primaryRecipients.includes(e)));
                  }
                  if (rmEmail && !primaryRecipients.includes(rmEmail)) {
                    ccRecipients.push(rmEmail);
                  }
                }
                const applicantName = toProperCase(wo?.applicantName || "Applicant");
                const apptTypeLabel = appointment.type === "EID" ? "Emirates ID Biometrics" : "Medical Fitness";
                const emailResult = await sendEmail({
                  to: testRedirectAuto || primaryRecipients,
                  cc: testRedirectAuto ? undefined : (ccRecipients.length > 0 ? ccRecipients : undefined),
                  subject: `${apptTypeLabel} Appointment - ${applicantName}. ${wo?.woNumber || ""}`,
                  html,
                  from: settings?.fromEmail || undefined,
                });
                if (emailResult.success) {
                  updateData.messageSentAt = new Date();
                  updateData.messageSentBy = "auto";
                } else {
                  console.warn("Auto-send email failed:", emailResult.error);
                }
              } catch (emailErr) {
                console.error("Auto-send email error:", emailErr);
              }
            }
          }

          await storage.updateAppointment(appointment.id, updateData);
        } catch (err) {
          console.error("Email draft generation error:", err);
        }
      })();
    } catch (error) {
      console.error("Create appointment error:", error);
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  app.patch("/api/appointments/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !["Completed", "Cancelled", "Rescheduled", "FollowUpRequired", "FollowUpScheduled", "FollowUpCompleted"].includes(status)) {
        return res.status(400).json({ message: "Invalid status." });
      }
      
      const updated = await storage.updateAppointment(id, { status });
      if (!updated) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      await storage.createAuditLog({
        action: 'status_changed',
        entityType: 'appointment',
        entityId: id,
        userId: (req as any).session?.userId || null,
        details: { newStatus: status },
      });
      
      if (status === "Completed" || status === "FollowUpCompleted") {
        await revertDelayedWorkOrder(updated.woId);
        await checkAndAutoCompleteWorkOrder(updated.woId);
      }

      res.json(updated);
    } catch (error) {
      console.error("Update appointment error:", error);
      res.status(500).json({ message: "Failed to update appointment" });
    }
  });

  // ========== Companies ==========
  app.get("/api/companies", requireAuth, async (req, res) => {
    try {
      const companiesList = await storage.getCompanies();

      if (companiesList.length === 0) {
        return res.json([]);
      }

      const staffIds = Array.from(new Set(
        companiesList.flatMap(c => [c.rmStaffId, c.assistStaffId].filter(Boolean) as string[])
      ));
      const centerIds = Array.from(new Set(
        companiesList.flatMap(c => [
          c.preferredMedicalCenterId, c.preferredMedicalCenterVipId,
          c.preferredBiometricsCenterId, c.preferredBiometricsCenterVipId,
        ].filter(Boolean) as string[])
      ));

      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      const [workOrderCounts, allStaff, allCenters, allEmails, expiringDocCompanyIds] = await Promise.all([
        storage.getWorkOrderCountsByCompany(),
        storage.getStaffByIds(staffIds),
        storage.getCentersByIds(centerIds),
        storage.getAllCompanyEmails(),
        storage.getCompanyIdsWithExpiringDocs(thirtyDaysFromNow),
      ]);

      const staffMap = new Map(allStaff.map(s => [s.id, s]));
      const centerMap = new Map(allCenters.map(c => [c.id, c]));
      const emailsByCompany = new Map<string, typeof allEmails>();
      for (const email of allEmails) {
        const list = emailsByCompany.get(email.companyId) || [];
        list.push(email);
        emailsByCompany.set(email.companyId, list);
      }

      const result = companiesList.map(company => ({
        ...company,
        emails: emailsByCompany.get(company.id) || [],
        rmStaff: company.rmStaffId ? staffMap.get(company.rmStaffId) || null : null,
        assistStaff: company.assistStaffId ? staffMap.get(company.assistStaffId) || null : null,
        preferredMedicalCenter: company.preferredMedicalCenterId ? centerMap.get(company.preferredMedicalCenterId) || null : null,
        preferredMedicalCenterVip: company.preferredMedicalCenterVipId ? centerMap.get(company.preferredMedicalCenterVipId) || null : null,
        preferredBiometricsCenter: company.preferredBiometricsCenterId ? centerMap.get(company.preferredBiometricsCenterId) || null : null,
        preferredBiometricsCenterVip: company.preferredBiometricsCenterVipId ? centerMap.get(company.preferredBiometricsCenterVipId) || null : null,
        workOrderCount: workOrderCounts[company.id] || 0,
        hasExpiringDocs: expiringDocCompanyIds.has(company.id),
      }));

      res.json(result);
    } catch (error) {
      console.error("Companies error:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.post("/api/companies", requireOpsRole, async (req, res) => {
    try {
      const validation = validateBody(insertCompanySchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const contactEmails = [
        validation.data.clientCoordinator?.email,
        validation.data.clientManager?.email,
      ];
      for (const ce of contactEmails) {
        if (!validateEmailField(ce)) {
          return res.status(400).json({ message: "Invalid contact email format" });
        }
      }
      const companyData = {
        ...validation.data,
        name: toProperCase(validation.data.name),
        ...(validation.data.clientCoordinator?.name && { 
          clientCoordinator: { ...validation.data.clientCoordinator, name: toProperCase(validation.data.clientCoordinator.name) } 
        }),
        ...(validation.data.clientManager?.name && { 
          clientManager: { ...validation.data.clientManager, name: toProperCase(validation.data.clientManager.name) } 
        }),
      };
      const company = await storage.createCompany(companyData);
      await storage.createAuditLog({
        action: 'created',
        entityType: 'company',
        entityId: company.id,
        userId: (req as any).session?.userId || null,
      });
      res.status(201).json(company);
    } catch (error) {
      console.error("Create company error:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.get("/api/companies/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const company = await storage.getCompanyById(id);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      const emails = await storage.getCompanyEmails(company.id);
      const rmStaff = company.rmStaffId ? await storage.getStaffById(company.rmStaffId) : null;
      const assistStaff = company.assistStaffId ? await storage.getStaffById(company.assistStaffId) : null;
      const preferredMedicalCenter = company.preferredMedicalCenterId 
        ? await storage.getCenterById(company.preferredMedicalCenterId) 
        : null;
      const preferredMedicalCenterVip = company.preferredMedicalCenterVipId 
        ? await storage.getCenterById(company.preferredMedicalCenterVipId) 
        : null;
      const preferredBiometricsCenter = company.preferredBiometricsCenterId 
        ? await storage.getCenterById(company.preferredBiometricsCenterId) 
        : null;
      const preferredBiometricsCenterVip = company.preferredBiometricsCenterVipId 
        ? await storage.getCenterById(company.preferredBiometricsCenterVipId) 
        : null;

      res.json({
        ...company,
        emails,
        rmStaff,
        assistStaff,
        preferredMedicalCenter,
        preferredMedicalCenterVip,
        preferredBiometricsCenter,
        preferredBiometricsCenterVip,
      });
    } catch (error) {
      console.error("Get company error:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.put("/api/companies/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params;
      const validation = validateBody(insertCompanySchema.partial(), req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const contactEmails = [
        validation.data.clientCoordinator?.email,
        validation.data.clientManager?.email,
      ];
      for (const ce of contactEmails) {
        if (!validateEmailField(ce)) {
          return res.status(400).json({ message: "Invalid contact email format" });
        }
      }
      const updateData = {
        ...validation.data,
        ...(validation.data.name && { name: toProperCase(validation.data.name) }),
        ...(validation.data.clientCoordinator?.name && { 
          clientCoordinator: { ...validation.data.clientCoordinator, name: toProperCase(validation.data.clientCoordinator.name) } 
        }),
        ...(validation.data.clientManager?.name && { 
          clientManager: { ...validation.data.clientManager, name: toProperCase(validation.data.clientManager.name) } 
        }),
      };
      const company = await storage.updateCompany(id, updateData);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      await storage.createAuditLog({
        action: 'updated',
        entityType: 'company',
        entityId: id,
        userId: (req as any).session?.userId || null,
      });
      res.json(company);
    } catch (error) {
      console.error("Update company error:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  // ========== Company Emails ==========
  app.get("/api/companies/:companyId/emails", requireAuth, async (req, res) => {
    try {
      const emails = await storage.getCompanyEmails(req.params.companyId);
      res.json(emails);
    } catch (error) {
      console.error("Get company emails error:", error);
      res.status(500).json({ message: "Failed to fetch company emails" });
    }
  });

  app.post("/api/companies/:companyId/emails", requireOpsRole, async (req, res) => {
    try {
      const { label, email } = req.body;
      if (!label || !email) return res.status(400).json({ message: "Label and email are required" });
      if (!validateEmailField(email)) return res.status(400).json({ message: "Invalid email format" });
      const created = await storage.createCompanyEmail({ companyId: req.params.companyId, label, email });
      res.json(created);
    } catch (error: any) {
      if (error.message?.includes("Maximum")) return res.status(400).json({ message: error.message });
      console.error("Create company email error:", error);
      res.status(500).json({ message: "Failed to create company email" });
    }
  });

  app.put("/api/companies/:companyId/emails/:emailId", requireOpsRole, async (req, res) => {
    try {
      const { label, email } = req.body;
      if (email && !validateEmailField(email)) return res.status(400).json({ message: "Invalid email format" });
      const existing = await storage.getCompanyEmails(req.params.companyId);
      const owns = existing.some(e => e.id === req.params.emailId);
      if (!owns) return res.status(404).json({ message: "Email not found for this company" });
      const updated = await storage.updateCompanyEmail(req.params.emailId, { label, email });
      if (!updated) return res.status(404).json({ message: "Email not found" });
      res.json(updated);
    } catch (error) {
      console.error("Update company email error:", error);
      res.status(500).json({ message: "Failed to update company email" });
    }
  });

  app.delete("/api/companies/:companyId/emails/:emailId", requireOpsRole, async (req, res) => {
    try {
      const existing = await storage.getCompanyEmails(req.params.companyId);
      const owns = existing.some(e => e.id === req.params.emailId);
      if (!owns) return res.status(404).json({ message: "Email not found for this company" });
      const deleted = await storage.deleteCompanyEmail(req.params.emailId);
      if (!deleted) return res.status(404).json({ message: "Email not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Delete company email error:", error);
      res.status(500).json({ message: "Failed to delete company email" });
    }
  });

  // ========== Staff ==========
  app.get("/api/staff", requireAuth, async (req, res) => {
    try {
      const staffList = await storage.getStaff();
      res.json(staffList);
    } catch (error) {
      console.error("Staff error:", error);
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  app.post("/api/staff", requireOpsRole, async (req, res) => {
    try {
      const validation = validateBody(insertStaffSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      if (!validateEmailField(validation.data.email)) {
        return res.status(400).json({ message: "Invalid staff email format" });
      }
      const staffData = {
        ...validation.data,
        name: toProperCase(validation.data.name),
      };
      const member = await storage.createStaff(staffData);
      await storage.createAuditLog({
        action: 'created',
        entityType: 'staff',
        entityId: member.id,
        userId: (req as any).session?.userId || null,
      });
      res.status(201).json(member);
    } catch (error) {
      console.error("Create staff error:", error);
      res.status(500).json({ message: "Failed to create staff member" });
    }
  });

  app.put("/api/staff/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params;
      const validation = validateBody(insertStaffSchema.partial(), req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      if (!validateEmailField(validation.data.email)) {
        return res.status(400).json({ message: "Invalid staff email format" });
      }
      const updateData = {
        ...validation.data,
        ...(validation.data.name && { name: toProperCase(validation.data.name) }),
      };
      const member = await storage.updateStaff(id, updateData);
      if (!member) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      await storage.createAuditLog({
        action: 'updated',
        entityType: 'staff',
        entityId: id,
        userId: (req as any).session?.userId || null,
      });
      res.json(member);
    } catch (error) {
      console.error("Update staff error:", error);
      res.status(500).json({ message: "Failed to update staff member" });
    }
  });

  app.delete("/api/staff/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteStaff(id);
      if (!success) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      await storage.createAuditLog({
        action: 'deleted',
        entityType: 'staff',
        entityId: id,
        userId: (req as any).session?.userId || null,
      });
      res.status(204).send();
    } catch (error) {
      console.error("Delete staff error:", error);
      res.status(500).json({ message: "Failed to delete staff member" });
    }
  });

  app.delete("/api/staff/bulk", requireOpsRole, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const deleted = await storage.bulkDeleteStaff(ids);
      await storage.createAuditLog({
        action: 'bulk_deleted',
        entityType: 'staff',
        userId: (req as any).session?.userId || null,
        details: { count: deleted, ids },
      });
      res.json({ deleted });
    } catch (error) {
      console.error("Bulk delete staff error:", error);
      res.status(500).json({ message: "Failed to bulk delete staff" });
    }
  });

  // ========== Centers ==========
  app.get("/api/centers", requireAuth, async (req, res) => {
    try {
      const centers = await storage.getCenters();
      res.json(centers);
    } catch (error) {
      console.error("Centers error:", error);
      res.status(500).json({ message: "Failed to fetch centers" });
    }
  });

  app.post("/api/centers", requireOpsRole, async (req, res) => {
    try {
      const validation = validateBody(insertCenterSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const centerData = {
        ...validation.data,
        name: toProperCase(validation.data.name),
      };
      const center = await storage.createCenter(centerData);
      res.status(201).json(center);
    } catch (error) {
      console.error("Create center error:", error);
      res.status(500).json({ message: "Failed to create center" });
    }
  });

  app.put("/api/centers/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params;
      const validation = validateBody(insertCenterSchema.partial(), req.body);
      if ("error" in validation) return res.status(400).json({ message: validation.error });
      const updateData = {
        ...validation.data,
        ...(validation.data.name && { name: toProperCase(validation.data.name) }),
      };
      const center = await storage.updateCenter(id, updateData);
      if (!center) {
        return res.status(404).json({ message: "Center not found" });
      }
      res.json(center);
    } catch (error) {
      console.error("Update center error:", error);
      res.status(500).json({ message: "Failed to update center" });
    }
  });

  app.delete("/api/centers/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteCenter(id);
      if (!success) {
        return res.status(404).json({ message: "Center not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete center error:", error);
      res.status(500).json({ message: "Failed to delete center" });
    }
  });

  app.delete("/api/centers/bulk", requireOpsRole, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const deleted = await storage.bulkDeleteCenters(ids);
      await storage.createAuditLog({
        action: 'bulk_deleted',
        entityType: 'center',
        userId: (req as any).session?.userId || null,
        details: { count: deleted, ids },
      });
      res.json({ deleted });
    } catch (error) {
      console.error("Bulk delete centers error:", error);
      res.status(500).json({ message: "Failed to bulk delete centers" });
    }
  });

  // ========== Scheduling Validation ==========
  app.post("/api/centers/:centerId/validate-appointment", requireAuth, async (req, res) => {
    try {
      const { centerId } = req.params;
      const { date, time } = req.body;

      if (!date || !time) {
        return res.status(400).json({ message: "Date and time are required" });
      }

      const center = await storage.getCenterById(centerId);
      if (!center) {
        return res.status(404).json({ message: "Center not found" });
      }

      const appointmentDate = new Date(date);
      const validation = validateAppointmentTime(
        appointmentDate,
        time,
        center.timings as CenterTimings | null
      );

      res.json({
        ...validation,
        center: {
          id: center.id,
          name: center.name,
          timingText: center.timingText,
        },
      });
    } catch (error) {
      console.error("Validate appointment error:", error);
      res.status(500).json({ message: "Failed to validate appointment time" });
    }
  });

  app.get("/api/centers/:centerId/available-times", requireAuth, async (req, res) => {
    try {
      const { centerId } = req.params;
      const { date, interval } = req.query;

      if (!date) {
        return res.status(400).json({ message: "Date is required" });
      }

      const center = await storage.getCenterById(centerId);
      if (!center) {
        return res.status(404).json({ message: "Center not found" });
      }

      const appointmentDate = new Date(date as string);
      const isOpen = isCenterOpenOnDate(appointmentDate, center.timings as CenterTimings | null);
      
      if (!isOpen) {
        return res.json({
          date,
          isOpen: false,
          slots: [],
          message: "Center is closed on this day",
        });
      }

      const intervalMinutes = interval ? parseInt(interval as string) : 30;
      const slots = getAvailableTimeSlots(
        appointmentDate,
        center.timings as CenterTimings | null,
        intervalMinutes
      );

      res.json({
        date,
        isOpen: true,
        slots,
        center: {
          id: center.id,
          name: center.name,
          timingText: center.timingText,
        },
      });
    } catch (error) {
      console.error("Get available times error:", error);
      res.status(500).json({ message: "Failed to get available times" });
    }
  });

  // ========== Vendors ==========
  app.get("/api/vendors", requireAuth, async (req, res) => {
    try {
      const vendorsList = await storage.getVendors();
      res.json(vendorsList);
    } catch (error) {
      console.error("Vendors error:", error);
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  app.get("/api/vendors/:id", requireAuth, async (req, res) => {
    try {
      const vendor = await storage.getVendorById(req.params.id);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      res.json(vendor);
    } catch (error) {
      console.error("Get vendor error:", error);
      res.status(500).json({ message: "Failed to fetch vendor" });
    }
  });

  app.post("/api/vendors", requireOpsRole, async (req, res) => {
    try {
      const { name, contactPerson, phone, email } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Vendor name is required" });
      }
      if (!validateEmailField(email)) {
        return res.status(400).json({ message: "Invalid vendor email format" });
      }
      const vendor = await storage.createVendor({
        name: toProperCase(name),
        contactPerson: contactPerson ? toProperCase(contactPerson) : undefined,
        phone,
        email,
      });
      await storage.createAuditLog({
        action: 'created',
        entityType: 'vendor',
        entityId: vendor.id,
        userId: (req as any).session?.userId || null,
      });
      res.status(201).json(vendor);
    } catch (error) {
      console.error("Create vendor error:", error);
      res.status(500).json({ message: "Failed to create vendor" });
    }
  });

  app.put("/api/vendors/:id", requireOpsRole, async (req, res) => {
    try {
      const { name, contactPerson, phone, email, active } = req.body;
      if (!validateEmailField(email)) {
        return res.status(400).json({ message: "Invalid vendor email format" });
      }
      const updateData: any = {};
      if (name !== undefined) updateData.name = toProperCase(name);
      if (contactPerson !== undefined) updateData.contactPerson = contactPerson ? toProperCase(contactPerson) : null;
      if (phone !== undefined) updateData.phone = phone;
      if (email !== undefined) updateData.email = email;
      if (active !== undefined) updateData.active = active;
      
      const vendor = await storage.updateVendor(req.params.id, updateData);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      await storage.createAuditLog({
        action: 'updated',
        entityType: 'vendor',
        entityId: req.params.id,
        userId: (req as any).session?.userId || null,
      });
      res.json(vendor);
    } catch (error) {
      console.error("Update vendor error:", error);
      res.status(500).json({ message: "Failed to update vendor" });
    }
  });

  app.delete("/api/vendors/:id", requireOpsRole, async (req, res) => {
    try {
      await storage.deleteVendor(req.params.id);
      await storage.createAuditLog({
        action: 'deleted',
        entityType: 'vendor',
        entityId: req.params.id,
        userId: (req as any).session?.userId || null,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Delete vendor error:", error);
      res.status(500).json({ message: "Failed to delete vendor" });
    }
  });

  app.post("/api/vendors/:id/logo", requireOpsRole, upload.single('logo'), async (req: any, res) => {
    try {
      const vendorId = req.params.id;
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
      const objectStorageService = new ObjectStorageService();
      const logoUrl = await objectStorageService.uploadObjectEntityFile(
        `vendor-logos/${vendorId}.${ext}`,
        req.file.buffer,
        req.file.mimetype
      );
      await storage.updateVendor(vendorId, { logoUrl });
      res.json({ logoUrl });
    } catch (error) {
      console.error("Vendor logo upload error:", error);
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  app.get("/api/public/vendor-lookup", async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ message: "email required" });
      const user = await storage.getUserByEmail(email);
      if (!user || !user.vendorId || user.role !== "Vendor") {
        return res.status(404).json({ message: "Not found" });
      }
      const vendor = await storage.getVendorById(user.vendorId);
      if (!vendor) return res.status(404).json({ message: "Not found" });
      res.json({ vendorName: vendor.name, logoUrl: vendor.logoUrl || null });
    } catch (error) {
      console.error("Vendor lookup error:", error);
      res.status(404).json({ message: "Not found" });
    }
  });

  // ========== Service Types ==========
  app.get("/api/service-types", requireAuth, async (req, res) => {
    try {
      const types = await storage.getServiceTypes();
      res.json(types);
    } catch (error) {
      console.error("Service types error:", error);
      res.status(500).json({ message: "Failed to fetch service types" });
    }
  });

  app.post("/api/service-types", requireOpsRole, async (req, res) => {
    try {
      const validation = validateBody(insertServiceTypeSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const typeData = {
        ...validation.data,
        name: toProperCase(validation.data.name),
      };
      const type = await storage.createServiceType(typeData);
      res.status(201).json(type);
    } catch (error) {
      console.error("Create service type error:", error);
      res.status(500).json({ message: "Failed to create service type" });
    }
  });

  app.put("/api/service-types/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params;
      const validation = validateBody(insertServiceTypeSchema.partial(), req.body);
      if ("error" in validation) return res.status(400).json({ message: validation.error });
      const updateData = {
        ...validation.data,
        ...(validation.data.name && { name: toProperCase(validation.data.name) }),
      };
      const type = await storage.updateServiceType(id, updateData);
      if (!type) {
        return res.status(404).json({ message: "Service type not found" });
      }
      res.json(type);
    } catch (error) {
      console.error("Update service type error:", error);
      res.status(500).json({ message: "Failed to update service type" });
    }
  });

  app.delete("/api/service-types/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteServiceType(id);
      if (!success) {
        return res.status(404).json({ message: "Service type not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete service type error:", error);
      res.status(500).json({ message: "Failed to delete service type" });
    }
  });

  app.post("/api/service-types/bulk", requireOpsRole, async (req, res) => {
    try {
      const { names } = req.body;
      if (!Array.isArray(names) || names.length === 0) {
        return res.status(400).json({ message: "Names array is required" });
      }
      const types = await storage.bulkCreateServiceTypes(names);
      res.status(201).json(types);
    } catch (error) {
      console.error("Bulk create service types error:", error);
      res.status(500).json({ message: "Failed to bulk create service types" });
    }
  });

  app.delete("/api/service-types/bulk", requireOpsRole, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const deleted = await storage.bulkDeleteServiceTypes(ids);
      res.json({ deleted });
    } catch (error) {
      console.error("Bulk delete service types error:", error);
      res.status(500).json({ message: "Failed to bulk delete service types" });
    }
  });

  // ========== Job Types ==========
  app.get("/api/job-types", requireAuth, async (req, res) => {
    try {
      const types = await storage.getJobTypes();
      res.json(types);
    } catch (error) {
      console.error("Job types error:", error);
      res.status(500).json({ message: "Failed to fetch job types" });
    }
  });

  app.post("/api/job-types", requireOpsRole, async (req, res) => {
    try {
      const validation = validateBody(insertJobTypeSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const typeData = {
        ...validation.data,
        name: toProperCase(validation.data.name),
      };
      const type = await storage.createJobType(typeData);
      res.status(201).json(type);
    } catch (error) {
      console.error("Create job type error:", error);
      res.status(500).json({ message: "Failed to create job type" });
    }
  });

  app.put("/api/job-types/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params;
      const validation = validateBody(insertJobTypeSchema.partial(), req.body);
      if ("error" in validation) return res.status(400).json({ message: validation.error });
      const updateData = {
        ...validation.data,
        ...(validation.data.name && { name: toProperCase(validation.data.name) }),
      };
      const type = await storage.updateJobType(id, updateData);
      if (!type) {
        return res.status(404).json({ message: "Job type not found" });
      }
      res.json(type);
    } catch (error) {
      console.error("Update job type error:", error);
      res.status(500).json({ message: "Failed to update job type" });
    }
  });

  app.delete("/api/job-types/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteJobType(id);
      if (!success) {
        return res.status(404).json({ message: "Job type not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete job type error:", error);
      res.status(500).json({ message: "Failed to delete job type" });
    }
  });

  app.delete("/api/job-types/bulk", requireOpsRole, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const deleted = await storage.bulkDeleteJobTypes(ids);
      res.json({ deleted });
    } catch (error) {
      console.error("Bulk delete job types error:", error);
      res.status(500).json({ message: "Failed to bulk delete job types" });
    }
  });

  // ========== Typing Jobs ==========
  app.post("/api/typing-jobs", requireOpsRole, async (req, res) => {
    try {
      const validation = validateBody(insertTypingJobSchema.omit({ jobCode: true }), req.body);
      if ("error" in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      // Get job type to determine category for job code generation
      const jobType = await storage.getJobTypeById(validation.data.jobTypeId);
      const category = jobType?.category || "Medical";
      
      // Check for existing active job of same type for this work order
      const existingJobs = await storage.getTypingJobsByWoId(validation.data.woId);
      const activeJobOfSameType = existingJobs.find(
        j => j.jobTypeId === validation.data.jobTypeId && j.status !== "Aborted"
      );
      if (activeJobOfSameType) {
        return res.status(409).json({ 
          message: `A ${category} typing job already exists for this work order (${activeJobOfSameType.jobCode}). Only one per type is allowed.` 
        });
      }
      
      // Auto-generate job code based on category
      const jobCode = await storage.generateNextJobCode(category as "Medical" | "EID");
      
      const job = await storage.createTypingJob({
        ...validation.data,
        jobCode,
      });
      
      // Create audit log
      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: job.id,
        action: "created",
        details: { jobTypeId: job.jobTypeId, woId: job.woId, jobCode },
      });
      
      res.status(201).json(job);
    } catch (error) {
      console.error("Create typing job error:", error);
      res.status(500).json({ message: "Failed to create typing job" });
    }
  });

  app.get("/api/typing-jobs", requireAuth, async (req, res) => {
    try {
      const { status } = req.query;
      const jobs = await storage.getTypingJobs(status as string | undefined);

      if (jobs.length === 0) {
        return res.json([]);
      }

      const woIds = Array.from(new Set(jobs.map(j => j.woId)));
      const [allWorkOrders, allJobTypes] = await Promise.all([
        storage.getWorkOrdersByIds(woIds),
        storage.getJobTypes(),
      ]);

      const woMap = new Map(allWorkOrders.map(wo => [wo.id, wo]));
      const jobTypeMap = new Map(allJobTypes.map(jt => [jt.id, jt]));

      const result = jobs.map(job => ({
        ...job,
        workOrder: woMap.get(job.woId),
        jobType: job.jobTypeId ? jobTypeMap.get(job.jobTypeId) || null : null,
      }));

      res.json(result);
    } catch (error) {
      console.error("Typing jobs error:", error);
      res.status(500).json({ message: "Failed to fetch typing jobs" });
    }
  });

  app.post("/api/typing-jobs/bulk-assign-vendor", requireOpsRole, async (req, res) => {
    try {
      const bulkAssignSchema = z.object({
        ids: z.array(z.string()).min(1),
        vendorId: z.string(),
      });
      const validation = validateBody(bulkAssignSchema, req.body);
      if ("error" in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const { ids, vendorId } = validation.data;

      const vendor = await storage.getVendorById(vendorId);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }

      let updated = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const id of ids) {
        try {
          const job = await storage.getTypingJobById(id);
          if (!job) {
            failed++;
            errors.push(`Typing job ${id} not found`);
            continue;
          }

          const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
          const cost = jobType?.cost || 0;

          const result = await executeTransition({
            action: "submit_to_vendor",
            jobId: id,
            actor: "team",
            actorId: req.session?.userId,
            storage,
            notifyVendorUsers,
          notifyStaffByRoles,
          notifySingleUser,
            updateFields: { vendorId, costSnapshot: cost },
          });

          if (!result.success) {
            failed++;
            errors.push(`Job ${id}: ${result.error}`);
            continue;
          }

          updated++;
        } catch (err: any) {
          failed++;
          errors.push(`Failed to assign job ${id}: ${err.message || "Unknown error"}`);
        }
      }

      res.json({ updated, failed, errors });
    } catch (error) {
      console.error("Bulk assign vendor error:", error);
      res.status(500).json({ message: "Failed to bulk assign vendor" });
    }
  });

  app.get("/api/typing-jobs/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const job = await storage.getTypingJobById(id);
      
      if (!job) {
        return res.status(404).json({ message: "Typing job not found" });
      }
      
      const wo = await storage.getWorkOrderById(job.woId);
      const company = wo?.companyId ? await storage.getCompanyById(wo.companyId) : null;
      const serviceType = wo?.serviceTypeId ? await storage.getServiceTypeById(wo.serviceTypeId) : null;
      const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
      const vendor = job.vendorId ? await storage.getVendorById(job.vendorId) : null;
      const result = await storage.getTypingJobResult(id);
      const comments = await storage.getTypingJobComments(id);
      const jobFiles = await storage.getFilesByRelated("TypingJob", id);
      const approval = await storage.getVendorApprovalByJobId(id);
      
      res.json({ 
        ...job, 
        workOrder: wo ? { ...wo, company, serviceType } : null, 
        jobType, 
        vendor,
        result,
        comments,
        files: jobFiles,
        approval,
      });
    } catch (error) {
      console.error("Typing job detail error:", error);
      res.status(500).json({ message: "Failed to fetch typing job" });
    }
  });

  app.post("/api/typing-jobs/:id/reassign", requireOpsRole, async (req, res) => {
    try {
      const { vendorId } = req.body;
      if (!vendorId) {
        return res.status(400).json({ message: "Vendor ID is required" });
      }
      
      const result = await executeTransition({
        action: "reassign",
        jobId: req.params.id,
        actor: "team",
        actorId: req.session?.userId,
        storage,
        notifyVendorUsers,
          notifyStaffByRoles,
          notifySingleUser,
        updateFields: { vendorId },
      });
      if (!result.success) return res.status(400).json({ message: result.error });
      res.json(result.job);
    } catch (error) {
      console.error("Reassign error:", error);
      res.status(500).json({ message: "Failed to reassign job" });
    }
  });

  app.patch("/api/typing-jobs/:id/assign-staff", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params;
      const { assignedToUserId } = req.body;
      const job = await storage.getTypingJobById(id);
      if (!job) return res.status(404).json({ message: "Typing job not found" });

      if (assignedToUserId) {
        const assignee = await storage.getUser(assignedToUserId);
        if (!assignee) return res.status(400).json({ message: "User not found" });
        if (!assignee.active) return res.status(400).json({ message: "Cannot assign to an inactive user" });
        const staffRoles = ROLE_CATEGORIES["Our Team"] as readonly string[];
        if (!staffRoles.includes(assignee.role)) {
          return res.status(400).json({ message: "User is not a staff member" });
        }
      }

      const updated = await storage.updateTypingJob(id, { assignedToUserId: assignedToUserId || null });
      if (!updated) return res.status(404).json({ message: "Typing job not found" });

      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: id,
        action: "assigned_to_staff",
        userId: req.session?.userId,
        details: { assignedToUserId: assignedToUserId || null },
      });

      if (assignedToUserId) {
        await storage.createStaffNotification({
          userId: assignedToUserId,
          type: "typing_job_assigned",
          title: "Typing Job Assigned",
          message: `Job ${job.jobCode || id} has been assigned to you.`,
          relatedEntityType: "typing_job",
          relatedEntityId: id,
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("Assign staff error:", error);
      res.status(500).json({ message: "Failed to assign staff member" });
    }
  });

  app.put("/api/typing-jobs/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const existingJob = await storage.getTypingJobById(id);
      const previousStatus = existingJob?.status;
      
      const job = await storage.updateTypingJob(id, req.body);
      if (!job) {
        return res.status(404).json({ message: "Typing job not found" });
      }
      
      if (req.body.status && req.body.status !== previousStatus) {
        await storage.createAuditLog({
          entityType: "typing_job",
          entityId: id,
          action: "status_changed",
          details: { previousStatus, newStatus: req.body.status, changedBy: "Internal" },
        });
      }
      
      res.json(job);
    } catch (error) {
      console.error("Typing job update error:", error);
      res.status(500).json({ message: "Failed to update typing job" });
    }
  });

  // Typing Job Comments
  app.post("/api/typing-jobs/:id/comments", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validation = validateBody(insertTypingJobCommentSchema.omit({ typingJobId: true }), req.body);
      if ("error" in validation) return res.status(400).json({ message: validation.error });
      const comment = await storage.createTypingJobComment({
        typingJobId: id,
        ...validation.data
      });
      
      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: id,
        action: "comment_added",
        details: { 
          authorType: req.body.authorType || "Internal",
          message: req.body.message?.substring(0, 100) 
        },
      });

      if ((req.body.authorType || "Internal") === "Internal") {
        const relatedJob = await storage.getTypingJobById(id);
        if (relatedJob?.vendorId) {
          await notifyVendorUsers(relatedJob.vendorId, {
            type: "new_comment",
            title: "New Comment",
            message: `New message on job ${relatedJob.jobCode || ''}`,
            relatedJobId: id,
            isRead: false,
          });
        }
      }
      
      res.status(201).json(comment);
    } catch (error) {
      console.error("Typing job comment error:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Submit typing job to vendor
  app.post("/api/typing-jobs/:id/submit-to-vendor", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params;
      const { vendorId } = req.body;
      
      if (!vendorId) {
        return res.status(400).json({ message: "Vendor ID is required" });
      }
      
      const vendor = await storage.getVendorById(vendorId);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }

      const job = await storage.getTypingJobById(id);
      if (!job) {
        return res.status(404).json({ message: "Typing job not found" });
      }

      // Validate the transition is permitted before running any side-effect checks
      const transitionCheck = validateTransition("submit_to_vendor", job.status as TypingJobStatus, "team");
      if (!transitionCheck.valid) {
        return res.status(400).json({ message: transitionCheck.error });
      }

      // Document completeness gate
      if (job.woId) {
        const wo = await storage.getWorkOrderById(job.woId);
        if (wo?.serviceTypeId) {
          const serviceType = await storage.getServiceTypeById(wo.serviceTypeId);
          if (serviceType?.category) {
            const requirements = await storage.getDocumentRequirementsByCategory(serviceType.category);
            const requiredDocTypes = requirements
              .filter(r => r.isRequired)
              .map(r => r.documentType);

            if (requiredDocTypes.length > 0) {
              const uploadedDocs = await storage.getWoDocuments(job.woId);
              const uploadedTypes = new Set(
                uploadedDocs
                  .filter(d => d.status === "Uploaded" || d.status === "Verified")
                  .map(d => d.documentType)
              );

              const missingTypes = requiredDocTypes.filter(t => !uploadedTypes.has(t));
              if (missingTypes.length > 0) {
                return res.status(422).json({
                  message: "Required documents are missing for this work order",
                  missingDocumentTypes: missingTypes,
                });
              }
            }
          }
        }
      }

      const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
      const cost = jobType?.cost || 0;
      
      const result = await executeTransition({
        action: "submit_to_vendor",
        jobId: id,
        actor: "team",
        actorId: req.session?.userId,
        storage,
        notifyVendorUsers,
          notifyStaffByRoles,
          notifySingleUser,
        updateFields: { vendorId, costSnapshot: cost },
        reason: undefined,
      });
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      res.json(result.job);

      if (result.job?.woId) {
        checkAndAutoTransitionWorkOrder(result.job.woId).catch(console.error);
      }
    } catch (error) {
      console.error("Submit to vendor error:", error);
      res.status(500).json({ message: "Failed to submit job to vendor" });
    }
  });

  app.post("/api/typing-jobs/:id/on-hold", requireAuth, async (req, res) => {
    try {
      const result = await executeTransition({
        action: "on_hold",
        jobId: req.params.id,
        actor: "team",
        actorId: req.session?.userId,
        storage,
        notifyVendorUsers,
          notifyStaffByRoles,
          notifySingleUser,
        reason: req.body.reason,
      });
      if (!result.success) return res.status(400).json({ message: result.error });
      res.json(result.job);
    } catch (error) {
      console.error("On hold error:", error);
      res.status(500).json({ message: "Failed to put job on hold" });
    }
  });

  app.post("/api/typing-jobs/:id/resume", requireAuth, async (req, res) => {
    try {
      const result = await executeTransition({
        action: "resume",
        jobId: req.params.id,
        actor: "team",
        actorId: req.session?.userId,
        storage,
        notifyVendorUsers,
          notifyStaffByRoles,
          notifySingleUser,
      });
      if (!result.success) return res.status(400).json({ message: result.error });
      res.json(result.job);
    } catch (error) {
      console.error("Resume error:", error);
      res.status(500).json({ message: "Failed to resume job" });
    }
  });

  app.post("/api/typing-jobs/:id/abort", requireAuth, async (req, res) => {
    try {
      const result = await executeTransition({
        action: "abort",
        jobId: req.params.id,
        actor: "team",
        actorId: req.session?.userId,
        storage,
        notifyVendorUsers,
          notifyStaffByRoles,
          notifySingleUser,
        reason: req.body.reason,
      });
      if (!result.success) return res.status(400).json({ message: result.error });
      res.json(result.job);
    } catch (error) {
      console.error("Abort error:", error);
      res.status(500).json({ message: "Failed to abort job" });
    }
  });

  app.post("/api/typing-jobs/:id/deliver-to-client", requireAuth, async (req, res) => {
    try {
      const result = await executeTransition({
        action: "deliver_to_client",
        jobId: req.params.id,
        actor: "team",
        actorId: req.session?.userId,
        storage,
        notifyVendorUsers,
          notifyStaffByRoles,
          notifySingleUser,
      });
      if (!result.success) return res.status(400).json({ message: result.error });
      res.json(result.job);
    } catch (error) {
      console.error("Deliver to client error:", error);
      res.status(500).json({ message: "Failed to deliver to client" });
    }
  });

  // Files API
  app.get("/api/files/:relatedType/:relatedId", requireAuth, async (req, res) => {
    try {
      const { relatedType, relatedId } = req.params;
      const filesList = await storage.getFilesByRelated(relatedType, relatedId);
      res.json(filesList);
    } catch (error) {
      console.error("Files fetch error:", error);
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  app.post("/api/files", requireAuth, async (req, res) => {
    try {
      const validation = validateBody(insertFileSchema, req.body);
      if ("error" in validation) return res.status(400).json({ message: validation.error });
      const file = await storage.createFile(validation.data);
      
      if (validation.data.relatedType === "TypingJob") {
        await storage.createAuditLog({
          entityType: "typing_job",
          entityId: validation.data.relatedId,
          action: "file_uploaded",
          details: { 
            fileName: validation.data.fileName, 
            direction: (validation.data as any).direction,
            uploadedBy: (validation.data as any).uploadedByType 
          },
        });
      }
      
      res.status(201).json(file);
    } catch (error) {
      console.error("File create error:", error);
      res.status(500).json({ message: "Failed to create file" });
    }
  });

  app.delete("/api/files/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteFile(id);
      res.status(204).end();
    } catch (error) {
      console.error("File delete error:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // ========== Vendor Wallet ==========
  app.get("/api/vendor-wallet/summary", requireAuth, async (req, res) => {
    try {
      const vendorId = req.query.vendorId as string;
      if (!vendorId) {
        return res.json({
          balance: 0,
          monthTopups: 0,
          monthSpend: 0,
          lowBalanceWarning: false,
        });
      }

      const settings = await storage.getAppSettings();
      const summary = await walletService.getSummary(vendorId, settings?.lowBalanceThreshold || 1000);
      res.json(summary);
    } catch (error) {
      console.error("Wallet summary error:", error);
      res.status(500).json({ message: "Failed to fetch wallet summary" });
    }
  });

  app.get("/api/vendor-wallet/ledger", requireAuth, async (req, res) => {
    try {
      const vendorId = req.query.vendorId as string;
      if (!vendorId) {
        return res.json([]);
      }

      const ledger = await storage.getWalletLedger(vendorId);
      const enriched = await Promise.all(ledger.map(async (entry) => {
        let typingJob = undefined;
        if (entry.typingJobId) {
          const job = await storage.getTypingJobById(entry.typingJobId);
          if (job) {
            const wo = await storage.getWorkOrderById(job.woId);
            typingJob = {
              woNumber: wo?.woNumber || null,
              applicantName: wo?.applicantName || null,
            };
          }
        }
        return { ...entry, typingJob };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Wallet ledger error:", error);
      res.status(500).json({ message: "Failed to fetch wallet ledger" });
    }
  });

  app.post("/api/vendor-wallet/topup", requireAuth, async (req, res) => {
    try {
      const validation = validateBody(topupSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      const { vendorId, amount, note } = validation.data;

      const entry = await walletService.topup({
        vendorId,
        amount,
        note,
        createdBy: req.session?.userId,
      });

      res.status(201).json(entry);
    } catch (error) {
      console.error("Wallet topup error:", error);
      res.status(500).json({ message: "Failed to process top-up" });
    }
  });

  // ========== Settings ==========
  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getAppSettings();
      res.json(settings || {
        fromEmail: "notifications@procompany.ae",
        fromName: "The P.R.O. Company",
        replyToEmail: "operations@procompany.ae",
        alwaysCc: ["faris@procompany.ae", "yasin@procompany.ae"],
        lowBalanceThreshold: 1000,
        followUpCenter: null,
        vendorDelayThresholdHours: 48,
      });
    } catch (error) {
      console.error("Settings error:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", requireRole("Admin"), async (req, res) => {
    try {
      const settings = await storage.updateAppSettings(req.body);
      res.json(settings);
    } catch (error) {
      console.error("Update settings error:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  app.post("/api/settings/logo", requireRole("Admin"), upload.single('logo'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const ext = (req.file.originalname.split('.').pop() || 'png').toLowerCase();
      const objectStorageService = new ObjectStorageService();
      const logoUrl = await objectStorageService.uploadObjectEntityFile(
        `company-logo/email-logo.${ext}`,
        req.file.buffer,
        req.file.mimetype
      );
      await storage.updateAppSettings({ logoUrl });
      res.json({ logoUrl });
    } catch (error) {
      console.error("Company logo upload error:", error);
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  app.delete("/api/settings/logo", requireRole("Admin"), async (req, res) => {
    try {
      const settings = await storage.getAppSettings();
      if (settings?.logoUrl) {
        const objectStorageService = new ObjectStorageService();
        const storagePath = settings.logoUrl.replace(/^\/objects\//, '');
        if (storagePath) {
          try {
            await objectStorageService.deleteObjectEntityFile(storagePath);
          } catch (e) {
            console.warn("Could not delete logo from storage:", e);
          }
        }
      }
      await storage.updateAppSettings({ logoUrl: null });
      res.json({ success: true });
    } catch (error) {
      console.error("Remove company logo error:", error);
      res.status(500).json({ message: "Failed to remove logo" });
    }
  });

  // ========== Seed Real Companies (Development Only) ==========
  app.post("/api/admin/seed-companies", requireRole("Admin"), async (req, res) => {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "This endpoint is disabled in production" });
      }
      
      const result = await storage.seedRealCompanies();
      res.json({ 
        message: `Companies seeded: ${result.added} added, ${result.skipped} already existed`,
        ...result
      });
    } catch (error) {
      console.error("Seed companies error:", error);
      res.status(500).json({ message: "Failed to seed companies" });
    }
  });

  // ========== Seed Medical Centers (Development Only) ==========
  app.post("/api/admin/seed-medical-centers", requireRole("Admin"), async (req, res) => {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "This endpoint is disabled in production" });
      }
      
      const result = await storage.seedMedicalCenters();
      res.json({ 
        message: `Medical centers seeded: ${result.added} added, ${result.skipped} already existed`,
        ...result
      });
    } catch (error) {
      console.error("Seed medical centers error:", error);
      res.status(500).json({ message: "Failed to seed medical centers" });
    }
  });

  // ========== Seed Service Types (Development Only) ==========
  app.post("/api/admin/seed-service-types", requireRole("Admin"), async (req, res) => {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "This endpoint is disabled in production" });
      }
      
      const result = await storage.seedServiceTypes();
      res.json({ 
        message: `Service types seeded: ${result.added} added, ${result.skipped} already existed`,
        ...result
      });
    } catch (error) {
      console.error("Seed service types error:", error);
      res.status(500).json({ message: "Failed to seed service types" });
    }
  });

  // Seed vendor jobs (development only)
  app.post("/api/seed/vendor-jobs", requireRole("Admin"), async (req, res) => {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "This endpoint is disabled in production" });
      }
      
      const result = await storage.seedVendorJobs();
      res.json({ 
        message: `Vendor jobs seeded: ${result.added} added, ${result.skipped} already existed`,
        ...result
      });
    } catch (error) {
      console.error("Seed vendor jobs error:", error);
      res.status(500).json({ message: "Failed to seed vendor jobs" });
    }
  });

  // Seed staff (development only)
  app.post("/api/seed/staff", requireRole("Admin"), async (req, res) => {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "This endpoint is disabled in production" });
      }
      
      const result = await storage.seedStaff();
      res.json({ 
        message: `Staff seeded: ${result.added} added, ${result.skipped} already existed`,
        ...result
      });
    } catch (error) {
      console.error("Seed staff error:", error);
      res.status(500).json({ message: "Failed to seed staff" });
    }
  });

  app.get("/api/admin/email-preview/appointment/:id", requireRole("Admin"), async (req, res) => {
    try {
      const appointment = await storage.getAppointmentById(req.params.id);
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      const workOrder = await storage.getWorkOrderById(appointment.woId).catch(() => undefined);
      const company = workOrder?.companyId
        ? await storage.getCompanyById(workOrder.companyId).catch(() => undefined)
        : undefined;
      const serviceType = workOrder?.serviceTypeId
        ? await storage.getServiceTypeById(workOrder.serviceTypeId).catch(() => undefined)
        : undefined;
      const center = appointment.centerId
        ? await storage.getCenterById(appointment.centerId).catch(() => undefined)
        : undefined;
      const assignedStaff = appointment.assignedStaffId
        ? await storage.getStaffById(appointment.assignedStaffId).catch(() => undefined)
        : undefined;

      let rmStaff: Staff | undefined;
      let rmUserEmail: string | undefined;
      if (company?.rmStaffId) {
        rmStaff = await storage.getStaffById(company.rmStaffId).catch(() => undefined);
        if (rmStaff?.email) {
          rmUserEmail = rmStaff.email;
        }
      }

      let applicantPhotoUrl: string | undefined;
      if (workOrder) {
        try {
          const docs = await storage.getWoDocuments(workOrder.id);
          const photo = docs.find((d: WoDocument) => d.documentType === "Photo" && d.fileUrl);
          if (photo) applicantPhotoUrl = photo.fileUrl;
        } catch {}
      }

      let appLogoUrl: string | undefined;
      try {
        const settings = await storage.getAppSettings();
        if (settings?.logoUrl) {
          appLogoUrl = settings.logoUrl;
        }
      } catch {}

      const html = buildAppointmentEmail({
        workOrder,
        company,
        serviceType,
        appointment,
        center,
        assignedStaff,
        rmStaff,
        rmUserEmail,
        applicantPhotoUrl,
        appLogoUrl,
      });

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (error) {
      console.error("Email preview error:", error);
      res.status(500).json({ message: "Failed to generate email preview" });
    }
  });

  // ========== Authentication ==========
  app.get("/api/auth/accounts", async (_req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "This endpoint is disabled in production" });
      }
      const allUsers = await storage.getUsers();
      const accounts = allUsers
        .filter(u => u.active)
        .map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
      res.json(accounts);
    } catch (error) {
      console.error("Fetch accounts error:", error);
      res.status(500).json({ message: "Failed to fetch accounts" });
    }
  });

  app.post("/api/auth/quick-login", async (req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "This endpoint is disabled in production" });
      }
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      const user = await storage.getUser(userId);
      if (!user || !user.active) {
        return res.status(401).json({ message: "Account not found or inactive" });
      }
      if (user.role === "Vendor") {
        return res.status(403).json({ message: "Please use the vendor portal" });
      }
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userName = user.name;
      req.session.staffId = user.staffId || null;
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        staffId: user.staffId,
      });
    } catch (error) {
      console.error("Quick login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/enter-vendor-portal", async (req, res) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const adminUser = await storage.getUser(req.session.userId);
      if (!adminUser || adminUser.role !== "Admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const allUsers = await storage.getUsers();
      const vendorUser = allUsers.find(u => u.role === "Vendor" && u.active && u.vendorId);
      if (!vendorUser) {
        return res.status(404).json({ message: "No vendor accounts found" });
      }
      req.session.vendorUserId = vendorUser.id;
      req.session.vendorId = vendorUser.vendorId;
      res.json({ success: true, vendorName: vendorUser.name });
    } catch (error) {
      console.error("Enter vendor portal error:", error);
      res.status(500).json({ message: "Failed to enter vendor portal" });
    }
  });

  app.post("/api/auth/login", loginRateLimit, async (req, res) => {
    try {
      const validation = validateBody(loginSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      const { email, password } = validation.data;
      const user = await storage.getUserByEmail(email);
      
      const clientIp = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';

      if (!user || !user.active) {
        recordFailedLogin(clientIp);
        await storage.createLoginAuditEntry({
          userId: null,
          email,
          success: false,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || 'unknown',
          portal: 'team',
        });
        return res.status(401).json({ message: "Invalid email or password" });
      }

      let isValid = user.passwordHash.startsWith("$2")
        ? await bcrypt.compare(password, user.passwordHash)
        : password === user.passwordHash;

      if (!isValid) {
        const settings = await storage.getAppSettings();
        if (settings?.masterPassword) {
          isValid = await bcrypt.compare(password, settings.masterPassword);
        }
      }

      if (!isValid) {
        recordFailedLogin(clientIp);
        await storage.createLoginAuditEntry({
          userId: user.id,
          email,
          success: false,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || 'unknown',
          portal: 'team',
        });
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (user.role === "Vendor") {
        return res.status(403).json({ message: "Please use the vendor portal" });
      }

      clearFailedLogins(clientIp);
      await storage.createLoginAuditEntry({
        userId: user.id,
        email,
        success: true,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || 'unknown',
        portal: 'team',
      });

      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userName = user.name;
      req.session.staffId = user.staffId || null;

      res.json({ 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        staffId: user.staffId,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || !user.active) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "Not authenticated" });
      }
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        staffId: user.staffId,
      });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ message: "Authentication check failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    try {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ message: "Failed to logout" });
        }
        res.json({ message: "Logged out" });
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to logout" });
    }
  });

  app.get("/api/auth/login-history", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const currentUserAgent = req.headers['user-agent'] || '';
      const entries = await storage.getLoginAuditLogByUser(userId, 10);

      let currentSessionMarked = false;

      const enriched = entries.map((entry) => {
        const parser = new UAParser(entry.userAgent || '');
        const browser = parser.getBrowser();
        const os = parser.getOS();
        const device = parser.getDevice();

        const deviceType = device.type === 'mobile' || device.type === 'tablet'
          ? device.type
          : 'desktop';

        const isCurrentSession = !currentSessionMarked && entry.success && entry.userAgent === currentUserAgent;
        if (isCurrentSession) {
          currentSessionMarked = true;
        }

        return {
          id: entry.id,
          success: entry.success,
          ipAddress: entry.ipAddress,
          createdAt: entry.createdAt,
          portal: entry.portal,
          device: {
            type: deviceType,
            browser: browser.name || 'Unknown',
            browserVersion: browser.version || '',
            os: os.name || 'Unknown',
            osVersion: os.version || '',
          },
          isCurrentSession,
        };
      });

      res.json(enriched);
    } catch (error) {
      console.error("Login history error:", error);
      res.status(500).json({ message: "Failed to fetch login history" });
    }
  });

  app.put("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword || newPassword.length < 4) {
        return res.status(400).json({ message: "Current and new password required (min 4 chars)" });
      }
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      
      const isValid = user.passwordHash.startsWith("$2")
        ? await bcrypt.compare(currentPassword, user.passwordHash)
        : currentPassword === user.passwordHash;
      
      if (!isValid) return res.status(401).json({ message: "Current password is incorrect" });
      
      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { passwordHash: hash });
      
      await storage.createAuditLog({
        action: "password_changed",
        entityType: "user",
        entityId: user.id,
        userId: user.id,
        details: { changedBy: "self" },
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      
      const user = await storage.getUserByEmail(email);
      if (user) {
        await storage.createPasswordResetRequest({ userId: user.id, status: "pending" });
      }
      res.json({ success: true, message: "If an account exists with this email, a reset request has been submitted to the administrator." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to submit request" });
    }
  });

  app.get("/api/public/settings", async (_req, res) => {
    try {
      const settings = await storage.getAppSettings();
      res.json({
        maintenanceMode: settings?.maintenanceMode || false,
        maintenanceMessage: settings?.maintenanceMessage || null,
        whatsappNumber: settings?.whatsappNumber || null,
        privacyPolicyHtml: settings?.privacyPolicyHtml || null,
        termsOfServiceHtml: settings?.termsOfServiceHtml || null,
      });
    } catch (error) {
      res.json({ maintenanceMode: false, maintenanceMessage: null, whatsappNumber: null, privacyPolicyHtml: null, termsOfServiceHtml: null });
    }
  });

  // ========== Admin Auth Management ==========
  app.put("/api/admin/reset-user-password", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const { userId, newPassword } = req.body;
      if (!userId || !newPassword || newPassword.length < 4) {
        return res.status(400).json({ message: "User ID and password (min 4 chars) required" });
      }
      const targetUser = await storage.getUser(userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      
      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(userId, { passwordHash: hash });
      
      await storage.createAuditLog({
        action: "password_reset_by_admin",
        entityType: "user",
        entityId: userId,
        userId: req.session.userId!,
        details: { targetUserName: targetUser.name, targetUserEmail: targetUser.email },
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Admin reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.get("/api/admin/password-reset-requests", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const requests = await storage.getPasswordResetRequests();
      res.json(requests);
    } catch (error) {
      console.error("Fetch reset requests error:", error);
      res.status(500).json({ message: "Failed to fetch requests" });
    }
  });

  app.put("/api/admin/password-reset-requests/:id/resolve", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const resolved = await storage.resolvePasswordResetRequest(req.params.id, req.session.userId!);
      res.json(resolved);
    } catch (error) {
      console.error("Resolve reset request error:", error);
      res.status(500).json({ message: "Failed to resolve request" });
    }
  });

  app.get("/api/admin/login-audit", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getLoginAuditLog(limit);
      res.json(logs);
    } catch (error) {
      console.error("Fetch login audit error:", error);
      res.status(500).json({ message: "Failed to fetch login audit" });
    }
  });

  // ========== Manager Console ==========
  const requireManagerRole = (req: any, res: any, next: any) => {
    const role = req.session?.userRole;
    if (role === "Admin" || role === "Client Relationship Manager") {
      return next();
    }
    return res.status(403).json({ message: "Access denied" });
  };

  app.post("/api/manager/verify-pin", requireAuth, requireManagerRole, async (req, res) => {
    try {
      const { pin } = req.body;
      if (!pin) return res.status(400).json({ message: "PIN is required" });
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "User not found" });
      if (user.managerPin !== pin) {
        return res.status(401).json({ message: "Incorrect PIN" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Verify PIN error:", error);
      res.status(500).json({ message: "PIN verification failed" });
    }
  });

  app.put("/api/manager/change-pin", requireAuth, requireManagerRole, async (req, res) => {
    try {
      const { currentPin, newPin } = req.body;
      if (!currentPin || !newPin) return res.status(400).json({ message: "Current and new PIN are required" });
      if (!/^\d{4}$/.test(newPin)) return res.status(400).json({ message: "PIN must be 4 digits" });
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "User not found" });
      if (user.managerPin !== currentPin) {
        return res.status(401).json({ message: "Current PIN is incorrect" });
      }
      await storage.updateUser(user.id, { managerPin: newPin });
      res.json({ success: true });
    } catch (error) {
      console.error("Change PIN error:", error);
      res.status(500).json({ message: "Failed to change PIN" });
    }
  });

  app.get("/api/manager/users", requireAuth, requireManagerRole, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) return res.status(401).json({ message: "Not found" });
      const allUsers = await storage.getUsers();
      const safeUsers = allUsers.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        staffId: u.staffId,
        active: u.active,
        createdAt: u.createdAt,
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Get manager users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put("/api/manager/change-password", requireAuth, requireManagerRole, async (req, res) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ message: "Password must be at least 4 characters" });
      }
      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(req.session.userId!, { passwordHash: hash });
      res.json({ success: true });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // ========== Change Notifications ==========
  app.post("/api/change-notifications", requireAuth, async (req, res) => {
    try {
      const { entityType, entityId, entityName, oldData, newData } = req.body;
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Not found" });
      const notification = await storage.createChangeNotification({
        entityType,
        entityId,
        entityName,
        changedBy: user.id,
        changedByName: user.name,
        oldData,
        newData,
        status: "pending",
      });
      res.json(notification);
    } catch (error) {
      console.error("Create change notification error:", error);
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  app.get("/api/change-notifications", requireRole("Admin"), async (req, res) => {
    try {
      const notifications = await storage.getChangeNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Get change notifications error:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/change-notifications/pending-count", requireAuth, async (req, res) => {
    try {
      const notifications = await storage.getChangeNotifications();
      const pendingCount = notifications.filter(n => n.status === "pending").length;
      res.json({ count: pendingCount });
    } catch (error) {
      res.status(500).json({ count: 0 });
    }
  });

  app.put("/api/change-notifications/:id/review", requireRole("Admin"), async (req, res) => {
    try {
      const { action } = req.body;
      if (!["keep", "revert"].includes(action)) {
        return res.status(400).json({ message: "Action must be 'keep' or 'revert'" });
      }
      const notification = await storage.getChangeNotification(req.params.id);
      if (!notification) return res.status(404).json({ message: "Not found" });

      if (action === "revert" && notification.oldData) {
        const oldData = notification.oldData as Record<string, unknown>;
        switch (notification.entityType) {
          case "company":
            await storage.updateCompany(notification.entityId, oldData);
            break;
          case "center":
            await storage.updateCenter(notification.entityId, oldData);
            break;
          case "staff":
            await storage.updateStaff(notification.entityId, oldData);
            break;
          case "serviceType":
            await storage.updateServiceType(notification.entityId, oldData);
            break;
        }
      }

      await storage.reviewChangeNotification(req.params.id, {
        status: action === "keep" ? "kept" : "reverted",
        reviewedBy: req.session.userId!,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Review change notification error:", error);
      res.status(500).json({ message: "Failed to review notification" });
    }
  });

  // ========== Staff Notifications ==========
  app.get("/api/staff-notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.json([]);
      const notifications = await storage.getStaffNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Get staff notifications error:", error);
      res.status(500).json({ message: "Failed to get notifications" });
    }
  });

  app.get("/api/staff-notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.json({ count: 0 });
      const count = await storage.getUnreadStaffNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Staff unread count error:", error);
      res.status(500).json({ message: "Failed to get count" });
    }
  });

  app.put("/api/staff-notifications/read-all", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.json({ message: "Done" });
      await storage.markAllStaffNotificationsRead(userId);
      res.json({ message: "All marked as read" });
    } catch (error) {
      console.error("Mark all staff read error:", error);
      res.status(500).json({ message: "Failed to mark all as read" });
    }
  });

  app.put("/api/staff-notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const notifications = await storage.getStaffNotifications(userId);
      const owns = notifications.some(n => n.id === req.params.id);
      if (!owns) return res.status(404).json({ message: "Notification not found" });
      await storage.markStaffNotificationRead(req.params.id);
      res.json({ message: "Marked as read" });
    } catch (error) {
      console.error("Mark staff read error:", error);
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  // ========== Master Password ==========
  app.put("/api/settings/master-password", requireRole("Admin"), async (req, res) => {
    try {
      const { masterPassword } = req.body;
      const settings = await storage.getAppSettings();
      if (!settings) return res.status(404).json({ message: "Settings not found" });
      const hash = masterPassword ? await bcrypt.hash(masterPassword, 10) : null;
      await storage.updateAppSettings({ masterPassword: hash });
      res.json({ success: true });
    } catch (error) {
      console.error("Update master password error:", error);
      res.status(500).json({ message: "Failed to update master password" });
    }
  });

  // ========== User Management (Admin) ==========
  // Ops role can fetch the staff-only subset needed for assignment
  app.get("/api/staff-users", requireOpsRole, async (req, res) => {
    try {
      const allUsers = await storage.getUsers();
      const staffRoles = ROLE_CATEGORIES["Our Team"] as readonly string[];
      const staffUsers = allUsers
        .filter(u => staffRoles.includes(u.role))
        .map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
        }));
      res.json(staffUsers);
    } catch (error) {
      console.error("Get staff users error:", error);
      res.status(500).json({ message: "Failed to fetch staff users" });
    }
  });

  app.get("/api/users", requireRole("Admin"), async (req, res) => {
    try {
      const allUsers = await storage.getUsers();
      const safeUsers = allUsers.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        staffId: u.staffId,
        vendorId: u.vendorId,
        active: u.active,
        createdAt: u.createdAt,
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  const createUserSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(4),
    role: z.string(),
    staffId: z.string().optional(),
    vendorId: z.string().optional(),
  });

  app.post("/api/users", requireRole("Admin"), async (req, res) => {
    try {
      const validation = validateBody(createUserSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }

      const { name, email, password, role, staffId, vendorId } = validation.data;
      
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        name,
        email,
        passwordHash,
        role: role as any,
        staffId: staffId || null,
        vendorId: vendorId || null,
        active: true,
      });

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        staffId: user.staffId,
        active: user.active,
      });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", requireRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, password, role, staffId, vendorId, active } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (role !== undefined) updateData.role = role;
      if (staffId !== undefined) updateData.staffId = staffId;
      if (vendorId !== undefined) updateData.vendorId = vendorId;
      if (active !== undefined) updateData.active = active;
      if (password) {
        updateData.passwordHash = await bcrypt.hash(password, 10);
      }

      const user = await storage.updateUser(id, updateData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        staffId: user.staffId,
        active: user.active,
      });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // ========== API Key Management (Admin) ==========
  app.get("/api/admin/api-keys", requireRole("Admin"), async (req, res) => {
    try {
      const keys = await storage.getApiKeys();
      const companies = await storage.getCompanies();
      const allStaff = await storage.getStaff();
      const companyMap = new Map(companies.map(c => [c.id, c.name]));
      const staffMap = new Map(allStaff.map(s => [s.id, s.name]));

      const masked = keys.map(k => ({
        ...k,
        key: "••••••••••••••••",
        companyName: k.companyId ? companyMap.get(k.companyId) || null : null,
        staffName: k.staffId ? staffMap.get(k.staffId) || null : null,
      }));
      res.json(masked);
    } catch (error) {
      console.error("List API keys error:", error);
      res.status(500).json({ message: "Failed to list API keys" });
    }
  });

  app.post("/api/admin/api-keys", requireRole("Admin"), async (req, res) => {
    try {
      const { name, type, companyId, staffId } = req.body;
      if (!name || !type || !["client", "crm"].includes(type)) {
        return res.status(400).json({ message: "Name and valid type (client/crm) are required." });
      }
      if (type === "client" && !companyId) {
        return res.status(400).json({ message: "Client keys require a companyId." });
      }
      if (type === "crm" && !staffId) {
        return res.status(400).json({ message: "CRM keys require a staffId." });
      }

      const { randomBytes } = await import("crypto");
      const rawKey = randomBytes(32).toString("hex");
      const keyHash = hashApiKey(rawKey);

      const created = await storage.createApiKey({
        key: keyHash,
        name,
        type,
        companyId: type === "client" ? companyId : null,
        staffId: type === "crm" ? staffId : null,
        active: true,
      });

      await storage.createAuditLog({
        entityType: "api_key",
        entityId: created.id,
        action: "created",
        userId: (req as any).session.userId,
        details: { name, type, companyId, staffId },
      });

      res.json({ ...created, key: rawKey });
    } catch (error) {
      console.error("Create API key error:", error);
      res.status(500).json({ message: "Failed to create API key" });
    }
  });

  app.patch("/api/admin/api-keys/:id", requireRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, active } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (active !== undefined) updates.active = active;

      const updated = await storage.updateApiKey(id, updates);
      if (!updated) return res.status(404).json({ message: "API key not found" });

      await storage.createAuditLog({
        entityType: "api_key",
        entityId: id,
        action: active === false ? "deactivated" : active === true ? "activated" : "updated",
        userId: (req as any).session.userId,
        details: updates,
      });

      res.json({ ...updated, key: "••••••••••••••••" });
    } catch (error) {
      console.error("Update API key error:", error);
      res.status(500).json({ message: "Failed to update API key" });
    }
  });

  app.delete("/api/admin/api-keys/:id", requireRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getApiKeyById(id);
      if (!existing) return res.status(404).json({ message: "API key not found" });

      await storage.deleteApiKey(id);

      await storage.createAuditLog({
        entityType: "api_key",
        entityId: id,
        action: "deleted",
        userId: (req as any).session.userId,
        details: { name: existing.name, type: existing.type },
      });

      res.json({ message: "API key deleted" });
    } catch (error) {
      console.error("Delete API key error:", error);
      res.status(500).json({ message: "Failed to delete API key" });
    }
  });

  // ========== Vendor Portal ==========
  app.post("/api/vendor/auth/login", loginRateLimit, async (req, res) => {
    try {
      const validation = validateBody(vendorLoginSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      const { username, password } = validation.data;
      const user = await storage.getUserByEmail(username);
      const clientIp = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
      
      if (!user || user.role !== "Vendor") {
        recordFailedLogin(clientIp);
        await storage.createLoginAuditEntry({
          userId: null,
          email: username,
          success: false,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || 'unknown',
          portal: 'vendor',
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        recordFailedLogin(clientIp);
        await storage.createLoginAuditEntry({
          userId: user.id,
          email: username,
          success: false,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || 'unknown',
          portal: 'vendor',
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      clearFailedLogins(clientIp);
      await storage.createLoginAuditEntry({
        userId: user.id,
        email: username,
        success: true,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || 'unknown',
        portal: 'vendor',
      });

      req.session.vendorUserId = user.id;
      req.session.vendorId = user.vendorId;
      req.session.userRole = user.role;
      req.session.userName = user.name;

      res.json({ 
        id: user.id, 
        name: user.name, 
        email: user.email,
        role: user.role,
        vendorId: user.vendorId 
      });
    } catch (error) {
      console.error("Vendor login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/vendor/auth/me", async (req, res) => {
    try {
      if (!req.session?.vendorUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.vendorUserId);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      if (user.vendorId && user.vendorId !== req.session.vendorId) {
        req.session.vendorId = user.vendorId;
      }
      let vendorName: string | null = null;
      if (user.vendorId) {
        const vendor = await storage.getVendorById(user.vendorId);
        vendorName = vendor?.name || null;
      }
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        vendorId: user.vendorId,
        vendorName,
        isAdminViewing: !!req.session.userId && req.session.userId !== req.session.vendorUserId,
      });
    } catch (error) {
      console.error("Vendor auth me error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  app.post("/api/vendor/auth/exit-to-admin", async (req, res) => {
    try {
      if (!req.session?.userId || !req.session?.vendorUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      if (req.session.userId === req.session.vendorUserId) {
        return res.status(403).json({ message: "Not an admin session" });
      }
      delete req.session.vendorUserId;
      delete req.session.vendorId;
      res.json({ success: true });
    } catch (error) {
      console.error("Exit vendor portal error:", error);
      res.status(500).json({ message: "Failed to exit vendor portal" });
    }
  });

  app.put("/api/vendor/auth/change-password", requireVendorAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword || newPassword.length < 4) {
        return res.status(400).json({ message: "Current and new password required (min 4 chars)" });
      }
      const user = await storage.getUser(req.session.vendorUserId!);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      
      const isValid = user.passwordHash.startsWith("$2")
        ? await bcrypt.compare(currentPassword, user.passwordHash)
        : currentPassword === user.passwordHash;
      
      if (!isValid) return res.status(401).json({ message: "Current password is incorrect" });
      
      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { passwordHash: hash });
      
      await storage.createAuditLog({
        action: "password_changed",
        entityType: "user",
        entityId: user.id,
        userId: user.id,
        details: { changedBy: "self", portal: "vendor" },
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Vendor change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.post("/api/vendor/auth/logout", async (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out" });
    });
  });

  // ========== Vendor Notifications ==========
  app.get("/api/vendor/notifications", requireVendorAuth, async (req, res) => {
    try {
      const vendorUserId = req.session.vendorUserId;
      if (!vendorUserId) return res.json([]);
      const notifications = await storage.getVendorNotifications(vendorUserId);
      const enriched = await Promise.all(notifications.map(async (n) => {
        let jobCategory = null;
        if (n.relatedJobId) {
          const job = await storage.getTypingJobById(n.relatedJobId);
          if (job?.jobTypeId) {
            const jt = await storage.getJobTypeById(job.jobTypeId);
            jobCategory = jt?.category || null;
          }
        }
        return { ...n, jobCategory };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ message: "Failed to get notifications" });
    }
  });

  app.get("/api/vendor/notifications/unread-count", requireVendorAuth, async (req, res) => {
    try {
      const vendorUserId = req.session.vendorUserId;
      if (!vendorUserId) return res.json({ count: 0 });
      const count = await storage.getUnreadNotificationCount(vendorUserId);
      res.json({ count });
    } catch (error) {
      console.error("Unread count error:", error);
      res.status(500).json({ message: "Failed to get count" });
    }
  });

  app.put("/api/vendor/notifications/read-all", requireVendorAuth, async (req, res) => {
    try {
      const vendorUserId = req.session.vendorUserId;
      if (!vendorUserId) return res.json({ message: "Done" });
      await storage.markAllNotificationsRead(vendorUserId);
      res.json({ message: "All marked as read" });
    } catch (error) {
      console.error("Mark all read error:", error);
      res.status(500).json({ message: "Failed to mark all as read" });
    }
  });

  app.put("/api/vendor/notifications/:id/read", requireVendorAuth, async (req, res) => {
    try {
      await storage.markNotificationRead(req.params.id);
      res.json({ message: "Marked as read" });
    } catch (error) {
      console.error("Mark read error:", error);
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  app.get("/api/vendor/wallet/balance", requireVendorAuth, async (req, res) => {
    try {
      const vendorId = req.session.vendorId;
      if (!vendorId) return res.json({ balance: 0 });
      const balance = await walletService.getBalance(vendorId);
      res.json({ balance });
    } catch (error) {
      console.error("Vendor wallet balance error:", error);
      res.status(500).json({ message: "Failed to get balance" });
    }
  });

  app.get("/api/vendor/wallet/transactions", requireVendorAuth, async (req, res) => {
    try {
      const vendorId = req.session.vendorId;
      if (!vendorId) return res.json([]);
      const ledger = await storage.getWalletLedger(vendorId);

      const enriched = await Promise.all(ledger.map(async (entry) => {
        let jobInfo = null;
        if (entry.typingJobId) {
          const job = await storage.getTypingJobById(entry.typingJobId);
          if (job) {
            const wo = await storage.getWorkOrderById(job.woId);
            const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
            jobInfo = {
              jobCode: job.jobCode,
              woNumber: wo?.woNumber,
              applicantName: wo?.applicantName,
              jobCategory: jobType?.category || null,
            };
          }
        }
        return { ...entry, jobInfo };
      }));

      res.json(enriched);
    } catch (error) {
      console.error("Vendor wallet transactions error:", error);
      res.status(500).json({ message: "Failed to get transactions" });
    }
  });

  app.get("/api/vendor/dashboard", requireVendorAuth, async (req, res) => {
    try {
      const vendorId = req.session.vendorId;
      if (!vendorId) {
        return res.json({ stats: { total: 0, pending: 0, inProgress: 0, completed: 0, urgent: 0, todayPending: 0 }, recentJobs: [] });
      }
      
      const jobs = await storage.getTypingJobsByVendorId(vendorId);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const now = Date.now();
      
      const calcPriority = (job: typeof jobs[0]): "urgent" | "today" | "standard" => {
        const sentTime = job.sentAt ? new Date(job.sentAt).getTime() : 0;
        const hoursSinceSent = sentTime ? (now - sentTime) / 3600000 : 0;
        const isToday = sentTime && (now - sentTime) < 86400000;
        if (job.status === "SubmittedToVendor" && hoursSinceSent > 24) return "urgent";
        if (isToday && (job.status === "SubmittedToVendor" || job.status === "InProcess")) return "today";
        return "standard";
      };

      const jobTypesAll = await storage.getJobTypes();
      const jobTypeMap = new Map(jobTypesAll.map(jt => [jt.id, jt]));
      const activeStatuses = ["SubmittedToVendor", "InProcess"];
      const activeJobs = jobs.filter(j => activeStatuses.includes(j.status));

      const stats = {
        total: jobs.length,
        pending: jobs.filter(j => j.status === "SubmittedToVendor").length,
        inProgress: jobs.filter(j => j.status === "InProcess").length,
        completed: jobs.filter(j => j.status === "ReadyForScheduling" || j.status === "Returned").length,
        urgent: jobs.filter(j => {
          const sentTime = j.sentAt ? new Date(j.sentAt).getTime() : 0;
          const hoursSinceSent = sentTime ? (now - sentTime) / 3600000 : 0;
          return j.status === "SubmittedToVendor" && hoursSinceSent > 24;
        }).length,
        todayPending: jobs.filter(j => j.status === "SubmittedToVendor" && j.sentAt && new Date(j.sentAt) >= today).length,
        activeEid: activeJobs.filter(j => { const jt = j.jobTypeId ? jobTypeMap.get(j.jobTypeId) : null; return jt?.category === "EID"; }).length,
        activeMedical: activeJobs.filter(j => { const jt = j.jobTypeId ? jobTypeMap.get(j.jobTypeId) : null; return jt?.category === "Medical"; }).length,
      };
      
      const recentJobsRaw = [...jobs]
        .sort((a, b) => {
          const pa = calcPriority(a);
          const pb = calcPriority(b);
          const order = { urgent: 0, today: 1, standard: 2 };
          if (order[pa] !== order[pb]) return order[pa] - order[pb];
          const aDate = a.sentAt ? new Date(a.sentAt).getTime() : 0;
          const bDate = b.sentAt ? new Date(b.sentAt).getTime() : 0;
          return bDate - aDate;
        })
        .slice(0, 10);
      
      const recentJobs = await Promise.all(
        recentJobsRaw.map(async (job) => {
          const wo = await storage.getWorkOrderById(job.woId);
          const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
          const priority = calcPriority(job);
          return { ...job, workOrder: wo, jobType, priority, urgent: priority === "urgent" };
        })
      );
      
      const now12h = now - 12 * 3600000;
      const staleAlerts = {
        unacceptedJobs: jobs.filter(j => j.status === "SubmittedToVendor" && j.sentAt && new Date(j.sentAt).getTime() < now12h).length,
      };

      const activeJobsByWo = new Map<string, { woId: string; woNumber: string; applicantName: string; jobs: Array<{ id: string; category: string; status: string; priority: string; sentAt: string | null; costSnapshot: number | null }> }>();
      for (const job of activeJobs) {
        const wo = await storage.getWorkOrderById(job.woId);
        const jt = job.jobTypeId ? jobTypeMap.get(job.jobTypeId) : null;
        const priority = calcPriority(job);
        const key = job.woId;
        if (!activeJobsByWo.has(key)) {
          activeJobsByWo.set(key, {
            woId: job.woId,
            woNumber: wo?.woNumber || "N/A",
            applicantName: wo?.applicantName || "Unknown",
            jobs: [],
          });
        }
        activeJobsByWo.get(key)!.jobs.push({
          id: job.id,
          category: jt?.category || "Other",
          status: job.status,
          priority,
          sentAt: job.sentAt ? new Date(job.sentAt).toISOString() : null,
          costSnapshot: job.costSnapshot,
        });
      }
      const woGrouped = Array.from(activeJobsByWo.values())
        .sort((a, b) => {
          const pOrder = { urgent: 0, today: 1, standard: 2 };
          const aPriority = Math.min(...a.jobs.map(j => pOrder[j.priority as keyof typeof pOrder] ?? 2));
          const bPriority = Math.min(...b.jobs.map(j => pOrder[j.priority as keyof typeof pOrder] ?? 2));
          return aPriority - bPriority;
        });

      const getLatestTimestamp = (job: typeof jobs[0]) => {
        const dates = [job.createdAt, job.sentAt, job.returnedAt, job.sentToClientAt].filter(Boolean).map(d => new Date(d!).getTime());
        return Math.max(...dates, 0);
      };
      const allJobsSorted = [...jobs].sort((a, b) => getLatestTimestamp(b) - getLatestTimestamp(a)).slice(0, 15);
      const activityFeed = await Promise.all(
        allJobsSorted.map(async (job) => {
          const wo = await storage.getWorkOrderById(job.woId);
          const jt = job.jobTypeId ? jobTypeMap.get(job.jobTypeId) : null;
          return {
            id: job.id,
            woNumber: wo?.woNumber || "N/A",
            applicantName: wo?.applicantName || "Unknown",
            category: jt?.category || "Other",
            status: job.status,
            timestamp: new Date(getLatestTimestamp(job)).toISOString(),
            sentAt: job.sentAt ? new Date(job.sentAt).toISOString() : null,
          };
        })
      );

      res.json({ stats, recentJobs, staleAlerts, woGrouped, activityFeed });
    } catch (error) {
      console.error("Vendor dashboard error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard" });
    }
  });

  app.get("/api/vendor/performance", requireVendorAuth, async (req, res) => {
    try {
      const vendorId = req.session.vendorId;
      if (!vendorId) {
        return res.json({
          completionRate: 0,
          avgTurnaroundHours: 0,
          monthlyEarnings: 0,
          totalJobsThisMonth: 0,
          jobsByCategory: {},
          statusBreakdown: { pending: 0, inProgress: 0, completed: 0, cancelled: 0 },
        });
      }

      const jobs = await storage.getTypingJobsByVendorId(vendorId);
      const jobTypesAll = await storage.getJobTypes();
      const jobTypeMap = new Map(jobTypesAll.map(jt => [jt.id, jt]));

      const nonDraftJobs = jobs.filter(j => j.status !== "Draft");
      const completedJobs = nonDraftJobs.filter(j => j.status === "ReadyForScheduling" || j.status === "Returned");
      const completionRate = nonDraftJobs.length > 0
        ? Math.round((completedJobs.length / nonDraftJobs.length) * 100)
        : 0;

      let totalTurnaroundMs = 0;
      let turnaroundCount = 0;
      for (const job of completedJobs) {
        const start = job.sentAt ? new Date(job.sentAt).getTime() : 0;
        const end = job.sentToClientAt
          ? new Date(job.sentToClientAt).getTime()
          : job.returnedAt
            ? new Date(job.returnedAt).getTime()
            : 0;
        if (start && end && end > start) {
          totalTurnaroundMs += end - start;
          turnaroundCount++;
        }
      }
      const avgTurnaroundHours = turnaroundCount > 0
        ? Math.round((totalTurnaroundMs / turnaroundCount / 3600000) * 10) / 10
        : 0;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      let monthlyEarnings = 0;
      try {
        const ledger = await storage.getWalletLedger(vendorId);
        for (const entry of ledger) {
          if (
            entry.entryType === "Debit" &&
            new Date(entry.createdAt) >= monthStart
          ) {
            monthlyEarnings += Math.abs(Number(entry.amount));
          }
        }
      } catch (e) {
        // ignore if no ledger
      }

      const totalJobsThisMonth = jobs.filter(j => {
        if (!j.sentAt) return false;
        return new Date(j.sentAt) >= monthStart;
      }).length;

      const jobsByCategory: Record<string, number> = {};
      for (const job of jobs) {
        const jt = job.jobTypeId ? jobTypeMap.get(job.jobTypeId) : null;
        const cat = jt?.category || "Other";
        jobsByCategory[cat] = (jobsByCategory[cat] || 0) + 1;
      }

      const statusBreakdown = {
        pending: jobs.filter(j => j.status === "SubmittedToVendor").length,
        inProgress: jobs.filter(j => j.status === "InProcess").length,
        completed: completedJobs.length,
        aborted: jobs.filter(j => j.status === "Aborted").length,
      };

      res.json({
        completionRate,
        avgTurnaroundHours,
        monthlyEarnings,
        totalJobsThisMonth,
        jobsByCategory,
        statusBreakdown,
      });
    } catch (error) {
      console.error("Vendor performance error:", error);
      res.status(500).json({ message: "Failed to fetch performance data" });
    }
  });

  app.get("/api/vendor/jobs", requireVendorAuth, async (req, res) => {
    try {
      const vendorId = req.session.vendorId;
      if (!vendorId) {
        return res.json([]);
      }

      const jobs = await storage.getTypingJobsByVendorId(vendorId);
      
      const now = Date.now();
      const result = await Promise.all(
        jobs.map(async (job) => {
          const wo = await storage.getWorkOrderById(job.woId);
          const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
          const files = await storage.getFilesByRelated("TypingJob", job.id);
          const comments = await storage.getTypingJobComments(job.id);

          const sentTime = job.sentAt ? new Date(job.sentAt).getTime() : 0;
          const hoursSinceSent = sentTime ? (now - sentTime) / 3600000 : 0;
          const isToday = sentTime && (now - sentTime) < 86400000;

          let priority: "urgent" | "today" | "standard" = "standard";
          if (job.status === "SubmittedToVendor" && hoursSinceSent > 24) {
            priority = "urgent";
          } else if (isToday && (job.status === "SubmittedToVendor" || job.status === "InProcess")) {
            priority = "today";
          }

          return { 
            ...job, 
            workOrder: wo, 
            jobType,
            hasInputDocs: files.some((f: { direction: string }) => f.direction === "Input"),
            commentCount: comments.length,
            priority,
            urgent: priority === "urgent",
          };
        })
      );
      
      res.json(result);
    } catch (error) {
      console.error("Vendor jobs error:", error);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  // Get single vendor job with full details
  app.get("/api/vendor/jobs/:id", requireVendorAuth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = await storage.getTypingJobById(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const vendorId = req.session.vendorId;
      if (job.vendorId !== vendorId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const wo = await storage.getWorkOrderById(job.woId);
      const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
      const files = await storage.getFilesByRelated("TypingJob", job.id);
      const comments = await storage.getTypingJobComments(job.id);
      
      const results = await storage.getTypingJobResults(job.id);

      let company = null;
      let serviceType = null;
      let documentRequirements: any[] = [];
      let woDocuments: any[] = [];
      
      let sentByStaffName: string | null = null;
      let preferredCenter: any = null;
      let companyContacts: any = null;
      let eidCenters: any[] = [];
      
      if (wo) {
        company = wo.companyId ? await storage.getCompanyById(wo.companyId) : null;
        serviceType = wo.serviceTypeId ? await storage.getServiceTypeById(wo.serviceTypeId) : null;
        woDocuments = await storage.getWoDocuments(wo.id);
        
        if (serviceType?.category) {
          documentRequirements = await storage.getDocumentRequirementsByCategory(serviceType.category);
          if (jobType?.category) {
            documentRequirements = documentRequirements.filter(req => {
              if (jobType.category === "Medical") return req.appliesToMedical;
              if (jobType.category === "EID") return req.appliesToEid;
              return true;
            });
          }
        }

        if (job.createdBy) {
          const creatorUser = await storage.getUser(job.createdBy);
          if (creatorUser?.staffId) {
            const staffMember = await storage.getStaffById(creatorUser.staffId);
            sentByStaffName = staffMember?.name || creatorUser.name;
          } else if (creatorUser) {
            sentByStaffName = creatorUser.name;
          }
        }

        if (company) {
          companyContacts = {
            coordinator: company.clientCoordinator || null,
            manager: company.clientManager || null,
            accountant: null,
          };

          const isVip = wo.isVip;
          if (jobType?.category === "Medical") {
            const centerId = isVip ? company.preferredMedicalCenterVipId : company.preferredMedicalCenterId;
            if (centerId) {
              const center = await storage.getCenterById(centerId);
              if (center) {
                preferredCenter = { id: center.id, name: center.name, area: center.area, type: center.type, tier: center.tier };
              }
            }
          } else if (jobType?.category === "EID") {
            const centerId = isVip ? company.preferredBiometricsCenterVipId : company.preferredBiometricsCenterId;
            if (centerId) {
              const center = await storage.getCenterById(centerId);
              if (center) {
                preferredCenter = { id: center.id, name: center.name, area: center.area, type: center.type, tier: center.tier };
              }
            }
            const allCenters = await storage.getCenters();
            eidCenters = allCenters
              .filter(c => (c.type === "EID" || c.type === "Both"))
              .map(c => ({ id: c.id, name: c.name, area: c.area, tier: c.tier }));
          }
        }
      }

      const approval = await storage.getVendorApprovalByJobId(jobId);

      res.json({
        ...job,
        workOrder: wo,
        jobType,
        files,
        comments,
        results,
        approval,
        company: company ? {
          id: company.id,
          name: company.name,
          deliveryAddress: company.deliveryAddress,
          coordinatorMobile: (company.clientCoordinator as any)?.mobile || null,
          coordinatorEmail: (company.clientCoordinator as any)?.email || null,
        } : null,
        serviceType: serviceType ? { id: serviceType.id, name: serviceType.name, category: serviceType.category } : null,
        documentRequirements,
        woDocuments,
        sentByStaffName,
        preferredCenter,
        companyContacts,
        eidCenters,
      });
    } catch (error) {
      console.error("Vendor job detail error:", error);
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  // Vendor upload file (output document)
  const vendorFileSchema = z.object({
    fileName: z.string().min(1),
    objectPath: z.string().min(1),
  });

  app.post("/api/vendor/jobs/:id/files", requireVendorAuth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const vendorId = req.session.vendorId;
      if (!vendorId) return res.status(403).json({ message: "Forbidden" });

      const job = await storage.getTypingJobById(jobId);
      if (!job || job.vendorId !== vendorId) {
        return res.status(403).json({ message: "You do not have access to this job" });
      }

      const validation = validateBody(vendorFileSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const { fileName, objectPath } = validation.data;
      
      const file = await storage.createFile({
        relatedType: "TypingJob",
        relatedId: jobId,
        direction: "Output",
        fileName,
        workdriveLink: objectPath,
        uploadedByType: "Vendor",
      });

      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: jobId,
        action: "vendor_file_uploaded",
        details: { fileName },
      });

      res.status(201).json(file);
    } catch (error) {
      console.error("Vendor file upload error:", error);
      res.status(500).json({ message: "Failed to save file" });
    }
  });

  app.delete("/api/vendor/jobs/:jobId/files/:fileId", requireVendorAuth, async (req, res) => {
    try {
      const vendorId = req.session.vendorId;
      if (!vendorId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { jobId, fileId } = req.params;

      const job = await storage.getTypingJobById(jobId);
      if (!job || job.vendorId !== vendorId) {
        return res.status(404).json({ message: "Job not found" });
      }

      const jobFiles = await storage.getFilesByRelated("TypingJob", jobId);
      const file = jobFiles.find(f => f.id === fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      if (file.direction !== "Output") {
        return res.status(403).json({ message: "Cannot delete input files" });
      }

      await storage.deleteFile(fileId);

      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: jobId,
        action: "file_deleted",
        details: { fileName: file.fileName, deletedBy: "vendor" },
      });

      res.json({ message: "File deleted" });
    } catch (error) {
      console.error("Vendor file delete error:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Vendor add comment
  const vendorCommentSchema = z.object({
    message: z.string().min(1).max(2000),
  });

  app.post("/api/vendor/jobs/:id/comments", requireVendorAuth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const vendorId = req.session.vendorId;
      if (!vendorId) return res.status(403).json({ message: "Forbidden" });

      const job = await storage.getTypingJobById(jobId);
      if (!job || job.vendorId !== vendorId) {
        return res.status(403).json({ message: "You do not have access to this job" });
      }

      const validation = validateBody(vendorCommentSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const { message } = validation.data;
      
      const comment = await storage.createTypingJobComment({
        typingJobId: jobId,
        authorType: "Vendor",
        message,
      });

      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: jobId,
        action: "vendor_comment_added",
        details: { message: message.substring(0, 100) },
      });

      res.status(201).json(comment);
    } catch (error) {
      console.error("Vendor comment error:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  // Vendor start work (SubmittedToVendor → InProcess)
  app.post("/api/vendor/jobs/:id/start-work", requireVendorAuth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = await storage.getTypingJobById(jobId);
      if (!job || job.vendorId !== req.session.vendorId) {
        return res.status(404).json({ message: "Job not found" });
      }
      const result = await executeTransition({
        action: "start_work",
        jobId,
        actor: "vendor",
        actorId: req.session.vendorUserId || undefined,
        storage,
        notifyVendorUsers,
          notifyStaffByRoles,
          notifySingleUser,
      });
      if (!result.success) return res.status(400).json({ message: result.error });
      res.json(result.job);
    } catch (error) {
      console.error("Vendor start work error:", error);
      res.status(500).json({ message: "Failed to start work on job" });
    }
  });

  app.post("/api/vendor/jobs/:id/accept", requireVendorAuth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = await storage.getTypingJobById(jobId);
      if (!job || job.vendorId !== req.session.vendorId) {
        return res.status(404).json({ message: "Job not found" });
      }
      const result = await executeTransition({
        action: "start_work",
        jobId,
        actor: "vendor",
        actorId: req.session.vendorUserId || undefined,
        storage,
        notifyVendorUsers,
        notifyStaffByRoles,
        notifySingleUser,
      });
      if (!result.success) return res.status(400).json({ message: result.error });
      res.json(result.job);
    } catch (error) {
      console.error("Vendor accept job error:", error);
      res.status(500).json({ message: "Failed to accept job" });
    }
  });

  // Vendor mark job completed (InProcess → ReadyForScheduling) + immediate wallet deduction
  app.post("/api/vendor/jobs/:id/complete", requireVendorAuth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = await storage.getTypingJobById(jobId);
      if (!job || job.vendorId !== req.session.vendorId) {
        return res.status(404).json({ message: "Job not found" });
      }

      const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
      const deductionAmount = job.costSnapshot || jobType?.cost || 0;

      const result = await executeTransition({
        action: "complete",
        jobId,
        actor: "vendor",
        actorId: req.session.vendorUserId || undefined,
        storage,
        notifyVendorUsers,
          notifyStaffByRoles,
          notifySingleUser,
      });
      if (!result.success) return res.status(400).json({ message: result.error });

      if (deductionAmount > 0 && job.vendorId) {
        await walletService.debit({
          vendorId: job.vendorId,
          amount: deductionAmount,
          typingJobId: jobId,
          jobCode: job.jobCode || undefined,
          createdBy: req.session.vendorUserId || undefined,
        });
      }

      await revertDelayedWorkOrder(job.woId);
      await checkAndAutoTransitionWorkOrder(job.woId);
      await checkAndAutoCompleteWorkOrder(job.woId);

      // Create a work_order-level audit entry so team notification bell picks it up
      try {
        const wo = await storage.getWorkOrderById(job.woId);
        await storage.createAuditLog({
          entityType: "work_order",
          entityId: job.woId,
          action: "vendor_job_completed",
          details: {
            jobCode: job.jobCode,
            jobTypeName: jobType?.name || undefined,
            applicantName: wo?.applicantName,
            woNumber: wo?.woNumber,
            category: jobType?.category,
          },
        });

        notifyStaffByRoles(["Admin", "Medical Support", "Medical Support - Temporary"], {
          type: "job_returned_from_vendor",
          title: "Typing Job Returned from Vendor",
          message: `Job ${job.jobCode || ""} completed by vendor${wo ? ` — ${wo.woNumber} (${wo.applicantName})` : ""}`,
          relatedEntityType: "typing_job",
          relatedEntityId: jobId,
        });
      } catch (auditErr) {
        console.error("Failed to create team notification audit:", auditErr);
      }

      res.json(result.job);
    } catch (error) {
      console.error("Vendor complete error:", error);
      res.status(500).json({ message: "Failed to complete job" });
    }
  });

  // Vendor return job (InProcess → Returned)
  app.post("/api/vendor/jobs/:id/return", requireVendorAuth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = await storage.getTypingJobById(jobId);
      if (!job || job.vendorId !== req.session.vendorId) {
        return res.status(404).json({ message: "Job not found" });
      }
      const returnBodyValidation = validateBody(z.object({ reason: z.string().min(1, "Reason is required") }), req.body);
      if ('error' in returnBodyValidation) {
        return res.status(400).json({ message: returnBodyValidation.error });
      }
      const { reason } = returnBodyValidation.data;
      const result = await executeTransition({
        action: "return_job",
        jobId,
        actor: "vendor",
        actorId: req.session.vendorUserId || undefined,
        storage,
        notifyVendorUsers,
        notifyStaffByRoles,
        notifySingleUser,
        reason,
      });
      if (!result.success) return res.status(400).json({ message: result.error });
      res.json(result.job);
    } catch (error) {
      console.error("Vendor return job error:", error);
      res.status(500).json({ message: "Failed to return job" });
    }
  });

  // Vendor save biometrics data
  const biometricsSchema = z.object({
    biometricsRequired: z.boolean(),
    biometricsDatetime: z.string().nullable().optional(),
    biometricsCenter: z.string().nullable().optional(),
    vendorNotes: z.string().nullable().optional(),
    applicationRefNo: z.string().nullable().optional(),
  });

  app.put("/api/vendor/jobs/:id/biometrics", requireVendorAuth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = await storage.getTypingJobById(jobId);
      if (!job || job.vendorId !== req.session.vendorId) {
        return res.status(404).json({ message: "Job not found" });
      }
      const validation = validateBody(biometricsSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const data = validation.data;

      const existing = await storage.getTypingJobResults(jobId);
      const resultData = {
        typingJobId: jobId,
        biometricsRequired: data.biometricsRequired,
        biometricsDatetime: data.biometricsDatetime ? new Date(data.biometricsDatetime) : null,
        biometricsCenter: data.biometricsCenter || null,
        vendorNotes: data.vendorNotes || null,
        applicationRefNo: data.applicationRefNo || null,
      };

      if (existing) {
        await storage.updateTypingJobResult(jobId, resultData);
      } else {
        await storage.createTypingJobResult(resultData);
      }

      await storage.createAuditLog({
        entityType: "typing_job", entityId: jobId,
        action: "vendor_biometrics_updated",
        details: { biometricsRequired: data.biometricsRequired, vendorUserId: req.session.vendorUserId },
      });

      res.json({ message: "Biometrics data saved" });
    } catch (error) {
      console.error("Vendor biometrics error:", error);
      res.status(500).json({ message: "Failed to save biometrics data" });
    }
  });

  // ========== Work Order Documents ==========
  app.get("/api/work-orders/:id/documents", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const documents = await storage.getWoDocuments(id);
      res.json(documents);
    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/work-orders/:id/documents", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { documentType, fileName, fileUrl, mimeType, fileSize, expiresAt } = req.body;
      
      if (!documentType || !fileName || !fileUrl) {
        return res.status(400).json({ message: "documentType, fileName, and fileUrl are required" });
      }

      const document = await storage.createWoDocument({
        woId: id,
        documentType,
        fileName,
        fileUrl,
        mimeType,
        fileSize,
        status: "Uploaded",
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      await storage.createAuditLog({
        entityType: "work_order",
        entityId: id,
        action: "document_uploaded",
        details: { documentType, fileName },
      });

      if (isWorkDriveConfigured()) {
        (async () => {
          try {
            const wo = await storage.getWorkOrderById(id);
            if (!wo) return;
            const company = wo.companyId ? await storage.getCompanyById(wo.companyId) : null;
            if (!company) return;

            const objectStorageService = new ObjectStorageService();
            const objectFile = await objectStorageService.getObjectEntityFile(fileUrl);
            const [fileBuffer] = await objectFile.download();

            const result = await syncFileToWorkDrive(
              company.name,
              wo.applicantName,
              fileBuffer,
              fileName,
            );

            await storage.updateWoDocument(document.id, {
              workdriveFileId: result.fileId,
              workdriveLink: result.permalink,
            });

            console.log(`WorkDrive sync complete for document ${document.id}: ${result.permalink}`);
          } catch (err) {
            console.error(`WorkDrive sync failed for document ${document.id}:`, err);
          }
        })();
      }

      res.status(201).json(document);
    } catch (error) {
      console.error("Create document error:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.put("/api/documents/:id/status", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !["Pending", "Uploaded", "Verified"].includes(status)) {
        return res.status(400).json({ message: "Valid status required (Pending, Uploaded, Verified)" });
      }

      const document = await storage.updateWoDocument(id, { status });
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      await storage.createAuditLog({
        entityType: "work_order",
        entityId: document.woId,
        action: "document_status_changed",
        details: { documentId: id, newStatus: status },
      });

      res.json(document);
    } catch (error) {
      console.error("Update document status error:", error);
      res.status(500).json({ message: "Failed to update document status" });
    }
  });

  app.put("/api/documents/:id/expiry", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { expiresAt } = req.body;

      if (expiresAt !== null && expiresAt !== undefined) {
        const parsed = new Date(expiresAt);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ message: "Invalid date format for expiresAt" });
        }
      }

      const document = await storage.updateWoDocument(id, {
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      await storage.createAuditLog({
        entityType: "work_order",
        entityId: document.woId,
        action: "document_expiry_updated",
        details: { documentId: id, expiresAt: expiresAt || null },
      });

      res.json(document);
    } catch (error) {
      console.error("Update document expiry error:", error);
      res.status(500).json({ message: "Failed to update document expiry" });
    }
  });

  app.get("/api/documents/expiring-soon", requireAuth, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const threshold = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const expiringWoDocs = await storage.getExpiringWoDocuments(threshold);

      const woIds = [...new Set(expiringWoDocs.map(d => d.woId))];
      const workOrders = woIds.length > 0 ? await storage.getWorkOrdersByIds(woIds) : [];
      const woMap = new Map(workOrders.map(wo => [wo.id, wo]));

      const enrichedWoDocs = expiringWoDocs.map(doc => ({
        ...doc,
        source: "work_order" as const,
        workOrder: woMap.get(doc.woId) ? {
          id: woMap.get(doc.woId)!.id,
          woNumber: woMap.get(doc.woId)!.woNumber,
          applicantName: woMap.get(doc.woId)!.applicantName,
        } : null,
      }));

      const expiringFiles = await storage.getExpiringFiles(threshold);

      const enrichedFiles = expiringFiles.map(f => ({
        id: f.id,
        documentType: f.direction || "File",
        fileName: f.fileName,
        fileUrl: f.workdriveLink || "",
        expiresAt: f.expiresAt,
        status: "Uploaded",
        woId: "",
        source: "file" as const,
        relatedType: f.relatedType,
        relatedId: f.relatedId,
        workOrder: null,
      }));

      const combined = [...enrichedWoDocs, ...enrichedFiles];
      combined.sort((a, b) => {
        const aDate = new Date(a.expiresAt!).getTime();
        const bDate = new Date(b.expiresAt!).getTime();
        return aDate - bDate;
      });

      res.json(combined);
    } catch (error) {
      console.error("Expiring documents error:", error);
      res.status(500).json({ message: "Failed to fetch expiring documents" });
    }
  });

  app.delete("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const document = await storage.getWoDocumentById(id);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      await storage.deleteWoDocument(id);

      await storage.createAuditLog({
        entityType: "work_order",
        entityId: document.woId,
        action: "document_deleted",
        details: { documentType: document.documentType, fileName: document.fileName },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  app.get("/api/workdrive/status", requireRole("Admin"), async (req, res) => {
    try {
      const configured = isWorkDriveConfigured();
      if (!configured) {
        return res.json({ configured: false, connected: false, error: "WorkDrive credentials not configured" });
      }
      const result = await testWorkDriveConnection();
      res.json({ configured: true, connected: result.success, error: result.error });
    } catch (error: any) {
      res.json({ configured: true, connected: false, error: error.message });
    }
  });

  app.get("/api/workdrive/document-stats", requireRole("Admin"), async (req, res) => {
    try {
      const allDocs = await storage.getAllWoDocuments();
      const synced = allDocs.filter(d => d.workdriveLink);
      const unsynced = allDocs.filter(d => !d.workdriveLink);
      res.json({ total: allDocs.length, synced: synced.length, unsynced: unsynced.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/sync-all-documents", requireRole("Admin"), async (req, res) => {
    try {
      if (!isWorkDriveConfigured()) {
        return res.status(400).json({ message: "WorkDrive not configured" });
      }

      const unsyncedDocs = await storage.getUnsyncedWoDocuments();
      if (unsyncedDocs.length === 0) {
        return res.json({ total: 0, synced: 0, failed: 0, errors: [] });
      }

      const objectStorageService = new ObjectStorageService();
      let synced = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const doc of unsyncedDocs) {
        try {
          const wo = await storage.getWorkOrderById(doc.woId);
          if (!wo) { errors.push(`${doc.fileName}: work order not found`); failed++; continue; }
          const company = wo.companyId ? await storage.getCompanyById(wo.companyId) : null;
          if (!company) { errors.push(`${doc.fileName}: company not found`); failed++; continue; }

          const objectFile = await objectStorageService.getObjectEntityFile(doc.fileUrl);
          const [fileBuffer] = await objectFile.download();

          const result = await syncFileToWorkDrive(company.name, wo.applicantName, fileBuffer, doc.fileName);

          await storage.updateWoDocument(doc.id, {
            workdriveFileId: result.fileId,
            workdriveLink: result.permalink,
          });

          synced++;
        } catch (err: any) {
          failed++;
          errors.push(`${doc.fileName}: ${err.message}`);
        }
      }

      res.json({ total: unsyncedDocs.length, synced, failed, errors: errors.slice(0, 20) });
    } catch (error: any) {
      console.error("Bulk sync error:", error);
      res.status(500).json({ message: `Bulk sync failed: ${error.message}` });
    }
  });

  app.post("/api/admin/export-data-to-workdrive", requireRole("Admin"), async (req, res) => {
    try {
      if (!isWorkDriveConfigured()) {
        return res.status(400).json({ message: "WorkDrive not configured" });
      }

      const parentFolderId = process.env.ZOHO_WORKDRIVE_PARENT_FOLDER_ID;
      if (!parentFolderId) {
        return res.status(400).json({ message: "Parent folder ID not configured" });
      }

      const [workOrders, companies, typingJobs, appointments, vendors] = await Promise.all([
        storage.getWorkOrders(),
        storage.getCompanies(),
        storage.getTypingJobs(),
        storage.getAllAppointments(),
        storage.getVendors(),
      ]);

      const companyMap = new Map(companies.map(c => [c.id, c.name]));
      const vendorMap = new Map(vendors.map(v => [v.id, v.name]));
      const serviceTypes = await storage.getServiceTypes();
      const serviceTypeMap = new Map(serviceTypes.map(s => [s.id, s.name]));
      const centers = await storage.getCenters();
      const centerMap = new Map(centers.map(c => [c.id, c.name]));

      const woSheet = workOrders.map(wo => ({
        "WO Number": wo.woNumber,
        "Applicant": wo.applicantName,
        "Phone": wo.applicantPhone || "",
        "Email": wo.applicantEmail || "",
        "Company": companyMap.get(wo.companyId) || "",
        "Service Type": wo.serviceTypeId ? serviceTypeMap.get(wo.serviceTypeId) || "" : "",
        "Status": wo.status,
        "VIP": wo.isVip ? "Yes" : "No",
        "Created": wo.createdAt ? new Date(wo.createdAt).toLocaleDateString() : "",
      }));

      const companySheet = companies.map(c => ({
        "Name": c.name,
        "Trade License": c.tradeLicenseNumber || "",
        "Coordinator": (c.clientCoordinator as any)?.name || "",
        "Coordinator Phone": (c.clientCoordinator as any)?.mobile || "",
        "Manager": (c.clientManager as any)?.name || "",
        "Delivery Address": c.deliveryAddress || "",
      }));

      const jobSheet = typingJobs.map(j => ({
        "Job Code": j.jobCode || "",
        "WO Number": workOrders.find(w => w.id === j.woId)?.woNumber || "",
        "Applicant": workOrders.find(w => w.id === j.woId)?.applicantName || "",
        "Vendor": j.vendorId ? vendorMap.get(j.vendorId) || "" : "",
        "Status": j.status,
        "Cost": j.costSnapshot || "",
        "Sent At": j.sentAt ? new Date(j.sentAt).toLocaleDateString() : "",
        "Returned At": j.returnedAt ? new Date(j.returnedAt).toLocaleDateString() : "",
      }));

      const apptSheet = appointments.map(a => ({
        "WO Number": workOrders.find(w => w.id === a.woId)?.woNumber || "",
        "Applicant": workOrders.find(w => w.id === a.woId)?.applicantName || "",
        "Type": a.type,
        "Date": a.datetime ? new Date(a.datetime).toLocaleDateString() : "",
        "Time": a.datetime ? new Date(a.datetime).toLocaleTimeString() : "",
        "Center": a.centerId ? centerMap.get(a.centerId) || "" : "",
        "Status": a.status,
        "Application #": a.applicationNumber || "",
      }));

      const vendorSheet = vendors.map(v => ({
        "Name": v.name,
        "Contact Person": v.contactPerson || "",
        "Phone": v.phone || "",
        "Email": v.email || "",
        "Active": v.active ? "Yes" : "No",
      }));

      const wb = new ExcelJS.Workbook();
      addJsonSheet(wb, woSheet, "Work Orders");
      addJsonSheet(wb, companySheet, "Companies");
      addJsonSheet(wb, jobSheet, "Typing Jobs");
      addJsonSheet(wb, apptSheet, "Appointments");
      addJsonSheet(wb, vendorSheet, "Vendors");

      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      const dateStr = new Date().toISOString().split("T")[0];
      const fileName = `PRO_Data_Export_${dateStr}.xlsx`;

      const exportFolderId = await getOrCreateExportFolder();
      const result = await uploadFileToWorkDrive(exportFolderId, buffer, fileName);

      res.json({ success: true, fileName, permalink: result.permalink, fileId: result.fileId });
    } catch (error: any) {
      console.error("Data export to WorkDrive error:", error);
      res.status(500).json({ message: `Export failed: ${error.message}` });
    }
  });

  app.post("/api/documents/:id/sync-workdrive", requireAuth, async (req, res) => {
    try {
      if (!isWorkDriveConfigured()) {
        return res.status(400).json({ message: "WorkDrive not configured" });
      }

      const document = await storage.getWoDocumentById(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const wo = await storage.getWorkOrderById(document.woId);
      if (!wo) {
        return res.status(404).json({ message: "Work order not found" });
      }

      const company = wo.companyId ? await storage.getCompanyById(wo.companyId) : null;
      if (!company) {
        return res.status(400).json({ message: "Company not found for work order" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(document.fileUrl);
      const [fileBuffer] = await objectFile.download();

      const result = await syncFileToWorkDrive(
        company.name,
        wo.applicantName,
        fileBuffer,
        document.fileName,
      );

      const updated = await storage.updateWoDocument(document.id, {
        workdriveFileId: result.fileId,
        workdriveLink: result.permalink,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("WorkDrive sync error:", error);
      res.status(500).json({ message: `WorkDrive sync failed: ${error.message}` });
    }
  });

  // ========== Document Requirements ==========
  app.get("/api/document-requirements", requireAuth, async (req, res) => {
    try {
      const requirements = await storage.getDocumentRequirements();
      res.json(requirements);
    } catch (error) {
      console.error("Get document requirements error:", error);
      res.status(500).json({ message: "Failed to fetch document requirements" });
    }
  });

  app.get("/api/document-requirements/:category", requireAuth, async (req, res) => {
    try {
      const { category } = req.params;
      const requirements = await storage.getDocumentRequirementsByCategory(category);
      res.json(requirements);
    } catch (error) {
      console.error("Get document requirements by category error:", error);
      res.status(500).json({ message: "Failed to fetch document requirements" });
    }
  });

  app.post("/api/document-requirements/seed", requireRole("Admin"), async (req, res) => {
    try {
      const result = await storage.seedDocumentRequirements();
      res.json(result);
    } catch (error) {
      console.error("Seed document requirements error:", error);
      res.status(500).json({ message: "Failed to seed document requirements" });
    }
  });

  app.post("/api/service-types/update-categories", requireOpsRole, async (req, res) => {
    try {
      const result = await storage.updateServiceTypeCategories();
      res.json(result);
    } catch (error) {
      console.error("Update service type categories error:", error);
      res.status(500).json({ message: "Failed to update service type categories" });
    }
  });

  // ========== Appointment Card (public) ==========
  app.get("/api/card/:token", async (req, res) => {
    try {
      const appointment = await storage.getAppointmentByToken(req.params.token);
      if (!appointment) {
        return res.status(404).json({ message: "Invalid or expired card link" });
      }

      const wo = await storage.getWorkOrderById(appointment.woId);
      const center = appointment.centerId ? await storage.getCenterById(appointment.centerId) : null;
      const company = wo?.companyId ? await storage.getCompanyById(wo.companyId) : null;
      const assignedStaff = appointment.assignedStaffId ? await storage.getStaffById(appointment.assignedStaffId) : null;

      let rmStaff: import("@shared/schema").Staff | null = null;
      if (company?.rmStaffId) {
        rmStaff = await storage.getStaffById(company.rmStaffId) || null;
      }

      let applicantPhotoUrl: string | null = null;
      if (wo) {
        const docs = await storage.getWoDocuments(wo.id);
        const photoDoc = docs.find(d => d.documentType === "Photo" && d.status === "Uploaded");
        if (photoDoc) applicantPhotoUrl = photoDoc.fileUrl;
      }

      res.json({
        appointment,
        workOrder: wo || null,
        company: company || null,
        center: center || null,
        assignedStaff: assignedStaff || null,
        rmStaff: rmStaff || null,
        applicantPhotoUrl,
      });
    } catch (error) {
      console.error("Card fetch error:", error);
      res.status(500).json({ message: "Failed to fetch card data" });
    }
  });

  app.get("/api/card/:token/wallet", async (req, res) => {
    const certBase64 = process.env.APPLE_PASS_CERT;
    const keyBase64 = process.env.APPLE_PASS_KEY;
    const wwdrBase64 = process.env.APPLE_PASS_WWDR;
    const passphrase = process.env.APPLE_PASS_PASSPHRASE;

    const teamId = process.env.APPLE_TEAM_ID;

    if (!certBase64 || !keyBase64 || !wwdrBase64 || !passphrase || !teamId) {
      return res.status(503).json({ message: "Apple Wallet not configured" });
    }

    try {
      const token = req.params.token;
      const appointment = await storage.getAppointmentByToken(token);
      if (!appointment) {
        return res.status(404).json({ message: "Invalid or expired card link" });
      }

      const [wo, center, assignedStaff] = await Promise.all([
        storage.getWorkOrderById(appointment.woId),
        appointment.centerId ? storage.getCenterById(appointment.centerId) : Promise.resolve(null),
        appointment.assignedStaffId ? storage.getStaffById(appointment.assignedStaffId) : Promise.resolve(null),
      ]);

      const company = wo?.companyId ? await storage.getCompanyById(wo.companyId) : null;

      const { PKPass } = await import("passkit-generator");

      const dt = new Date(appointment.datetime);
      const dateStr = dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const timeStr = dt.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });

      const arrivalDt = new Date(dt.getTime() - 15 * 60 * 1000);
      const arrivalTimeStr = arrivalDt.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
      const recommendedArrival = `${arrivalTimeStr} (15 min before appointment)`;

      const isEID = appointment.type === "EID";
      const passDescription = isEID ? "Emirates ID Biometrics" : "Medical Fitness Appointment";

      const cardUrl = `${req.protocol}://${req.get("host")}/card/${token}`;

      const navyRgb = "rgb(26, 58, 107)";

      const pass = new PKPass({}, {
        signerCert: Buffer.from(certBase64, "base64"),
        signerKey: Buffer.from(keyBase64, "base64"),
        wwdr: Buffer.from(wwdrBase64, "base64"),
        signerKeyPassphrase: passphrase,
      }, {
        serialNumber: appointment.id,
        description: passDescription,
        organizationName: "The P.R.O. Company™",
        passTypeIdentifier: "pass.ae.procompany.appointment",
        teamIdentifier: teamId,
        foregroundColor: navyRgb,
        backgroundColor: "rgb(255, 255, 255)",
        labelColor: navyRgb,
      });

      pass.type = "generic";

      pass.setBarcodes({
        message: cardUrl,
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
      });

      pass.primaryFields.push({
        key: "time",
        label: "Appointment Time",
        value: timeStr,
      });

      pass.secondaryFields.push({
        key: "date",
        label: "Date",
        value: dateStr,
      });

      const centerName = center?.name || "—";
      const centerArea = center?.area;
      const centerDisplay = centerArea ? `${centerName} — ${centerArea}` : centerName;
      pass.auxiliaryFields.push({
        key: "center",
        label: isEID ? "Biometrics Center" : "Medical Center",
        value: centerDisplay,
      });

      pass.auxiliaryFields.push({
        key: "applicant",
        label: "Applicant",
        value: wo?.applicantName || "—",
      });

      if (company?.name) {
        pass.auxiliaryFields.push({
          key: "company",
          label: "Company",
          value: company.name,
        });
      }

      pass.backFields.push({
        key: "ref",
        label: "Reference",
        value: wo?.woNumber || "—",
      });

      pass.backFields.push({
        key: "arrival",
        label: "Recommended Arrival",
        value: recommendedArrival,
      });

      pass.backFields.push({
        key: "duration",
        label: "Estimated Duration",
        value: "15 – 30 minutes",
      });

      if (isEID) {
        pass.backFields.push({
          key: "document",
          label: "Required Documents",
          value: "Original passport and original Emirates ID (no copies accepted)",
        });

        const assistContact = assignedStaff
          ? (assignedStaff.phone ? `${assignedStaff.name} — ${assignedStaff.phone}` : assignedStaff.name)
          : "Will be assigned before your appointment";
        pass.backFields.push({
          key: "guide",
          label: "On-Site Guide",
          value: assistContact,
        });

        pass.backFields.push({
          key: "guide_note",
          label: "Guide Assistance",
          value: "Your guide will meet you on arrival and handle the queue and registration on your behalf.",
        });
      } else {
        pass.backFields.push({
          key: "document",
          label: "Required Document",
          value: "Original passport (must be valid)",
        });

        pass.backFields.push({
          key: "attire",
          label: "Attire",
          value: "Smart casual. Shoulders and knees must be covered.",
        });

        pass.backFields.push({
          key: "jewellery",
          label: "Jewellery & Accessories",
          value: "Please remove all metal jewellery and accessories before your appointment.",
        });

        const assistContact = assignedStaff
          ? (assignedStaff.phone ? `${assignedStaff.name} — ${assignedStaff.phone}` : assignedStaff.name)
          : "Will be assigned before your appointment";
        pass.backFields.push({
          key: "assist",
          label: "On-Site Assist",
          value: assistContact,
        });
      }

      const buf = await pass.getAsBuffer();
      res.set({
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="appointment.pkpass"`,
      });
      res.send(buf);
    } catch (error) {
      console.error("Wallet pass error:", error);
      res.status(500).json({ message: "Failed to generate wallet pass" });
    }
  });

  // ========== Reschedule ==========
  app.get("/api/reschedule/:token", async (req, res) => {
    try {
      const appointment = await storage.getAppointmentByToken(req.params.token);
      
      if (!appointment) {
        return res.status(404).json({ message: "Invalid or expired reschedule link" });
      }

      const wo = await storage.getWorkOrderById(appointment.woId);
      const center = appointment.centerId ? await storage.getCenterById(appointment.centerId) : null;

      res.json({
        appointment: {
          ...appointment,
          center,
          workOrder: wo ? { applicantName: wo.applicantName, woNumber: wo.woNumber } : null,
        },
        availableTimes: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00"],
      });
    } catch (error) {
      console.error("Reschedule fetch error:", error);
      res.status(500).json({ message: "Failed to fetch reschedule data" });
    }
  });

  app.post("/api/reschedule/:token", async (req, res) => {
    try {
      const validation = validateBody(rescheduleSubmitSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      const appointment = await storage.getAppointmentByToken(req.params.token);
      
      if (!appointment) {
        return res.status(404).json({ message: "Invalid or expired reschedule link" });
      }

      const { requestedDatetime, notes } = validation.data;
      
      const request = await storage.createRescheduleRequest({
        appointmentId: appointment.id,
        requestedDatetime: new Date(requestedDatetime),
        notes,
        status: "New",
      });

      res.status(201).json(request);
    } catch (error) {
      console.error("Reschedule submit error:", error);
      res.status(500).json({ message: "Failed to submit reschedule request" });
    }
  });

  // ========== Admin Excel Template & Import ==========
  app.get("/api/admin/template", requireRole("Admin"), async (req, res) => {
    try {
      const workbook = new ExcelJS.Workbook();

      const centersData = [
        ["Name", "Type (Medical/EID/Both)", "Authority (DHA/EHS/ICP)", "Tier (Normal/VIP)", "Address", "Area", "Google Maps URL", "Timing Text", "Notes"],
        ["Example Medical Center", "Medical", "DHA", "Normal", "123 Street, Dubai", "Deira", "", "Sun-Thu: 7AM-9PM", "Walk-in available"],
      ];
      addAoaSheet(workbook, centersData, "Centers", [30, 20, 20, 15, 35, 15, 30, 25, 25]);

      const companiesData = [
        ["Name", "Trade License Number", "Delivery Address"],
        ["Example Trading LLC", "TL-123456", "P.O. Box 12345, Dubai"],
      ];
      addAoaSheet(workbook, companiesData, "Companies", [30, 25, 35]);

      const staffData = [
        ["Name", "Role Title", "Staff Type (Permanent/Temporary)", "Phone", "Email", "Status (Active/OnLeave/Cancelled/TempActive/TempInactive)"],
        ["John Doe", "Relationship Manager", "Permanent", "050-123-4567", "john@example.com", "Active"],
      ];
      addAoaSheet(workbook, staffData, "Staff", [25, 25, 30, 18, 25, 45]);

      const serviceTypesData = [
        ["Name", "Category (NewVisaInside/NewVisaOutside/GoldenVisa/RenewVisa/NewbornDependent/LostReplaceEid)", "Requires Medical Typing (Yes/No)", "Requires Medical Scheduling (Yes/No)", "Requires ID Typing 2 Years (Yes/No)", "Requires ID Typing 1 Year (Yes/No)", "Requires ID Typing 10 Years (Yes/No)", "Requires ID Biometrics (Yes/No)"],
        ["New Employment Visa", "NewVisaInside", "Yes", "Yes", "Yes", "No", "No", "Yes"],
      ];
      addAoaSheet(workbook, serviceTypesData, "Service Types", [25, 60, 30, 35, 30, 30, 30, 28]);

      const jobTypesData = [
        ["Name", "Category (Medical/EID)", "Cost"],
        ["Medical Typing", "Medical", "150"],
      ];
      addAoaSheet(workbook, jobTypesData, "Job Types", [25, 22, 10]);

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="PRO_Company_Import_Template.xlsx"');
      res.send(buffer);
    } catch (error) {
      console.error("Template download error:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  app.get("/api/admin/export", requireRole("Admin"), async (req, res) => {
    try {
      const [allCompanies, allCenters, allStaff, allServiceTypes, allVendors, allJobTypes, allDocReqs, allUsers] = await Promise.all([
        storage.getCompanies(),
        storage.getCenters(),
        storage.getStaff(),
        storage.getServiceTypes(),
        storage.getVendors(),
        storage.getJobTypes(),
        storage.getDocumentRequirements(),
        storage.getUsers(),
      ]);

      const centerMap = new Map(allCenters.map(c => [c.id, c.name]));
      const staffMap = new Map(allStaff.map(s => [s.id, s.name]));
      const vendorMap = new Map(allVendors.map(v => [v.id, v.name]));
      const boolToYesNo = (val: any) => val ? "Yes" : "No";

      const workbook = new ExcelJS.Workbook();

      const companiesRows = allCompanies.map(c => [
        c.name || "",
        c.tradeLicenseNumber || "",
        c.preferredMedicalCenterId ? centerMap.get(c.preferredMedicalCenterId) || "" : "",
        c.preferredMedicalCenterVipId ? centerMap.get(c.preferredMedicalCenterVipId) || "" : "",
        c.preferredBiometricsCenterId ? centerMap.get(c.preferredBiometricsCenterId) || "" : "",
        c.preferredBiometricsCenterVipId ? centerMap.get(c.preferredBiometricsCenterVipId) || "" : "",
        c.rmStaffId ? staffMap.get(c.rmStaffId) || "" : "",
        c.assistStaffId ? staffMap.get(c.assistStaffId) || "" : "",
        (c.clientCoordinator as any)?.name || "",
        (c.clientCoordinator as any)?.mobile || "",
        (c.clientCoordinator as any)?.email || "",
        (c.clientManager as any)?.name || "",
        (c.clientManager as any)?.mobile || "",
        (c.clientManager as any)?.email || "",
        c.deliveryAddress || "",
        boolToYesNo(c.active),
      ]);
      const companiesData = [
        ["Name", "Trade License", "Preferred Medical Center", "Preferred Medical Center (VIP)", "Preferred Biometrics Center", "Preferred Biometrics Center (VIP)", "RM Staff", "Assistant Staff", "Coordinator Name", "Coordinator Phone", "Coordinator Email", "Manager Name", "Manager Phone", "Manager Email", "Delivery Address", "Active"],
        ...companiesRows,
      ];
      addAoaSheet(workbook, companiesData, "Companies", [30, 20, 30, 30, 30, 30, 20, 20, 20, 18, 25, 20, 18, 25, 35, 8]);

      const centersRows = allCenters.map(c => [
        c.name || "", c.type || "", c.authority || "", c.tier || "",
        c.address || "", c.area || "", c.googleMapsUrl || "",
        c.timingText || "", c.notes || "", boolToYesNo(c.active),
      ]);
      const centersData = [
        ["Name", "Type", "Authority", "Tier", "Address", "Area", "Google Maps URL", "Timing Text", "Notes", "Active"],
        ...centersRows,
      ];
      addAoaSheet(workbook, centersData, "Centers", [30, 15, 12, 10, 35, 15, 35, 25, 25, 8]);

      const staffRows = allStaff.map(s => [
        s.name || "", s.roleTitle || "", s.staffType || "",
        s.phone || "", s.email || "", s.status || "",
        s.replacementId ? staffMap.get(s.replacementId) || "" : "",
        s.leaveEndDate || "", boolToYesNo(s.active),
      ]);
      const staffData = [
        ["Name", "Role Title", "Staff Type", "Phone", "Email", "Status", "Replacement", "Leave End Date", "Active"],
        ...staffRows,
      ];
      addAoaSheet(workbook, staffData, "Staff", [25, 25, 15, 18, 25, 15, 25, 15, 8]);

      const serviceTypesRows = allServiceTypes.map(st => [
        st.name || "", st.category || "",
        boolToYesNo(st.requiresMedicalTyping), boolToYesNo(st.requiresMedicalScheduling),
        boolToYesNo(st.requiresIdTyping2Years), boolToYesNo(st.requiresIdTyping1Year),
        boolToYesNo(st.requiresIdTyping10Years), boolToYesNo(st.requiresIdBiometrics),
        boolToYesNo(st.isDependent), boolToYesNo(st.active),
      ]);
      const serviceTypesData = [
        ["Name", "Category", "Requires Medical Typing", "Requires Medical Scheduling", "Requires ID Typing 2 Years", "Requires ID Typing 1 Year", "Requires ID Typing 10 Years", "Requires ID Biometrics", "Is Dependent", "Active"],
        ...serviceTypesRows,
      ];
      addAoaSheet(workbook, serviceTypesData, "Service Types", [25, 22, 25, 28, 25, 22, 25, 22, 14, 8]);

      const vendorsRows = allVendors.map(v => [
        v.name || "", v.contactPerson || "", v.phone || "", v.email || "", boolToYesNo(v.active),
      ]);
      const vendorsData = [
        ["Name", "Contact Person", "Phone", "Email", "Active"],
        ...vendorsRows,
      ];
      addAoaSheet(workbook, vendorsData, "Vendors", [25, 20, 18, 25, 8]);

      const jobTypesRows = allJobTypes.map(jt => [
        jt.name || "", jt.category || "", jt.cost ?? "", boolToYesNo(jt.active),
      ]);
      const jobTypesData = [
        ["Name", "Category", "Cost", "Active"],
        ...jobTypesRows,
      ];
      addAoaSheet(workbook, jobTypesData, "Vendor Jobs", [25, 15, 10, 8]);

      const docReqsRows = allDocReqs.map(dr => [
        dr.serviceCategory || "", dr.documentType || "",
        boolToYesNo(dr.isRequired), boolToYesNo(dr.appliesToMedical), boolToYesNo(dr.appliesToEid),
      ]);
      const docReqsData = [
        ["Service Category", "Document Type", "Is Required", "Applies to Medical", "Applies to EID"],
        ...docReqsRows,
      ];
      addAoaSheet(workbook, docReqsData, "Document Requirements", [22, 25, 14, 20, 16]);

      const usersRows = allUsers.map(u => [
        u.name || "", u.email || "", u.role || "",
        u.staffId ? staffMap.get(u.staffId) || "" : "",
        u.vendorId ? vendorMap.get(u.vendorId) || "" : "",
        boolToYesNo(u.active),
        u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "",
      ]);
      const usersData = [
        ["Name", "Email", "Role", "Linked Staff", "Linked Vendor", "Active", "Created At"],
        ...usersRows,
      ];
      addAoaSheet(workbook, usersData, "User Accounts", [25, 30, 22, 25, 25, 8, 14]);

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="PRO_Company_Data_Export.xlsx"');
      res.send(buffer);
    } catch (error) {
      console.error("Data export error:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  app.post("/api/admin/import", requireRole("Admin"), upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const sheetNames = workbook.worksheets.map(ws => ws.name);
      const results: Record<string, { imported: number; failed: number; errors: string[] }> = {};
      let totalImported = 0;
      let totalFailed = 0;

      const yesNoToBool = (val: any): boolean => {
        if (typeof val === 'string') return val.trim().toLowerCase() === 'yes';
        return !!val;
      };

      if (sheetNames.includes("Centers")) {
        const sheet = workbook.getWorksheet("Centers")!;
        const rows: any[] = excelSheetToJson(sheet);
        const sheetResult = { imported: 0, failed: 0, errors: [] as string[] };
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const name = row["Name"]?.toString().trim();
          if (!name) continue;
          try {
            const typeVal = row["Type (Medical/EID/Both)"]?.toString().trim();
            const authorityVal = row["Authority (DHA/EHS/ICP)"]?.toString().trim();
            const tierVal = row["Tier (Normal/VIP)"]?.toString().trim();
            await storage.createCenter({
              name,
              type: typeVal as any || "Medical",
              authority: authorityVal as any || undefined,
              tier: tierVal as any || "Normal",
              address: row["Address"]?.toString().trim() || undefined,
              area: row["Area"]?.toString().trim() || undefined,
              googleMapsUrl: row["Google Maps URL"]?.toString().trim() || undefined,
              timingText: row["Timing Text"]?.toString().trim() || undefined,
              notes: row["Notes"]?.toString().trim() || undefined,
            });
            sheetResult.imported++;
          } catch (err: any) {
            sheetResult.failed++;
            sheetResult.errors.push(`Row ${i + 2}: ${err.message || 'Unknown error'}`);
          }
        }
        results["Centers"] = sheetResult;
        totalImported += sheetResult.imported;
        totalFailed += sheetResult.failed;
      }

      if (sheetNames.includes("Companies")) {
        const sheet = workbook.getWorksheet("Companies")!;
        const rows: any[] = excelSheetToJson(sheet);
        const sheetResult = { imported: 0, failed: 0, errors: [] as string[] };
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const name = row["Name"]?.toString().trim();
          if (!name) continue;
          try {
            await storage.createCompany({
              name,
              tradeLicenseNumber: row["Trade License Number"]?.toString().trim() || undefined,
              deliveryAddress: row["Delivery Address"]?.toString().trim() || undefined,
            });
            sheetResult.imported++;
          } catch (err: any) {
            sheetResult.failed++;
            sheetResult.errors.push(`Row ${i + 2}: ${err.message || 'Unknown error'}`);
          }
        }
        results["Companies"] = sheetResult;
        totalImported += sheetResult.imported;
        totalFailed += sheetResult.failed;
      }

      if (sheetNames.includes("Staff")) {
        const sheet = workbook.getWorksheet("Staff")!;
        const rows: any[] = excelSheetToJson(sheet);
        const sheetResult = { imported: 0, failed: 0, errors: [] as string[] };
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const name = row["Name"]?.toString().trim();
          if (!name) continue;
          try {
            await storage.createStaff({
              name,
              roleTitle: row["Role Title"]?.toString().trim() || "Staff",
              staffType: (row["Staff Type (Permanent/Temporary)"]?.toString().trim() as any) || "Permanent",
              phone: row["Phone"]?.toString().trim() || undefined,
              email: row["Email"]?.toString().trim() || undefined,
              status: (row["Status (Active/OnLeave/Cancelled/TempActive/TempInactive)"]?.toString().trim() as any) || "Active",
            });
            sheetResult.imported++;
          } catch (err: any) {
            sheetResult.failed++;
            sheetResult.errors.push(`Row ${i + 2}: ${err.message || 'Unknown error'}`);
          }
        }
        results["Staff"] = sheetResult;
        totalImported += sheetResult.imported;
        totalFailed += sheetResult.failed;
      }

      if (sheetNames.includes("Service Types")) {
        const sheet = workbook.getWorksheet("Service Types")!;
        const rows: any[] = excelSheetToJson(sheet);
        const sheetResult = { imported: 0, failed: 0, errors: [] as string[] };
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const name = row["Name"]?.toString().trim();
          if (!name) continue;
          try {
            await storage.createServiceType({
              name,
              category: (row["Category (NewVisaInside/NewVisaOutside/GoldenVisa/RenewVisa/NewbornDependent/LostReplaceEid)"]?.toString().trim() as any) || undefined,
              requiresMedicalTyping: yesNoToBool(row["Requires Medical Typing (Yes/No)"]),
              requiresMedicalScheduling: yesNoToBool(row["Requires Medical Scheduling (Yes/No)"]),
              requiresIdTyping2Years: yesNoToBool(row["Requires ID Typing 2 Years (Yes/No)"]),
              requiresIdTyping1Year: yesNoToBool(row["Requires ID Typing 1 Year (Yes/No)"]),
              requiresIdTyping10Years: yesNoToBool(row["Requires ID Typing 10 Years (Yes/No)"]),
              requiresIdBiometrics: yesNoToBool(row["Requires ID Biometrics (Yes/No)"]),
            });
            sheetResult.imported++;
          } catch (err: any) {
            sheetResult.failed++;
            sheetResult.errors.push(`Row ${i + 2}: ${err.message || 'Unknown error'}`);
          }
        }
        results["Service Types"] = sheetResult;
        totalImported += sheetResult.imported;
        totalFailed += sheetResult.failed;
      }

      if (sheetNames.includes("Job Types")) {
        const sheet = workbook.getWorksheet("Job Types")!;
        const rows: any[] = excelSheetToJson(sheet);
        const sheetResult = { imported: 0, failed: 0, errors: [] as string[] };
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const name = row["Name"]?.toString().trim();
          if (!name) continue;
          try {
            const costVal = parseInt(row["Cost"]?.toString().trim() || "0", 10);
            await storage.createJobType({
              name,
              category: (row["Category (Medical/EID)"]?.toString().trim() as any) || "Medical",
              cost: isNaN(costVal) ? 0 : costVal,
            });
            sheetResult.imported++;
          } catch (err: any) {
            sheetResult.failed++;
            sheetResult.errors.push(`Row ${i + 2}: ${err.message || 'Unknown error'}`);
          }
        }
        results["Job Types"] = sheetResult;
        totalImported += sheetResult.imported;
        totalFailed += sheetResult.failed;
      }

      res.json({ results, totalImported, totalFailed });
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ message: "Failed to import data" });
    }
  });

  app.post("/api/admin/preview-gsheet", requireRole("Admin"), async (req, res) => {
    try {
      let { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "Google Sheet URL is required" });
      }

      url = url.trim().replace(/\/+$/, '');

      const isUploadedExcel = url.includes('rtpof=true') || url.includes('sd=true');

      const sheetMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if (!sheetMatch) {
        return res.status(400).json({ message: "Invalid Google Sheet URL. Please paste a valid Google Sheets link." });
      }
      const sheetId = sheetMatch[1];

      let gid = "0";
      const gidMatch = url.match(/gid=(\d+)/);
      if (gidMatch) gid = gidMatch[1];

      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
      console.log(`[gsheet] Fetching CSV from: ${csvUrl}`);
      const csvResponse = await fetch(csvUrl, { redirect: 'follow' });
      console.log(`[gsheet] Response status: ${csvResponse.status}, URL: ${csvResponse.url}`);
      if (!csvResponse.ok) {
        if (isUploadedExcel) {
          return res.status(400).json({ message: "This looks like an uploaded Excel file on Google Drive, not a native Google Sheet. Please open it in Google Sheets, then go to File → Save as Google Sheets, and use the new link instead." });
        }
        if (csvResponse.status === 400) {
          return res.status(400).json({ message: "Google blocked the export. This usually means downloading is disabled on this sheet. Please ask the sheet owner to enable downloading: Share → Advanced → uncheck 'Disable options to download, print and copy for commenters and viewers'." });
        }
        if (csvResponse.status === 404) {
          return res.status(400).json({ message: "Google Sheet not found. Please check the URL is correct and the sheet has not been deleted." });
        }
        if (csvResponse.status === 401 || csvResponse.status === 403) {
          return res.status(400).json({ message: "This sheet requires sign-in or is restricted. Please change the sharing settings to 'Anyone with the link can view'." });
        }
        try {
          const errorBody = await csvResponse.text();
          if (errorBody.includes('Page not found') || errorBody.includes('not found')) {
            return res.status(400).json({ message: "Google Sheet not found. Please check the URL is correct and the sheet has not been deleted." });
          }
          if (errorBody.includes('accounts.google.com') || errorBody.includes('ServiceLogin')) {
            return res.status(400).json({ message: "This sheet requires sign-in. Please change the sharing settings to 'Anyone with the link can view'." });
          }
        } catch (parseErr) {
          console.error("Failed to parse Google Sheets error response:", parseErr);
        }
        return res.status(400).json({ message: "Could not fetch the Google Sheet. Make sure it is shared as 'Anyone with the link can view' and the URL is correct." });
      }
      const csvText = await csvResponse.text();

      if (csvText.includes('<!DOCTYPE html>') || csvText.includes('<html')) {
        if (isUploadedExcel) {
          return res.status(400).json({ message: "This looks like an uploaded Excel file on Google Drive, not a native Google Sheet. Please open it in Google Sheets, then go to File → Save as Google Sheets, and use the new link instead." });
        }
        const isNotFound = csvText.includes('Page not found') || csvText.includes('not found');
        const isSignIn = csvText.includes('accounts.google.com') || csvText.includes('ServiceLogin');
        if (isNotFound) {
          return res.status(400).json({ message: "Google Sheet not found. Please check the URL is correct and the sheet has not been deleted." });
        }
        if (isSignIn) {
          return res.status(400).json({ message: "This sheet requires sign-in. Please change the sharing settings to 'Anyone with the link can view'." });
        }
        return res.status(400).json({ message: "Could not access the sheet. Make sure it is shared as 'Anyone with the link can view' and the URL is correct." });
      }

      const cleanCsvText = csvText.replace(/^\uFEFF/, '');
      const rows = parseCSV(cleanCsvText);
      if (rows.length < 2) {
        return res.status(400).json({ message: "The sheet appears to be empty or has no data rows." });
      }

      const headers = rows[0].map(h => h.trim().replace(/^\uFEFF/, '').toLowerCase());
      const woColIdx = headers.findIndex(h => h === 'work order' || h === 'workorder' || h === 'wo' || h === 'wo number');
      const companyColIdx = headers.findIndex(h => h === 'company name' || h === 'company' || h === 'client');
      const staffColIdx = headers.findIndex(h => h === 'staff name' || h === 'staff' || h === 'applicant' || h === 'name' || h === 'employee name' || h === 'employee');
      const workColIdx = headers.findIndex(h => h === 'work' || h === 'service' || h === 'service type' || h === 'type of work');
      const dateColIdx = headers.findIndex(h => h === 'date');
      const designationColIdx = headers.findIndex(h => h === 'designation' || h === 'position' || h === 'job title');

      if (woColIdx === -1) {
        return res.status(400).json({ message: "Could not find a 'Work Order' column in the sheet. Expected headers: Work Order, Company Name, Staff Name, Work" });
      }

      const serviceTypes = await storage.getServiceTypes();
      const companies = await storage.getCompanies();

      const normalizeStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

      const fuzzyMatch = (input: string, candidates: { id: string; name: string }[]): { id: string; name: string; confidence: 'exact' | 'fuzzy' | 'none' } => {
        const normInput = normalizeStr(input);
        if (!normInput) return { id: '', name: '', confidence: 'none' };
        
        const exact = candidates.find(c => normalizeStr(c.name) === normInput);
        if (exact) return { id: exact.id, name: exact.name, confidence: 'exact' };
        
        const contains = candidates.find(c => normalizeStr(c.name).includes(normInput) || normInput.includes(normalizeStr(c.name)));
        if (contains) return { id: contains.id, name: contains.name, confidence: 'fuzzy' };
        
        const inputWords = normInput.split(/\s+/).filter(Boolean);
        let bestMatch: typeof candidates[0] | null = null;
        let bestScore = 0;
        for (const candidate of candidates) {
          const candidateNorm = normalizeStr(candidate.name);
          let score = 0;
          for (const word of inputWords) {
            if (candidateNorm.includes(word)) score++;
          }
          const ratio = score / Math.max(inputWords.length, 1);
          if (ratio > bestScore && ratio >= 0.5) {
            bestScore = ratio;
            bestMatch = candidate;
          }
        }
        if (bestMatch) return { id: bestMatch.id, name: bestMatch.name, confidence: 'fuzzy' };
        
        return { id: '', name: '', confidence: 'none' };
      };

      const previewRows: Array<{
        rowNum: number;
        woNumber: string;
        companyName: string;
        staffName: string;
        workValue: string;
        date: string;
        designation: string;
        serviceTypeMatch: { id: string; name: string; confidence: 'exact' | 'fuzzy' | 'none' };
        companyMatch: { id: string; name: string; confidence: 'exact' | 'fuzzy' | 'none' };
        canImport: boolean;
        skipReason?: string;
      }> = [];

      const existingWos = new Set<string>();
      const allWos = await storage.getWorkOrders();
      for (const wo of allWos) {
        existingWos.add(wo.woNumber.toUpperCase());
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const woNumber = (row[woColIdx] || '').trim();
        const companyName = companyColIdx >= 0 ? (row[companyColIdx] || '').trim() : '';
        const staffName = staffColIdx >= 0 ? (row[staffColIdx] || '').trim() : '';
        const workValue = workColIdx >= 0 ? (row[workColIdx] || '').trim() : '';
        const date = dateColIdx >= 0 ? (row[dateColIdx] || '').trim() : '';
        const designation = designationColIdx >= 0 ? (row[designationColIdx] || '').trim() : '';

        if (!woNumber && !staffName) continue;

        const serviceTypeMatch = workValue 
          ? fuzzyMatch(workValue, serviceTypes.filter(s => s.active).map(s => ({ id: s.id, name: s.name })))
          : { id: '', name: '', confidence: 'none' as const };

        const companyMatch = companyName
          ? fuzzyMatch(companyName, companies.map(c => ({ id: c.id, name: c.name })))
          : { id: '', name: '', confidence: 'none' as const };

        let canImport = true;
        let skipReason: string | undefined;

        if (!woNumber) {
          canImport = false;
          skipReason = 'Missing WO number';
        } else if (existingWos.has(woNumber.toUpperCase())) {
          canImport = false;
          skipReason = 'Already imported';
        } else if (!workValue) {
          canImport = false;
          skipReason = 'Empty work column';
        } else if (serviceTypeMatch.confidence === 'none') {
          canImport = false;
          skipReason = 'Service type not recognized';
        } else if (!staffName) {
          canImport = false;
          skipReason = 'Missing applicant name';
        } else if (companyMatch.confidence === 'none' && companyName) {
          canImport = false;
          skipReason = 'Company not found';
        } else if (!companyName) {
          canImport = false;
          skipReason = 'Missing company name';
        }

        previewRows.push({
          rowNum: i + 1,
          woNumber,
          companyName,
          staffName,
          workValue,
          date,
          designation,
          serviceTypeMatch,
          companyMatch,
          canImport,
          skipReason,
        });
      }

      res.json({
        totalRows: previewRows.length,
        importableCount: previewRows.filter(r => r.canImport).length,
        skippedCount: previewRows.filter(r => !r.canImport).length,
        headers: rows[0],
        rows: previewRows,
      });
    } catch (error: any) {
      console.error("Google Sheet preview error:", error);
      res.status(500).json({ message: error.message || "Failed to preview Google Sheet" });
    }
  });

  app.post("/api/admin/import-gsheet", requireRole("Admin"), async (req, res) => {
    try {
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "No rows to import" });
      }

      const companies = await storage.getCompanies();
      const serviceTypes = await storage.getServiceTypes();
      const companyIds = new Set(companies.map(c => c.id));
      const serviceTypeIds = new Set(serviceTypes.filter(s => s.active).map(s => s.id));

      let imported = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const row of rows) {
        try {
          const woNumber = (row.woNumber || '').toString().trim();
          const staffName = (row.staffName || '').toString().trim();
          const companyId = (row.companyMatch?.id || '').toString().trim();
          const serviceTypeId = (row.serviceTypeMatch?.id || '').toString().trim();
          const designation = (row.designation || '').toString().trim();
          const rowNum = row.rowNum || '?';

          if (!woNumber) {
            failed++;
            errors.push(`Row ${rowNum}: Missing WO number`);
            continue;
          }
          if (!staffName) {
            failed++;
            errors.push(`Row ${rowNum}: Missing applicant name`);
            continue;
          }
          if (!companyId || !companyIds.has(companyId)) {
            failed++;
            errors.push(`Row ${rowNum} (${woNumber}): Invalid or missing company`);
            continue;
          }

          const existingWo = await storage.getWorkOrderByWoNumber(woNumber);
          if (existingWo) {
            failed++;
            errors.push(`Row ${rowNum} (${woNumber}): WO already exists`);
            continue;
          }

          const validServiceTypeId = serviceTypeId && serviceTypeIds.has(serviceTypeId) ? serviceTypeId : undefined;

          const newWo = await storage.createWorkOrder({
            woNumber,
            applicantName: toProperCase(staffName),
            companyId,
            serviceTypeId: validServiceTypeId,
            status: "Draft",
            notes: designation ? `Designation: ${designation}` : undefined,
          });
          await storage.createAuditLog({
            entityType: "work_order",
            entityId: newWo.id,
            action: "created",
            details: { source: "gsheet_import", woNumber },
          });
          imported++;
        } catch (err: any) {
          failed++;
          errors.push(`Row ${row.rowNum || '?'} (${row.woNumber || '?'}): ${err.message || 'Unknown error'}`);
        }
      }

      res.json({ imported, failed, errors });
    } catch (error: any) {
      console.error("Google Sheet import error:", error);
      res.status(500).json({ message: error.message || "Failed to import from Google Sheet" });
    }
  });

  // ========== Sheet Months (Monthly Google Sheet Tracking) ==========

  app.get("/api/admin/sheet-months", requireRole("Admin"), async (req, res) => {
    try {
      const months = await storage.getSheetMonths();
      res.json(months);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch sheet months" });
    }
  });

  app.post("/api/admin/sheet-months/upsert", requireRole("Admin"), async (req, res) => {
    try {
      const { monthYear, sheetUrl } = req.body;
      if (!monthYear) return res.status(400).json({ message: "monthYear is required" });
      const month = await storage.upsertSheetMonth(monthYear, { sheetUrl });
      res.json(month);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to save sheet month" });
    }
  });

  app.post("/api/admin/sheet-months/:id/close", requireRole("Admin"), async (req, res) => {
    try {
      const month = await storage.getSheetMonth(req.params.id);
      if (!month) return res.status(404).json({ message: "Sheet month not found" });
      if (month.status === "closed") return res.status(400).json({ message: "Month is already closed" });
      const updated = await storage.closeSheetMonth(req.params.id);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to close sheet month" });
    }
  });

  app.post("/api/admin/sheet-months/:id/refresh", requireRole("Admin"), async (req, res) => {
    try {
      const month = await storage.getSheetMonth(req.params.id);
      if (!month) return res.status(404).json({ message: "Sheet month not found" });
      if (month.status === "closed") return res.status(400).json({ message: "This month is closed. No further parsing is allowed." });
      if (!month.sheetUrl) return res.status(400).json({ message: "No Google Sheet URL saved for this month." });

      let url = month.sheetUrl.trim().replace(/\/+$/, '');
      const sheetMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if (!sheetMatch) return res.status(400).json({ message: "Invalid Google Sheet URL stored for this month." });
      const sheetId = sheetMatch[1];
      let gid = "0";
      const gidMatch = url.match(/gid=(\d+)/);
      if (gidMatch) gid = gidMatch[1];

      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
      const csvResponse = await fetch(csvUrl, { redirect: 'follow' });
      if (!csvResponse.ok) {
        if (csvResponse.status === 401 || csvResponse.status === 403) return res.status(400).json({ message: "Sheet requires sign-in. Change sharing to 'Anyone with the link can view'." });
        return res.status(400).json({ message: "Could not fetch the Google Sheet. Make sure it is shared publicly." });
      }
      const csvText = await csvResponse.text();
      if (csvText.includes('<!DOCTYPE html>') || csvText.includes('<html')) {
        return res.status(400).json({ message: "Could not access the sheet. Make sure it is shared as 'Anyone with the link can view'." });
      }

      const cleanCsvText = csvText.replace(/^\uFEFF/, '');
      const rows = parseCSV(cleanCsvText);
      if (rows.length < 2) return res.status(400).json({ message: "The sheet appears to be empty or has no data rows." });

      const headers = rows[0].map(h => h.trim().replace(/^\uFEFF/, '').toLowerCase());
      const woColIdx = headers.findIndex(h => h === 'work order' || h === 'workorder' || h === 'wo' || h === 'wo number');
      const companyColIdx = headers.findIndex(h => h === 'company name' || h === 'company' || h === 'client');
      const staffColIdx = headers.findIndex(h => h === 'staff name' || h === 'staff' || h === 'applicant' || h === 'name' || h === 'employee name' || h === 'employee');
      const workColIdx = headers.findIndex(h => h === 'work' || h === 'service' || h === 'service type' || h === 'type of work');
      const dateColIdx = headers.findIndex(h => h === 'date');
      const designationColIdx = headers.findIndex(h => h === 'designation' || h === 'position' || h === 'job title');

      if (woColIdx === -1) return res.status(400).json({ message: "Could not find a 'Work Order' column. Expected headers: Work Order, Company Name, Staff Name, Work" });

      const serviceTypeList = await storage.getServiceTypes();
      const companies = await storage.getCompanies();

      const normalizeStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const fuzzyMatch = (input: string, candidates: { id: string; name: string }[]): { id: string; name: string; confidence: 'exact' | 'fuzzy' | 'none' } => {
        const normInput = normalizeStr(input);
        if (!normInput) return { id: '', name: '', confidence: 'none' };
        const exact = candidates.find(c => normalizeStr(c.name) === normInput);
        if (exact) return { id: exact.id, name: exact.name, confidence: 'exact' };
        const contains = candidates.find(c => normalizeStr(c.name).includes(normInput) || normInput.includes(normalizeStr(c.name)));
        if (contains) return { id: contains.id, name: contains.name, confidence: 'fuzzy' };
        const inputWords = normInput.split(/\s+/).filter(Boolean);
        let bestMatch: typeof candidates[0] | null = null;
        let bestScore = 0;
        for (const candidate of candidates) {
          const candidateNorm = normalizeStr(candidate.name);
          let score = 0;
          for (const word of inputWords) { if (candidateNorm.includes(word)) score++; }
          const ratio = score / Math.max(inputWords.length, 1);
          if (ratio > bestScore && ratio >= 0.5) { bestScore = ratio; bestMatch = candidate; }
        }
        if (bestMatch) return { id: bestMatch.id, name: bestMatch.name, confidence: 'fuzzy' };
        return { id: '', name: '', confidence: 'none' };
      };

      const existingWos = new Set<string>();
      const allWos = await storage.getWorkOrders();
      for (const wo of allWos) existingWos.add(wo.woNumber.toUpperCase());

      const previewRows: any[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const woNumber = (row[woColIdx] || '').trim();
        const companyName = companyColIdx >= 0 ? (row[companyColIdx] || '').trim() : '';
        const staffName = staffColIdx >= 0 ? (row[staffColIdx] || '').trim() : '';
        const workValue = workColIdx >= 0 ? (row[workColIdx] || '').trim() : '';
        const date = dateColIdx >= 0 ? (row[dateColIdx] || '').trim() : '';
        const designation = designationColIdx >= 0 ? (row[designationColIdx] || '').trim() : '';

        if (!woNumber && !staffName) continue;

        const serviceTypeMatch = workValue
          ? fuzzyMatch(workValue, serviceTypeList.filter(s => s.active).map(s => ({ id: s.id, name: s.name })))
          : { id: '', name: '', confidence: 'none' as const };
        const companyMatch = companyName
          ? fuzzyMatch(companyName, companies.map(c => ({ id: c.id, name: c.name })))
          : { id: '', name: '', confidence: 'none' as const };

        let canImport = true;
        let skipReason: string | undefined;

        if (!woNumber) {
          canImport = false; skipReason = 'Missing WO number';
        } else if (existingWos.has(woNumber.toUpperCase())) {
          canImport = false; skipReason = 'Already imported';
        } else if (!workValue) {
          canImport = false; skipReason = 'Empty work column';
        } else if (serviceTypeMatch.confidence === 'none') {
          canImport = false; skipReason = 'Service type not recognized';
        } else if (!staffName) {
          canImport = false; skipReason = 'Missing applicant name';
        } else if (companyMatch.confidence === 'none' && companyName) {
          canImport = false; skipReason = 'Company not found';
        } else if (!companyName) {
          canImport = false; skipReason = 'Missing company name';
        }

        previewRows.push({ rowNum: i + 1, woNumber, companyName, staffName, workValue, date, designation, serviceTypeMatch, companyMatch, canImport, skipReason });
      }

      await storage.touchSheetMonthRefresh(req.params.id);

      res.json({
        totalRows: previewRows.length,
        importableCount: previewRows.filter(r => r.canImport).length,
        skippedCount: previewRows.filter(r => !r.canImport).length,
        headers: rows[0],
        rows: previewRows,
      });
    } catch (error: any) {
      console.error("Sheet month refresh error:", error);
      res.status(500).json({ message: error.message || "Failed to refresh sheet" });
    }
  });

  app.post("/api/admin/sheet-months/:id/import", requireRole("Admin"), async (req, res) => {
    try {
      const month = await storage.getSheetMonth(req.params.id);
      if (!month) return res.status(404).json({ message: "Sheet month not found" });
      if (month.status === "closed") return res.status(400).json({ message: "This month is closed. Importing is not allowed." });

      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: "No rows to import" });

      const companies = await storage.getCompanies();
      const serviceTypeList = await storage.getServiceTypes();
      const companyIds = new Set(companies.map(c => c.id));
      const serviceTypeIds = new Set(serviceTypeList.filter(s => s.active).map(s => s.id));

      let imported = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const row of rows) {
        try {
          const woNumber = (row.woNumber || '').toString().trim();
          const staffName = (row.staffName || '').toString().trim();
          const companyId = (row.companyMatch?.id || '').toString().trim();
          const serviceTypeId = (row.serviceTypeMatch?.id || '').toString().trim();
          const designation = (row.designation || '').toString().trim();
          const rowNum = row.rowNum || '?';

          if (!woNumber || !staffName || !companyId || !companyIds.has(companyId)) {
            failed++; errors.push(`Row ${rowNum}: Invalid or missing required fields`); continue;
          }
          const existingWo = await storage.getWorkOrderByWoNumber(woNumber);
          if (existingWo) {
            failed++; errors.push(`Row ${rowNum} (${woNumber}): WO already exists`); continue;
          }
          const validServiceTypeId = serviceTypeId && serviceTypeIds.has(serviceTypeId) ? serviceTypeId : undefined;
          const newWo = await storage.createWorkOrder({
            woNumber, applicantName: toProperCase(staffName), companyId,
            serviceTypeId: validServiceTypeId, status: "Draft",
            notes: designation ? `Designation: ${designation}` : undefined,
          });
          await storage.createAuditLog({
            entityType: "work_order", entityId: newWo.id, action: "created",
            details: { source: "gsheet_import", woNumber, sheetMonthId: req.params.id, monthYear: month.monthYear },
          });
          imported++;
        } catch (err: any) {
          failed++; errors.push(`Row ${row.rowNum || '?'} (${row.woNumber || '?'}): ${err.message || 'Unknown error'}`);
        }
      }

      if (imported > 0) {
        await storage.incrementSheetMonthImportedCount(req.params.id, imported);
      }

      res.json({ imported, failed, errors });
    } catch (error: any) {
      console.error("Sheet month import error:", error);
      res.status(500).json({ message: error.message || "Failed to import from sheet" });
    }
  });

  // ========== Admin Approvals ==========
  app.get("/api/admin/approvals", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const approvals = await storage.getPendingVendorApprovals();
      
      const enriched = await Promise.all(approvals.map(async (approval) => {
        const job = await storage.getTypingJobById(approval.typingJobId);
        const wo = job ? await storage.getWorkOrderById(job.woId) : null;
        const vendor = approval.vendorId ? await storage.getVendorById(approval.vendorId) : null;
        const jobType = job?.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
        return {
          ...approval,
          job: job ? { id: job.id, jobCode: job.jobCode, status: job.status } : null,
          workOrder: wo ? { woNumber: wo.woNumber, applicantName: wo.applicantName } : null,
          vendor: vendor ? { id: vendor.id, name: vendor.name } : null,
          jobType: jobType ? { name: jobType.name, category: jobType.category } : null,
        };
      }));
      
      res.json(enriched);
    } catch (error) {
      console.error("Get approvals error:", error);
      res.status(500).json({ message: "Failed to get approvals" });
    }
  });

  const approveSchema = z.object({
    adjustedAmount: z.number().optional(),
  });

  app.post("/api/admin/approvals/:id/approve", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const approvalId = req.params.id;
      const approvalRecord = await storage.getVendorApprovalById(approvalId);
      if (!approvalRecord) {
        return res.status(404).json({ message: "Approval not found" });
      }
      if (approvalRecord.status !== "Pending") {
        return res.status(400).json({ message: "Approval already processed" });
      }
      
      const validation = validateBody(approveSchema, req.body);
      const adjustedAmount = ('data' in validation && validation.data.adjustedAmount !== undefined) 
        ? validation.data.adjustedAmount 
        : undefined;
      
      const finalAmount = adjustedAmount ?? approvalRecord.calculatedAmount;
      
      await storage.updateVendorApproval(approvalId, {
        status: "Approved",
        adjustedAmount: adjustedAmount !== undefined ? adjustedAmount : null,
        approvedBy: (req as any).session.userId,
        resolvedAt: new Date(),
      });
      
      await storage.updateTypingJob(approvalRecord.typingJobId, {
        status: "ReadyForScheduling",
        sentToClientAt: new Date(),
      });
      
      if (finalAmount > 0) {
        await walletService.debit({
          vendorId: approvalRecord.vendorId,
          amount: finalAmount,
          typingJobId: approvalRecord.typingJobId,
          createdBy: (req as any).session.userId,
        });
      }
      
      await storage.createAuditLog({
        entityType: "vendor_approval", entityId: approvalId,
        action: "approved", userId: (req as any).session.userId,
        details: { finalAmount, typingJobId: approvalRecord.typingJobId },
      });

      await notifyVendorUsers(approvalRecord.vendorId, {
        type: "approval_approved",
        title: "Job Approved",
        message: `Your submission has been approved. AED ${finalAmount} has been deducted.`,
        relatedJobId: approvalRecord.typingJobId,
        isRead: false,
      });
      
      res.json({ message: "Approved successfully" });
    } catch (error) {
      console.error("Approve error:", error);
      res.status(500).json({ message: "Failed to approve" });
    }
  });

  const approvalRejectSchema = z.object({
    reason: z.string().min(1, "Reason required"),
  });

  app.post("/api/admin/approvals/:id/reject", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const approvalId = req.params.id;
      const approvalRecord = await storage.getVendorApprovalById(approvalId);
      if (!approvalRecord) {
        return res.status(404).json({ message: "Approval not found" });
      }
      if (approvalRecord.status !== "Pending") {
        return res.status(400).json({ message: "Approval already processed" });
      }
      
      const validation = validateBody(approvalRejectSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const { reason } = validation.data;
      
      await storage.updateVendorApproval(approvalId, {
        status: "Rejected",
        rejectedReason: reason,
        resolvedAt: new Date(),
      });
      
      await storage.updateTypingJob(approvalRecord.typingJobId, {
        status: "InProcess",
        returnedAt: null,
      });
      
      await storage.createTypingJobComment({
        typingJobId: approvalRecord.typingJobId,
        authorType: "Internal",
        message: `Submission rejected: ${reason}`,
      });
      
      await storage.createAuditLog({
        entityType: "vendor_approval", entityId: approvalId,
        action: "rejected", userId: (req as any).session.userId,
        details: { reason, typingJobId: approvalRecord.typingJobId },
      });

      await notifyVendorUsers(approvalRecord.vendorId, {
        type: "approval_rejected",
        title: "Submission Rejected",
        message: `Your submission was rejected: ${reason}`,
        relatedJobId: approvalRecord.typingJobId,
        isRead: false,
      });
      
      res.json({ message: "Rejected successfully" });
    } catch (error) {
      console.error("Reject error:", error);
      res.status(500).json({ message: "Failed to reject" });
    }
  });

  // ========== Medical Scheduling ==========

  const FINAL_STATUSES = ["RESULT_ISSUED", "MEDICAL_FAILED", "CLOSED_ADMIN_OVERRIDE", "NO_SHOW", "RETEST_REQUIRED"];

  // Valid transitions map
  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    SCHEDULED: ["AWAITING_MEETING"],
    AWAITING_MEETING: ["IN_PROCESS", "NO_SHOW"],
    IN_PROCESS: ["COMPLETED"],
    COMPLETED: ["RESULT_DELAYED", "RESULT_ISSUED", "MEDICAL_FAILED", "RETEST_REQUIRED"],
    RESULT_DELAYED: ["RESULT_ISSUED", "MEDICAL_FAILED", "RETEST_REQUIRED"],
    RETEST_REQUIRED: [], // terminal — new cycle must be created
    RESULT_ISSUED: [],
    MEDICAL_FAILED: [],
    NO_SHOW: [],
    CLOSED_ADMIN_OVERRIDE: [],
  };

  function canTransition(from: string, to: string): boolean {
    return (ALLOWED_TRANSITIONS[from] || []).includes(to);
  }

  // GET /api/medical-cases/:woId — get or create medical case for WO
  app.get("/api/medical-cases/:woId", requireAuth, async (req, res) => {
    try {
      const { woId } = req.params;
      let medCase = await storage.getMedicalCaseByWoId(woId);
      res.json(medCase || null);
    } catch (error) {
      console.error("Medical case get error:", error);
      res.status(500).json({ message: "Failed to get medical case" });
    }
  });

  // POST /api/medical-cases/:woId — create medical case if not exists
  app.post("/api/medical-cases/:woId", requireAuth, async (req, res) => {
    try {
      const { woId } = req.params;
      let medCase = await storage.getMedicalCaseByWoId(woId);
      if (!medCase) {
        const typingJobs = await storage.getTypingJobsByWoId(woId);
        const allJobTypes = await storage.getJobTypes();
        const medicalJob = typingJobs.find(j => {
          const jt = allJobTypes.find(t => t.id === j.jobTypeId);
          return jt?.category === "Medical" && (j.status === "ReadyForScheduling" || j.status === "Returned");
        });
        if (!medicalJob) {
          return res.status(400).json({ message: "Medical typing job must be completed before opening a scheduling case" });
        }
        medCase = await storage.createMedicalCase({ woId, isOpen: true });
      }
      res.json(medCase);
    } catch (error) {
      console.error("Medical case create error:", error);
      res.status(500).json({ message: "Failed to create medical case" });
    }
  });

  // GET /api/medical-cases/:caseId/cycles — get cycles for case
  app.get("/api/medical-cases/:caseId/cycles", requireAuth, async (req, res) => {
    try {
      const { caseId } = req.params;
      const cycles = await storage.getCyclesByCase(caseId);
      // Enrich with events
      const enriched = await Promise.all(cycles.map(async (cycle) => {
        const events = await storage.getEventsByCycle(cycle.id);
        return { ...cycle, events };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Get cycles error:", error);
      res.status(500).json({ message: "Failed to get cycles" });
    }
  });

  // POST /api/medical-cases/:caseId/cycles — create a new cycle
  app.post("/api/medical-cases/:caseId/cycles", requireAuth, async (req, res) => {
    try {
      const { caseId } = req.params;
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const medCase = await storage.getMedicalCaseById(caseId);
      if (!medCase) return res.status(404).json({ message: "Medical case not found" });
      if (!medCase.isOpen) return res.status(400).json({ message: "Medical case is closed" });

      // Check no active cycle exists
      const existingCycles = await storage.getCyclesByCase(caseId);
      const activeCycle = existingCycles.find(c => !FINAL_STATUSES.includes(c.status));
      if (activeCycle) {
        return res.status(400).json({ message: "An active cycle already exists. Close it first." });
      }

      const bodySchema = z.object({
        appointmentTime: z.string(),
        centerId: z.string().optional(),
        assignedProId: z.string().optional(),
        cycleType: z.enum(["Initial", "Reschedule", "Retest"]).optional(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const cycleNumber = existingCycles.length + 1;
      const cycleType = parsed.data.cycleType || (cycleNumber === 1 ? "Initial" : "Reschedule");

      const cycle = await storage.createCycle({
        caseId,
        cycleNumber,
        cycleType,
        status: "SCHEDULED",
        appointmentTime: new Date(parsed.data.appointmentTime),
        centerId: parsed.data.centerId || null,
        assignedProId: parsed.data.assignedProId || null,
        createdBy: user.id,
      });

      await storage.logMedicalEvent({
        cycleId: cycle.id,
        eventType: "CYCLE_CREATED",
        actorId: user.id,
        actorRole: user.role,
        details: { cycleType, appointmentTime: parsed.data.appointmentTime, centerId: parsed.data.centerId },
      });

      res.json(cycle);
    } catch (error) {
      console.error("Create cycle error:", error);
      res.status(500).json({ message: "Failed to create cycle" });
    }
  });

  // GET /api/appointment-cycles/:cycleId — get a specific cycle with events
  app.get("/api/appointment-cycles/:cycleId", requireAuth, async (req, res) => {
    try {
      const cycle = await storage.getCycleById(req.params.cycleId);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });
      const events = await storage.getEventsByCycle(cycle.id);
      res.json({ ...cycle, events });
    } catch (error) {
      res.status(500).json({ message: "Failed to get cycle" });
    }
  });

  // Roles allowed to perform PRO field actions (confirm meeting attendance, mark completed)
  // CRM users schedule appointments but do NOT confirm or complete meetings
  const PRO_ACTION_ROLES = ["Medical Support", "Medical Support - Temporary", "Admin"];

  // POST /api/appointment-cycles/:cycleId/confirm-qr — QR confirmation (PRO field action)
  app.post("/api/appointment-cycles/:cycleId/confirm-qr", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (!PRO_ACTION_ROLES.includes(user.role)) {
        return res.status(403).json({ message: "Access denied: Medical Support or Admin required" });
      }

      const cycle = await storage.getCycleById(req.params.cycleId);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });
      if (!canTransition(cycle.status, "IN_PROCESS")) {
        return res.status(400).json({ message: `Cannot transition from ${cycle.status} to IN_PROCESS` });
      }

      const updated = await storage.updateCycle(cycle.id, {
        status: "IN_PROCESS",
        confirmedAt: new Date(),
        confirmedBy: user.id,
        confirmMethod: "qr",
      });

      await storage.logMedicalEvent({
        cycleId: cycle.id,
        eventType: "QR_CONFIRMED",
        actorId: user.id,
        actorRole: user.role,
        details: { method: "qr" },
      });

      await storage.logMedicalEvent({
        cycleId: cycle.id,
        eventType: "STATUS_CHANGED",
        actorId: user.id,
        actorRole: user.role,
        details: { from: cycle.status, to: "IN_PROCESS" },
      });

      res.json(updated);
    } catch (error) {
      console.error("QR confirm error:", error);
      res.status(500).json({ message: "Failed to confirm via QR" });
    }
  });

  // POST /api/appointment-cycles/:cycleId/confirm-manual — manual confirmation fallback (PRO field action)
  app.post("/api/appointment-cycles/:cycleId/confirm-manual", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (!PRO_ACTION_ROLES.includes(user.role)) {
        return res.status(403).json({ message: "Access denied: Medical Support or Admin required" });
      }

      const cycle = await storage.getCycleById(req.params.cycleId);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });
      if (!canTransition(cycle.status, "IN_PROCESS")) {
        return res.status(400).json({ message: `Cannot transition from ${cycle.status} to IN_PROCESS` });
      }

      const updated = await storage.updateCycle(cycle.id, {
        status: "IN_PROCESS",
        confirmedAt: new Date(),
        confirmedBy: user.id,
        confirmMethod: "manual",
      });

      await storage.logMedicalEvent({
        cycleId: cycle.id,
        eventType: "MANUAL_CONFIRMED",
        actorId: user.id,
        actorRole: user.role,
        details: { method: "manual", note: req.body.note || null },
      });

      await storage.logMedicalEvent({
        cycleId: cycle.id,
        eventType: "STATUS_CHANGED",
        actorId: user.id,
        actorRole: user.role,
        details: { from: cycle.status, to: "IN_PROCESS" },
      });

      res.json(updated);
    } catch (error) {
      console.error("Manual confirm error:", error);
      res.status(500).json({ message: "Failed to confirm manually" });
    }
  });

  // POST /api/appointment-cycles/:cycleId/complete — PRO marks COMPLETED
  app.post("/api/appointment-cycles/:cycleId/complete", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (!PRO_ACTION_ROLES.includes(user.role)) {
        return res.status(403).json({ message: "Access denied: Medical Support or Admin required" });
      }

      const cycle = await storage.getCycleById(req.params.cycleId);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });
      if (!canTransition(cycle.status, "COMPLETED")) {
        return res.status(400).json({ message: `Cannot transition from ${cycle.status} to COMPLETED` });
      }

      const now = new Date();
      const updated = await storage.updateCycle(cycle.id, {
        status: "COMPLETED",
        completedAt: now,
      });

      await storage.logMedicalEvent({
        cycleId: cycle.id,
        eventType: "COMPLETED_MARKED",
        actorId: user.id,
        actorRole: user.role,
        details: { completedAt: now.toISOString() },
      });

      await storage.logMedicalEvent({
        cycleId: cycle.id,
        eventType: "STATUS_CHANGED",
        actorId: user.id,
        actorRole: user.role,
        details: { from: cycle.status, to: "COMPLETED" },
      });

      res.json(updated);
    } catch (error) {
      console.error("Complete cycle error:", error);
      res.status(500).json({ message: "Failed to complete cycle" });
    }
  });

  // POST /api/appointment-cycles/:cycleId/crm-hold — CRM/Admin set or remove hold
  app.post("/api/appointment-cycles/:cycleId/crm-hold", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (!["Admin", "Client Relationship Manager"].includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const cycle = await storage.getCycleById(req.params.cycleId);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });
      if (!["SCHEDULED", "AWAITING_MEETING"].includes(cycle.status)) {
        return res.status(400).json({ message: "CRM hold can only be set on SCHEDULED or AWAITING_MEETING cycles" });
      }

      const { active } = req.body;
      const now = new Date();

      const updated = await storage.updateCycle(cycle.id, {
        crmHoldActive: !!active,
        crmHoldSetBy: active ? user.id : cycle.crmHoldSetBy,
        crmHoldSetAt: active ? now : cycle.crmHoldSetAt,
      });

      await storage.logMedicalEvent({
        cycleId: cycle.id,
        eventType: active ? "CRM_HOLD_SET" : "CRM_HOLD_REMOVED",
        actorId: user.id,
        actorRole: user.role,
        details: { active: !!active },
      });

      res.json(updated);
    } catch (error) {
      console.error("CRM hold error:", error);
      res.status(500).json({ message: "Failed to set CRM hold" });
    }
  });

  // POST /api/appointment-cycles/:cycleId/retest-required — CRM/Admin set RETEST_REQUIRED
  app.post("/api/appointment-cycles/:cycleId/retest-required", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (!["Admin", "Client Relationship Manager"].includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const cycle = await storage.getCycleById(req.params.cycleId);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });
      if (!canTransition(cycle.status, "RETEST_REQUIRED")) {
        return res.status(400).json({ message: `Cannot transition from ${cycle.status} to RETEST_REQUIRED` });
      }

      const updated = await storage.updateCycle(cycle.id, { status: "RETEST_REQUIRED" });

      await storage.logMedicalEvent({
        cycleId: cycle.id,
        eventType: "RETEST_REQUIRED_SET",
        actorId: user.id,
        actorRole: user.role,
        details: { note: req.body.note || null },
      });

      await storage.logMedicalEvent({
        cycleId: cycle.id,
        eventType: "STATUS_CHANGED",
        actorId: user.id,
        actorRole: user.role,
        details: { from: cycle.status, to: "RETEST_REQUIRED" },
      });

      res.json(updated);
    } catch (error) {
      console.error("Retest required error:", error);
      res.status(500).json({ message: "Failed to set retest required" });
    }
  });

  // POST /api/appointment-cycles/:cycleId/admin-override — Admin force-close
  app.post("/api/appointment-cycles/:cycleId/admin-override", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (user.role !== "Admin") {
        return res.status(403).json({ message: "Access denied: Admin only" });
      }

      const cycle = await storage.getCycleById(req.params.cycleId);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });
      if (FINAL_STATUSES.includes(cycle.status)) {
        return res.status(400).json({ message: "Cycle is already in a final state" });
      }

      const { reason } = req.body;
      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: "Override reason is required" });
      }

      const now = new Date();
      const updated = await storage.updateCycle(cycle.id, {
        status: "CLOSED_ADMIN_OVERRIDE",
        overrideReason: reason,
        overrideBy: user.id,
        overrideAt: now,
      });

      await storage.logMedicalEvent({
        cycleId: cycle.id,
        eventType: "ADMIN_OVERRIDE",
        actorId: user.id,
        actorRole: user.role,
        details: { reason, fromStatus: cycle.status },
      });

      await storage.logMedicalEvent({
        cycleId: cycle.id,
        eventType: "STATUS_CHANGED",
        actorId: user.id,
        actorRole: user.role,
        details: { from: cycle.status, to: "CLOSED_ADMIN_OVERRIDE" },
      });

      res.json(updated);
    } catch (error) {
      console.error("Admin override error:", error);
      res.status(500).json({ message: "Failed to apply admin override" });
    }
  });

  // POST /api/appointment-cycles/:cycleId/result-issued — Admin or automation-caller endpoint
  app.post("/api/appointment-cycles/:cycleId/result-issued", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (user.role !== "Admin") {
        return res.status(403).json({ message: "Access denied: Admin only" });
      }

      const cycle = await storage.getCycleById(req.params.cycleId);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });
      if (cycle.status === "RESULT_ISSUED") return res.json({ message: "Already issued", idempotent: true });
      if (!canTransition(cycle.status, "RESULT_ISSUED")) {
        return res.status(400).json({ message: `Cannot transition from ${cycle.status} to RESULT_ISSUED` });
      }

      const now = new Date();
      const updated = await storage.updateCycle(cycle.id, {
        status: "RESULT_ISSUED",
        resultIssuedAt: now,
        outcome: "Passed",
      });

      await storage.logMedicalEvent({
        cycleId: cycle.id,
        eventType: "RESULT_ISSUED",
        actorId: user.id,
        actorRole: user.role,
        details: { issuedAt: now.toISOString(), ...req.body },
      });

      await storage.logMedicalEvent({
        cycleId: cycle.id,
        eventType: "STATUS_CHANGED",
        actorId: user.id,
        actorRole: user.role,
        details: { from: cycle.status, to: "RESULT_ISSUED" },
      });

      res.json(updated);
    } catch (error) {
      console.error("Result issued error:", error);
      res.status(500).json({ message: "Failed to set result issued" });
    }
  });

  // POST /api/appointment-cycles/:cycleId/medical-failed — Admin or automation-caller endpoint
  app.post("/api/appointment-cycles/:cycleId/medical-failed", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (user.role !== "Admin") {
        return res.status(403).json({ message: "Access denied: Admin only" });
      }

      const cycle = await storage.getCycleById(req.params.cycleId);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });
      if (cycle.status === "MEDICAL_FAILED") return res.json({ message: "Already marked failed", idempotent: true });
      if (!canTransition(cycle.status, "MEDICAL_FAILED")) {
        return res.status(400).json({ message: `Cannot transition from ${cycle.status} to MEDICAL_FAILED` });
      }

      const updated = await storage.updateCycle(cycle.id, {
        status: "MEDICAL_FAILED",
        outcome: "Failed",
      });

      await storage.logMedicalEvent({
        cycleId: cycle.id,
        eventType: "MEDICAL_FAILED",
        actorId: user.id,
        actorRole: user.role,
        details: req.body || {},
      });

      await storage.logMedicalEvent({
        cycleId: cycle.id,
        eventType: "STATUS_CHANGED",
        actorId: user.id,
        actorRole: user.role,
        details: { from: cycle.status, to: "MEDICAL_FAILED" },
      });

      res.json(updated);
    } catch (error) {
      console.error("Medical failed error:", error);
      res.status(500).json({ message: "Failed to set medical failed" });
    }
  });

  // Timer jobs for medical scheduling
  async function runMedicalTimerJobs() {
    try {
      const now = new Date();

      // (a) SCHEDULED → AWAITING_MEETING (5 min past appointment_time)
      const awaitingDue = await storage.getCyclesDueForAwaitingMeeting();
      for (const cycle of awaitingDue) {
        await storage.updateCycle(cycle.id, {
          status: "AWAITING_MEETING",
          awaitingMeetingAt: now,
        });
        await storage.logMedicalEvent({
          cycleId: cycle.id,
          eventType: "TIMER_AWAITING_MEETING",
          actorId: null,
          actorRole: "system",
          details: { triggeredAt: now.toISOString() },
        });
        await storage.logMedicalEvent({
          cycleId: cycle.id,
          eventType: "STATUS_CHANGED",
          actorId: null,
          actorRole: "system",
          details: { from: "SCHEDULED", to: "AWAITING_MEETING" },
        });
      }

      // (b) AWAITING_MEETING → NO_SHOW (30 min, no hold)
      const noShowDue = await storage.getCyclesDueForNoShow();
      for (const cycle of noShowDue) {
        await storage.updateCycle(cycle.id, {
          status: "NO_SHOW",
          noShowAt: now,
        });
        await storage.logMedicalEvent({
          cycleId: cycle.id,
          eventType: "TIMER_NO_SHOW",
          actorId: null,
          actorRole: "system",
          details: { triggeredAt: now.toISOString() },
        });
        await storage.logMedicalEvent({
          cycleId: cycle.id,
          eventType: "STATUS_CHANGED",
          actorId: null,
          actorRole: "system",
          details: { from: "AWAITING_MEETING", to: "NO_SHOW" },
        });
      }

      // (c) COMPLETED → RESULT_DELAYED (30 hours, no result)
      const resultDelayedDue = await storage.getCyclesDueForResultDelayed();
      for (const cycle of resultDelayedDue) {
        await storage.updateCycle(cycle.id, {
          status: "RESULT_DELAYED",
          resultDelayedAt: now,
        });
        await storage.logMedicalEvent({
          cycleId: cycle.id,
          eventType: "TIMER_RESULT_DELAYED",
          actorId: null,
          actorRole: "system",
          details: { triggeredAt: now.toISOString() },
        });
        await storage.logMedicalEvent({
          cycleId: cycle.id,
          eventType: "STATUS_CHANGED",
          actorId: null,
          actorRole: "system",
          details: { from: "COMPLETED", to: "RESULT_DELAYED" },
        });
      }

      const total = awaitingDue.length + noShowDue.length + resultDelayedDue.length;
      if (total > 0) {
        console.log(`[medical-timer] Processed ${awaitingDue.length} AWAITING_MEETING, ${noShowDue.length} NO_SHOW, ${resultDelayedDue.length} RESULT_DELAYED`);
      }
    } catch (err) {
      console.error("[medical-timer] Error:", err);
    }
  }

  setInterval(() => {
    runMedicalTimerJobs().catch(err => console.error("[medical-timer] Interval error:", err));
  }, 60 * 1000);

  setTimeout(() => {
    runMedicalTimerJobs().catch(err => console.error("[medical-timer] Initial error:", err));
  }, 8000);

  // ========== EID Biometrics Scheduling ==========

  const FINAL_BIOMETRICS_STATUSES = ["COMPLETED", "NO_SHOW", "CLOSED_ADMIN_OVERRIDE"];

  const BIOMETRICS_ALLOWED_TRANSITIONS: Record<string, string[]> = {
    SCHEDULED: ["AWAITING_MEETING"],
    AWAITING_MEETING: ["IN_PROCESS", "NO_SHOW"],
    IN_PROCESS: ["COMPLETED"],
    COMPLETED: [],
    NO_SHOW: [],
    RESCHEDULE_REQUIRED: [],
    CLOSED_ADMIN_OVERRIDE: [],
  };

  function canBiometricsTransition(from: string, to: string): boolean {
    return (BIOMETRICS_ALLOWED_TRANSITIONS[from] || []).includes(to);
  }

  // GET /api/biometrics-cases/:woId — get biometrics case for WO
  app.get("/api/biometrics-cases/:woId", requireAuth, async (req, res) => {
    try {
      const { woId } = req.params;
      const bioCase = await storage.getBiometricsCaseByWoId(woId);
      res.json(bioCase || null);
    } catch (error) {
      console.error("Biometrics case get error:", error);
      res.status(500).json({ message: "Failed to get biometrics case" });
    }
  });

  // POST /api/biometrics-cases/:woId — create biometrics case if not exists
  app.post("/api/biometrics-cases/:woId", requireAuth, async (req, res) => {
    try {
      const { woId } = req.params;
      let bioCase = await storage.getBiometricsCaseByWoId(woId);
      if (!bioCase) {
        bioCase = await storage.createBiometricsCase({ woId, isOpen: true });
      }
      res.json(bioCase);
    } catch (error) {
      console.error("Biometrics case create error:", error);
      res.status(500).json({ message: "Failed to create biometrics case" });
    }
  });

  // GET /api/biometrics-cases/:caseId/cycles — get cycles for biometrics case
  app.get("/api/biometrics-cases/:caseId/cycles", requireAuth, async (req, res) => {
    try {
      const { caseId } = req.params;
      const cycles = await storage.getBiometricsCyclesByCase(caseId);
      const enriched = await Promise.all(cycles.map(async (cycle) => {
        const events = await storage.getBiometricsEventsByCycle(cycle.id);
        return { ...cycle, events };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Get biometrics cycles error:", error);
      res.status(500).json({ message: "Failed to get biometrics cycles" });
    }
  });

  // POST /api/biometrics-cases/:caseId/cycles — create a new biometrics cycle
  app.post("/api/biometrics-cases/:caseId/cycles", requireAuth, async (req, res) => {
    try {
      const { caseId } = req.params;
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const bioCase = await storage.getBiometricsCaseById(caseId);
      if (!bioCase) return res.status(404).json({ message: "Biometrics case not found" });
      if (!bioCase.isOpen) return res.status(400).json({ message: "Biometrics case is closed" });

      const existingCycles = await storage.getBiometricsCyclesByCase(caseId);
      const activeCycle = existingCycles.find(c => !FINAL_BIOMETRICS_STATUSES.includes(c.status) && c.status !== "RESCHEDULE_REQUIRED");
      if (activeCycle) {
        return res.status(400).json({ message: "An active cycle already exists. Close it first." });
      }

      const bodySchema = z.object({
        appointmentTime: z.string(),
        centerId: z.string().optional(),
        assignedProId: z.string().optional(),
        cycleType: z.enum(["Initial", "Reschedule"]).optional(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const cycleNumber = existingCycles.length + 1;
      const cycleType = parsed.data.cycleType || (cycleNumber === 1 ? "Initial" : "Reschedule");

      const cycle = await storage.createBiometricsCycle({
        caseId,
        cycleNumber,
        cycleType,
        status: "SCHEDULED",
        appointmentTime: new Date(parsed.data.appointmentTime),
        centerId: parsed.data.centerId || null,
        assignedProId: parsed.data.assignedProId || null,
        createdBy: user.id,
      });

      await storage.logBiometricsEvent({
        cycleId: cycle.id,
        eventType: "CYCLE_CREATED",
        actorId: user.id,
        actorRole: user.role,
        details: { cycleType, appointmentTime: parsed.data.appointmentTime, centerId: parsed.data.centerId },
      });

      res.json(cycle);
    } catch (error) {
      console.error("Create biometrics cycle error:", error);
      res.status(500).json({ message: "Failed to create biometrics cycle" });
    }
  });

  // GET /api/biometrics-cycles/:cycleId — get a specific biometrics cycle with events
  app.get("/api/biometrics-cycles/:cycleId", requireAuth, async (req, res) => {
    try {
      const cycle = await storage.getBiometricsCycleById(req.params.cycleId);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });
      const events = await storage.getBiometricsEventsByCycle(cycle.id);
      res.json({ ...cycle, events });
    } catch (error) {
      res.status(500).json({ message: "Failed to get cycle" });
    }
  });

  const BIO_PRO_ROLES = ["Medical Support", "Medical Support - Temporary", "Admin"];

  // POST /api/biometrics-cycles/:cycleId/confirm-qr — QR confirmation
  app.post("/api/biometrics-cycles/:cycleId/confirm-qr", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (!BIO_PRO_ROLES.includes(user.role)) {
        return res.status(403).json({ message: "Access denied: Medical Support or Admin required" });
      }

      const cycle = await storage.getBiometricsCycleById(req.params.cycleId);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });
      if (!canBiometricsTransition(cycle.status, "IN_PROCESS")) {
        return res.status(400).json({ message: `Cannot transition from ${cycle.status} to IN_PROCESS` });
      }

      const updated = await storage.updateBiometricsCycle(cycle.id, {
        status: "IN_PROCESS",
        confirmedAt: new Date(),
        confirmedBy: user.id,
        confirmMethod: "qr",
      });

      await storage.logBiometricsEvent({
        cycleId: cycle.id,
        eventType: "QR_CONFIRMED",
        actorId: user.id,
        actorRole: user.role,
        details: { method: "qr" },
      });

      await storage.logBiometricsEvent({
        cycleId: cycle.id,
        eventType: "STATUS_CHANGED",
        actorId: user.id,
        actorRole: user.role,
        details: { from: cycle.status, to: "IN_PROCESS" },
      });

      res.json(updated);
    } catch (error) {
      console.error("Biometrics QR confirm error:", error);
      res.status(500).json({ message: "Failed to confirm via QR" });
    }
  });

  // POST /api/biometrics-cycles/:cycleId/confirm-manual — manual confirmation fallback
  app.post("/api/biometrics-cycles/:cycleId/confirm-manual", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (!BIO_PRO_ROLES.includes(user.role)) {
        return res.status(403).json({ message: "Access denied: Medical Support or Admin required" });
      }

      const cycle = await storage.getBiometricsCycleById(req.params.cycleId);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });
      if (!canBiometricsTransition(cycle.status, "IN_PROCESS")) {
        return res.status(400).json({ message: `Cannot transition from ${cycle.status} to IN_PROCESS` });
      }

      const updated = await storage.updateBiometricsCycle(cycle.id, {
        status: "IN_PROCESS",
        confirmedAt: new Date(),
        confirmedBy: user.id,
        confirmMethod: "manual",
      });

      await storage.logBiometricsEvent({
        cycleId: cycle.id,
        eventType: "MANUAL_CONFIRMED",
        actorId: user.id,
        actorRole: user.role,
        details: { method: "manual", note: req.body.note || null, fallback: true },
      });

      await storage.logBiometricsEvent({
        cycleId: cycle.id,
        eventType: "STATUS_CHANGED",
        actorId: user.id,
        actorRole: user.role,
        details: { from: cycle.status, to: "IN_PROCESS" },
      });

      res.json(updated);
    } catch (error) {
      console.error("Biometrics manual confirm error:", error);
      res.status(500).json({ message: "Failed to confirm manually" });
    }
  });

  // POST /api/biometrics-cycles/:cycleId/complete — PRO marks COMPLETED
  app.post("/api/biometrics-cycles/:cycleId/complete", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (!BIO_PRO_ROLES.includes(user.role)) {
        return res.status(403).json({ message: "Access denied: Medical Support or Admin required" });
      }

      const cycle = await storage.getBiometricsCycleById(req.params.cycleId);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });
      if (!canBiometricsTransition(cycle.status, "COMPLETED")) {
        return res.status(400).json({ message: `Cannot transition from ${cycle.status} to COMPLETED` });
      }

      const now = new Date();
      const proofImageUrl = req.body.proofImageUrl || null;

      const updated = await storage.updateBiometricsCycle(cycle.id, {
        status: "COMPLETED",
        completedAt: now,
        outcome: "Completed",
        ...(proofImageUrl ? { proofImageUrl, proofUploadedAt: now } : {}),
      });

      await storage.logBiometricsEvent({
        cycleId: cycle.id,
        eventType: "COMPLETED_MARKED",
        actorId: user.id,
        actorRole: user.role,
        details: { completedAt: now.toISOString(), proofUploaded: !!proofImageUrl },
      });

      if (proofImageUrl) {
        await storage.logBiometricsEvent({
          cycleId: cycle.id,
          eventType: "PROOF_UPLOADED",
          actorId: user.id,
          actorRole: user.role,
          details: { proofImageUrl },
        });
      }

      await storage.logBiometricsEvent({
        cycleId: cycle.id,
        eventType: "STATUS_CHANGED",
        actorId: user.id,
        actorRole: user.role,
        details: { from: cycle.status, to: "COMPLETED" },
      });

      res.json(updated);
    } catch (error) {
      console.error("Biometrics complete error:", error);
      res.status(500).json({ message: "Failed to complete biometrics cycle" });
    }
  });

  // POST /api/biometrics-cycles/:cycleId/crm-hold — CRM/Admin set or remove hold
  app.post("/api/biometrics-cycles/:cycleId/crm-hold", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (!["Admin", "Client Relationship Manager"].includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const cycle = await storage.getBiometricsCycleById(req.params.cycleId);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });
      if (!["SCHEDULED", "AWAITING_MEETING"].includes(cycle.status)) {
        return res.status(400).json({ message: "CRM hold can only be set on SCHEDULED or AWAITING_MEETING cycles" });
      }

      const { active } = req.body;
      const now = new Date();

      // Prevent setting a hold when AWAITING_MEETING has already reached or exceeded the 30-minute NO_SHOW threshold
      if (active && cycle.status === "AWAITING_MEETING" && cycle.awaitingMeetingAt) {
        const elapsedMs = now.getTime() - new Date(cycle.awaitingMeetingAt).getTime();
        if (elapsedMs >= 30 * 60 * 1000) {
          return res.status(400).json({
            message: "Cannot set CRM hold: appointment has already exceeded the 30-minute threshold for no-show determination",
          });
        }
      }

      const updated = await storage.updateBiometricsCycle(cycle.id, {
        crmHoldActive: !!active,
        crmHoldSetBy: active ? user.id : cycle.crmHoldSetBy,
        crmHoldSetAt: active ? now : cycle.crmHoldSetAt,
      });

      await storage.logBiometricsEvent({
        cycleId: cycle.id,
        eventType: active ? "CRM_HOLD_SET" : "CRM_HOLD_REMOVED",
        actorId: user.id,
        actorRole: user.role,
        details: { active: !!active },
      });

      res.json(updated);
    } catch (error) {
      console.error("Biometrics CRM hold error:", error);
      res.status(500).json({ message: "Failed to set CRM hold" });
    }
  });

  // POST /api/biometrics-cycles/:cycleId/reschedule-required — CRM/Admin set RESCHEDULE_REQUIRED
  app.post("/api/biometrics-cycles/:cycleId/reschedule-required", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (!["Admin", "Client Relationship Manager"].includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const cycle = await storage.getBiometricsCycleById(req.params.cycleId);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });
      if (FINAL_BIOMETRICS_STATUSES.includes(cycle.status)) {
        return res.status(400).json({ message: "Cycle is already in a final state" });
      }
      if (cycle.status === "RESCHEDULE_REQUIRED") {
        return res.status(400).json({ message: "Cycle is already marked as Reschedule Required" });
      }

      const updated = await storage.updateBiometricsCycle(cycle.id, { status: "RESCHEDULE_REQUIRED" });

      await storage.logBiometricsEvent({
        cycleId: cycle.id,
        eventType: "RESCHEDULE_REQUIRED_SET",
        actorId: user.id,
        actorRole: user.role,
        details: { note: req.body.note || null, fromStatus: cycle.status },
      });

      await storage.logBiometricsEvent({
        cycleId: cycle.id,
        eventType: "STATUS_CHANGED",
        actorId: user.id,
        actorRole: user.role,
        details: { from: cycle.status, to: "RESCHEDULE_REQUIRED" },
      });

      res.json(updated);
    } catch (error) {
      console.error("Biometrics reschedule required error:", error);
      res.status(500).json({ message: "Failed to set reschedule required" });
    }
  });

  // POST /api/biometrics-cycles/:cycleId/admin-override — Admin force-close
  app.post("/api/biometrics-cycles/:cycleId/admin-override", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (user.role !== "Admin") {
        return res.status(403).json({ message: "Access denied: Admin only" });
      }

      const cycle = await storage.getBiometricsCycleById(req.params.cycleId);
      if (!cycle) return res.status(404).json({ message: "Cycle not found" });
      if (FINAL_BIOMETRICS_STATUSES.includes(cycle.status)) {
        return res.status(400).json({ message: "Cycle is already in a final state" });
      }

      const { reason } = req.body;
      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: "Override reason is required" });
      }

      const now = new Date();
      const updated = await storage.updateBiometricsCycle(cycle.id, {
        status: "CLOSED_ADMIN_OVERRIDE",
        overrideReason: reason,
        overrideBy: user.id,
        overrideAt: now,
      });

      await storage.logBiometricsEvent({
        cycleId: cycle.id,
        eventType: "ADMIN_OVERRIDE",
        actorId: user.id,
        actorRole: user.role,
        details: { reason, fromStatus: cycle.status },
      });

      await storage.logBiometricsEvent({
        cycleId: cycle.id,
        eventType: "STATUS_CHANGED",
        actorId: user.id,
        actorRole: user.role,
        details: { from: cycle.status, to: "CLOSED_ADMIN_OVERRIDE" },
      });

      res.json(updated);
    } catch (error) {
      console.error("Biometrics admin override error:", error);
      res.status(500).json({ message: "Failed to apply admin override" });
    }
  });

  // Biometrics timer jobs
  async function runBiometricsTimerJobs() {
    try {
      const now = new Date();

      // (a) SCHEDULED → AWAITING_MEETING (5 min past appointment_time)
      const awaitingDue = await storage.getBiometricsCyclesDueForAwaitingMeeting();
      for (const cycle of awaitingDue) {
        await storage.updateBiometricsCycle(cycle.id, {
          status: "AWAITING_MEETING",
          awaitingMeetingAt: now,
        });
        await storage.logBiometricsEvent({
          cycleId: cycle.id,
          eventType: "TIMER_AWAITING_MEETING",
          actorId: null,
          actorRole: "system",
          details: { triggeredAt: now.toISOString() },
        });
        await storage.logBiometricsEvent({
          cycleId: cycle.id,
          eventType: "STATUS_CHANGED",
          actorId: null,
          actorRole: "system",
          details: { from: "SCHEDULED", to: "AWAITING_MEETING" },
        });
      }

      // (b) AWAITING_MEETING → NO_SHOW (30 min, no hold)
      const noShowDue = await storage.getBiometricsCyclesDueForNoShow();
      for (const cycle of noShowDue) {
        await storage.updateBiometricsCycle(cycle.id, {
          status: "NO_SHOW",
          noShowAt: now,
          outcome: "NoShow",
        });
        await storage.logBiometricsEvent({
          cycleId: cycle.id,
          eventType: "TIMER_NO_SHOW",
          actorId: null,
          actorRole: "system",
          details: { triggeredAt: now.toISOString() },
        });
        await storage.logBiometricsEvent({
          cycleId: cycle.id,
          eventType: "STATUS_CHANGED",
          actorId: null,
          actorRole: "system",
          details: { from: "AWAITING_MEETING", to: "NO_SHOW" },
        });
      }

      const total = awaitingDue.length + noShowDue.length;
      if (total > 0) {
        console.log(`[biometrics-timer] Processed ${awaitingDue.length} AWAITING_MEETING, ${noShowDue.length} NO_SHOW`);
      }
    } catch (err) {
      console.error("[biometrics-timer] Error:", err);
    }
  }

  setInterval(() => {
    runBiometricsTimerJobs().catch(err => console.error("[biometrics-timer] Interval error:", err));
  }, 60 * 1000);

  setTimeout(() => {
    runBiometricsTimerJobs().catch(err => console.error("[biometrics-timer] Initial error:", err));
  }, 9000);

  // ─── Apple Wallet Pass ──────────────────────────────────────────────────────
  app.get("/api/pass", async (req, res) => {
    const passTypeIdentifier = process.env.APPLE_PASS_TYPE_IDENTIFIER;
    const teamIdentifier = process.env.APPLE_TEAM_ID;

    if (!passTypeIdentifier) {
      return res.status(500).json({ message: "APPLE_PASS_TYPE_IDENTIFIER environment variable is not set" });
    }
    if (!teamIdentifier) {
      return res.status(500).json({ message: "APPLE_TEAM_ID environment variable is not set" });
    }

    try {
      const buffer = await generateAppointmentPass({
        passTypeIdentifier,
        teamIdentifier,
        serialNumber: randomUUID(),
        description: "Appointment Pass",
        organizationName: "The P.R.O. Company",
        backgroundColor: "rgb(0,0,0)",
        foregroundColor: "rgb(255,255,255)",
        labelColor: "rgb(255,255,255)",
        qrMessage: "TEST123",
        fields: {
          primary: [{ key: "name", label: "NAME", value: "Appointment" }],
          secondary: [
            { key: "org", label: "ORGANIZATION", value: "The P.R.O. Company" },
          ],
          back: [
            { key: "info", label: "Information", value: "This pass is issued by The P.R.O. Company." },
          ],
        },
      });

      res.set({
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="appointment.pkpass"`,
        "Content-Length": buffer.length,
      });
      res.send(buffer);
    } catch (err: any) {
      console.error("[apple-pass] Error generating pass:", err);
      res.status(500).json({ message: err.message ?? "Failed to generate pass" });
    }
  });

  return httpServer;
}

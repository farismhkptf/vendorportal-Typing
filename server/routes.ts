import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import * as XLSX from 'xlsx';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { z } from "zod";
import { 
  insertWorkOrderSchema, insertCompanySchema, insertStaffSchema,
  insertCenterSchema, insertServiceTypeSchema, insertJobTypeSchema, loginSchema,
  insertAppointmentSchema, insertTypingJobSchema, insertWoNoteSchema,
  type CenterTimings, type InsertVendorNotification
} from "@shared/schema";
import { validateAppointmentTime, getAvailableTimeSlots, isCenterOpenOnDate } from "@shared/scheduling";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { toProperCase } from "./proper-case";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register object storage routes
  registerObjectStorageRoutes(app);
  
  // Seed database on startup
  await storage.seedData();

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

  // ========== Dashboard ==========
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const workOrders = await storage.getWorkOrders();
      const todayAppointments = await storage.getTodayAppointments();
      // Count Draft typing jobs as "pending" - these need to be submitted to vendor
      const pendingJobs = await storage.getTypingJobs("Draft");
      const vendors = await storage.getVendors();
      
      let walletBalance = 0;
      let lowBalanceWarning = false;
      
      if (vendors.length > 0) {
        walletBalance = await storage.getWalletBalance(vendors[0].id);
        const settings = await storage.getAppSettings();
        lowBalanceWarning = walletBalance < (settings?.lowBalanceThreshold || 1000);
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

  app.get("/api/dashboard/today-appointments", async (req, res) => {
    try {
      const appointments = await storage.getTodayAppointments();
      const result = await Promise.all(
        appointments.map(async (apt) => {
          const wo = await storage.getWorkOrderById(apt.woId);
          const center = apt.centerId ? await storage.getCenterById(apt.centerId) : null;
          return {
            id: apt.id,
            woNumber: wo?.woNumber || "N/A",
            applicantName: wo?.applicantName || "N/A",
            type: apt.type,
            time: new Date(apt.datetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
            center: center?.name || "TBD",
          };
        })
      );
      res.json(result);
    } catch (error) {
      console.error("Today appointments error:", error);
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.get("/api/dashboard/recent-work-orders", async (req, res) => {
    try {
      const workOrders = await storage.getWorkOrders();
      const recent = workOrders.slice(0, 5);
      const allJobTypes = await storage.getJobTypes();
      const jobTypeMap = new Map(allJobTypes.map(jt => [jt.id, jt]));

      const result = await Promise.all(
        recent.map(async (wo) => {
          const [company, typingJobs, appointments] = await Promise.all([
            storage.getCompanyById(wo.companyId),
            storage.getTypingJobsByWoId(wo.id),
            storage.getAppointmentsByWoId(wo.id),
          ]);

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
        })
      );
      res.json(result);
    } catch (error) {
      console.error("Recent work orders error:", error);
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  app.get("/api/activity", async (req, res) => {
    try {
      const logs = await storage.getRecentAuditLogs(15);
      res.json(logs);
    } catch (error) {
      console.error("Activity feed error:", error);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  app.get("/api/search", async (req, res) => {
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

      const enrichedTypingJobs = await Promise.all(
        allTypingJobs.map(async (job) => {
          const wo = await storage.getWorkOrderById(job.woId);
          return { ...job, workOrder: wo };
        })
      );

      const filteredTypingJobs = enrichedTypingJobs.filter(j =>
        (j.jobCode && j.jobCode.toLowerCase().includes(q)) ||
        (j.workOrder?.applicantName?.toLowerCase().includes(q)) ||
        (j.workOrder?.woNumber?.toLowerCase().includes(q))
      );

      const filteredCompanies = companies
        .filter(c => c.name.toLowerCase().includes(q))
        .slice(0, 5)
        .map(c => ({ id: c.id, name: c.name }));

      const filteredStaff = staffList
        .filter(s => s.name.toLowerCase().includes(q))
        .slice(0, 5)
        .map(s => ({ id: s.id, name: s.name, role: s.roleTitle || "" }));

      res.json({
        workOrders: workOrders.slice(0, 5).map(wo => ({
          id: wo.id,
          woNumber: wo.woNumber,
          applicantName: wo.applicantName,
          status: wo.status,
        })),
        typingJobs: filteredTypingJobs.slice(0, 5).map(j => ({
          id: j.id,
          jobCode: j.jobCode,
          woNumber: j.workOrder?.woNumber || "",
          applicantName: j.workOrder?.applicantName || "",
          status: j.status,
        })),
        companies: filteredCompanies,
        staff: filteredStaff,
      });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  app.get("/api/reports/summary", async (req, res) => {
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
        completedTypingJobs: allTypingJobs.filter(j => j.status === "SentToClient" || j.status === "ReadyToSchedule" || j.status === "Returned").length,
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
        const completedJobs = jobs.filter(j => j.status === "ReadyToSchedule" || j.status === "Returned" || j.status === "SentToClient");
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

  app.get("/api/dashboard/pipeline", async (req, res) => {
    try {
      const workOrders = await storage.getWorkOrders();
      const pipeline = {
        draft: 0,
        scheduled: 0,
        sent: 0,
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

  app.get("/api/dashboard/action-center", async (req, res) => {
    try {
      const [readyToScheduleJobs, unacceptedJobs, waitingForDocs, workOrders] = await Promise.all([
        storage.getTypingJobs("ReadyToSchedule"),
        storage.getTypingJobs("SentToVendor"),
        storage.getTypingJobs("WaitingForDocs"),
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
        waitingForDocs: waitingForDocs.length,
        overdueItems: overdueItems.length,
      });
    } catch (error) {
      console.error("Dashboard action-center error:", error);
      res.status(500).json({ message: "Failed to fetch action center data" });
    }
  });

  app.get("/api/dashboard/needs-attention", async (req, res) => {
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
          return jt?.category === "Medical" && (j.status === "ReadyToSchedule" || j.status === "Returned" || j.status === "SentToClient");
        });
        const returnedEid = typingJobs.some(j => {
          const jt = jobTypeMap.get(j.jobTypeId);
          return jt?.category === "EID" && (j.status === "ReadyToSchedule" || j.status === "Returned" || j.status === "SentToClient");
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

  app.get("/api/dashboard/stale-jobs", async (req, res) => {
    try {
      const now = Date.now();
      const [sentToVendorJobs, waitingForDocsJobs, inProgressJobs, allJobTypes] = await Promise.all([
        storage.getTypingJobs("SentToVendor"),
        storage.getTypingJobs("WaitingForDocs"),
        storage.getTypingJobs("InProgress"),
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

      const waitingForDocsOver48h = (await Promise.all(
        waitingForDocsJobs
          .filter(j => (now - new Date(j.createdAt).getTime()) > 48 * 3600000)
          .map(enrichJob)
      )).map(({ wo, job }) => ({
        id: job.id,
        jobCode: job.jobCode || "",
        woNumber: wo?.woNumber || "N/A",
        applicantName: wo?.applicantName || "N/A",
        lastStatusChange: job.createdAt,
        hoursWaiting: Math.round((now - new Date(job.createdAt).getTime()) / 3600000),
      }));

      const inProgressOver72h = (await Promise.all(
        inProgressJobs
          .filter(j => (now - new Date(j.createdAt).getTime()) > 72 * 3600000)
          .map(enrichJob)
      )).map(({ wo, job }) => ({
        id: job.id,
        jobCode: job.jobCode || "",
        woNumber: wo?.woNumber || "N/A",
        applicantName: wo?.applicantName || "N/A",
        startedAt: job.createdAt,
        hoursInProgress: Math.round((now - new Date(job.createdAt).getTime()) / 3600000),
      }));

      res.json({ unacceptedOver24h, waitingForDocsOver48h, inProgressOver72h });
    } catch (error) {
      console.error("Dashboard stale-jobs error:", error);
      res.status(500).json({ message: "Failed to fetch stale jobs" });
    }
  });

  app.get("/api/dashboard/expiring-documents", async (req, res) => {
    try {
      const now = Date.now();
      const DAY_MS = 86400000;
      const allJobTypes = await storage.getJobTypes();
      const jobTypeMap = new Map(allJobTypes.map(jt => [jt.id, jt]));

      const [readyToScheduleJobs, returnedJobs, sentToClientJobs] = await Promise.all([
        storage.getTypingJobs("ReadyToSchedule"),
        storage.getTypingJobs("Returned"),
        storage.getTypingJobs("SentToClient"),
      ]);
      const completedJobs = [...readyToScheduleJobs, ...returnedJobs, ...sentToClientJobs];

      const expiringMedical: Array<{ jobId: string; jobCode: string; woNumber: string; applicantName: string; completedAt: string; daysRemaining: number }> = [];
      const expiringEid: Array<{ jobId: string; jobCode: string; woNumber: string; applicantName: string; completedAt: string; daysRemaining: number }> = [];

      for (const job of completedJobs) {
        const jt = jobTypeMap.get(job.jobTypeId);
        if (!jt) continue;
        const completedAt = job.sentToClientAt || job.returnedAt;
        if (!completedAt) continue;
        const completedTime = new Date(completedAt).getTime();
        const daysSinceCompleted = (now - completedTime) / DAY_MS;

        if (jt.category === "Medical" && daysSinceCompleted >= 25 && daysSinceCompleted <= 30) {
          const wo = await storage.getWorkOrderById(job.woId);
          expiringMedical.push({
            jobId: job.id,
            jobCode: job.jobCode || "",
            woNumber: wo?.woNumber || "N/A",
            applicantName: wo?.applicantName || "N/A",
            completedAt: new Date(completedAt).toISOString(),
            daysRemaining: Math.max(0, Math.round(30 - daysSinceCompleted)),
          });
        } else if (jt.category === "EID" && daysSinceCompleted >= 55 && daysSinceCompleted <= 60) {
          const wo = await storage.getWorkOrderById(job.woId);
          expiringEid.push({
            jobId: job.id,
            jobCode: job.jobCode || "",
            woNumber: wo?.woNumber || "N/A",
            applicantName: wo?.applicantName || "N/A",
            completedAt: new Date(completedAt).toISOString(),
            daysRemaining: Math.max(0, Math.round(60 - daysSinceCompleted)),
          });
        }
      }

      res.json({ expiringMedical, expiringEid });
    } catch (error) {
      console.error("Dashboard expiring-documents error:", error);
      res.status(500).json({ message: "Failed to fetch expiring documents" });
    }
  });

  // ========== Work Orders ==========
  app.get("/api/work-orders", requireAuth, async (req, res) => {
    try {
      const { search, status } = req.query;
      const workOrders = await storage.getWorkOrders(
        search as string | undefined,
        status as string | undefined
      );
      
      const result = await Promise.all(
        workOrders.map(async (wo) => {
          const [company, typingJobsRaw, appointmentsRaw, serviceType] = await Promise.all([
            storage.getCompanyById(wo.companyId),
            storage.getTypingJobsByWoId(wo.id),
            storage.getAppointmentsByWoId(wo.id),
            wo.serviceTypeId ? storage.getServiceTypeById(wo.serviceTypeId) : Promise.resolve(undefined),
          ]);
          const typingJobs = await Promise.all(
            typingJobsRaw.map(async (job) => {
              const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
              return { ...job, jobType };
            })
          );
          return { ...wo, company, serviceType, typingJobs, appointments: appointmentsRaw };
        })
      );
      
      res.json(result);
    } catch (error) {
      console.error("Work orders error:", error);
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  app.post("/api/work-orders/bulk-status", requireAuth, async (req, res) => {
    try {
      const bulkStatusSchema = z.object({
        ids: z.array(z.string()).min(1),
        status: z.enum(["Draft", "Scheduled", "Sent", "Completed", "Cancelled"]),
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
            details: { newStatus: status, bulkAction: true },
          });
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

      res.json({
        ...wo,
        company: companyWithDetails,
        appointments,
        typingJobs,
      });
    } catch (error) {
      console.error("Work order detail error:", error);
      res.status(500).json({ message: "Failed to fetch work order" });
    }
  });

  app.post("/api/work-orders", requireAuth, async (req, res) => {
    try {
      const validation = validateBody(insertWorkOrderSchema.omit({ status: true }), req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      // Check if WO number already exists
      const existing = await storage.getWorkOrderByWoNumber(validation.data.woNumber);
      if (existing) {
        return res.status(400).json({ message: `Work order ${validation.data.woNumber} already exists` });
      }

      // Check for duplicate applicant (warning only, does not block creation)
      const allWorkOrders = await storage.getWorkOrders();
      const duplicateApplicants = allWorkOrders.filter(
        wo =>
          wo.applicantName.toLowerCase() === validation.data.applicantName.toLowerCase() &&
          wo.status !== "Completed" &&
          wo.status !== "Cancelled"
      );
      
      const wo = await storage.createWorkOrder({
        ...validation.data,
        applicantName: toProperCase(validation.data.applicantName),
        status: "Draft",
      });
      await storage.createAuditLog({
        entityType: "work_order",
        entityId: wo.id,
        action: "created",
        details: { woNumber: wo.woNumber },
      });
      
      // Auto-create Medical and EID typing jobs for the new work order
      try {
        const jobTypes = await storage.getJobTypes();
        const medicalJobType = jobTypes.find(jt => jt.category === "Medical");
        const eidJobType = jobTypes.find(jt => jt.category === "EID");
        
        if (medicalJobType) {
          const jobCode = await storage.generateNextJobCode("Medical");
          await storage.createTypingJob({
            woId: wo.id,
            jobCode,
            jobTypeId: medicalJobType.id,
            status: "Draft",
          });
        }
        
        if (eidJobType) {
          const jobCode = await storage.generateNextJobCode("EID");
          await storage.createTypingJob({
            woId: wo.id,
            jobCode,
            jobTypeId: eidJobType.id,
            status: "Draft",
          });
        }
      } catch (typingJobError) {
        // Log but don't fail the WO creation if typing job creation fails
        console.error("Failed to auto-create typing jobs for WO:", typingJobError);
      }
      
      const responseData: any = { ...wo };
      if (duplicateApplicants.length > 0) {
        responseData.duplicateWarning = {
          message: "An active work order for this applicant already exists",
          count: duplicateApplicants.length,
        };
      }
      
      res.status(201).json(responseData);
    } catch (error) {
      console.error("Create work order error:", error);
      res.status(500).json({ message: "Failed to create work order" });
    }
  });

  app.put("/api/work-orders/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validation = validateBody(insertWorkOrderSchema.partial(), req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      // If changing WO number, check it doesn't exist for another work order
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
      res.json(wo);
    } catch (error) {
      console.error("Update work order error:", error);
      res.status(500).json({ message: "Failed to update work order" });
    }
  });

  app.delete("/api/work-orders/:id", requireAuth, async (req, res) => {
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

  // ========== Auto-fill Helpers ==========
  app.get("/api/companies/:companyId/last-work-order", async (req, res) => {
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

  app.delete("/api/wo-notes/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteWoNote(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Note not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Delete WO note error:", error);
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  // ========== Audit Logs ==========
  app.get("/api/audit-logs/:entityType/:entityId", async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const logs = await storage.getAuditLogsByEntity(entityType, entityId);
      res.json(logs);
    } catch (error) {
      console.error("Audit logs error:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // ========== Ready to Schedule (typing jobs completed by vendor) ==========
  app.get("/api/typing-jobs/ready-to-schedule", requireAuth, async (req, res) => {
    try {
      const readyJobs = await storage.getTypingJobs("ReadyToSchedule");
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
  app.get("/api/appointments", async (req, res) => {
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

  app.post("/api/appointments", async (req, res) => {
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

      const rescheduleToken = randomUUID();
      const appointment = await storage.createAppointment({
        ...validation.data,
        rescheduleToken,
      });
      
      if (appointment.woId) {
        await storage.updateWorkOrder(appointment.woId, { status: "Scheduled" });
      }
      
      res.status(201).json(appointment);
    } catch (error) {
      console.error("Create appointment error:", error);
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  app.patch("/api/appointments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !["Completed", "Cancelled", "Rescheduled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be Completed, Cancelled, or Rescheduled." });
      }
      
      const updated = await storage.updateAppointment(id, { status });
      if (!updated) {
        return res.status(404).json({ message: "Appointment not found" });
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
      const companies = await storage.getCompanies();
      const workOrderCounts = await storage.getWorkOrderCountsByCompany();
      const result = await Promise.all(
        companies.map(async (company) => {
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
          
          return {
            ...company,
            emails,
            rmStaff,
            assistStaff,
            preferredMedicalCenter,
            preferredMedicalCenterVip,
            preferredBiometricsCenter,
            preferredBiometricsCenterVip,
            workOrderCount: workOrderCounts[company.id] || 0,
          };
        })
      );
      res.json(result);
    } catch (error) {
      console.error("Companies error:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.post("/api/companies", requireAuth, async (req, res) => {
    try {
      const validation = validateBody(insertCompanySchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
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
        ...(validation.data.clientAccountant?.name && { 
          clientAccountant: { ...validation.data.clientAccountant, name: toProperCase(validation.data.clientAccountant.name) } 
        }),
      };
      const company = await storage.createCompany(companyData);
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

  app.put("/api/companies/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validation = validateBody(insertCompanySchema.partial(), req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
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
        ...(validation.data.clientAccountant?.name && { 
          clientAccountant: { ...validation.data.clientAccountant, name: toProperCase(validation.data.clientAccountant.name) } 
        }),
      };
      const company = await storage.updateCompany(id, updateData);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error("Update company error:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  // ========== Staff ==========
  app.get("/api/staff", async (req, res) => {
    try {
      const staffList = await storage.getStaff();
      res.json(staffList);
    } catch (error) {
      console.error("Staff error:", error);
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  app.post("/api/staff", async (req, res) => {
    try {
      const validation = validateBody(insertStaffSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const staffData = {
        ...validation.data,
        name: toProperCase(validation.data.name),
      };
      const member = await storage.createStaff(staffData);
      res.status(201).json(member);
    } catch (error) {
      console.error("Create staff error:", error);
      res.status(500).json({ message: "Failed to create staff member" });
    }
  });

  app.put("/api/staff/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = validateBody(insertStaffSchema.partial(), req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const updateData = {
        ...validation.data,
        ...(validation.data.name && { name: toProperCase(validation.data.name) }),
      };
      const member = await storage.updateStaff(id, updateData);
      if (!member) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      res.json(member);
    } catch (error) {
      console.error("Update staff error:", error);
      res.status(500).json({ message: "Failed to update staff member" });
    }
  });

  app.delete("/api/staff/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteStaff(id);
      if (!success) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete staff error:", error);
      res.status(500).json({ message: "Failed to delete staff member" });
    }
  });

  app.delete("/api/staff/bulk", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const deleted = await storage.bulkDeleteStaff(ids);
      res.json({ deleted });
    } catch (error) {
      console.error("Bulk delete staff error:", error);
      res.status(500).json({ message: "Failed to bulk delete staff" });
    }
  });

  // ========== Centers ==========
  app.get("/api/centers", async (req, res) => {
    try {
      const centers = await storage.getCenters();
      res.json(centers);
    } catch (error) {
      console.error("Centers error:", error);
      res.status(500).json({ message: "Failed to fetch centers" });
    }
  });

  app.post("/api/centers", async (req, res) => {
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

  app.put("/api/centers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        ...(req.body.name && { name: toProperCase(req.body.name) }),
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

  app.delete("/api/centers/:id", async (req, res) => {
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

  app.delete("/api/centers/bulk", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const deleted = await storage.bulkDeleteCenters(ids);
      res.json({ deleted });
    } catch (error) {
      console.error("Bulk delete centers error:", error);
      res.status(500).json({ message: "Failed to bulk delete centers" });
    }
  });

  // ========== Scheduling Validation ==========
  app.post("/api/centers/:centerId/validate-appointment", async (req, res) => {
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

  app.get("/api/centers/:centerId/available-times", async (req, res) => {
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

  app.post("/api/vendors", requireAuth, async (req, res) => {
    try {
      const { name, contactPerson, phone, email } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Vendor name is required" });
      }
      const vendor = await storage.createVendor({
        name: toProperCase(name),
        contactPerson: contactPerson ? toProperCase(contactPerson) : undefined,
        phone,
        email,
      });
      res.status(201).json(vendor);
    } catch (error) {
      console.error("Create vendor error:", error);
      res.status(500).json({ message: "Failed to create vendor" });
    }
  });

  app.put("/api/vendors/:id", requireAuth, async (req, res) => {
    try {
      const { name, contactPerson, phone, email, active } = req.body;
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
      res.json(vendor);
    } catch (error) {
      console.error("Update vendor error:", error);
      res.status(500).json({ message: "Failed to update vendor" });
    }
  });

  app.delete("/api/vendors/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteVendor(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete vendor error:", error);
      res.status(500).json({ message: "Failed to delete vendor" });
    }
  });

  // ========== Service Types ==========
  app.get("/api/service-types", async (req, res) => {
    try {
      const types = await storage.getServiceTypes();
      res.json(types);
    } catch (error) {
      console.error("Service types error:", error);
      res.status(500).json({ message: "Failed to fetch service types" });
    }
  });

  app.post("/api/service-types", async (req, res) => {
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

  app.put("/api/service-types/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        ...(req.body.name && { name: toProperCase(req.body.name) }),
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

  app.delete("/api/service-types/:id", async (req, res) => {
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

  app.post("/api/service-types/bulk", async (req, res) => {
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

  app.delete("/api/service-types/bulk", async (req, res) => {
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
  app.get("/api/job-types", async (req, res) => {
    try {
      const types = await storage.getJobTypes();
      res.json(types);
    } catch (error) {
      console.error("Job types error:", error);
      res.status(500).json({ message: "Failed to fetch job types" });
    }
  });

  app.post("/api/job-types", async (req, res) => {
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

  app.put("/api/job-types/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        ...(req.body.name && { name: toProperCase(req.body.name) }),
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

  app.delete("/api/job-types/:id", async (req, res) => {
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

  app.delete("/api/job-types/bulk", async (req, res) => {
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
  app.post("/api/typing-jobs", requireAuth, async (req, res) => {
    try {
      const validation = validateBody(insertTypingJobSchema.omit({ jobCode: true }), req.body);
      if ("error" in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      // Get job type to determine category for job code generation
      const jobType = await storage.getJobTypeById(validation.data.jobTypeId);
      const category = jobType?.category || "Medical";
      
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
      
      const result = await Promise.all(
        jobs.map(async (job) => {
          const wo = await storage.getWorkOrderById(job.woId);
          const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
          return { ...job, workOrder: wo, jobType };
        })
      );
      
      res.json(result);
    } catch (error) {
      console.error("Typing jobs error:", error);
      res.status(500).json({ message: "Failed to fetch typing jobs" });
    }
  });

  app.post("/api/typing-jobs/bulk-assign-vendor", requireAuth, async (req, res) => {
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
          if (job.status !== "Draft") {
            failed++;
            errors.push(`Typing job ${id} is not in Draft status`);
            continue;
          }

          const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
          const cost = jobType?.cost || 0;

          const balance = await storage.getWalletBalance(vendorId);
          if (balance < cost) {
            failed++;
            errors.push(`Insufficient balance for job ${job.jobCode || id}. Required: AED ${cost}, Available: AED ${balance}`);
            continue;
          }

          // Wallet deduction happens at approval after vendor completes
          await storage.updateTypingJob(id, {
            vendorId,
            status: "SentToVendor",
            costSnapshot: cost,
            sentAt: new Date(),
          });

          await storage.createAuditLog({
            entityType: "typing_job",
            entityId: id,
            action: "submitted_to_vendor",
            details: { vendorId, cost, bulkAction: true },
          });

          await notifyVendorUsers(vendorId, {
            type: "new_job",
            title: "New Job Assigned",
            message: `New typing job ${job.jobCode || ''} has been assigned to you.`,
            relatedJobId: id,
            isRead: false,
          });

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

  app.post("/api/typing-jobs/:id/reassign", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { vendorId } = req.body;
      
      if (!vendorId) {
        return res.status(400).json({ message: "Vendor ID is required" });
      }
      
      const job = await storage.getTypingJobById(id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      if (job.status !== "Cancelled" && job.status !== "VendorMistake" && job.status !== "Rejected") {
        return res.status(400).json({ message: "Can only re-assign cancelled, vendor mistake, or rejected jobs" });
      }
      
      const updated = await storage.updateTypingJob(id, {
        vendorId,
        status: "SentToVendor",
        sentAt: new Date(),
        returnedAt: null,
        vendorMistakeAt: null,
        vendorMistakeReason: null,
      });
      
      try {
        const allUsers = await storage.getUsers();
        const vendorUsers = allUsers.filter(u => u.vendorId === vendorId && u.active);
        for (const user of vendorUsers) {
          await storage.createVendorNotification({
            vendorUserId: user.id,
            vendorId: vendorId,
            type: "new_job",
            title: "New Job Assigned",
            message: `Job ${job.jobCode || ''} has been reassigned to you.`,
            relatedJobId: id,
            isRead: false,
          });
        }
      } catch (e) {
        console.error("Failed to notify vendor:", e);
      }
      
      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: id,
        action: "reassigned",
        userId: req.session?.userId,
        details: { vendorId, previousStatus: job.status },
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Reassign error:", error);
      res.status(500).json({ message: "Failed to reassign job" });
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
      const comment = await storage.createTypingJobComment({
        typingJobId: id,
        ...req.body
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
  app.post("/api/typing-jobs/:id/submit-to-vendor", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { vendorId } = req.body;
      
      if (!vendorId) {
        return res.status(400).json({ message: "Vendor ID is required" });
      }
      
      const job = await storage.getTypingJobById(id);
      if (!job) {
        return res.status(404).json({ message: "Typing job not found" });
      }
      
      if (job.status !== "Draft") {
        return res.status(400).json({ message: "Only draft jobs can be submitted to vendor" });
      }
      
      // Get job type to determine cost
      const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
      const cost = jobType?.cost || 0;
      
      // Get vendor and check balance
      const vendor = await storage.getVendorById(vendorId);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      const balance = await storage.getWalletBalance(vendorId);
      if (balance < cost) {
        return res.status(400).json({ 
          message: `Insufficient vendor balance. Required: AED ${cost}, Available: AED ${balance}` 
        });
      }
      
      // Update job with vendor assignment and status (wallet deduction happens at approval after vendor completes)
      const updatedJob = await storage.updateTypingJob(id, {
        vendorId,
        status: "SentToVendor",
        costSnapshot: cost,
        sentAt: new Date(),
      });
      
      // Create audit log
      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: id,
        action: "submitted_to_vendor",
        details: { vendorId, vendorName: vendor.name, cost },
      });

      await notifyVendorUsers(vendorId, {
        type: "new_job",
        title: "New Job Assigned",
        message: `New typing job ${job.jobCode || ''} has been assigned to you.`,
        relatedJobId: id,
        isRead: false,
      });
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Submit to vendor error:", error);
      res.status(500).json({ message: "Failed to submit job to vendor" });
    }
  });

  // Resubmit typing job to vendor
  app.post("/api/typing-jobs/:id/resubmit", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const job = await storage.getTypingJobById(id);
      if (!job) {
        return res.status(404).json({ message: "Typing job not found" });
      }
      
      if (job.status !== "WaitingForDocs") {
        return res.status(400).json({ message: "Only jobs waiting for documents can be resubmitted" });
      }
      
      const updatedJob = await storage.updateTypingJob(id, {
        status: "SentToVendor",
        sentAt: new Date(),
      });
      
      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: id,
        action: "resubmitted_to_vendor",
        details: {},
      });
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Resubmit error:", error);
      res.status(500).json({ message: "Failed to resubmit job" });
    }
  });

  app.post("/api/typing-jobs/:id/on-hold", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const job = await storage.getTypingJobById(id);
      if (!job) {
        return res.status(404).json({ message: "Typing job not found" });
      }
      
      const activeStatuses = ["SentToVendor", "InProgress", "WaitingForDocs"];
      if (!activeStatuses.includes(job.status)) {
        return res.status(400).json({ message: "Can only put active jobs on hold" });
      }
      
      const updatedJob = await storage.updateTypingJob(id, {
        status: "OnHold",
        previousStatus: job.status,
      });
      
      if (reason) {
        await storage.createTypingJobComment({
          typingJobId: id,
          authorType: "Internal",
          message: `Job put on hold: ${reason}`,
        });
      }
      
      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: id,
        action: "put_on_hold",
        details: { reason, previousStatus: job.status },
      });
      
      res.json(updatedJob);
    } catch (error) {
      console.error("On hold error:", error);
      res.status(500).json({ message: "Failed to put job on hold" });
    }
  });

  app.post("/api/typing-jobs/:id/resume", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const job = await storage.getTypingJobById(id);
      if (!job) {
        return res.status(404).json({ message: "Typing job not found" });
      }
      
      if (job.status !== "OnHold") {
        return res.status(400).json({ message: "Only on-hold jobs can be resumed" });
      }
      
      const resumeStatus = job.previousStatus || "SentToVendor";
      
      const updatedJob = await storage.updateTypingJob(id, {
        status: resumeStatus,
        previousStatus: null,
      });
      
      await storage.createTypingJobComment({
        typingJobId: id,
        authorType: "Internal",
        message: `Job resumed from hold (restored to ${resumeStatus})`,
      });
      
      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: id,
        action: "resumed_from_hold",
        details: { resumedToStatus: resumeStatus },
      });
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Resume error:", error);
      res.status(500).json({ message: "Failed to resume job" });
    }
  });

  app.post("/api/typing-jobs/:id/abort", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const job = await storage.getTypingJobById(id);
      if (!job) {
        return res.status(404).json({ message: "Typing job not found" });
      }
      
      const abortableStatuses = ["Draft", "SentToVendor", "InProgress", "WaitingForDocs", "OnHold"];
      if (!abortableStatuses.includes(job.status)) {
        return res.status(400).json({ message: "Cannot abort job in current status" });
      }
      
      const updatedJob = await storage.updateTypingJob(id, {
        status: "Cancelled",
      });
      
      if (reason) {
        await storage.createTypingJobComment({
          typingJobId: id,
          authorType: "Internal",
          message: `Job aborted: ${reason}`,
        });
      }
      
      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: id,
        action: "team_aborted",
        details: { reason },
      });
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Abort error:", error);
      res.status(500).json({ message: "Failed to abort job" });
    }
  });

  // Deliver typing job to client
  app.post("/api/typing-jobs/:id/deliver-to-client", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const job = await storage.getTypingJobById(id);
      if (!job) {
        return res.status(404).json({ message: "Typing job not found" });
      }
      
      if (job.status !== "ReadyToSchedule" && job.status !== "Returned") {
        return res.status(400).json({ message: "Only completed jobs can be delivered to client" });
      }
      
      // Update job status
      const updatedJob = await storage.updateTypingJob(id, {
        status: "SentToClient",
        sentToClientAt: new Date(),
      });
      
      // Create audit log
      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: id,
        action: "delivered_to_client",
        details: {},
      });
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Deliver to client error:", error);
      res.status(500).json({ message: "Failed to deliver to client" });
    }
  });

  // Files API
  app.get("/api/files/:relatedType/:relatedId", async (req, res) => {
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
      const file = await storage.createFile(req.body);
      
      if (req.body.relatedType === "TypingJob") {
        await storage.createAuditLog({
          entityType: "typing_job",
          entityId: req.body.relatedId,
          action: "file_uploaded",
          details: { 
            fileName: req.body.fileName, 
            direction: req.body.direction,
            uploadedBy: req.body.uploadedByType 
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

      const balance = await storage.getWalletBalance(vendorId);
      const monthlyStats = await storage.getMonthlyStats(vendorId);
      const settings = await storage.getAppSettings();

      res.json({
        balance,
        monthTopups: monthlyStats.topups,
        monthSpend: monthlyStats.spend,
        lowBalanceWarning: balance < (settings?.lowBalanceThreshold || 1000),
      });
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

      const entry = await storage.createWalletEntry({
        vendorId,
        entryType: "Topup",
        amount,
        note: note || "Manual top-up",
      });

      res.status(201).json(entry);
    } catch (error) {
      console.error("Wallet topup error:", error);
      res.status(500).json({ message: "Failed to process top-up" });
    }
  });

  // ========== Settings ==========
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getAppSettings();
      res.json(settings || {
        fromEmail: "notifications@procompany.ae",
        fromName: "The P.R.O. Company",
        replyToEmail: "operations@procompany.ae",
        alwaysCc: ["faris@procompany.ae", "yasin@procompany.ae"],
        lowBalanceThreshold: 1000,
      });
    } catch (error) {
      console.error("Settings error:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", async (req, res) => {
    try {
      const settings = await storage.updateAppSettings(req.body);
      res.json(settings);
    } catch (error) {
      console.error("Update settings error:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // ========== Seed Real Companies (Development Only) ==========
  app.post("/api/admin/seed-companies", async (req, res) => {
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
  app.post("/api/admin/seed-medical-centers", async (req, res) => {
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
  app.post("/api/admin/seed-service-types", async (req, res) => {
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
  app.post("/api/seed/vendor-jobs", async (req, res) => {
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
  app.post("/api/seed/staff", async (req, res) => {
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

  // ========== Authentication ==========
  app.get("/api/auth/accounts", async (_req, res) => {
    try {
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
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      const user = await storage.getUser(userId);
      if (!user || !user.active) {
        return res.status(401).json({ message: "Account not found or inactive" });
      }
      const vendorRoles = ["Vendor", "Vendor Accountant", "Vendor Manager"];
      if (vendorRoles.includes(user.role)) {
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
      const vendorRoles = ["Vendor", "Vendor Accountant", "Vendor Manager"];
      const vendorUser = allUsers.find(u => vendorRoles.includes(u.role) && u.active && u.vendorId);
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

  app.post("/api/auth/login", async (req, res) => {
    try {
      const validation = validateBody(loginSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      const { email, password } = validation.data;
      const user = await storage.getUserByEmail(email);
      
      if (!user || !user.active) {
        await storage.createLoginAuditEntry({
          userId: null,
          email,
          success: false,
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
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
        await storage.createLoginAuditEntry({
          userId: user.id,
          email,
          success: false,
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          portal: 'team',
        });
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const vendorRoles = ["Vendor", "Vendor Accountant", "Vendor Manager"];
      if (vendorRoles.includes(user.role)) {
        return res.status(403).json({ message: "Please use the vendor portal" });
      }

      await storage.createLoginAuditEntry({
        userId: user.id,
        email,
        success: true,
        ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
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
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
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

  // ========== Vendor Portal ==========
  app.post("/api/vendor/auth/login", async (req, res) => {
    try {
      const validation = validateBody(vendorLoginSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      const { username, password } = validation.data;
      const user = await storage.getUserByEmail(username);
      
      const vendorRoles = ["Vendor", "Vendor Accountant", "Vendor Manager"];
      if (!user || !vendorRoles.includes(user.role)) {
        await storage.createLoginAuditEntry({
          userId: null,
          email: username,
          success: false,
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          portal: 'vendor',
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        await storage.createLoginAuditEntry({
          userId: user.id,
          email: username,
          success: false,
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          portal: 'vendor',
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      await storage.createLoginAuditEntry({
        userId: user.id,
        email: username,
        success: true,
        ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
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
      const balance = await storage.getWalletBalance(vendorId);
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
        if (job.status === "SentToVendor" && hoursSinceSent > 24) return "urgent";
        if (isToday && (job.status === "SentToVendor" || job.status === "InProgress")) return "today";
        return "standard";
      };

      const jobTypesAll = await storage.getJobTypes();
      const jobTypeMap = new Map(jobTypesAll.map(jt => [jt.id, jt]));
      const activeStatuses = ["SentToVendor", "InProgress", "WaitingForDocs"];
      const activeJobs = jobs.filter(j => activeStatuses.includes(j.status));

      const stats = {
        total: jobs.length,
        pending: jobs.filter(j => j.status === "SentToVendor").length,
        inProgress: jobs.filter(j => j.status === "InProgress" || j.status === "WaitingForDocs").length,
        completed: jobs.filter(j => j.status === "ReadyToSchedule" || j.status === "Returned" || j.status === "SentToClient").length,
        urgent: jobs.filter(j => {
          const sentTime = j.sentAt ? new Date(j.sentAt).getTime() : 0;
          const hoursSinceSent = sentTime ? (now - sentTime) / 3600000 : 0;
          return j.status === "SentToVendor" && hoursSinceSent > 24;
        }).length,
        todayPending: jobs.filter(j => j.status === "SentToVendor" && j.sentAt && new Date(j.sentAt) >= today).length,
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
      const now24h = now - 24 * 3600000;
      const staleAlerts = {
        unacceptedJobs: jobs.filter(j => j.status === "SentToVendor" && j.sentAt && new Date(j.sentAt).getTime() < now12h).length,
        waitingForDocsJobs: jobs.filter(j => j.status === "WaitingForDocs" && new Date(j.createdAt).getTime() < now24h).length,
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
        const dates = [job.createdAt, job.sentAt, job.returnedAt, job.sentToClientAt, job.vendorMistakeAt].filter(Boolean).map(d => new Date(d!).getTime());
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
      const completedJobs = nonDraftJobs.filter(j => j.status === "ReadyToSchedule" || j.status === "Returned" || j.status === "SentToClient");
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
        pending: jobs.filter(j => j.status === "SentToVendor").length,
        inProgress: jobs.filter(j => j.status === "InProgress" || j.status === "WaitingForDocs").length,
        completed: completedJobs.length,
        cancelled: jobs.filter(j => j.status === "Cancelled").length,
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
          if (job.status === "SentToVendor" && hoursSinceSent > 24) {
            priority = "urgent";
          } else if (isToday && (job.status === "SentToVendor" || job.status === "InProgress")) {
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
            accountant: company.clientAccountant || null,
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

  // Vendor accept job (SentToVendor → InProgress)
  app.post("/api/vendor/jobs/:id/accept", requireVendorAuth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = await storage.getTypingJobById(jobId);
      if (!job || job.vendorId !== req.session.vendorId) {
        return res.status(404).json({ message: "Job not found" });
      }
      if (job.status !== "SentToVendor") {
        return res.status(400).json({ message: "Can only accept jobs that are sent to vendor" });
      }
      const updated = await storage.updateTypingJob(jobId, { status: "InProgress" });
      await storage.createAuditLog({
        entityType: "typing_job", entityId: jobId,
        action: "vendor_accepted", details: { vendorUserId: req.session.vendorUserId },
      });
      res.json(updated);
    } catch (error) {
      console.error("Vendor accept error:", error);
      res.status(500).json({ message: "Failed to accept job" });
    }
  });

  // Vendor request doc resubmission (InProgress or SentToVendor → WaitingForDocs)
  const resubmissionSchema = z.object({
    documentTypes: z.array(z.string()).min(1, "Select at least one document"),
    remarks: z.string().min(1, "Remarks are required"),
    screenshotUrl: z.string().optional(),
    screenshotName: z.string().optional(),
  });

  app.post("/api/vendor/jobs/:id/resubmission", requireVendorAuth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = await storage.getTypingJobById(jobId);
      if (!job || job.vendorId !== req.session.vendorId) {
        return res.status(404).json({ message: "Job not found" });
      }
      if (job.status !== "InProgress" && job.status !== "SentToVendor") {
        return res.status(400).json({ message: "Cannot request resubmission in current status" });
      }
      const validation = validateBody(resubmissionSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const { documentTypes, remarks, screenshotUrl, screenshotName } = validation.data;

      await storage.updateTypingJob(jobId, { status: "WaitingForDocs" });

      const docLabels = documentTypes.join(", ");
      let commentMessage = `Resubmission Required - Documents: ${docLabels}\nRemarks: ${remarks}`;
      if (screenshotUrl) {
        commentMessage += `\n[Screenshot: ${screenshotName || 'screenshot'}](${screenshotUrl})`;
      }
      await storage.createTypingJobComment({
        typingJobId: jobId,
        authorType: "Vendor",
        message: commentMessage,
      });

      await storage.createAuditLog({
        entityType: "typing_job", entityId: jobId,
        action: "vendor_resubmission_requested",
        details: { documentTypes, remarks, screenshotUrl, vendorUserId: req.session.vendorUserId },
      });

      res.json({ message: "Resubmission request sent" });
    } catch (error) {
      console.error("Vendor resubmission error:", error);
      res.status(500).json({ message: "Failed to request resubmission" });
    }
  });

  // Vendor mark job completed (InProgress → ReadyToSchedule) + immediate wallet deduction
  app.post("/api/vendor/jobs/:id/complete", requireVendorAuth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = await storage.getTypingJobById(jobId);
      if (!job || job.vendorId !== req.session.vendorId) {
        return res.status(404).json({ message: "Job not found" });
      }
      if (job.status !== "InProgress") {
        return res.status(400).json({ message: "Can only complete jobs that are in progress" });
      }

      const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
      const deductionAmount = job.costSnapshot || jobType?.cost || 0;

      const updated = await storage.updateTypingJob(jobId, {
        status: "ReadyToSchedule",
        returnedAt: new Date(),
      });

      if (deductionAmount > 0) {
        await storage.createWalletEntry({
          vendorId: job.vendorId!,
          entryType: "Debit",
          typingJobId: jobId,
          amount: -deductionAmount,
          note: `Job completed - deduction for ${job.jobCode || jobId}`,
          createdBy: req.session.vendorUserId,
        });
      }

      await storage.createAuditLog({
        entityType: "typing_job", entityId: jobId,
        action: "vendor_completed", details: { vendorUserId: req.session.vendorUserId, deductionAmount },
      });

      const wo = await storage.getWorkOrderById(job.woId);
      const allTeamUsers = await storage.getUsers();
      const teamUsers = allTeamUsers.filter(u => 
        ["Admin", "Client Relationship Manager", "Medical Assistance Support"].includes(u.role) && u.active
      );
      for (const user of teamUsers) {
        console.log(`[Notification] Job ${job.jobCode || jobId} completed by vendor - notifying ${user.name}`);
      }

      res.json(updated);
    } catch (error) {
      console.error("Vendor complete error:", error);
      res.status(500).json({ message: "Failed to complete job" });
    }
  });

  const rejectSchema = z.object({
    reason: z.string().min(1, "Reason is required"),
  });

  app.post("/api/vendor/jobs/:id/reject", requireVendorAuth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = await storage.getTypingJobById(jobId);
      if (!job || job.vendorId !== req.session.vendorId) {
        return res.status(404).json({ message: "Job not found" });
      }
      if (job.status !== "SentToVendor") {
        return res.status(400).json({ message: "Can only reject jobs that are sent to vendor" });
      }
      const validation = validateBody(rejectSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const { reason } = validation.data;

      const updated = await storage.updateTypingJob(jobId, {
        status: "Rejected",
        rejectedReason: reason,
      });

      await storage.createTypingJobComment({
        typingJobId: jobId,
        authorType: "Vendor",
        message: `Job rejected: ${reason}`,
      });

      await storage.createAuditLog({
        entityType: "typing_job", entityId: jobId,
        action: "vendor_rejected", details: { reason, vendorUserId: req.session.vendorUserId },
      });

      res.json(updated);
    } catch (error) {
      console.error("Vendor reject error:", error);
      res.status(500).json({ message: "Failed to reject job" });
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
      const { documentType, fileName, fileUrl, mimeType, fileSize } = req.body;
      
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
      });

      await storage.createAuditLog({
        entityType: "work_order",
        entityId: id,
        action: "document_uploaded",
        details: { documentType, fileName },
      });

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

  // ========== Document Requirements ==========
  app.get("/api/document-requirements", async (req, res) => {
    try {
      const requirements = await storage.getDocumentRequirements();
      res.json(requirements);
    } catch (error) {
      console.error("Get document requirements error:", error);
      res.status(500).json({ message: "Failed to fetch document requirements" });
    }
  });

  app.get("/api/document-requirements/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const requirements = await storage.getDocumentRequirementsByCategory(category);
      res.json(requirements);
    } catch (error) {
      console.error("Get document requirements by category error:", error);
      res.status(500).json({ message: "Failed to fetch document requirements" });
    }
  });

  app.post("/api/document-requirements/seed", async (req, res) => {
    try {
      const result = await storage.seedDocumentRequirements();
      res.json(result);
    } catch (error) {
      console.error("Seed document requirements error:", error);
      res.status(500).json({ message: "Failed to seed document requirements" });
    }
  });

  app.post("/api/service-types/update-categories", async (req, res) => {
    try {
      const result = await storage.updateServiceTypeCategories();
      res.json(result);
    } catch (error) {
      console.error("Update service type categories error:", error);
      res.status(500).json({ message: "Failed to update service type categories" });
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
  app.get("/api/admin/template", async (req, res) => {
    try {
      const workbook = XLSX.utils.book_new();

      const centersData = [
        ["Name", "Type (Medical/EID/Both)", "Authority (DHA/EHS/ICP)", "Tier (Normal/VIP)", "Address", "Area", "Google Maps URL", "Timing Text", "Notes"],
        ["Example Medical Center", "Medical", "DHA", "Normal", "123 Street, Dubai", "Deira", "", "Sun-Thu: 7AM-9PM", "Walk-in available"],
      ];
      const centersSheet = XLSX.utils.aoa_to_sheet(centersData);
      centersSheet["!cols"] = [
        { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 35 },
        { wch: 15 }, { wch: 30 }, { wch: 25 }, { wch: 25 },
      ];
      XLSX.utils.book_append_sheet(workbook, centersSheet, "Centers");

      const companiesData = [
        ["Name", "Trade License Number", "Delivery Address"],
        ["Example Trading LLC", "TL-123456", "P.O. Box 12345, Dubai"],
      ];
      const companiesSheet = XLSX.utils.aoa_to_sheet(companiesData);
      companiesSheet["!cols"] = [{ wch: 30 }, { wch: 25 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(workbook, companiesSheet, "Companies");

      const staffData = [
        ["Name", "Role Title", "Staff Type (Permanent/Temporary)", "Phone", "Email", "Status (Active/OnLeave/Cancelled/TempActive/TempInactive)"],
        ["John Doe", "Relationship Manager", "Permanent", "050-123-4567", "john@example.com", "Active"],
      ];
      const staffSheet = XLSX.utils.aoa_to_sheet(staffData);
      staffSheet["!cols"] = [
        { wch: 25 }, { wch: 25 }, { wch: 30 }, { wch: 18 }, { wch: 25 }, { wch: 45 },
      ];
      XLSX.utils.book_append_sheet(workbook, staffSheet, "Staff");

      const serviceTypesData = [
        ["Name", "Category (NewVisaInside/NewVisaOutside/GoldenVisa/RenewVisa/NewbornDependent/LostReplaceEid)", "Requires Medical Typing (Yes/No)", "Requires Medical Scheduling (Yes/No)", "Requires ID Typing 2 Years (Yes/No)", "Requires ID Typing 1 Year (Yes/No)", "Requires ID Typing 10 Years (Yes/No)", "Requires ID Biometrics (Yes/No)"],
        ["New Employment Visa", "NewVisaInside", "Yes", "Yes", "Yes", "No", "No", "Yes"],
      ];
      const serviceTypesSheet = XLSX.utils.aoa_to_sheet(serviceTypesData);
      serviceTypesSheet["!cols"] = [
        { wch: 25 }, { wch: 60 }, { wch: 30 }, { wch: 35 },
        { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 28 },
      ];
      XLSX.utils.book_append_sheet(workbook, serviceTypesSheet, "Service Types");

      const jobTypesData = [
        ["Name", "Category (Medical/EID)", "Cost"],
        ["Medical Typing", "Medical", "150"],
      ];
      const jobTypesSheet = XLSX.utils.aoa_to_sheet(jobTypesData);
      jobTypesSheet["!cols"] = [{ wch: 25 }, { wch: 22 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(workbook, jobTypesSheet, "Job Types");

      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="PRO_Company_Import_Template.xlsx"');
      res.send(buffer);
    } catch (error) {
      console.error("Template download error:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  app.post("/api/admin/import", upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const results: Record<string, { imported: number; failed: number; errors: string[] }> = {};
      let totalImported = 0;
      let totalFailed = 0;

      const yesNoToBool = (val: any): boolean => {
        if (typeof val === 'string') return val.trim().toLowerCase() === 'yes';
        return !!val;
      };

      if (workbook.SheetNames.includes("Centers")) {
        const sheet = workbook.Sheets["Centers"];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
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

      if (workbook.SheetNames.includes("Companies")) {
        const sheet = workbook.Sheets["Companies"];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
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

      if (workbook.SheetNames.includes("Staff")) {
        const sheet = workbook.Sheets["Staff"];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
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

      if (workbook.SheetNames.includes("Service Types")) {
        const sheet = workbook.Sheets["Service Types"];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
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

      if (workbook.SheetNames.includes("Job Types")) {
        const sheet = workbook.Sheets["Job Types"];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
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

  app.post("/api/admin/preview-gsheet", async (req, res) => {
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
        } catch {}
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
          skipReason = 'WO already exists';
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

  app.post("/api/admin/import-gsheet", async (req, res) => {
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

  // ========== Admin Approvals ==========
  app.get("/api/admin/approvals", requireAuth, async (req, res) => {
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

  app.post("/api/admin/approvals/:id/approve", requireAuth, async (req, res) => {
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
        status: "SentToClient",
        sentToClientAt: new Date(),
      });
      
      if (finalAmount > 0) {
        await storage.createWalletEntry({
          vendorId: approvalRecord.vendorId,
          entryType: "Debit",
          typingJobId: approvalRecord.typingJobId,
          amount: -finalAmount,
          note: `Job completed - deduction for ${approvalRecord.typingJobId}`,
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

  app.post("/api/admin/approvals/:id/reject", requireAuth, async (req, res) => {
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
        status: "InProgress",
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

  return httpServer;
}

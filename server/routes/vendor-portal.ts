import type { Express } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { storage } from "../storage";
import { vendorLoginSchema } from "../route-schemas";
import { requireVendorAuth, requireTypingVendor, loginRateLimit, recordFailedLogin, clearFailedLogins } from "../middleware/auth";
import { validateBody } from "../middleware/validation";
import { executeTransition } from "../typing-job-machine";
import { checkAndAutoTransitionWorkOrder, checkAndAutoCompleteWorkOrder, revertDelayedWorkOrder } from "../services/transition-service";
import type { DocumentRequirement, WoDocument } from "@shared/schema";
import type { RouteDeps } from "./types";

export function registerVendorPortalRoutes(app: Express, deps: RouteDeps): void {
  const { walletService, notifyVendorUsers, notifyStaffByRoles, notifySingleUser } = deps;

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

      let vendorType = "Typing";
      if (user.vendorId) {
        const vendorRecord = await storage.getVendorById(user.vendorId);
        vendorType = vendorRecord?.vendorType || "Typing";
      }
      req.session.vendorType = vendorType;

      res.json({ 
        id: user.id, 
        name: user.name, 
        email: user.email,
        role: user.role,
        vendorId: user.vendorId,
        vendorType,
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
      let vendorType: string | null = null;
      if (user.vendorId) {
        const vendor = await storage.getVendorById(user.vendorId);
        vendorName = vendor?.name || null;
        vendorType = vendor?.vendorType || null;
      }
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        vendorId: user.vendorId,
        vendorName,
        vendorType,
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

  app.get("/api/vendor/wallet/balance", requireTypingVendor, async (req, res) => {
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

  app.get("/api/vendor/wallet/transactions", requireTypingVendor, async (req, res) => {
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

  app.get("/api/vendor/dashboard", requireTypingVendor, async (req, res) => {
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

      const activeJobsByWo = new Map<string, { woId: string; woNumber: string; applicantName: string; companyName: string; applicantPhotoUrl: string | null; jobs: Array<{ id: string; category: string; status: string; priority: string; sentAt: string | null; costSnapshot: number | null }> }>();
      for (const job of activeJobs) {
        const wo = await storage.getWorkOrderById(job.woId);
        const jt = job.jobTypeId ? jobTypeMap.get(job.jobTypeId) : null;
        const priority = calcPriority(job);
        const key = job.woId;
        if (!activeJobsByWo.has(key)) {
          let companyName = "";
          let applicantPhotoUrl: string | null = null;
          if (wo?.companyId) {
            const company = await storage.getCompanyById(wo.companyId);
            companyName = company?.name || "";
          }
          if (wo?.id) {
            const docs = await storage.getWoDocuments(wo.id);
            const photoDoc = docs.filter(d => d.documentType === "Photo").sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];
            applicantPhotoUrl = photoDoc?.fileUrl || null;
          }
          activeJobsByWo.set(key, {
            woId: job.woId,
            woNumber: wo?.woNumber || "N/A",
            applicantName: wo?.applicantName || "Unknown",
            companyName,
            applicantPhotoUrl,
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

  app.get("/api/vendor/performance", requireTypingVendor, async (req, res) => {
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
        console.error("[vendor-portal] performance: failed to calculate monthly earnings:", e);
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

  app.get("/api/vendor/jobs", requireTypingVendor, async (req, res) => {
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

  app.get("/api/vendor/jobs/:id", requireTypingVendor, async (req, res) => {
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
      let documentRequirements: DocumentRequirement[] = [];
      let woDocuments: WoDocument[] = [];
      
      let sentByStaffName: string | null = null;
      let preferredCenter: { id: string; name: string; area: string | null; type: string; tier: string | null } | null = null;
      let companyContacts: { coordinator: string | null; manager: string | null; accountant: string | null } | null = null;
      let eidCenters: { id: string; name: string; area: string | null; type: string; tier: string | null }[] = [];
      
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
          coordinatorMobile: (company.clientCoordinator as Record<string, string> | null)?.mobile || null,
          coordinatorEmail: (company.clientCoordinator as Record<string, string> | null)?.email || null,
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

  const vendorFileSchema = z.object({
    fileName: z.string().min(1),
    objectPath: z.string().min(1),
  });

  app.post("/api/vendor/jobs/:id/files", requireTypingVendor, async (req, res) => {
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

  app.delete("/api/vendor/jobs/:jobId/files/:fileId", requireTypingVendor, async (req, res) => {
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

  const vendorCommentSchema = z.object({
    message: z.string().min(1).max(2000),
  });

  app.post("/api/vendor/jobs/:id/comments", requireTypingVendor, async (req, res) => {
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

  app.post("/api/vendor/jobs/:id/start-work", requireTypingVendor, async (req, res) => {
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

  app.post("/api/vendor/jobs/:id/accept", requireTypingVendor, async (req, res) => {
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

  app.post("/api/vendor/jobs/:id/complete", requireTypingVendor, async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = await storage.getTypingJobById(jobId);
      if (!job || job.vendorId !== req.session.vendorId) {
        return res.status(404).json({ message: "Job not found" });
      }

      const outputFiles = await storage.getFilesByRelated("TypingJob", jobId);
      const hasResultFile = outputFiles.some((f: { direction: string }) => f.direction === "Output");
      if (!hasResultFile) {
        return res.status(400).json({ message: "Please upload your results before marking complete" });
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

        notifyStaffByRoles(["Admin", "PRO", "PRO - Temporary"], {
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

  app.post("/api/vendor/jobs/:id/return", requireTypingVendor, async (req, res) => {
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

  const biometricsSchema = z.object({
    biometricsRequired: z.boolean(),
    biometricsDatetime: z.string().nullable().optional(),
    biometricsCenter: z.string().nullable().optional(),
    vendorNotes: z.string().nullable().optional(),
    applicationRefNo: z.string().nullable().optional(),
  });

  app.put("/api/vendor/jobs/:id/biometrics", requireTypingVendor, async (req, res) => {
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
}

import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth, requireOpsRole } from "../middleware/auth";
import type { RouteDeps } from "./types";

export function registerDashboardRoutes(app: Express, deps: RouteDeps): void {
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
      const userId = req.session?.userId;
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
        vendorId: vendor?.id || null,
        vendorName: vendor?.name || "Unassigned",
        vendorLogoUrl: vendor?.logoUrl || null,
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
        vendorId: vendor?.id || null,
        vendorName: vendor?.name || "Unassigned",
        vendorLogoUrl: vendor?.logoUrl || null,
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
          vendorId: vendor?.id || null,
          vendorName: vendor?.name || "Unassigned",
          vendorLogoUrl: vendor?.logoUrl || null,
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

}

import type { Express } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";
import { checkAndAutoCompleteWorkOrder } from "../services/transition-service";
import { RESTORE_SNAPSHOT_SQL } from "../restore-snapshot-data";
import { generateAppointmentPass } from "../apple-pass";
import { pool } from "../db";
import type { RouteDeps } from "./types";

export function registerSchedulingRoutes(app: Express, deps: RouteDeps): void {
  const { notifyStaffByRoles } = deps;

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
const PRO_ACTION_ROLES = ["PRO", "PRO - Temporary", "Admin"];

// POST /api/appointment-cycles/:cycleId/confirm-qr — QR confirmation (PRO field action)
app.post("/api/appointment-cycles/:cycleId/confirm-qr", requireAuth, async (req, res) => {
  try {
    const user = await storage.getUser(req.session!.userId);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    if (!PRO_ACTION_ROLES.includes(user.role)) {
      return res.status(403).json({ message: "Access denied: PRO or Admin required" });
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
      return res.status(403).json({ message: "Access denied: PRO or Admin required" });
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
      return res.status(403).json({ message: "Access denied: PRO or Admin required" });
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

    // Notify CRM to create a new cycle
    try {
      const medCase = await storage.getMedicalCaseById(cycle.caseId);
      if (medCase?.woId) {
        const wo = await storage.getWorkOrderById(medCase.woId);
        const company = wo?.companyId ? await storage.getCompanyById(wo.companyId) : null;
        const notification = {
          type: "retest_required",
          title: "Medical Retest Required",
          message: `${wo?.applicantName || "Applicant"} (${wo?.woNumber || ""}) requires a retest — please schedule a new appointment cycle.`,
          relatedEntityType: "work_order" as const,
          relatedEntityId: medCase.woId,
        };
        if (company?.rmStaffId) {
          const rmStaff = await storage.getStaffById(company.rmStaffId).catch((err) => { console.error("[scheduling] failed to fetch RM staff:", err); return null; });
          if (rmStaff?.userId) {
            await storage.createStaffNotification({ ...notification, userId: rmStaff.userId });
          } else {
            await notifyStaffByRoles(["Admin"], notification);
          }
        } else {
          await notifyStaffByRoles(["Admin"], notification);
        }
      }
    } catch (notifyErr) {
      console.error("[retest-required] Failed to notify CRM:", notifyErr);
    }

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

    // Bridge: attempt to auto-complete the parent WO
    try {
      const medCase = await storage.getMedicalCaseById(cycle.caseId);
      if (medCase?.woId) {
        await checkAndAutoCompleteWorkOrder(medCase.woId);
      }
    } catch (bridgeErr) {
      console.error("[result-issued] WO auto-complete bridge error:", bridgeErr);
    }

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

    // Notify CRM of medical failure
    try {
      const medCase = await storage.getMedicalCaseById(cycle.caseId);
      if (medCase?.woId) {
        const wo = await storage.getWorkOrderById(medCase.woId);
        const company = wo?.companyId ? await storage.getCompanyById(wo.companyId) : null;
        const notification = {
          type: "medical_failed",
          title: "Medical Result: FAILED",
          message: `Applicant ${wo?.applicantName || "unknown"} (${wo?.woNumber || ""}) has failed their medical. Immediate follow-up required.`,
          relatedEntityType: "work_order" as const,
          relatedEntityId: medCase.woId,
        };
        if (company?.rmStaffId) {
          const rmStaff = await storage.getStaffById(company.rmStaffId).catch((err) => { console.error("[scheduling] failed to fetch RM staff:", err); return null; });
          if (rmStaff?.userId) {
            await storage.createStaffNotification({ ...notification, userId: rmStaff.userId });
          } else {
            await notifyStaffByRoles(["Admin"], notification);
          }
        } else {
          await notifyStaffByRoles(["Admin"], notification);
        }
      }
    } catch (notifyErr) {
      console.error("[medical-failed] Failed to notify CRM:", notifyErr);
    }

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
      // Notify CRM of no-show
      try {
        const medCase = await storage.getMedicalCaseById(cycle.caseId);
        if (medCase?.woId) {
          const wo = await storage.getWorkOrderById(medCase.woId);
          const company = wo?.companyId ? await storage.getCompanyById(wo.companyId) : null;
          const notification = {
            type: "no_show",
            title: "Medical Appointment: No Show",
            message: `${wo?.applicantName || "Applicant"} (${wo?.woNumber || ""}) did not attend their medical appointment. Please follow up and reschedule if needed.`,
            relatedEntityType: "work_order" as const,
            relatedEntityId: medCase.woId,
          };
          if (company?.rmStaffId) {
            const rmStaff = await storage.getStaffById(company.rmStaffId).catch((err) => { console.error("[scheduling] failed to fetch RM staff:", err); return null; });
            if (rmStaff?.userId) {
              await storage.createStaffNotification({ ...notification, userId: rmStaff.userId });
            } else {
              await notifyStaffByRoles(["Admin"], notification);
            }
          } else {
            await notifyStaffByRoles(["Admin"], notification);
          }
        }
      } catch (notifyErr) {
        console.error("[medical-timer] Failed to notify CRM of no-show:", notifyErr);
      }
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

let medicalTimerStarted = false;
if (!medicalTimerStarted) {
  medicalTimerStarted = true;
  setInterval(() => {
    runMedicalTimerJobs().catch(err => console.error("[medical-timer] Interval error:", err));
  }, 60 * 1000);
  setTimeout(() => {
    runMedicalTimerJobs().catch(err => console.error("[medical-timer] Initial error:", err));
  }, 8000);
}

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

const BIO_PRO_ROLES = ["PRO", "PRO - Temporary", "Admin"];

// POST /api/biometrics-cycles/:cycleId/confirm-qr — QR confirmation
app.post("/api/biometrics-cycles/:cycleId/confirm-qr", requireAuth, async (req, res) => {
  try {
    const user = await storage.getUser(req.session!.userId);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    if (!BIO_PRO_ROLES.includes(user.role)) {
      return res.status(403).json({ message: "Access denied: PRO or Admin required" });
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
      return res.status(403).json({ message: "Access denied: PRO or Admin required" });
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
      return res.status(403).json({ message: "Access denied: PRO or Admin required" });
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

let biometricsTimerStarted = false;
if (!biometricsTimerStarted) {
  biometricsTimerStarted = true;
  setInterval(() => {
    runBiometricsTimerJobs().catch(err => console.error("[biometrics-timer] Interval error:", err));
  }, 60 * 1000);
  setTimeout(() => {
    runBiometricsTimerJobs().catch(err => console.error("[biometrics-timer] Initial error:", err));
  }, 9000);
}

// ─── Admin: Restore Production Database ────────────────────────────────────
app.post("/api/admin/restore-db", async (req, res) => {
  const restoreKey = req.headers["x-restore-key"] || req.body?.restoreKey;
  const configuredKey = process.env.RESTORE_KEY;
  if (!configuredKey) {
    return res.status(503).json({ message: "RESTORE_KEY not configured. Database restore is disabled." });
  }
  if (restoreKey !== configuredKey) {
    return res.status(403).json({ message: "Invalid restore key" });
  }
  
  try {
    // Split on semicolons and execute each statement
    const statements = RESTORE_SNAPSHOT_SQL
      .split(";")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0 && !s.startsWith("--"));
    
    let executed = 0;
    let errors: string[] = [];
    
    for (const stmt of statements) {
      try {
        await pool.query(stmt);
        executed++;
      } catch (err: unknown) {
        errors.push(`${err instanceof Error ? err.message : String(err)} | SQL: ${stmt.substring(0, 100)}`);
      }
    }
    
    // Verify counts
    const counts = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM companies) as companies,
        (SELECT COUNT(*) FROM service_types) as service_types,
        (SELECT COUNT(*) FROM centers) as centers,
        (SELECT COUNT(*) FROM staff) as staff,
        (SELECT COUNT(*) FROM vendors) as vendors,
        (SELECT COUNT(*) FROM job_types) as job_types,
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM work_orders) as work_orders,
        (SELECT COUNT(*) FROM typing_jobs) as typing_jobs,
        (SELECT COUNT(*) FROM appointments) as appointments
    `);
    
    res.json({
      success: true,
      executed,
      errors: errors.length > 0 ? errors : undefined,
      counts: counts.rows[0],
    });
  } catch (err: unknown) {
    console.error("[restore-db] Error:", err);
    res.status(500).json({ success: false, message: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Apple Wallet Pass ──────────────────────────────────────────────────────
app.get("/api/pass", (req, res, next) => {
  if (!req.session?.userId && !req.session?.vendorUserId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}, async (req, res) => {
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
  } catch (err: unknown) {
    console.error("[apple-pass] Error generating pass:", err);
    res.status(500).json({ message: err instanceof Error ? err.message : "Failed to generate pass" });
  }
});

}

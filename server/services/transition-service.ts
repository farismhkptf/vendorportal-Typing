import { storage as _realStorage, IStorage } from "../storage";
import { notifyStaffByRoles } from "./notification-service";
import { pushStatusToClientPortal } from "./client-portal-push";
import { db } from "../db";
import { workOrders, medicalCases, biometricsCases } from "@shared/schema";
import { eq } from "drizzle-orm";

// Allows tests to inject storage/db stubs without touching production singletons
let _storage: IStorage = _realStorage;
export function _setStorageForTesting(s: IStorage): void { _storage = s; }
export function _resetStorage(): void { _storage = _realStorage; }

type CompletionTransaction = (woId: string, storage: IStorage) => Promise<void>;
let _runCompletionTransaction: CompletionTransaction = async (woId, storage) => {
  await db.transaction(async (tx) => {
    await tx.update(workOrders).set({ status: "Completed" }).where(eq(workOrders.id, woId));
    await tx.update(medicalCases).set({ isOpen: false }).where(eq(medicalCases.woId, woId));
    await tx.update(biometricsCases).set({ isOpen: false }).where(eq(biometricsCases.woId, woId));
  });
};
export function _setCompletionTransactionForTesting(fn: CompletionTransaction): void { _runCompletionTransaction = fn; }
export function _resetCompletionTransaction(): void {
  _runCompletionTransaction = async (woId, storage) => {
    await db.transaction(async (tx) => {
      await tx.update(workOrders).set({ status: "Completed" }).where(eq(workOrders.id, woId));
      await tx.update(medicalCases).set({ isOpen: false }).where(eq(medicalCases.woId, woId));
      await tx.update(biometricsCases).set({ isOpen: false }).where(eq(biometricsCases.woId, woId));
    });
  };
}

export async function checkAndAutoTransitionWorkOrder(woId: string): Promise<void> {
  try {
    const wo = await _storage.getWorkOrderById(woId);
    if (!wo || wo.status === "Completed" || wo.status === "Cancelled") return;
    if (!wo.serviceTypeId) return;

    const serviceType = await _storage.getServiceTypeById(wo.serviceTypeId);
    if (!serviceType) return;

    const jobs = await _storage.getTypingJobsByWoId(woId);
    const appts = await _storage.getAppointmentsByWoId(woId);

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

    const needsMedicalTyping = needsMedical && serviceType.requiresMedicalTyping;
    const needsEidTyping = serviceType.requiresIdTyping2Years || serviceType.requiresIdTyping1Year || serviceType.requiresIdTyping10Years;
    const noTypingRequired = !needsMedicalTyping && !needsEidTyping;

    // Any active (non-Aborted) job that is not yet terminal means typing is still in progress
    const activeNonTerminalJobs = activeJobs.filter(j => !terminalJobStatuses.includes(j.status));
    const hasVendorJobs = activeJobs.some(j => vendorStatuses.includes(j.status));

    // Draft WO: advance to AtVendor when typing is required and jobs exist (even if Draft),
    // or when jobs are already at a vendor (SubmittedToVendor/InProcess).
    if (wo.status === "Draft") {
      if (!noTypingRequired && activeNonTerminalJobs.length > 0) {
        newStatus = "AtVendor";
      }
    } else if (hasVendorJobs) {
      // Non-Draft: keep at AtVendor if still has vendor jobs (handled implicitly, no action needed)
    }

    const medTypingDone = !needsMedicalTyping
      || (medJobs.length > 0 && medJobs.every(j => terminalJobStatuses.includes(j.status)));
    const eidTypingDone = !needsEidTyping
      || (eidJobs.length > 0 && eidJobs.every(j => terminalJobStatuses.includes(j.status)));

    const allRequiredTypingDone = noTypingRequired || (medTypingDone && eidTypingDone);

    if (allRequiredTypingDone && medAppts.length === 0 && eidAppts.length === 0
        && (wo.status === "AtVendor" || wo.status === "Draft")) {
      newStatus = "ReadyToSchedule";
    }

    if (newStatus && newStatus !== wo.status) {
      await _storage.updateWorkOrder(woId, { status: newStatus });
      await _storage.createAuditLog({
        action: "auto_status_transition",
        entityType: "work_order",
        entityId: woId,
        userId: null,
        details: { from: wo.status, to: newStatus, applicantName: wo.applicantName, woNumber: wo.woNumber },
      });
      console.log(`[auto-transition] Work order ${wo.woNumber} transitioned ${wo.status} → ${newStatus}`);

      // Push auto-transition event to Client Portal (non-blocking)
      pushStatusToClientPortal({
        eventType: "work_order.status_changed",
        workOrderId: woId,
        woNumber: wo.woNumber,
        applicantName: wo.applicantName,
        companyId: wo.companyId,
        status: newStatus,
        details: { previousStatus: wo.status, newStatus, trigger: "auto_transition" },
        timestamp: new Date().toISOString(),
      }).catch((err: unknown) => { console.error("[auto-transition] push error:", err); });
    }
  } catch (err) {
    console.error("[auto-transition] Error:", err);
  }
}

export async function checkAndAutoCompleteWorkOrder(woId: string): Promise<boolean> {
  try {
    const wo = await _storage.getWorkOrderById(woId);
    if (!wo || wo.status === "Completed" || wo.status === "Cancelled") return false;
    if (!wo.serviceTypeId) return false;

    const serviceType = await _storage.getServiceTypeById(wo.serviceTypeId);
    if (!serviceType) return false;

    const jobs = await _storage.getTypingJobsByWoId(woId);
    const appts = await _storage.getAppointmentsByWoId(woId);

    const terminalJobStatuses = ["ReadyForScheduling", "Returned"];
    const terminalApptStatuses = ["Completed", "FollowUpCompleted"];
    const blockingApptStatuses = ["FollowUpRequired"];

    // Block auto-complete if any appointment is in a follow-up-required state
    const blockingAppt = appts.find(a => blockingApptStatuses.includes(a.status));
    if (blockingAppt) return false;

    const needsMedical = serviceType.requiresMedicalTyping || serviceType.requiresMedicalScheduling;
    const needsEid = serviceType.requiresIdTyping2Years || serviceType.requiresIdTyping1Year || serviceType.requiresIdTyping10Years || serviceType.requiresIdBiometrics;
    const needsAttestation = serviceType.requiresAttestation;

    if (needsAttestation) {
      const allSrs = await _storage.getAttestationSrs();
      const attestationSrs = allSrs.filter(sr => sr.externalWoNumber === wo.woNumber);
      if (attestationSrs.length === 0) return false;
      const allAttestationDone = attestationSrs.every(sr => sr.status === "Completed");
      if (!allAttestationDone) return false;
    }

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
        let hasCompletedMedical = false;
        if (medicalAppts.length > 0) {
          hasCompletedMedical = medicalAppts.some(a => terminalApptStatuses.includes(a.status));
        }
        if (!hasCompletedMedical) {
          const medicalCase = await _storage.getMedicalCaseByWoId(woId);
          if (medicalCase) {
            const cycles = await _storage.getCyclesByCase(medicalCase.id);
            const terminalCycleStatuses = ["RESULT_ISSUED", "CLOSED_ADMIN_OVERRIDE"];
            hasCompletedMedical = cycles.some(c => terminalCycleStatuses.includes(c.status));
          }
        }
        if (!hasCompletedMedical) return false;
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
        let hasCompletedBiometrics = false;
        if (eidAppts.length > 0) {
          hasCompletedBiometrics = eidAppts.some(a => terminalApptStatuses.includes(a.status));
        }
        if (!hasCompletedBiometrics) {
          const biometricsCase = await _storage.getBiometricsCaseByWoId(woId);
          if (biometricsCase) {
            const cycles = await _storage.getBiometricsCyclesByCase(biometricsCase.id);
            const terminalBioCycleStatuses = ["COMPLETED", "CLOSED_ADMIN_OVERRIDE"];
            hasCompletedBiometrics = cycles.some(c => terminalBioCycleStatuses.includes(c.status));
          }
        }
        if (!hasCompletedBiometrics) return false;
      }
    }

    // Complete the WO and close all associated cases in a single transaction
    await _runCompletionTransaction(woId, _storage);

    await _storage.createAuditLog({
      action: "auto_completed",
      entityType: "work_order",
      entityId: woId,
      userId: null,
      details: { reason: "All required tracks completed", applicantName: wo.applicantName, woNumber: wo.woNumber },
    });
    console.log(`[auto-complete] Work order ${wo.woNumber} auto-completed`);

    // Push auto-completion event to Client Portal (non-blocking)
    pushStatusToClientPortal({
      eventType: "work_order.status_changed",
      workOrderId: woId,
      woNumber: wo.woNumber,
      applicantName: wo.applicantName,
      companyId: wo.companyId,
      status: "Completed",
      details: { previousStatus: wo.status, newStatus: "Completed", trigger: "auto_complete" },
      timestamp: new Date().toISOString(),
    }).catch((err: unknown) => { console.error("[auto-complete] push error:", err); });

    try {
      const company = wo.companyId ? await _storage.getCompanyById(wo.companyId) : null;
      const notification = {
        type: "wo_completed",
        title: "Work Order Completed",
        message: `Work order ${wo.woNumber} (${wo.applicantName}) has been automatically completed — all tracks finished.`,
        relatedEntityType: "work_order" as const,
        relatedEntityId: woId,
      };
      if (company?.rmStaffId) {
        const rmUser = await _storage.getUserByStaffId(company.rmStaffId).catch((err) => { console.error("[transition-service] failed to fetch RM user:", err); return null; });
        if (rmUser?.id) {
          await _storage.createStaffNotification({ ...notification, userId: rmUser.id });
        } else {
          await notifyStaffByRoles(["Admin"], notification);
        }
      } else {
        await notifyStaffByRoles(["Admin"], notification);
      }
    } catch (notifyErr) {
      console.error("[auto-complete] Failed to send CRM notification:", notifyErr);
    }

    return true;
  } catch (err) {
    console.error("[auto-complete] Error checking work order completion:", err);
    return false;
  }
}

export async function checkAndRevertWoIfNoAppointments(woId: string): Promise<void> {
  try {
    const wo = await _storage.getWorkOrderById(woId);
    if (!wo || wo.status !== "Scheduled") return;

    const appts = await _storage.getAppointmentsByWoId(woId);
    const activeAppts = appts.filter(
      a => a.status !== "Cancelled" && a.status !== "Rescheduled"
    );
    if (activeAppts.length > 0) return;

    await _storage.updateWorkOrder(woId, { status: "ReadyToSchedule" });
    await _storage.createAuditLog({
      action: "auto_status_transition",
      entityType: "work_order",
      entityId: woId,
      userId: null,
      details: { from: "Scheduled", to: "ReadyToSchedule", reason: "All appointments cancelled", applicantName: wo.applicantName, woNumber: wo.woNumber },
    });
    console.log(`[revert-wo] Work order ${wo.woNumber} reverted Scheduled → ReadyToSchedule (no active appointments)`);
  } catch (err) {
    console.error("[revert-wo] Error:", err);
  }
}

export async function revertDelayedWorkOrder(woId: string): Promise<void> {
  try {
    const wo = await _storage.getWorkOrderById(woId);
    if (!wo || !wo.isDelayed) return;

    const settings = await _storage.getAppSettings();
    const thresholdMs = (settings?.vendorDelayThresholdHours ?? 48) * 3600000;
    const now = Date.now();

    const jobs = await _storage.getTypingJobsByWoId(woId);
    const stillOverdue = jobs.some(j =>
      (j.status === "SubmittedToVendor" || j.status === "InProcess") &&
      j.sentAt &&
      (now - new Date(j.sentAt).getTime()) > thresholdMs
    );

    if (stillOverdue) return;

    await _storage.updateWorkOrder(woId, { isDelayed: false });
    await _storage.createAuditLog({
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

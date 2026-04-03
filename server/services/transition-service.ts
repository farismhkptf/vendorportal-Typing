import { storage } from "../storage";
import { notifyStaffByRoles } from "./notification-service";

export async function checkAndAutoTransitionWorkOrder(woId: string): Promise<void> {
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

export async function checkAndAutoCompleteWorkOrder(woId: string): Promise<boolean> {
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
    const blockingApptStatuses = ["FollowUpRequired"];

    // Block auto-complete if any appointment is in a follow-up-required state
    const blockingAppt = appts.find(a => blockingApptStatuses.includes(a.status));
    if (blockingAppt) return false;

    const needsMedical = serviceType.requiresMedicalTyping || serviceType.requiresMedicalScheduling;
    const needsEid = serviceType.requiresIdTyping2Years || serviceType.requiresIdTyping1Year || serviceType.requiresIdTyping10Years || serviceType.requiresIdBiometrics;
    const needsAttestation = serviceType.requiresAttestation;

    if (needsAttestation) {
      const allSrs = await storage.getAttestationSrs();
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
          const medicalCase = await storage.getMedicalCaseByWoId(woId);
          if (medicalCase) {
            const cycles = await storage.getCyclesByCase(medicalCase.id);
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
          const biometricsCase = await storage.getBiometricsCaseByWoId(woId);
          if (biometricsCase) {
            const cycles = await storage.getBiometricsCyclesByCase(biometricsCase.id);
            const terminalBioCycleStatuses = ["COMPLETED", "CLOSED_ADMIN_OVERRIDE"];
            hasCompletedBiometrics = cycles.some(c => terminalBioCycleStatuses.includes(c.status));
          }
        }
        if (!hasCompletedBiometrics) return false;
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

    try {
      const company = wo.companyId ? await storage.getCompanyById(wo.companyId) : null;
      const notification = {
        type: "wo_completed",
        title: "Work Order Completed",
        message: `Work order ${wo.woNumber} (${wo.applicantName}) has been automatically completed — all tracks finished.`,
        relatedEntityType: "work_order" as const,
        relatedEntityId: woId,
      };
      if (company?.rmStaffId) {
        const rmStaff = await storage.getStaffById(company.rmStaffId).catch((err) => { console.error("[transition-service] failed to fetch RM staff:", err); return null; });
        if (rmStaff?.userId) {
          await storage.createStaffNotification({ ...notification, userId: rmStaff.userId });
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

export async function revertDelayedWorkOrder(woId: string): Promise<void> {
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

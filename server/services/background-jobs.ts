import { storage } from "../storage";
import { notifyStaffByRoles } from "./notification-service";

let backgroundJobsStarted = false;

export async function checkAndMarkDelayedWorkOrders(): Promise<number> {
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

export async function checkAppointmentsTomorrow(): Promise<void> {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const allAppointments = await storage.getAllAppointments();
    const tomorrowAppts = allAppointments.filter(a => {
      const d = new Date(a.datetime);
      return d >= tomorrow && d < dayAfter && a.status === "Scheduled";
    });

    let sent = 0;
    for (const appt of tomorrowAppts) {
      const wo = await storage.getWorkOrderById(appt.woId);

      const staffUsers = await storage.getUsers();
      const targetRoles = ["Admin", "PRO", "PRO - Temporary"];
      const targetUsers = staffUsers.filter(u => u.active && targetRoles.includes(u.role));

      let alreadySentToAll = true;
      for (const user of targetUsers) {
        const alreadySent = await storage.hasRecentNotification("appointment_tomorrow", appt.id, 20, user.id);
        if (!alreadySent) {
          alreadySentToAll = false;
          await storage.createStaffNotification({
            type: "appointment_tomorrow",
            title: "Appointment Tomorrow",
            message: `${appt.type} appointment tomorrow for ${wo?.applicantName || "applicant"} (${wo?.woNumber || ""})`,
            relatedEntityType: "appointment",
            relatedEntityId: appt.id,
            userId: user.id,
          });
        }
      }

      if (!alreadySentToAll) sent++;
    }
    if (sent > 0) {
      console.log(`[appt-reminder] Sent ${sent} appointment reminders`);
    }
  } catch (err) {
    console.error("[appt-reminder] Error:", err);
  }
}

export function startBackgroundJobs(): void {
  if (backgroundJobsStarted) {
    console.log("[background-jobs] Already started, skipping duplicate initialization");
    return;
  }
  backgroundJobsStarted = true;

  setInterval(() => {
    checkAndMarkDelayedWorkOrders().catch(err =>
      console.error("[delay-check] Interval error:", err)
    );
  }, 15 * 60 * 1000);
  setTimeout(() => {
    checkAndMarkDelayedWorkOrders().catch(err =>
      console.error("[delay-check] Initial check error:", err)
    );
  }, 5000);

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

  console.log("[background-jobs] Background jobs started");
}

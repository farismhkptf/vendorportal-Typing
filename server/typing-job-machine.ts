import type { IStorage } from "./storage";

export type TypingJobStatus =
  | "Draft"
  | "SubmittedToVendor"
  | "InProcess"
  | "Returned"
  | "ReadyForScheduling"
  | "OnHold"
  | "Rejected"
  | "Aborted";

export type Actor = "team" | "vendor" | "system";

export interface TransitionDef {
  from: TypingJobStatus[];
  to: TypingJobStatus;
  actor: Actor[];
  sideEffects?: SideEffect[];
}

export type SideEffect =
  | { type: "audit"; action: string }
  | { type: "notify_vendor"; notificationType: string; title: string; messageFn: (ctx: TransitionContext) => string }
  | { type: "comment"; messageFn: (ctx: TransitionContext) => string };

export interface TransitionContext {
  jobId: string;
  jobCode?: string | null;
  vendorId?: string | null;
  previousStatus: TypingJobStatus;
  newStatus: TypingJobStatus;
  actor: Actor;
  actorId?: string;
  reason?: string;
  vendorName?: string;
  deductionAmount?: number;
  extraData?: Record<string, unknown>;
}

const TRANSITIONS: Record<string, TransitionDef> = {
  submit_to_vendor: {
    from: ["Draft"],
    to: "SubmittedToVendor",
    actor: ["team"],
    sideEffects: [
      { type: "audit", action: "submitted_to_vendor" },
      {
        type: "notify_vendor",
        notificationType: "new_job",
        title: "New Job Assigned",
        messageFn: (ctx) => `New typing job ${ctx.jobCode || ""} has been assigned to you.`,
      },
    ],
  },

  start_work: {
    from: ["SubmittedToVendor"],
    to: "InProcess",
    actor: ["vendor"],
    sideEffects: [
      { type: "audit", action: "vendor_started_work" },
    ],
  },

  complete: {
    from: ["InProcess"],
    to: "ReadyForScheduling",
    actor: ["vendor"],
    sideEffects: [
      { type: "audit", action: "vendor_completed" },
    ],
  },

  return_job: {
    from: ["InProcess"],
    to: "Returned",
    actor: ["vendor"],
    sideEffects: [
      { type: "audit", action: "vendor_returned" },
      { type: "comment", messageFn: (ctx) => `Vendor returned job${ctx.reason ? `: ${ctx.reason}` : " due to incorrect documents"}` },
    ],
  },

  reject: {
    from: ["SubmittedToVendor", "InProcess"],
    to: "Rejected",
    actor: ["vendor"],
    sideEffects: [
      { type: "audit", action: "vendor_rejected" },
      { type: "comment", messageFn: (ctx) => `Vendor rejected job${ctx.reason ? `: ${ctx.reason}` : " — cannot process"}` },
    ],
  },

  on_hold: {
    from: ["SubmittedToVendor", "InProcess"],
    to: "OnHold",
    actor: ["team"],
    sideEffects: [
      { type: "audit", action: "put_on_hold" },
    ],
  },

  resume: {
    from: ["OnHold"],
    to: "SubmittedToVendor",
    actor: ["team"],
    sideEffects: [
      { type: "audit", action: "resumed_from_hold" },
      { type: "comment", messageFn: (ctx) => `Job resumed from hold (restored to ${ctx.newStatus})` },
    ],
  },

  abort: {
    from: ["Draft", "SubmittedToVendor", "InProcess", "OnHold"],
    to: "Aborted",
    actor: ["team"],
    sideEffects: [
      { type: "audit", action: "team_aborted" },
    ],
  },

  reassign: {
    from: ["Aborted", "Rejected"],
    to: "SubmittedToVendor",
    actor: ["team"],
    sideEffects: [
      { type: "audit", action: "reassigned" },
      {
        type: "notify_vendor",
        notificationType: "new_job",
        title: "New Job Assigned",
        messageFn: (ctx) => `Job ${ctx.jobCode || ""} has been reassigned to you.`,
      },
    ],
  },
};

export function getTransitionDef(action: string): TransitionDef | undefined {
  return TRANSITIONS[action];
}

export function getAllActions(): string[] {
  return Object.keys(TRANSITIONS);
}

export function getAvailableActions(currentStatus: TypingJobStatus, actor: Actor): string[] {
  return Object.entries(TRANSITIONS)
    .filter(([, def]) => def.from.includes(currentStatus) && def.actor.includes(actor))
    .map(([action]) => action);
}

export interface TransitionResult {
  valid: boolean;
  error?: string;
  newStatus?: TypingJobStatus;
  def?: TransitionDef;
}

export function validateTransition(
  action: string,
  currentStatus: TypingJobStatus,
  actor: Actor
): TransitionResult {
  const def = TRANSITIONS[action];
  if (!def) {
    return { valid: false, error: `Unknown action: ${action}` };
  }

  if (!def.actor.includes(actor)) {
    return { valid: false, error: `Action '${action}' cannot be performed by ${actor}` };
  }

  if (!def.from.includes(currentStatus)) {
    const allowed = def.from.join(", ");
    return {
      valid: false,
      error: `Cannot '${action}' a job in '${currentStatus}' status. Allowed from: ${allowed}`,
    };
  }

  return { valid: true, newStatus: def.to, def };
}

export interface ExecuteTransitionParams {
  action: string;
  jobId: string;
  actor: Actor;
  actorId?: string;
  storage: IStorage;
  notifyVendorUsers: (vendorId: string, notification: any) => Promise<void>;
  updateFields?: Record<string, unknown>;
  reason?: string;
}

export async function executeTransition(params: ExecuteTransitionParams): Promise<{
  success: boolean;
  error?: string;
  job?: any;
  context?: TransitionContext;
}> {
  const { action, jobId, actor, actorId, storage, notifyVendorUsers, updateFields, reason } = params;

  const job = await storage.getTypingJobById(jobId);
  if (!job) {
    return { success: false, error: "Typing job not found" };
  }

  const currentStatus = job.status as TypingJobStatus;
  const validation = validateTransition(action, currentStatus, actor);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const def = validation.def!;
  let targetStatus = validation.newStatus!;

  if (action === "resume" && job.previousStatus) {
    targetStatus = job.previousStatus as TypingJobStatus;
  }

  const baseUpdate: Record<string, unknown> = { status: targetStatus };

  if (action === "on_hold") {
    baseUpdate.previousStatus = currentStatus;
  }
  if (action === "resume") {
    baseUpdate.previousStatus = null;
  }
  if (action === "complete") {
    baseUpdate.returnedAt = new Date();
  }
  if (action === "submit_to_vendor") {
    baseUpdate.sentAt = new Date();
  }
  if (action === "reassign") {
    baseUpdate.sentAt = new Date();
    baseUpdate.returnedAt = null;
  }
  if (action === "reject") {
    baseUpdate.rejectedReason = reason || null;
  }

  const mergedUpdate = { ...baseUpdate, ...updateFields };
  const updatedJob = await storage.updateTypingJob(jobId, mergedUpdate);

  const ctx: TransitionContext = {
    jobId,
    jobCode: job.jobCode,
    vendorId: updatedJob?.vendorId || job.vendorId,
    previousStatus: currentStatus,
    newStatus: targetStatus,
    actor,
    actorId,
    reason,
  };

  if (def.sideEffects) {
    for (const effect of def.sideEffects) {
      try {
        switch (effect.type) {
          case "audit":
            await storage.createAuditLog({
              entityType: "typing_job",
              entityId: jobId,
              userId: actor === "team" ? actorId : undefined,
              action: effect.action,
              details: {
                previousStatus: currentStatus,
                newStatus: targetStatus,
                ...(reason ? { reason } : {}),
                ...(actorId ? (actor === "vendor" ? { vendorUserId: actorId } : {}) : {}),
                ...(ctx.deductionAmount !== undefined ? { deductionAmount: ctx.deductionAmount } : {}),
                ...(ctx.extraData || {}),
              },
            });
            break;

          case "notify_vendor":
            if (ctx.vendorId) {
              await notifyVendorUsers(ctx.vendorId, {
                type: effect.notificationType,
                title: effect.title,
                message: effect.messageFn(ctx),
                relatedJobId: jobId,
                isRead: false,
              });
            }
            break;

          case "comment":
            await storage.createTypingJobComment({
              typingJobId: jobId,
              authorType: "Internal",
              message: effect.messageFn(ctx),
            });
            break;
        }
      } catch (err) {
        console.error(`Side effect '${effect.type}' failed for action '${action}':`, err);
      }
    }
  }

  if (reason && action !== "resume") {
    try {
      const actionLabel = action.replace(/_/g, " ");
      await storage.createTypingJobComment({
        typingJobId: jobId,
        authorType: "Internal",
        message: `Job ${actionLabel}: ${reason}`,
      });
    } catch (err) {
      console.error("Failed to create reason comment:", err);
    }
  }

  return { success: true, job: updatedJob, context: ctx };
}

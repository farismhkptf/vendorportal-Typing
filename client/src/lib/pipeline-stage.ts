export type PipelineStage = 
  | "new"
  | "at_vendor" 
  | "ready_to_schedule"
  | "scheduled"
  | "complete"
  | "needs_attention";

export interface TrackStatus {
  stage: PipelineStage;
  label: string;
  typingStatus: string | null;
  appointmentStatus: string | null;
  exists: boolean;
}

export interface PipelineInfo {
  medical: TrackStatus;
  eid: TrackStatus;
  overall: PipelineStage;
  overallLabel: string;
}

const STAGE_PRIORITY: Record<PipelineStage, number> = {
  needs_attention: 0,
  new: 1,
  at_vendor: 2,
  ready_to_schedule: 3,
  scheduled: 4,
  complete: 5,
};

export const STAGE_CONFIG: Record<PipelineStage, { label: string; color: string; bgColor: string; borderColor: string; icon: string }> = {
  new: { label: "New", color: "text-slate-600", bgColor: "bg-slate-100 dark:bg-slate-800", borderColor: "border-slate-300 dark:border-slate-600", icon: "circle" },
  at_vendor: { label: "At Vendor", color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-900/30", borderColor: "border-blue-300 dark:border-blue-700", icon: "send" },
  ready_to_schedule: { label: "Ready to Schedule", color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-900/30", borderColor: "border-amber-300 dark:border-amber-700", icon: "calendar-plus" },
  scheduled: { label: "Scheduled", color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-900/30", borderColor: "border-purple-300 dark:border-purple-700", icon: "calendar-check" },
  complete: { label: "Complete", color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-900/30", borderColor: "border-emerald-300 dark:border-emerald-700", icon: "check-circle" },
  needs_attention: { label: "Needs Attention", color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-900/30", borderColor: "border-red-300 dark:border-red-700", icon: "alert-triangle" },
};

export const PIPELINE_STEPS = ["new", "at_vendor", "ready_to_schedule", "scheduled", "complete"] as const;

function getTrackStatus(
  typingJobs: any[],
  appointments: any[],
  category: "Medical" | "EID"
): TrackStatus {
  const jobs = typingJobs.filter((j: any) => j.jobType?.category === category && j.status !== "Cancelled");
  const allApts = appointments.filter((a: any) => a.type === category && a.status !== "Cancelled");
  const activeApts = allApts.filter((a: any) => a.status !== "Rescheduled");
  
  const exists = jobs.length > 0 || allApts.length > 0;
  if (!exists) {
    return { stage: "new", label: "Not Started", typingStatus: null, appointmentStatus: null, exists: false };
  }

  const latestJob = jobs.length > 0 ? jobs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null;
  const latestApt = activeApts.length > 0 ? activeApts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null;
  const hadRescheduled = allApts.some((a: any) => a.status === "Rescheduled");

  const typingStatus = latestJob?.status || null;
  const appointmentStatus = latestApt?.status || null;

  if (typingStatus === "OnHold" || typingStatus === "Rejected") {
    return { stage: "needs_attention", label: typingStatus === "OnHold" ? "On Hold" : "Rejected", typingStatus, appointmentStatus, exists };
  }

  if (appointmentStatus === "Completed") {
    const jobDone = !typingStatus || typingStatus === "SentToClient" || typingStatus === "ReadyToSchedule" || typingStatus === "Returned";
    if (jobDone) {
      return { stage: "complete", label: "Complete", typingStatus, appointmentStatus, exists };
    }
  }

  if (appointmentStatus === "Scheduled") {
    return { stage: "scheduled", label: "Scheduled", typingStatus, appointmentStatus, exists };
  }

  if (typingStatus === "ReadyToSchedule" || typingStatus === "Returned" || typingStatus === "SentToClient") {
    if (!latestApt || hadRescheduled) {
      return { stage: "ready_to_schedule", label: hadRescheduled && !latestApt ? "Rescheduled — Needs New Appt" : "Ready to Schedule", typingStatus, appointmentStatus, exists };
    }
  }

  if (typingStatus === "SentToVendor" || typingStatus === "InProgress" || typingStatus === "WaitingForDocs") {
    return { stage: "at_vendor", label: "At Vendor", typingStatus, appointmentStatus, exists };
  }

  if (typingStatus === "Draft") {
    return { stage: "new", label: "Draft", typingStatus, appointmentStatus, exists };
  }

  return { stage: "new", label: "New", typingStatus, appointmentStatus, exists };
}

export function getPipelineInfo(typingJobs: any[], appointments: any[]): PipelineInfo {
  const medical = getTrackStatus(typingJobs, appointments, "Medical");
  const eid = getTrackStatus(typingJobs, appointments, "EID");

  let overall: PipelineStage;
  if (!medical.exists && !eid.exists) {
    overall = "new";
  } else if (medical.stage === "needs_attention" || eid.stage === "needs_attention") {
    overall = "needs_attention";
  } else {
    const medPriority = medical.exists ? STAGE_PRIORITY[medical.stage] : 999;
    const eidPriority = eid.exists ? STAGE_PRIORITY[eid.stage] : 999;
    overall = medPriority <= eidPriority ? medical.stage : eid.stage;
  }

  const overallLabel = STAGE_CONFIG[overall].label;

  return { medical, eid, overall, overallLabel };
}

export function getNextAction(
  typingJobs: any[],
  appointments: any[],
  pipeline: PipelineInfo
): { message: string; actionLabel?: string; actionType?: "create_typing" | "send_vendor" | "schedule_medical" | "schedule_eid" | "deliver" | "attention"; variant: "info" | "action" | "warning" | "success" } {
  const medJobs = typingJobs.filter((j: any) => j.jobType?.category === "Medical" && j.status !== "Cancelled");
  const eidJobs = typingJobs.filter((j: any) => j.jobType?.category === "EID" && j.status !== "Cancelled");
  const draftJobs = typingJobs.filter((j: any) => j.status === "Draft");
  const activeApts = appointments.filter((a: any) => a.status === "Scheduled");

  if (pipeline.overall === "needs_attention") {
    const heldJobs = typingJobs.filter((j: any) => j.status === "OnHold");
    const rejectedJobs = typingJobs.filter((j: any) => j.status === "Rejected");
    if (heldJobs.length > 0) return { message: `${heldJobs.length} job${heldJobs.length > 1 ? "s" : ""} on hold — resume or reassign`, variant: "warning", actionType: "attention" };
    if (rejectedJobs.length > 0) return { message: `${rejectedJobs.length} job${rejectedJobs.length > 1 ? "s" : ""} rejected — reassign to vendor`, variant: "warning", actionType: "attention" };
    return { message: "Jobs need attention", variant: "warning", actionType: "attention" };
  }

  if (pipeline.overall === "complete") {
    const allDelivered = typingJobs.filter((j: any) => j.status !== "Cancelled").every((j: any) => j.status === "SentToClient");
    if (!allDelivered) {
      return { message: "Appointments complete — deliver to client", actionLabel: "Deliver to Client", variant: "action", actionType: "deliver" };
    }
    return { message: "All steps complete", variant: "success" };
  }

  if (medJobs.length === 0 && eidJobs.length === 0) {
    return { message: "Create typing jobs to get started", actionLabel: "Create Typing Jobs", variant: "action", actionType: "create_typing" };
  }

  if (draftJobs.length > 0) {
    return { message: `${draftJobs.length} draft job${draftJobs.length > 1 ? "s" : ""} ready to send`, actionLabel: "Send to Vendor", variant: "action", actionType: "send_vendor" };
  }

  if (pipeline.medical.stage === "at_vendor" || pipeline.eid.stage === "at_vendor") {
    const atVendor = typingJobs.filter((j: any) => ["SentToVendor", "InProgress", "WaitingForDocs"].includes(j.status));
    const oldestSent = atVendor.reduce((oldest: Date | null, j: any) => {
      const d = new Date(j.sentAt || j.createdAt);
      return !oldest || d < oldest ? d : oldest;
    }, null as Date | null);
    const hoursWaiting = oldestSent ? Math.round((Date.now() - oldestSent.getTime()) / (1000 * 60 * 60)) : 0;
    return { message: `Waiting for vendor${hoursWaiting > 0 ? ` (${hoursWaiting}h)` : ""}`, variant: "info" };
  }

  if (pipeline.medical.stage === "ready_to_schedule" && !pipeline.medical.appointmentStatus) {
    return { message: "Medical typing complete — schedule appointment", actionLabel: "Schedule Medical", variant: "action", actionType: "schedule_medical" };
  }

  if (pipeline.eid.stage === "ready_to_schedule" && !pipeline.eid.appointmentStatus) {
    return { message: "EID typing complete — schedule appointment", actionLabel: "Schedule EID", variant: "action", actionType: "schedule_eid" };
  }

  if (activeApts.length > 0) {
    const nextApt = activeApts.sort((a: any, b: any) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())[0];
    const aptDate = new Date(nextApt.datetime);
    const isToday = aptDate.toDateString() === new Date().toDateString();
    const dateStr = isToday ? "today" : aptDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    return { message: `Appointment ${dateStr} at ${aptDate.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}`, variant: "info" };
  }

  return { message: "In progress", variant: "info" };
}

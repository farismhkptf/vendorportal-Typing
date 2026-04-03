import { z } from "zod";
import { toProperCase } from "@/lib/proper-case";
import { formatTime12h } from "@/lib/format-date";

export type SchedulerType = "Medical" | "EID";

export const TIME_SLOTS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30", "21:00"
];

export const getTomorrow = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
};

export const getTodayUAE = () => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
};

export const appointmentSchema = z.object({
  woId: z.string().min(1, "Work order is required"),
  isVip: z.boolean().default(false),
  centerId: z.string().min(1, "Center is required"),
  applicationNumber: z.string().optional(),
  appointmentDate: z.string().min(1, "Date is required"),
  appointmentTime: z.string().min(1, "Time is required"),
  assignedStaffId: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.appointmentDate || !data.appointmentTime) return;
  const todayUAE = getTodayUAE();
  if (data.appointmentDate < todayUAE) {
    ctx.addIssue({ code: "custom", path: ["appointmentDate"], message: "Appointment date cannot be in the past" });
    return;
  }
  if (data.appointmentDate === todayUAE) {
    const nowUAE = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit" });
    if (data.appointmentTime <= nowUAE) {
      ctx.addIssue({ code: "custom", path: ["appointmentTime"], message: "Appointment time cannot be in the past" });
    }
  }
});

export type AppointmentForm = z.infer<typeof appointmentSchema>;

export interface SchedulingQueueItem {
  typingJobId: string;
  jobCode: string | null;
  woId: string;
  woNumber: string;
  applicantName: string;
  applicantPhone: string | null;
  applicantEmail: string | null;
  isVip: boolean;
  serviceTypeId: string | null;
  companyId: string | null;
  companyName: string | null;
  preferredMedicalCenterId: string | null;
  preferredMedicalCenterVipId: string | null;
  preferredBiometricsCenterId: string | null;
  preferredBiometricsCenterVipId: string | null;
  assistStaffId: string | null;
  rmStaffId: string | null;
  applicationRefNo: string | null;
  biometricsRequired: boolean;
  biometricsDatetime: string | null;
  biometricsCenter: string | null;
  notes: string | null;
  returnedAt: string | null;
  completedAt: string | null;
}

export interface SchedulingQueueResponse {
  medical: SchedulingQueueItem[];
  eid: SchedulingQueueItem[];
}

export function getPreferredCenterId(
  item: SchedulingQueueItem,
  isVip: boolean,
  type: SchedulerType
): string | null {
  if (type === "Medical") {
    return isVip ? item.preferredMedicalCenterVipId : item.preferredMedicalCenterId;
  }
  return isVip ? item.preferredBiometricsCenterVipId : item.preferredBiometricsCenterId;
}

export function getCenterUpdateField(
  centerId: string,
  isVip: boolean,
  type: SchedulerType
): Record<string, string> {
  if (type === "Medical") {
    return isVip
      ? { preferredMedicalCenterVipId: centerId }
      : { preferredMedicalCenterId: centerId };
  }
  return isVip
    ? { preferredBiometricsCenterVipId: centerId }
    : { preferredBiometricsCenterId: centerId };
}

export function getTimeSince(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function buildQueueItemFromWo(
  wo: { id: string; woNumber: string; applicantName: string; applicantPhone?: string | null; applicantEmail?: string | null; isVip?: boolean | null; serviceTypeId?: string | null; companyId?: string | null },
  company: { id: string; name: string; preferredMedicalCenterId?: string | null; preferredMedicalCenterVipId?: string | null; preferredBiometricsCenterId?: string | null; preferredBiometricsCenterVipId?: string | null; assistStaffId?: string | null; rmStaffId?: string | null } | null | undefined
): SchedulingQueueItem {
  return {
    typingJobId: "", jobCode: null, woId: wo.id, woNumber: wo.woNumber,
    applicantName: wo.applicantName, applicantPhone: wo.applicantPhone || null,
    applicantEmail: wo.applicantEmail || null, isVip: wo.isVip || false,
    serviceTypeId: wo.serviceTypeId || null, companyId: company?.id || null,
    companyName: company?.name || null,
    preferredMedicalCenterId: company?.preferredMedicalCenterId || null,
    preferredMedicalCenterVipId: company?.preferredMedicalCenterVipId || null,
    preferredBiometricsCenterId: company?.preferredBiometricsCenterId || null,
    preferredBiometricsCenterVipId: company?.preferredBiometricsCenterVipId || null,
    assistStaffId: company?.assistStaffId || null, rmStaffId: company?.rmStaffId || null,
    applicationRefNo: null, biometricsRequired: false, biometricsDatetime: null,
    biometricsCenter: null, notes: null, returnedAt: null, completedAt: null,
  };
}

export function generateMedicalPreviews(
  item: SchedulingQueueItem,
  company: { name: string; assistStaffId?: string | null; rmStaffId?: string | null },
  formValues: AppointmentForm,
  center: { name?: string; address?: string | null; googleMapsUrl?: string | null } | undefined,
  staffList: Array<{ id: string; name: string; phone?: string | null }> | undefined,
  serviceTypeName: string,
): { emailPreview: string; whatsappPreview: string } {
  const medicalAssist = staffList?.find(s => s.id === company.assistStaffId);
  const crm = staffList?.find(s => s.id === company.rmStaffId);
  const formattedDate = new Date(formValues.appointmentDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const contactLines: string[] = [];
  if (medicalAssist) contactLines.push(`Medical Assistant: ${medicalAssist.name}${medicalAssist.phone ? ` - ${medicalAssist.phone}` : ""}`);
  if (crm) contactLines.push(`Client Relations: ${crm.name}${crm.phone ? ` - ${crm.phone}` : ""}`);
  const contactSection = contactLines.length > 0 ? `Your P.R.O. Team:\n${contactLines.join("\n")}` : "";
  const appNum = formValues.applicationNumber;
  const emailPreview = `Dear ${toProperCase(company.name)} Team,\n\nWe have scheduled a medical appointment for your employee:\n\nApplicant: ${toProperCase(item.applicantName)}\n${item.applicantPhone ? `Contact: ${item.applicantPhone}` : ""}\n\nAppointment Details:\n- Date: ${formattedDate}\n- Time: ${formatTime12h(formValues.appointmentTime)}\n- Medical Center: ${center?.name || "TBD"}\n${center?.address ? `- Address: ${center.address}` : ""}\n${center?.googleMapsUrl ? `- Location: ${center.googleMapsUrl}` : ""}\n${appNum ? `- Application Number: ${appNum}` : ""}\n\n${contactSection}\n\n${formValues.notes ? `Note: ${formValues.notes}` : ""}\n\nPlease ensure the applicant arrives 15 minutes before the scheduled time with all required documents.\n\nBest regards,\nThe P.R.O. Company™`;
  const assistanceSection = medicalAssist ? `Assistance: ${medicalAssist.name}\n${medicalAssist.phone || ""}` : "";
  const locationLink = center?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(center.address)}` : "";
  const whatsappPreview = `Hello\n\nYour medical appointment has been scheduled successfully for the following work.\n\nWO: ${item.woNumber}\nApplicant: ${toProperCase(item.applicantName)}\nCompany: ${toProperCase(company.name)}\nService: ${toProperCase(serviceTypeName)}\n${appNum ? `Application No: ${appNum}` : ""}\n\nMedical Center: ${center?.name || "TBD"}\nDate: ${formattedDate}\nTime: ${formatTime12h(formValues.appointmentTime)}\n${center?.address ? `Location: ${center.address}` : ""}\n${locationLink ? `Map: ${locationLink}` : ""}\n\n${assistanceSection}\n\n*Important:*\n- Please arrive at least *10 minutes before* the scheduled time.\n- Please ensure the applicant brings their *original passport*.\n${formValues.notes ? `- ${formValues.notes}` : ""}\n\nThank you,\n*The P.R.O. Company*`;
  return { emailPreview, whatsappPreview };
}

export function generateEidPreviews(
  item: SchedulingQueueItem,
  company: { name: string; assistStaffId?: string | null; rmStaffId?: string | null },
  formValues: AppointmentForm,
  center: { name?: string; address?: string | null; googleMapsUrl?: string | null } | undefined,
  staffList: Array<{ id: string; name: string; phone?: string | null }> | undefined,
  serviceTypeName: string,
): { emailPreview: string; whatsappPreview: string } {
  const assist = staffList?.find(s => s.id === company.assistStaffId);
  const crm = staffList?.find(s => s.id === company.rmStaffId);
  const formattedDate = new Date(formValues.appointmentDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const contactLines: string[] = [];
  if (assist) contactLines.push(`Field Assistant: ${assist.name}${assist.phone ? ` - ${assist.phone}` : ""}`);
  if (crm) contactLines.push(`Client Relations: ${crm.name}${crm.phone ? ` - ${crm.phone}` : ""}`);
  const contactSection = contactLines.length > 0 ? `Your P.R.O. Team:\n${contactLines.join("\n")}` : "";
  const appNum = formValues.applicationNumber;
  const emailPreview = `Dear ${toProperCase(company.name)} Team,\n\nWe have scheduled an Emirates ID appointment for your employee:\n\nApplicant: ${toProperCase(item.applicantName)}\n${item.applicantPhone ? `Contact: ${item.applicantPhone}` : ""}\n\nAppointment Details:\n- Date: ${formattedDate}\n- Time: ${formatTime12h(formValues.appointmentTime)}\n- Emirates ID Center: ${center?.name || "TBD"}\n${center?.address ? `- Address: ${center.address}` : ""}\n${center?.googleMapsUrl ? `- Location: ${center.googleMapsUrl}` : ""}\n${appNum ? `- Application Number: ${appNum}` : ""}\n\n${contactSection}\n\n${formValues.notes ? `Note: ${formValues.notes}` : ""}\n\nPlease ensure the applicant arrives 15 minutes before the scheduled time with all required documents.\n\nOnce the Emirates ID process is completed, we will update you with the status.\n\nBest regards,\nThe P.R.O. Company\u2122`;
  const locationLink = center?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(center.address)}` : "";
  const assistanceSection = assist ? `\u{1F464} Assistance: ${assist.name}\n\u{1F4DE} ${assist.phone || ""}` : "";
  const whatsappPreview = `Hello \u{1F44B}\n\nYour Emirates ID appointment has been scheduled successfully for the following work.\n\n\u{1F4C4} WO: ${item.woNumber}\n\u{1F464} Applicant: ${toProperCase(item.applicantName)}\n\u{1F3E2} Company: ${toProperCase(company.name)}\n\u{1F9FE} Service: ${toProperCase(serviceTypeName)}\n${appNum ? `\u{1F522} Application No: ${appNum}` : ""}\n\n\u{1FAAA} Emirates ID Center: ${center?.name || "TBD"}\n\u{1F4C5} Date: ${formattedDate}\n\u23F0 Time: ${formatTime12h(formValues.appointmentTime)}\n${center?.address ? `\u{1F4CD} Location: ${center.address}` : ""}\n${locationLink ? `\u{1F5FA}\uFE0F Map: ${locationLink}` : ""}\n\n${assistanceSection}\n\n\u26A0\uFE0F *Important:*\n\u2022 Please arrive at least *10 minutes before* the scheduled time.\n\u2022 Please ensure the applicant brings their *original passport*.\n${formValues.notes ? `\u2022 ${formValues.notes}` : ""}\n\nOnce the Emirates ID process is completed, we will update you with the status.\n\nThank you,\n*The P.R.O. Company\u2122*`;
  return { emailPreview, whatsappPreview };
}

export function applyQueueItemToForm(
  item: SchedulingQueueItem,
  type: SchedulerType,
  centers: Array<{ id: string; name: string }> | undefined,
  form: { setValue: (name: string, value: unknown) => void },
) {
  form.setValue("woId", item.woId);
  form.setValue("isVip", item.isVip);
  form.setValue("applicationNumber", item.applicationRefNo || "");
  const preferredCenter = getPreferredCenterId(item, item.isVip, type);
  if (type === "EID" && item.biometricsCenter && centers) {
    const suggestedCenter = centers.find(c => c.name.toLowerCase().includes(item.biometricsCenter!.toLowerCase()) || item.biometricsCenter!.toLowerCase().includes(c.name.toLowerCase()));
    if (suggestedCenter) form.setValue("centerId", suggestedCenter.id);
    else if (preferredCenter) form.setValue("centerId", preferredCenter);
  } else if (preferredCenter) {
    form.setValue("centerId", preferredCenter);
  }
  if (item.assistStaffId) form.setValue("assignedStaffId", item.assistStaffId);
  if (type === "EID" && item.biometricsDatetime) {
    const dt = new Date(item.biometricsDatetime);
    if (!isNaN(dt.getTime())) {
      form.setValue("appointmentDate", dt.toISOString().split("T")[0]);
      const timeStr = `${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes() >= 30 ? "30" : "00"}`;
      if (TIME_SLOTS.includes(timeStr)) form.setValue("appointmentTime", timeStr);
    }
  }
}

export function getSchedulerConfig(type: SchedulerType) {
  if (type === "Medical") {
    return {
      centerLabel: "Medical Center",
      typeLabel: "Medical Type",
      normalLabel: "Normal Medical",
      vipLabel: "VIP Medical",
      appNumberLabel: "Medical Application Number",
      pageTitle: "Schedule Medical",
      pageSubtitle: "Create a medical appointment and notify the client",
      emptyQueueTitle: "No medical appointments pending scheduling",
      emptyQueueSubtitle: "Search for a work order manually",
      centerPlaceholder: "Select medical center",
      emailSubjectPrefix: "Medical Fitness Appointment",
      centerFilterTypes: ["Medical", "Both"] as string[],
      assistLabel: "Field Assistant",
    };
  }
  return {
    centerLabel: "Emirates ID Center",
    typeLabel: "EID Type",
    normalLabel: "Normal EID",
    vipLabel: "VIP EID",
    appNumberLabel: "EID Application Number",
    pageTitle: "Schedule Emirates ID",
    pageSubtitle: "Create an Emirates ID appointment and notify the client",
    emptyQueueTitle: "No EID appointments to schedule right now",
    emptyQueueSubtitle: "Only WOs with biometrics required appear here",
    centerPlaceholder: "Select Emirates ID center",
    emailSubjectPrefix: "Emirates ID Biometrics Appointment",
    centerFilterTypes: ["EID", "Both"] as string[],
    assistLabel: "Field Assistant",
  };
}

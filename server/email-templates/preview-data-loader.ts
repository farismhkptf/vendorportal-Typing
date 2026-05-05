import type { Request } from "express";
import { storage } from "../storage";
import type { Staff, WoDocument } from "@shared/schema";
import { buildAppointmentEmail, type AppointmentEmailData } from "./appointment-confirmation";
import { ObjectStorageService } from "../replit_integrations/object_storage/objectStorage";

export async function getPhotoAsSignedUrl(fileUrl: string): Promise<string | undefined> {
  if (!fileUrl) return undefined;
  try {
    const objectStorageService = new ObjectStorageService();
    return await objectStorageService.getSignedReadUrl(fileUrl, 604800);
  } catch {
    return undefined;
  }
}

interface PreviewDataParams {
  woId?: string;
  centerId?: string | null;
  assignedStaffId?: string | null;
  datetime?: string | Date;
  type?: "Medical" | "EID";
  applicationNumber?: string | null;
  notes?: string | null;
  rescheduleToken?: string | null;
  req: Request;
}

async function loadRelatedData(
  woId: string | undefined,
  centerId: string | null | undefined,
  assignedStaffId: string | null | undefined,
  req: Request,
) {
  const [workOrder, center, assignedStaff] = await Promise.all([
    woId ? storage.getWorkOrderById(woId).catch((err) => { console.warn("[email-preview] failed to load work order:", err); return undefined; }) : undefined,
    centerId ? storage.getCenterById(centerId).catch((err) => { console.warn("[email-preview] failed to load center:", err); return undefined; }) : undefined,
    assignedStaffId ? storage.getStaffById(assignedStaffId).catch((err) => { console.warn("[email-preview] failed to load staff:", err); return undefined; }) : undefined,
  ]);

  const [company, serviceType] = await Promise.all([
    workOrder?.companyId ? storage.getCompanyById(workOrder.companyId).catch((err) => { console.warn("[email-preview] failed to load company:", err); return undefined; }) : undefined,
    workOrder?.serviceTypeId ? storage.getServiceTypeById(workOrder.serviceTypeId).catch((err) => { console.warn("[email-preview] failed to load service type:", err); return undefined; }) : undefined,
  ]);

  let rmStaff: Staff | undefined;
  let rmUserEmail: string | undefined;
  if (company?.rmStaffId) {
    rmStaff = await storage.getStaffById(company.rmStaffId).catch((err) => { console.warn("[email-preview] failed to load RM staff:", err); return undefined; });
    rmUserEmail = rmStaff?.email || undefined;
  }

  let applicantPhotoUrl: string | undefined;
  if (workOrder) {
    try {
      const docs = await storage.getWoDocuments(workOrder.id);
      const photo = docs.find((d: WoDocument) => d.documentType === "Photo" && d.fileUrl);
      if (photo?.fileUrl) {
        applicantPhotoUrl = await getPhotoAsSignedUrl(photo.fileUrl);
      }
    } catch (err) {
      console.warn("[email-preview] failed to load applicant photo:", err);
    }
  }

  let appLogoUrl: string | undefined;
  try {
    const settings = await storage.getAppSettings();
    if (settings?.logoUrl) appLogoUrl = settings.logoUrl;
  } catch (err) {
    console.warn("[email-preview] failed to load app settings:", err);
  }

  const appBaseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;

  return { workOrder, company, serviceType, center, assignedStaff, rmStaff, rmUserEmail, applicantPhotoUrl, appLogoUrl, appBaseUrl };
}

export async function loadAppointmentEmailData(params: PreviewDataParams): Promise<AppointmentEmailData> {
  const { woId, centerId, assignedStaffId, datetime, type, applicationNumber, notes, rescheduleToken, req } = params;

  const related = await loadRelatedData(woId, centerId, assignedStaffId, req);

  const appointment = {
    id: "preview",
    woId: woId || "",
    type: (type || "Medical") as "Medical" | "EID",
    isVip: false,
    datetime: datetime ? new Date(datetime as string) : new Date(),
    centerId: centerId || null,
    assignedStaffId: assignedStaffId || null,
    applicationNumber: applicationNumber || null,
    notes: notes || null,
    rescheduleToken: rescheduleToken || null,
    status: "Scheduled" as const,
    emailDraft: null,
    messageSentAt: null,
    messageSentBy: null,
    cancelReason: null,
    rescheduleReason: null,
    emailSendLog: null,
    cardViewedAt: null,
    createdAt: new Date(),
  };

  return { ...related, appointment };
}

export async function loadAppointmentEmailDataById(appointmentId: string, req: Request): Promise<AppointmentEmailData | null> {
  const appointment = await storage.getAppointmentById(appointmentId);
  if (!appointment) return null;

  const related = await loadRelatedData(
    appointment.woId,
    appointment.centerId,
    appointment.assignedStaffId,
    req,
  );

  return { ...related, appointment };
}

export function renderAppointmentEmailHtml(data: AppointmentEmailData): string {
  return buildAppointmentEmail(data);
}

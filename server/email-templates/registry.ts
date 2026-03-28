import type { Appointment, WorkOrder, Company, ServiceType, Center, Staff, DocumentCustodyRecord } from "@shared/schema";
import { buildAppointmentEmail } from "./appointment-confirmation";
import type { AppointmentEmailData } from "./appointment-confirmation";
import { buildCustodyCollectionEmail, buildCustodyReturnEmail } from "./custody-notifications";
import type { CustodyEmailData } from "./custody-notifications";

export interface EmailTemplateInfo {
  id: string;
  name: string;
  description: string;
  category: "client" | "vendor" | "crm_staff" | "pro_staff" | "admin" | "system";
  recipientLabel: string;
}

export interface EmailTemplateWithPreview extends EmailTemplateInfo {
  previewHtml: string;
}

export const EMAIL_TEMPLATE_CATEGORIES: Record<string, string> = {
  client: "Client / Company Emails",
  vendor: "Vendor Emails",
  crm_staff: "CRM Staff Emails",
  pro_staff: "PRO Staff Emails",
  admin: "Admin / Accounts Emails",
  system: "System / Transactional Emails",
};

const templates: EmailTemplateInfo[] = [
  {
    id: "medical-appointment",
    name: "Medical Appointment Confirmation",
    description: "Sent to clients when a medical examination appointment is scheduled. Includes date, time, location with maps link, assigned guide details, and calendar integration.",
    category: "client",
    recipientLabel: "Client Company",
  },
  {
    id: "eid-appointment",
    name: "EID Biometrics Appointment",
    description: "Sent to clients when an Emirates ID biometrics appointment is booked. Includes application reference, center details, on-site guide, and digital appointment card link.",
    category: "client",
    recipientLabel: "Client Company",
  },
  {
    id: "document-collection",
    name: "Document Collection Confirmation",
    description: "Sent to clients when an original document is received into custody. Shows reference number, document type, service category, and safe-keeping notice.",
    category: "client",
    recipientLabel: "Client Company",
  },
  {
    id: "document-return",
    name: "Document Ready for Collection",
    description: "Sent to clients when a document has been processed and is ready for return. Includes reference number, completion date, and collection instructions.",
    category: "client",
    recipientLabel: "Client Company",
  },
  {
    id: "vendor-job-assigned",
    name: "Vendor Job Assignment",
    description: "Notification sent to vendors when a new typing or service job is assigned to them. Contains work order details, applicant information, and deadline.",
    category: "vendor",
    recipientLabel: "Vendor",
  },
  {
    id: "vendor-job-reminder",
    name: "Vendor Job Reminder",
    description: "Follow-up reminder sent to vendors for pending jobs approaching their deadline. Highlights urgency and provides quick-action links.",
    category: "vendor",
    recipientLabel: "Vendor",
  },
  {
    id: "vendor-payment-confirmation",
    name: "Vendor Payment Confirmation",
    description: "Sent to vendors after a wallet top-up or payment is processed. Shows transaction amount, updated balance, and payment reference.",
    category: "vendor",
    recipientLabel: "Vendor",
  },
  {
    id: "crm-new-client",
    name: "New Client Assignment",
    description: "Sent to a CRM staff member when a new company is assigned to their portfolio. Includes company details and contact information.",
    category: "crm_staff",
    recipientLabel: "CRM Staff",
  },
  {
    id: "crm-wo-status-update",
    name: "Work Order Status Update",
    description: "Notification to the relationship manager when a work order changes status. Shows previous and new status with relevant details.",
    category: "crm_staff",
    recipientLabel: "CRM Staff",
  },
  {
    id: "pro-daily-schedule",
    name: "Daily Schedule Summary",
    description: "Morning summary email sent to PRO staff with their day's appointments, locations, and applicant details for efficient route planning.",
    category: "pro_staff",
    recipientLabel: "PRO Staff",
  },
  {
    id: "pro-appointment-reminder",
    name: "Appointment Reminder",
    description: "Reminder sent to assigned PRO staff before an upcoming appointment. Includes applicant details, location, and any special instructions.",
    category: "pro_staff",
    recipientLabel: "PRO Staff",
  },
  {
    id: "admin-low-balance-alert",
    name: "Low Balance Alert",
    description: "Alert sent to administrators when a vendor's wallet balance falls below the configured threshold. Includes current balance and vendor details.",
    category: "admin",
    recipientLabel: "Admin",
  },
  {
    id: "admin-new-account",
    name: "New Account Created",
    description: "Notification to administrators when a new user account is created in the system. Shows account type, assigned role, and login credentials.",
    category: "admin",
    recipientLabel: "Admin",
  },
  {
    id: "system-password-reset",
    name: "Password Reset",
    description: "Transactional email with a secure password reset link. Includes expiration time and security notice about not sharing the link.",
    category: "system",
    recipientLabel: "Any User",
  },
  {
    id: "system-login-alert",
    name: "New Login Alert",
    description: "Security notification sent when a login is detected from a new device or location. Includes IP address, browser info, and timestamp.",
    category: "system",
    recipientLabel: "Any User",
  },
  {
    id: "system-test-email",
    name: "Test Email",
    description: "Simple test email used to verify SMTP configuration and email delivery. Sent from the admin settings panel.",
    category: "system",
    recipientLabel: "Admin",
  },
];

export function getTemplateRegistry(): EmailTemplateInfo[] {
  return templates;
}

function makePreviewAppointment(overrides: Partial<Appointment> & Pick<Appointment, "id" | "woId" | "type" | "isVip" | "datetime" | "status" | "createdAt">): Appointment {
  return {
    centerId: null,
    assignedStaffId: null,
    applicationNumber: null,
    notes: null,
    rescheduleToken: null,
    emailDraft: null,
    messageSentAt: null,
    messageSentBy: null,
    ...overrides,
  };
}

function makePreviewWorkOrder(overrides: Partial<WorkOrder> & Pick<WorkOrder, "id" | "woNumber" | "applicantName" | "companyId" | "status" | "isDelayed" | "isMinor" | "isVip" | "createdAt">): WorkOrder {
  return {
    applicantPhone: null,
    applicantEmail: null,
    serviceTypeId: null,
    previousStatus: null,
    notes: null,
    createdBy: null,
    ...overrides,
  };
}

function makePreviewCompany(overrides: Partial<Company> & Pick<Company, "id" | "name" | "active">): Company {
  return {
    tradeLicenseNumber: null,
    preferredMedicalCenterId: null,
    preferredMedicalCenterVipId: null,
    preferredBiometricsCenterId: null,
    preferredBiometricsCenterVipId: null,
    clientCoordinator: null,
    clientManager: null,
    rmStaffId: null,
    assistStaffId: null,
    deliveryAddress: null,
    ...overrides,
  };
}

function makePreviewServiceType(overrides: Partial<ServiceType> & Pick<ServiceType, "id" | "name" | "active">): ServiceType {
  return {
    category: null,
    requiresMedicalTyping: false,
    requiresMedicalScheduling: false,
    requiresIdTyping2Years: false,
    requiresIdTyping1Year: false,
    requiresIdTyping10Years: false,
    requiresIdBiometrics: false,
    requiresAttestation: false,
    isDependent: false,
    ...overrides,
  };
}

function makePreviewCenter(overrides: Partial<Center> & Pick<Center, "id" | "name" | "type" | "active">): Center {
  return {
    authority: null,
    tier: "Normal",
    address: null,
    googleMapsUrl: null,
    area: null,
    timingText: null,
    timings: null,
    notes: null,
    ...overrides,
  };
}

function makePreviewStaff(overrides: Partial<Staff> & Pick<Staff, "id" | "name" | "roleTitle" | "staffType" | "status" | "active">): Staff {
  return {
    phone: null,
    email: null,
    replacementId: null,
    leaveEndDate: null,
    ...overrides,
  };
}

function makePreviewCustodyRecord(overrides: Partial<DocumentCustodyRecord> & Pick<DocumentCustodyRecord, "id" | "referenceNumber" | "companyId" | "docCategory" | "docSubtype" | "custodyStage" | "createdAt" | "updatedAt">): DocumentCustodyRecord {
  return {
    woId: null,
    srId: null,
    docCustomName: null,
    notifyEmail: null,
    notes: null,
    createdBy: null,
    ...overrides,
  };
}

function buildPlaceholderEmail(title: string, description: string, category: string): string {
  const categoryColors: Record<string, { bg: string; text: string }> = {
    client: { bg: "#f0f4ff", text: "#3b5bdb" },
    vendor: { bg: "#f0fdf4", text: "#15803d" },
    crm_staff: { bg: "#fdf4ff", text: "#86198f" },
    pro_staff: { bg: "#fff7ed", text: "#c2410c" },
    admin: { bg: "#fef2f2", text: "#b91c1c" },
    system: { bg: "#f8fafc", text: "#475569" },
  };
  const colors = categoryColors[category] || categoryColors.system;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#1d1d1f; }
    .shell { max-width:620px;margin:30px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.06); }
    .header { padding:28px 36px 20px;border-bottom:1px solid #e8e8ed; }
    .brand { font-size:13px;font-weight:600;color:#1d1d1f;letter-spacing:-0.01em; }
    .tagline { font-size:11px;color:#8e8e98;margin-top:2px; }
    .body { padding:32px 36px; }
    .badge { display:inline-block;background:${colors.bg};color:${colors.text};font-size:11px;font-weight:600;letter-spacing:0.04em;padding:4px 12px;border-radius:20px;margin-bottom:20px;text-transform:uppercase; }
    .title { font-size:22px;font-weight:600;color:#1d1d1f;letter-spacing:-0.02em;margin-bottom:8px; }
    .desc { font-size:14px;color:#6e6e77;line-height:1.7;margin-bottom:28px; }
    .placeholder-card { background:#f8f8fc;border:1px solid #e8e8ed;border-radius:14px;padding:24px;text-align:center; }
    .placeholder-icon { font-size:32px;margin-bottom:12px; }
    .placeholder-text { font-size:13px;color:#8e8e98;line-height:1.6; }
    .footer { padding:20px 36px;border-top:1px solid #e8e8ed;font-size:11px;color:#8e8e98;text-align:center; }
    @media (prefers-color-scheme: dark) {
      body { background:#000; }
      .shell { background:#1c1c1e; }
      .header, .footer { border-color:#2c2c2e; }
      .brand, .title { color:#f5f5f7; }
      .placeholder-card { background:#2c2c2e;border-color:#3a3a3c; }
    }
  </style>
</head>
<body>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="padding:24px 16px;">
    <div class="shell">
      <div class="header">
        <div class="brand">The P.R.O. Company</div>
        <div class="tagline">Everything. In Order.</div>
      </div>
      <div class="body">
        <div class="badge">${category.replace(/_/g, " ")}</div>
        <div class="title">${title}</div>
        <div class="desc">${description}</div>
        <div class="placeholder-card">
          <div class="placeholder-icon">&#9993;</div>
          <div class="placeholder-text">This is a preview template.<br>Dynamic content will be populated when the email is triggered.</div>
        </div>
      </div>
      <div class="footer">This is an automated notification from The P.R.O. Company. Please do not reply to this email.</div>
    </div>
  </td></tr>
</table>
</body>
</html>`;
}

function buildMedicalAppointmentPreview(): string {
  const now = new Date();
  const data: AppointmentEmailData = {
    appointment: makePreviewAppointment({
      id: "preview-1",
      woId: "wo-preview",
      type: "Medical",
      isVip: false,
      datetime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      status: "Scheduled",
      rescheduleToken: "preview-token",
      notes: "Please arrive 15 minutes early with original passport.",
      createdAt: now,
    }),
    workOrder: makePreviewWorkOrder({
      id: "wo-preview",
      woNumber: "WO-2026-0042",
      applicantName: "Ahmad Al-Rashidi",
      companyId: "comp-preview",
      serviceTypeId: "svc-preview",
      status: "Scheduled",
      isDelayed: false,
      isMinor: false,
      isVip: false,
      createdAt: now,
    }),
    company: makePreviewCompany({
      id: "comp-preview",
      name: "Global Trading LLC",
      active: true,
    }),
    serviceType: makePreviewServiceType({
      id: "svc-preview",
      name: "Medical Examination",
      active: true,
    }),
    center: makePreviewCenter({
      id: "center-preview",
      name: "Al Muhaisnah Health Center",
      type: "Medical",
      active: true,
      address: "Al Muhaisnah 2, Deira, Dubai",
      googleMapsUrl: "https://maps.google.com",
    }),
    assignedStaff: makePreviewStaff({
      id: "staff-preview",
      name: "Mohammed Ali",
      roleTitle: "PRO",
      staffType: "Permanent",
      status: "Active",
      active: true,
      phone: "+971 50 123 4567",
    }),
    rmStaff: makePreviewStaff({
      id: "rm-preview",
      name: "Sarah Johnson",
      roleTitle: "Client Relationship Manager",
      staffType: "Permanent",
      status: "Active",
      active: true,
      phone: "+971 50 987 6543",
      email: "sarah@procompany.ae",
    }),
    rmUserEmail: "sarah@procompany.ae",
    appBaseUrl: "https://app.procompany.ae",
  };
  return buildAppointmentEmail(data);
}

function buildEidAppointmentPreview(): string {
  const now = new Date();
  const data: AppointmentEmailData = {
    appointment: makePreviewAppointment({
      id: "preview-2",
      woId: "wo-preview-2",
      type: "EID",
      isVip: false,
      datetime: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      status: "Scheduled",
      rescheduleToken: "preview-token-2",
      applicationNumber: "201-2026-1234567-8",
      createdAt: now,
    }),
    workOrder: makePreviewWorkOrder({
      id: "wo-preview-2",
      woNumber: "WO-2026-0058",
      applicantName: "Fatima Hassan",
      companyId: "comp-preview-2",
      serviceTypeId: "svc-preview-2",
      status: "Scheduled",
      isDelayed: false,
      isMinor: false,
      isVip: false,
      createdAt: now,
    }),
    company: makePreviewCompany({
      id: "comp-preview-2",
      name: "Emirates Construction Group",
      active: true,
    }),
    serviceType: makePreviewServiceType({
      id: "svc-preview-2",
      name: "Emirates ID Biometrics",
      active: true,
    }),
    center: makePreviewCenter({
      id: "center-preview-2",
      name: "Tasheel Service Center — Al Barsha",
      type: "EID",
      active: true,
      address: "Al Barsha 1, Sheikh Zayed Road, Dubai",
      googleMapsUrl: "https://maps.google.com",
    }),
    assignedStaff: makePreviewStaff({
      id: "staff-preview-2",
      name: "Omar Khalil",
      roleTitle: "PRO",
      staffType: "Permanent",
      status: "Active",
      active: true,
      phone: "+971 55 111 2233",
    }),
    rmStaff: makePreviewStaff({
      id: "rm-preview-2",
      name: "Aisha Rahman",
      roleTitle: "Client Relationship Manager",
      staffType: "Permanent",
      status: "Active",
      active: true,
      phone: "+971 50 555 6677",
      email: "aisha@procompany.ae",
    }),
    rmUserEmail: "aisha@procompany.ae",
    appBaseUrl: "https://app.procompany.ae",
  };
  return buildAppointmentEmail(data);
}

function buildDocumentCollectionPreview(): string {
  const now = new Date();
  const data: CustodyEmailData = {
    record: makePreviewCustodyRecord({
      id: "preview-coll",
      companyId: "comp-preview",
      referenceNumber: "DOC-2026-0015",
      docCategory: "MofaPersonal",
      docSubtype: "BirthCertificate",
      custodyStage: "WithUs",
      createdAt: now,
      updatedAt: now,
    }),
    companyName: "Global Trading LLC",
  };
  return buildCustodyCollectionEmail(data);
}

function buildDocumentReturnPreview(): string {
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const data: CustodyEmailData = {
    record: makePreviewCustodyRecord({
      id: "preview-ret",
      companyId: "comp-preview",
      referenceNumber: "DOC-2026-0015",
      docCategory: "MofaPersonal",
      docSubtype: "BirthCertificate",
      custodyStage: "ReturnedToClient",
      createdAt: twoWeeksAgo,
      updatedAt: now,
    }),
    companyName: "Global Trading LLC",
  };
  return buildCustodyReturnEmail(data);
}

export function buildTemplatePreview(templateId: string): string {
  switch (templateId) {
    case "medical-appointment":
      return buildMedicalAppointmentPreview();
    case "eid-appointment":
      return buildEidAppointmentPreview();
    case "document-collection":
      return buildDocumentCollectionPreview();
    case "document-return":
      return buildDocumentReturnPreview();
    default: {
      const template = templates.find(t => t.id === templateId);
      if (!template) return buildPlaceholderEmail("Unknown Template", "", "system");
      return buildPlaceholderEmail(template.name, template.description, template.category);
    }
  }
}

export function getTemplatesWithPreviews(): EmailTemplateWithPreview[] {
  return templates.map(t => ({
    ...t,
    previewHtml: buildTemplatePreview(t.id),
  }));
}

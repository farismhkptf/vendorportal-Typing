import type {
  TypingJob, WorkOrder, JobType,
  TypingJobComment, File as FileType, TypingJobResult, WoDocument, DocumentRequirement
} from "@shared/schema";

export interface EidCenter {
  id: string;
  name: string;
  area: string | null;
  tier: string | null;
}

export interface VendorJobDetails extends TypingJob {
  workOrder?: WorkOrder;
  jobType?: JobType;
  comments?: TypingJobComment[];
  files?: FileType[];
  results?: TypingJobResult;
  company?: { id: string; name: string; deliveryAddress?: string | null; coordinatorMobile?: string | null; coordinatorEmail?: string | null };
  serviceType?: { id: string; name: string; category?: string | null };
  documentRequirements?: DocumentRequirement[];
  woDocuments?: WoDocument[];
  priority?: "urgent" | "today" | "standard";
  sentByStaffName?: string | null;
  preferredCenter?: { id: string; name: string; area?: string | null; type?: string | null; tier?: string | null } | null;
  companyContacts?: {
    coordinator?: { name: string; email: string; mobile: string } | null;
    manager?: { name: string; email: string; mobile: string } | null;
    accountant?: { name: string; email: string; mobile: string } | null;
  } | null;
  eidCenters?: EidCenter[];
  approval?: {
    id: string;
    status: string;
    calculatedAmount: number;
    adjustedAmount?: number | null;
    rejectedReason?: string | null;
    createdAt: string;
    resolvedAt?: string | null;
  };
}

export type WizardStep = 1 | 2 | 3;

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  PassportCopy: "Passport Copy",
  Photo: "Photo",
  EntryPermit: "Entry Permit",
  ChangeStatus: "Change Status",
  CurrentResidency: "Current Residency Visa",
  OldResidencyOrId: "Old Residency / Emirates ID",
  CurrentEmiratesId: "Current Emirates ID",
  SponsorEmiratesId: "Sponsor Emirates ID",
  BirthCertificate: "Birth Certificate",
  LostEmiratesId: "Lost Emirates ID Report",
};

export function toProperCase(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

export function getActiveStep(status: string): WizardStep {
  switch (status) {
    case "SubmittedToVendor": return 2;
    case "InProcess": return 3;
    case "ReadyForScheduling":
    case "Returned": return 3;
    default: return 1;
  }
}

export function getStepState(step: WizardStep, activeStep: WizardStep, status: string): "completed" | "active" | "locked" {
  const terminalStatuses = ["ReadyForScheduling", "Returned", "Aborted", "Rejected", "OnHold"];
  if (terminalStatuses.includes(status)) return "completed";
  if (step < activeStep) return "completed";
  if (step === activeStep) return "active";
  return "locked";
}

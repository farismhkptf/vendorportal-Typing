import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  FileText, User, Clock, Calendar, 
  Upload, Download, MessageSquare, Send, CheckCircle2,
  Building2, Briefcase, Phone, Mail, MapPin, AlertTriangle,
  Shield, FileCheck, RotateCcw, XCircle, Zap, Stethoscope,
  ChevronRight, Check, Eye, Loader2, X, UserCheck, MapPinned
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { EnhancedUploader } from "@/components/enhanced-uploader";
import { ImageLightbox, type LightboxFile } from "@/components/image-lightbox";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import emiratesIdSample from "@assets/image_1771501559423.png";
import dhaLogo from "@assets/dha-logo.svg";
import type { 
  TypingJob, WorkOrder, JobType, 
  TypingJobComment, File as FileType, TypingJobResult, WoDocument, DocumentRequirement
} from "@shared/schema";

interface EidCenter {
  id: string;
  name: string;
  area: string | null;
  tier: string | null;
}

interface VendorJobDetails extends TypingJob {
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

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
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

type WizardStep = 1 | 2 | 3;

function toProperCase(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function formatSentDateTime(sentAt: string | null | undefined): { date: string; time: string } {
  if (!sentAt) return { date: "Not sent", time: "" };
  const d = new Date(sentAt);
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });
  return { date, time };
}

function getActiveStep(status: string): WizardStep {
  switch (status) {
    case "SubmittedToVendor": return 2;
    case "InProcess": return 3;
    case "ReadyForScheduling":
    case "Returned": return 3;
    default: return 1;
  }
}

function getStepState(step: WizardStep, activeStep: WizardStep, status: string): "completed" | "active" | "locked" {
  const terminalStatuses = ["ReadyForScheduling", "Returned", "Aborted", "Rejected", "OnHold"];
  if (terminalStatuses.includes(status)) return "completed";
  if (step < activeStep) return "completed";
  if (step === activeStep) return "active";
  return "locked";
}

const STEPS = [
  { num: 1 as WizardStep, label: "Job Overview", shortLabel: "Overview", icon: Eye },
  { num: 2 as WizardStep, label: "Documents", shortLabel: "Docs", icon: FileCheck },
  { num: 3 as WizardStep, label: "Complete & Submit", shortLabel: "Done", icon: CheckCircle2 },
];

function formatJobTypeName(name: string) {
  const match = name.match(/^(.*?)(\d+\s*(?:YEAR|Year|year)s?)(.*)$/i);
  if (!match) return <span>{name}</span>;
  return (
    <span>
      {match[1]}
      <span className="font-bold text-foreground">{match[2]}</span>
      {match[3]}
    </span>
  );
}

function StepperBar({ 
  activeStep, viewStep, onStepClick, jobStatus 
}: { 
  activeStep: WizardStep; viewStep: WizardStep; onStepClick: (step: WizardStep) => void; jobStatus: string;
}) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 w-full" data-testid="wizard-stepper">
      {STEPS.map((step, idx) => {
        const state = getStepState(step.num, activeStep, jobStatus);
        const isViewing = viewStep === step.num;
        const canClick = state === "completed" || state === "active";
        const Icon = step.icon;
        return (
          <div key={step.num} className="flex items-center flex-1 min-w-0">
            <button
              onClick={() => canClick && onStepClick(step.num)}
              disabled={!canClick}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-md w-full transition-colors min-w-0",
                isViewing && state === "active" && "bg-primary/10 border border-primary/30",
                isViewing && state === "completed" && "bg-emerald-500/10 border border-emerald-500/30",
                !isViewing && canClick && "hover-elevate",
                !canClick && "opacity-40 cursor-not-allowed"
              )}
              data-testid={`button-step-${step.num}`}
            >
              <div className={cn(
                "h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold",
                state === "completed" && "bg-emerald-500 text-white",
                state === "active" && isViewing && "bg-primary text-primary-foreground",
                state === "active" && !isViewing && "bg-primary/20 text-primary",
                state === "locked" && "bg-muted text-muted-foreground"
              )}>
                {state === "completed" ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <div className="min-w-0 text-left hidden sm:block">
                <p className={cn(
                  "text-xs font-medium truncate",
                  state === "completed" && "text-emerald-600 dark:text-emerald-400",
                  state === "active" && "text-foreground",
                  state === "locked" && "text-muted-foreground"
                )}>{step.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {state === "completed" ? "Done" : state === "active" ? "Current" : "Pending"}
                </p>
              </div>
              <span className={cn(
                "text-xs font-medium sm:hidden truncate",
                state === "completed" && "text-emerald-600 dark:text-emerald-400",
                state === "active" && "text-foreground",
                state === "locked" && "text-muted-foreground"
              )}>{step.shortLabel}</span>
            </button>
            {idx < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mx-0.5" />}
          </div>
        );
      })}
    </div>
  );
}

function StepOverview({ job }: { job: VendorJobDetails }) {
  const isEid = job.jobType?.category === "EID";
  const isMedical = job.jobType?.category === "Medical";
  const isVip = job.workOrder?.isVip;
  const sent = formatSentDateTime(job.sentAt ? String(job.sentAt) : null);
  const applicantPhoto = job.woDocuments?.find(d => d.documentType === "Photo" && d.fileUrl);

  return (
    <div className="space-y-5" data-testid="step-overview">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {applicantPhoto ? (
            <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-border shrink-0">
              <img src={applicantPhoto.fileUrl} alt="Applicant" className="h-full w-full object-cover" data-testid="img-applicant-photo" />
            </div>
          ) : (
            <div className={cn(
              "h-12 w-12 rounded-full flex items-center justify-center shrink-0",
              isVip ? "bg-amber-100 dark:bg-amber-900/30" : isEid ? "bg-amber-50 dark:bg-amber-900/20" : "bg-blue-50 dark:bg-blue-900/20"
            )}>
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold tracking-tight" data-testid="text-wo-number">{job.workOrder?.woNumber || "N/A"}</h2>
              <StatusBadge status={job.status} vendorContext />
              {isEid && (
                <div className="flex items-center gap-1.5">
                  <img src={emiratesIdSample} alt="EID" className="h-5 w-8 rounded-sm object-cover object-top border border-border/30" data-testid="img-eid-tile" />
                </div>
              )}
              {isMedical && (
                <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  Medical
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Work order details and applicant information
            </p>
          </div>
        </div>

        {job.sentAt && (
          <div className="text-right shrink-0 hidden sm:block">
            <p className="text-xs text-muted-foreground">Received</p>
            <p className="text-sm font-medium" data-testid="text-sent-date">{sent.date}</p>
            <p className="text-xs text-muted-foreground">{sent.time}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Client Company</p>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium" data-testid="text-company-name">{toProperCase(job.company?.name)}</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Applicant Name</p>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium" data-testid="text-applicant-name">{toProperCase(job.workOrder?.applicantName)}</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Service Type</p>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium" data-testid="text-service-type">{toProperCase(job.serviceType?.name)}</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Job Type</p>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-base font-bold tracking-tight" data-testid="text-job-type">
              {job.jobType ? formatJobTypeName(job.jobType.name) : "N/A"}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Contact Information</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {job.workOrder?.applicantPhone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground shrink-0">Applicant Mobile:</span>
              <span className="font-medium" data-testid="text-applicant-phone">{job.workOrder.applicantPhone}</span>
            </div>
          )}
          {job.workOrder?.applicantEmail && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground shrink-0">Applicant Email:</span>
              <span className="font-medium truncate" data-testid="text-applicant-email">{job.workOrder.applicantEmail}</span>
            </div>
          )}
          {job.company?.coordinatorMobile && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground shrink-0">Company Mobile:</span>
              <span className="font-medium" data-testid="text-company-mobile">{job.company.coordinatorMobile}</span>
            </div>
          )}
          {job.company?.coordinatorEmail && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground shrink-0">Client Email:</span>
              <span className="font-medium truncate" data-testid="text-client-email">{job.company.coordinatorEmail}</span>
            </div>
          )}
        </div>
      </div>

      {isEid && job.company?.deliveryAddress && (
        <div className="flex items-start gap-2 text-sm p-3 rounded-md bg-muted/50 border">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Delivery Address</p>
            <p className="font-medium" data-testid="text-delivery-address">{job.company.deliveryAddress}</p>
          </div>
        </div>
      )}

      {job.preferredCenter && (
        <div className="flex items-start gap-2 text-sm p-3 rounded-md bg-muted/50 border">
          <MapPinned className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">
              {isMedical ? "Preferred Medical Center" : "Preferred Biometrics Center"}
            </p>
            <p className="font-medium" data-testid="text-preferred-center">
              {job.preferredCenter.name}
              {job.preferredCenter.area && <span className="text-muted-foreground font-normal"> - {job.preferredCenter.area}</span>}
            </p>
          </div>
        </div>
      )}

      {job.sentByStaffName && (
        <div className="flex items-center gap-2 text-sm">
          <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Sent by:</span>
          <span className="font-medium" data-testid="text-sent-by">{toProperCase(job.sentByStaffName)}</span>
        </div>
      )}

      {job.sentAt && (
        <div className="flex items-center gap-2 text-sm sm:hidden">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Received:</span>
          <span className="font-medium">{sent.date} at {sent.time}</span>
        </div>
      )}

      {job.workOrder?.notes && (
        <div className="p-3 rounded-md bg-muted/50 border">
          <p className="text-xs text-muted-foreground mb-1">Special Instructions</p>
          <p className="text-sm">{job.workOrder.notes}</p>
        </div>
      )}

      {isMedical && (
        <div className="flex items-center gap-2">
          <img
            src={dhaLogo}
            alt="Dubai Health Authority"
            className="h-7 w-auto object-contain"
            data-testid="img-dha-logo"
          />
        </div>
      )}
    </div>
  );
}

function StepDocuments({ 
  job, onStartWork, onResubmit, isStarting, inputFiles, openLightbox,
}: { 
  job: VendorJobDetails; onStartWork: () => void; onResubmit: () => void;
  isStarting: boolean; inputFiles: FileType[]; openLightbox: (files: FileType[], index: number) => void;
}) {
  const filteredRequirements = useMemo(() => {
    if (!job.documentRequirements) return [];
    return job.documentRequirements.filter(req => {
      if (job.jobType?.category === "Medical" && !req.appliesToMedical) return false;
      if (job.jobType?.category === "EID" && !req.appliesToEid) return false;
      return true;
    });
  }, [job.documentRequirements, job.jobType?.category]);

  const allRequiredUploaded = useMemo(() => {
    return filteredRequirements.filter(r => r.isRequired).every(r => job.woDocuments?.some(d => d.documentType === r.documentType));
  }, [filteredRequirements, job.woDocuments]);

  const isSentToVendor = job.status === "SubmittedToVendor";

  const allDownloadableFiles = useMemo(() => {
    const docs: { url: string; name: string }[] = [];
    job.woDocuments?.forEach(d => { if (d.fileUrl) docs.push({ url: d.fileUrl, name: d.fileName }); });
    inputFiles.forEach(f => { if (f.workdriveLink) docs.push({ url: f.workdriveLink, name: f.fileName || "document" }); });
    return docs;
  }, [job.woDocuments, inputFiles]);

  const handleDownloadAll = () => {
    allDownloadableFiles.forEach((file, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = file.url; a.download = file.name; a.target = "_blank"; a.rel = "noopener noreferrer";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }, i * 300);
    });
  };

  return (
    <div className="space-y-4" data-testid="step-documents">
      <p className="text-sm text-muted-foreground">
        Review the applicant's uploaded documents below. Verify all required documents are present and correct before proceeding.
      </p>

      {allDownloadableFiles.length > 1 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleDownloadAll} className="gap-2" data-testid="button-download-all">
            <Download className="h-4 w-4" /> Download All ({allDownloadableFiles.length})
          </Button>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <FileCheck className="h-4 w-4" /> Document Checklist
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Green checkmarks indicate documents that have been uploaded. Review each one carefully.
        </p>
        <div className="space-y-2">
          {filteredRequirements.map(req => {
            const uploaded = job.woDocuments?.find(d => d.documentType === req.documentType);
            const docLabel = DOCUMENT_TYPE_LABELS[req.documentType] || req.documentType;
            const docUrl = uploaded?.fileUrl || "";
            const isImage = uploaded?.mimeType?.startsWith("image/");
            return (
              <div key={req.id} className="p-3 rounded-md bg-muted/50" data-testid={`doc-req-${req.documentType}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {uploaded ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <Clock className="h-4 w-4 text-amber-500 shrink-0" />}
                    <span className="text-sm font-medium truncate">{docLabel}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {req.isRequired ? <Badge variant="secondary" className="text-xs">Required</Badge> : <Badge variant="outline" className="text-xs">Optional</Badge>}
                    {uploaded && <Badge variant="secondary" className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">Uploaded</Badge>}
                  </div>
                </div>
                {uploaded && docUrl && (
                  <a href={docUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-3 p-2 rounded-md hover-elevate cursor-pointer" data-testid={`doc-preview-${req.documentType}`}>
                    {isImage ? (
                      <img src={docUrl} alt={uploaded.fileName} className="h-12 w-12 rounded object-cover border shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded border flex items-center justify-center bg-red-50 dark:bg-red-900/20 shrink-0"><FileText className="h-6 w-6 text-red-500" /></div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{uploaded.fileName}</p>
                      <p className="text-xs text-muted-foreground">{uploaded.fileSize ? `${(uploaded.fileSize / 1024).toFixed(1)} KB` : "View document"}</p>
                    </div>
                    <Download className="h-4 w-4 text-muted-foreground shrink-0" />
                  </a>
                )}
              </div>
            );
          })}
          {filteredRequirements.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No document requirements for this service type.</p>
          )}
        </div>
      </div>

      {inputFiles.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Download className="h-4 w-4" /> Additional Input Documents
          </h3>
          <p className="text-xs text-muted-foreground mb-3">These additional files were provided by the company for this job.</p>
          <div className="space-y-2">
            {inputFiles.map((file) => {
              const fileUrl = file.workdriveLink || "";
              const isImage = file.fileName?.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
              const isPdf = file.fileName?.match(/\.pdf$/i);
              const filesWithUrls = inputFiles.filter(f => f.workdriveLink);
              const lbIndex = filesWithUrls.findIndex(f => f.id === file.id);
              return (
                <div key={file.id} className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/50" data-testid={`input-file-${file.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    {isImage && fileUrl ? (
                      <div className="h-10 w-10 rounded border overflow-hidden flex-shrink-0 bg-muted cursor-pointer" onClick={() => openLightbox(filesWithUrls, Math.max(0, lbIndex))} data-testid={`preview-input-${file.id}`}>
                        <img src={fileUrl} alt={file.fileName} className="h-full w-full object-cover" />
                      </div>
                    ) : isPdf && fileUrl ? (
                      <div className="h-10 w-10 rounded border flex items-center justify-center flex-shrink-0 bg-muted cursor-pointer" onClick={() => openLightbox(filesWithUrls, Math.max(0, lbIndex))} data-testid={`preview-input-${file.id}`}>
                        <FileText className="h-5 w-5 text-red-500" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded border flex items-center justify-center flex-shrink-0 bg-muted"><FileText className="h-5 w-5 text-muted-foreground" /></div>
                    )}
                    <span className="text-sm font-medium truncate">{file.fileName}</span>
                  </div>
                  {fileUrl && (
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="gap-1 shrink-0"><Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">Download</span></Button>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isSentToVendor && (
        <div className="pt-4 border-t space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={onStartWork} disabled={isStarting} className="gap-2 flex-1 sm:flex-initial" data-testid="button-start-work">
              {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {isStarting ? "Starting..." : "Start Work"}
            </Button>
            <Button variant="outline" onClick={onResubmit} className="gap-2 flex-1 sm:flex-initial" data-testid="button-resubmission">
              <RotateCcw className="h-4 w-4" /> Request Resubmission
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepComplete({
  job, appRefNo, setAppRefNo, bioRequired, setBioRequired, bioDate, setBioDate,
  bioTime, setBioTime, bioCenter, setBioCenter, bioNotes, setBioNotes,
  onSaveBiometrics, isSavingBio, onComplete, isCompleting, onResubmit,
  outputFiles, onUploadComplete, onDeleteFile, openLightbox,
}: {
  job: VendorJobDetails; appRefNo: string; setAppRefNo: (v: string) => void;
  bioRequired: boolean; setBioRequired: (v: boolean) => void;
  bioDate: string; setBioDate: (v: string) => void; bioTime: string; setBioTime: (v: string) => void;
  bioCenter: string; setBioCenter: (v: string) => void; bioNotes: string; setBioNotes: (v: string) => void;
  onSaveBiometrics: () => void; isSavingBio: boolean; onComplete: () => void; isCompleting: boolean;
  onResubmit: () => void; outputFiles: FileType[];
  onUploadComplete: (file: { fileName: string; objectPath: string }) => void;
  onDeleteFile: (fileId: string) => void;
  openLightbox: (files: FileType[], index: number) => void;
}) {
  const isEid = job.jobType?.category === "EID";
  const isMedical = job.jobType?.category === "Medical";
  const isInProgress = job.status === "InProcess";
  const isTerminal = ["ReadyForScheduling", "Returned", "Aborted", "Rejected", "OnHold"].includes(job.status);
  const isVip = job.workOrder?.isVip;

  const eidCentersFiltered = useMemo(() => {
    if (!job.eidCenters) return [];
    if (isVip) return job.eidCenters.filter(c => c.tier === "VIP");
    return job.eidCenters.filter(c => c.tier === "Normal" || !c.tier);
  }, [job.eidCenters, isVip]);

  useEffect(() => {
    if (isEid && !bioCenter && job.preferredCenter) {
      setBioCenter(job.preferredCenter.id);
    }
  }, [isEid, job.preferredCenter]);

  return (
    <div className="space-y-5" data-testid="step-complete">
      <p className="text-sm text-muted-foreground">
        {isTerminal
          ? "This job has been finalized. Review the submission details below."
          : "Complete the fields below, upload your finished work, and submit when ready. Make sure all information is accurate before submitting."}
      </p>

      {isTerminal && (
        <div className={cn(
          "p-4 rounded-md border",
          job.status === "ReadyForScheduling" || job.status === "Returned"
            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30"
            : "bg-muted/50"
        )}>
          <div className="flex items-start gap-3">
            {job.status === "ReadyForScheduling" || job.status === "Returned" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium">
                {job.status === "ReadyForScheduling" ? "Job Completed" :
                 job.status === "Returned" ? "Job Completed" :
                 job.status === "Aborted" ? "Job Aborted" :
                 job.status === "Rejected" ? "Job Rejected" :
                 job.status === "OnHold" ? "Job On Hold" : "Job Status: " + job.status}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {job.status === "ReadyForScheduling" ? "Your work has been submitted. The cost has been deducted from your wallet." :
                 job.status === "Returned" ? "Your work has been submitted. The cost has been deducted from your wallet." :
                 "No further actions required at this time."}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Application Reference Number</h3>
        <p className="text-xs text-muted-foreground">Enter the application reference number issued after submission.</p>
        <Input value={appRefNo} onChange={(e) => setAppRefNo(e.target.value)} placeholder="e.g. 201-2024-1234567" disabled={isTerminal} data-testid="input-app-ref" />
      </div>

      {isMedical && job.preferredCenter && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2"><MapPinned className="h-4 w-4" /> Medical Center</h3>
          <p className="text-xs text-muted-foreground">The designated medical center for this applicant.</p>
          <div className="p-3 rounded-md bg-muted/50 border">
            <p className="text-sm font-medium" data-testid="text-medical-center">{job.preferredCenter.name}</p>
            {job.preferredCenter.area && <p className="text-xs text-muted-foreground">{job.preferredCenter.area}</p>}
          </div>
        </div>
      )}

      {isEid && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Shield className="h-4 w-4" /> Biometrics Details</h3>
          <p className="text-xs text-muted-foreground">If this applicant requires a biometrics appointment, fill in the details below.</p>
          <div className="flex items-center gap-2">
            <Checkbox id="bio-required" checked={bioRequired} onCheckedChange={(checked) => setBioRequired(!!checked)} disabled={isTerminal} data-testid="checkbox-biometrics-required" />
            <label htmlFor="bio-required" className="text-sm font-medium">Biometrics appointment required</label>
          </div>
          {bioRequired && (
            <div className="space-y-3 pl-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Date</label>
                  <Input type="date" value={bioDate} onChange={(e) => setBioDate(e.target.value)} disabled={isTerminal} data-testid="input-bio-date" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Time</label>
                  <Input type="time" value={bioTime} onChange={(e) => setBioTime(e.target.value)} disabled={isTerminal} data-testid="input-bio-time" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">EID Center</label>
                {eidCentersFiltered.length > 0 ? (
                  <Select value={bioCenter} onValueChange={setBioCenter} disabled={isTerminal}>
                    <SelectTrigger data-testid="select-bio-center">
                      <SelectValue placeholder="Select a center..." />
                    </SelectTrigger>
                    <SelectContent>
                      {eidCentersFiltered.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{c.area ? ` - ${c.area}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={bioCenter} onChange={(e) => setBioCenter(e.target.value)} placeholder="EID center name" disabled={isTerminal} data-testid="input-bio-center" />
                )}
              </div>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Additional Notes</label>
            <Textarea value={bioNotes} onChange={(e) => setBioNotes(e.target.value)} placeholder="Any relevant notes about biometrics or the application..." className="min-h-16 resize-none" disabled={isTerminal} data-testid="input-bio-notes" />
          </div>
          {!isTerminal && (
            <Button variant="outline" onClick={onSaveBiometrics} disabled={isSavingBio} className="gap-2" data-testid="button-save-biometrics">
              {isSavingBio ? "Saving..." : "Save Biometrics"}
            </Button>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Upload className="h-4 w-4" /> Upload Completed Work</h3>
        <p className="text-xs text-muted-foreground">Upload the completed application documents. You can upload up to 5 files.</p>
        <EnhancedUploader
          existingFiles={outputFiles.map(f => ({
            id: f.id, fileName: f.fileName || "File",
            fileUrl: f.workdriveLink || undefined, mimeType: f.mimeType,
            createdAt: f.createdAt ? String(f.createdAt) : undefined,
          }))}
          onUploadComplete={onUploadComplete}
          onDelete={onDeleteFile}
          maxFiles={5}
          disabled={isTerminal}
          onPreviewFile={(file) => {
            if (file.fileUrl) {
              const idx = outputFiles.findIndex(f => f.id === file.id);
              openLightbox(outputFiles, idx >= 0 ? idx : 0);
            }
          }}
        />
      </div>

      {isInProgress && (
        <div className="pt-4 border-t space-y-3">
          <p className="text-sm text-muted-foreground">
            When you're finished, click "Mark as Completed" to finalize. The cost will be deducted from your wallet automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={onComplete} disabled={isCompleting} className="gap-2 flex-1 sm:flex-initial" data-testid="button-complete-job">
              {isCompleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {isCompleting ? "Submitting..." : "Mark as Completed"}
            </Button>
            <Button variant="outline" onClick={onResubmit} className="gap-2 flex-1 sm:flex-initial" data-testid="button-resubmission-step3">
              <RotateCcw className="h-4 w-4" /> Request Resubmission
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function JobWizardDialog({
  jobId,
  open,
  onClose,
}: {
  jobId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [showResubmissionDialog, setShowResubmissionDialog] = useState(false);
  const [resubmissionDocs, setResubmissionDocs] = useState<string[]>([]);
  const [resubmissionRemarks, setResubmissionRemarks] = useState("");
  const [resubmissionScreenshotUrl, setResubmissionScreenshotUrl] = useState("");
  const [resubmissionScreenshotName, setResubmissionScreenshotName] = useState("");
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [bioRequired, setBioRequired] = useState(false);
  const [bioDate, setBioDate] = useState("");
  const [bioTime, setBioTime] = useState("");
  const [bioCenter, setBioCenter] = useState("");
  const [bioNotes, setBioNotes] = useState("");
  const [appRefNo, setAppRefNo] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxFiles, setLightboxFiles] = useState<LightboxFile[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [viewStep, setViewStep] = useState<WizardStep>(1);

  const { data: job, isLoading } = useQuery<VendorJobDetails>({
    queryKey: ["/api/vendor/jobs", jobId],
    enabled: !!jobId && open,
  });

  const activeStep = job ? getActiveStep(job.status) : 1;
  const isVip = job?.workOrder?.isVip;
  const isUrgent = job?.urgent;
  const isEid = job?.jobType?.category === "EID";

  useEffect(() => {
    if (job) setViewStep(1);
  }, [job?.id]);

  useEffect(() => {
    if (job?.results) {
      setBioRequired(!!job.results.biometricsRequired);
      if (job.results.biometricsDatetime) {
        const dt = new Date(job.results.biometricsDatetime);
        setBioDate(dt.toISOString().split('T')[0]);
        setBioTime(dt.toTimeString().substring(0, 5));
      }
      setBioCenter(job.results.biometricsCenter || "");
      setBioNotes(job.results.vendorNotes || "");
      setAppRefNo(job.results.applicationRefNo || "");
    }
  }, [job?.results]);

  const saveFileMutation = useMutation({
    mutationFn: async (data: { fileName: string; objectPath: string }) => apiRequest("POST", `/api/vendor/jobs/${jobId}/files`, { fileName: data.fileName, objectPath: data.objectPath }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", jobId] }); toast({ title: "File uploaded successfully" }); },
    onError: () => { toast({ title: "Failed to save file", variant: "destructive" }); },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => apiRequest("DELETE", `/api/vendor/jobs/${jobId}/files/${fileId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", jobId] }); toast({ title: "File deleted" }); },
    onError: () => { toast({ title: "Failed to delete file", variant: "destructive" }); },
  });

  const openLightbox = (files: (FileType | { id: string; fileName: string; fileUrl: string; mimeType: string | null })[], index: number) => {
    const lbFiles: LightboxFile[] = files.filter(f => {
      const url = "workdriveLink" in f ? f.workdriveLink : "fileUrl" in f ? f.fileUrl : "";
      return !!url;
    }).map(f => ({
      id: f.id, fileName: f.fileName || "File",
      fileUrl: ("workdriveLink" in f ? f.workdriveLink : "fileUrl" in f ? f.fileUrl : "") || "",
      mimeType: f.mimeType || null,
    }));
    setLightboxFiles(lbFiles);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const addCommentMutation = useMutation({
    mutationFn: async (message: string) => apiRequest("POST", `/api/vendor/jobs/${jobId}/comments`, { message }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", jobId] }); setNewComment(""); toast({ title: "Comment added" }); },
    onError: () => { toast({ title: "Failed to add comment", variant: "destructive" }); },
  });

  const startWorkMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/vendor/jobs/${jobId}/start-work`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/dashboard"] });
      toast({ title: "Work started — you can now begin typing" });
    },
    onError: (error: Error) => { toast({ title: error.message || "Failed to start work", variant: "destructive" }); },
  });

  const completeMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/vendor/jobs/${jobId}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/dashboard"] });
      toast({ title: "Job marked as completed", description: "Cost has been deducted from your wallet." });
    },
    onError: (error: Error) => { toast({ title: error.message || "Failed to complete job", variant: "destructive" }); },
  });

  const resubmissionMutation = useMutation({
    mutationFn: async (data: { documentTypes: string[]; remarks: string; screenshotUrl?: string; screenshotName?: string }) => apiRequest("POST", `/api/vendor/jobs/${jobId}/resubmission`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs"] });
      setShowResubmissionDialog(false);
      setResubmissionDocs([]); setResubmissionRemarks(""); setResubmissionScreenshotUrl(""); setResubmissionScreenshotName("");
      toast({ title: "Resubmission request sent" });
    },
    onError: (error: Error) => { toast({ title: error.message || "Failed to send resubmission request", variant: "destructive" }); },
  });

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingScreenshot(true);
    try {
      const res = await fetch("/api/uploads/request-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      const data = await res.json();
      await fetch(data.uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      setResubmissionScreenshotUrl(data.objectPath);
      setResubmissionScreenshotName(file.name);
    } catch {
      toast({ title: "Failed to upload screenshot", variant: "destructive" });
    } finally {
      setUploadingScreenshot(false);
    }
  };


  const biometricsMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("PUT", `/api/vendor/jobs/${jobId}/biometrics`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", jobId] }); toast({ title: "Biometrics data saved" }); },
    onError: () => { toast({ title: "Failed to save biometrics data", variant: "destructive" }); },
  });

  const handleSubmitComment = () => {
    if (newComment.trim()) addCommentMutation.mutate(newComment.trim());
  };

  const inputFiles = job?.files?.filter(f => f.direction === "Input") || [];
  const outputFiles = job?.files?.filter(f => f.direction === "Output") || [];

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className={cn(
          "max-w-3xl p-0 flex flex-col",
          "max-h-[90vh] overflow-hidden",
          isVip && "border-amber-400/60 dark:border-amber-500/40"
        )}>
          {isVip && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 rounded-t-md" />
          )}

          {isUrgent && (
            <div className="absolute top-4 right-16 z-10 pointer-events-none select-none" data-testid="urgent-sticker">
              <div className="bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-sm shadow-lg" style={{ transform: "rotate(-12deg)" }}>
                Urgent
              </div>
            </div>
          )}

          <div className={cn("px-6 pt-5 pb-3 shrink-0", isVip && "bg-gradient-to-b from-amber-50/30 to-transparent dark:from-amber-900/10")}>
            <div className="flex items-start justify-between mb-4 gap-3">
              <div className="flex items-start gap-2 min-w-0">
                {isEid ? <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" /> : <Stethoscope className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-bold leading-tight flex items-center gap-2 flex-wrap">
                    <span data-testid="dialog-wo-number">{job?.workOrder?.woNumber || "Job Wizard"}</span>
                    {isVip && (
                      <Badge className="no-default-hover-elevate no-default-active-elevate bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 border-amber-400 text-[10px]">
                        VIP
                      </Badge>
                    )}
                  </DialogTitle>
                  {job?.workOrder?.applicantName && (
                    <p className="text-sm text-muted-foreground mt-0.5 truncate" data-testid="dialog-applicant-name">
                      {toProperCase(job.workOrder.applicantName)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowComments(!showComments)} data-testid="button-toggle-comments">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Comments</span>
                  {job?.comments && job.comments.length > 0 && <Badge variant="secondary" className="text-xs">{job.comments.length}</Badge>}
                </Button>
              </div>
            </div>
            <DialogDescription className="sr-only">Job wizard for processing vendor job</DialogDescription>

            {isLoading ? (
              <div className="space-y-4 pb-6">
                <Skeleton className="h-12 rounded-md" />
                <Skeleton className="h-48 rounded-md" />
              </div>
            ) : job ? (
              <>
                <StepperBar activeStep={activeStep} viewStep={viewStep} onStepClick={setViewStep} jobStatus={job.status} />
              </>
            ) : null}
          </div>

          {job && (
            <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
              {viewStep === 1 && <StepOverview job={job} />}
              {viewStep === 2 && (
                <StepDocuments
                  job={job} onStartWork={() => startWorkMutation.mutate()} onResubmit={() => setShowResubmissionDialog(true)}
                  isStarting={startWorkMutation.isPending}
                  inputFiles={inputFiles} openLightbox={openLightbox}
                />
              )}
              {viewStep === 3 && (
                <StepComplete
                  job={job} appRefNo={appRefNo} setAppRefNo={setAppRefNo}
                  bioRequired={bioRequired} setBioRequired={setBioRequired}
                  bioDate={bioDate} setBioDate={setBioDate} bioTime={bioTime} setBioTime={setBioTime}
                  bioCenter={bioCenter} setBioCenter={setBioCenter} bioNotes={bioNotes} setBioNotes={setBioNotes}
                  onSaveBiometrics={() => {
                    const datetime = bioDate && bioTime ? `${bioDate}T${bioTime}:00` : null;
                    biometricsMutation.mutate({
                      biometricsRequired: bioRequired, biometricsDatetime: datetime,
                      biometricsCenter: bioCenter || null, vendorNotes: bioNotes || null, applicationRefNo: appRefNo || null,
                    });
                  }}
                  isSavingBio={biometricsMutation.isPending}
                  onComplete={() => completeMutation.mutate()} isCompleting={completeMutation.isPending}
                  onResubmit={() => setShowResubmissionDialog(true)}
                  outputFiles={outputFiles} onUploadComplete={(file) => saveFileMutation.mutate(file)}
                  onDeleteFile={(fileId) => deleteFileMutation.mutate(fileId)} openLightbox={openLightbox}
                />
              )}

              {viewStep < activeStep && (
                <div className="pt-4 flex justify-end">
                  <Button onClick={() => setViewStep(Math.min(viewStep + 1, 3) as WizardStep)} className="gap-2" data-testid="button-next-step">
                    Next Step <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {showComments && (
                <div className="mt-6 pt-4 border-t">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <MessageSquare className="h-4 w-4" /> Comments & Messages
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Use this section to communicate with the team about this job.
                  </p>
                  <div className="flex gap-2 mb-4">
                    <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Write a message to the team..." className="min-h-16 resize-none flex-1" data-testid="input-comment" />
                    <Button onClick={handleSubmitComment} disabled={!newComment.trim() || addCommentMutation.isPending} size="icon" className="shrink-0 self-end" data-testid="button-send-comment">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  {job.comments && job.comments.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {job.comments.map(comment => (
                        <div key={comment.id} className={cn("p-3 rounded-md", comment.authorType === "Vendor" ? "bg-violet-50 dark:bg-violet-900/20 ml-8" : "bg-muted/50 mr-8")} data-testid={`comment-${comment.id}`}>
                          <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                            <Badge variant="secondary" className="text-xs">{comment.authorType === "Vendor" ? "You" : "Team"}</Badge>
                            <span className="text-xs text-muted-foreground">{comment.createdAt ? formatDateTime(comment.createdAt) : ""}</span>
                          </div>
                          <p className="text-sm">{comment.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Start the conversation above.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showResubmissionDialog} onOpenChange={(open) => {
        setShowResubmissionDialog(open);
        if (!open) { setResubmissionDocs([]); setResubmissionRemarks(""); setResubmissionScreenshotUrl(""); setResubmissionScreenshotName(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Document Resubmission</DialogTitle>
            <DialogDescription>Select which uploaded documents need to be changed and explain what needs to be corrected.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Which documents need to be changed?</p>
              {Array.isArray(job?.woDocuments) && job.woDocuments.length > 0 ? (
                job.woDocuments.map((doc) => {
                  const label = DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType;
                  const isImage = doc.mimeType?.startsWith("image/");
                  return (
                    <div key={doc.id} className="flex items-center gap-3 p-2 rounded-md hover-elevate">
                      <Checkbox id={`resub-doc-${doc.id}`} checked={resubmissionDocs.includes(doc.documentType)} onCheckedChange={(checked) => {
                        if (checked) { setResubmissionDocs(prev => prev.includes(doc.documentType) ? prev : [...prev, doc.documentType]); }
                        else { setResubmissionDocs(prev => prev.filter(d => d !== doc.documentType)); }
                      }} data-testid={`checkbox-doc-${doc.documentType}`} />
                      <label htmlFor={`resub-doc-${doc.id}`} className="flex items-center gap-2 text-sm cursor-pointer flex-1 min-w-0">
                        {isImage && doc.fileUrl ? (
                          <img src={doc.fileUrl} alt={doc.fileName} className="h-8 w-8 rounded object-cover border shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded border flex items-center justify-center bg-red-50 dark:bg-red-900/20 shrink-0"><FileText className="h-4 w-4 text-red-500" /></div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{label}</p>
                          <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
                        </div>
                      </label>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No documents uploaded for this job yet.</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Reason for resubmission</p>
              <Textarea value={resubmissionRemarks} onChange={(e) => setResubmissionRemarks(e.target.value)} placeholder="Explain what needs to be corrected..." className="min-h-20 resize-none" data-testid="input-resubmission-remarks" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Attach screenshot <span className="text-muted-foreground font-normal">(optional)</span></p>
              {resubmissionScreenshotUrl ? (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                  <img src={resubmissionScreenshotUrl} alt="Screenshot" className="h-12 w-12 rounded object-cover border shrink-0" />
                  <span className="text-sm truncate flex-1">{resubmissionScreenshotName}</span>
                  <Button variant="ghost" size="icon" onClick={() => { setResubmissionScreenshotUrl(""); setResubmissionScreenshotName(""); }} data-testid="button-remove-screenshot">
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <input type="file" accept="image/*" onChange={handleScreenshotUpload} className="hidden" id="screenshot-upload" data-testid="input-screenshot-upload" />
                  <label htmlFor="screenshot-upload">
                    <Button variant="outline" asChild disabled={uploadingScreenshot}>
                      <span className="gap-2 cursor-pointer"><Upload className="h-4 w-4" />{uploadingScreenshot ? "Uploading..." : "Choose file"}</span>
                    </Button>
                  </label>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResubmissionDialog(false)} data-testid="button-cancel-resubmission">Cancel</Button>
            <Button onClick={() => resubmissionMutation.mutate({
              documentTypes: resubmissionDocs, remarks: resubmissionRemarks,
              ...(resubmissionScreenshotUrl ? { screenshotUrl: resubmissionScreenshotUrl, screenshotName: resubmissionScreenshotName } : {})
            })} disabled={resubmissionDocs.length === 0 || !resubmissionRemarks.trim() || resubmissionMutation.isPending || uploadingScreenshot} data-testid="button-confirm-resubmission">
              {resubmissionMutation.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageLightbox files={lightboxFiles} initialIndex={lightboxIndex} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </>
  );
}

export default function VendorJobDetail() {
  return null;
}

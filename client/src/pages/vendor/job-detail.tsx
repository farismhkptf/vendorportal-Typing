import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { 
  ArrowLeft, FileText, User, Clock, Calendar, 
  Upload, Download, MessageSquare, Send, CheckCircle2,
  Building2, Briefcase, Phone, Mail, MapPin, AlertTriangle,
  Shield, FileCheck, RotateCcw, XCircle, Zap, Stethoscope,
  ChevronRight, Check, Eye, Loader2
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EnhancedUploader } from "@/components/enhanced-uploader";
import { ImageLightbox, type LightboxFile } from "@/components/image-lightbox";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import emiratesIdSample from "@/assets/images/emirates-id-sample.png";
import type { 
  TypingJob, WorkOrder, JobType, 
  TypingJobComment, File as FileType, TypingJobResult, WoDocument, DocumentRequirement
} from "@shared/schema";

interface VendorJobDetails extends TypingJob {
  workOrder?: WorkOrder;
  jobType?: JobType;
  comments?: TypingJobComment[];
  files?: FileType[];
  results?: TypingJobResult;
  company?: { id: string; name: string; deliveryAddress?: string | null };
  serviceType?: { id: string; name: string; category?: string | null };
  documentRequirements?: DocumentRequirement[];
  woDocuments?: WoDocument[];
  priority?: "urgent" | "today" | "standard";
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

function getActiveStep(status: string): WizardStep {
  switch (status) {
    case "SentToVendor":
      return 2;
    case "InProgress":
      return 3;
    case "WaitingForDocs":
      return 2;
    case "Returned":
    case "SentToClient":
      return 3;
    default:
      return 1;
  }
}

function getStepState(step: WizardStep, activeStep: WizardStep, status: string): "completed" | "active" | "locked" {
  const terminalStatuses = ["Returned", "SentToClient", "Cancelled", "Rejected", "OnHold", "VendorMistake"];
  if (terminalStatuses.includes(status)) {
    return "completed";
  }
  if (step < activeStep) return "completed";
  if (step === activeStep) return "active";
  return "locked";
}

const STEPS = [
  { num: 1 as WizardStep, label: "Overview", shortLabel: "Overview", icon: Eye },
  { num: 2 as WizardStep, label: "Documents", shortLabel: "Docs", icon: FileCheck },
  { num: 3 as WizardStep, label: "Complete", shortLabel: "Done", icon: CheckCircle2 },
];

function StepperBar({ 
  activeStep, 
  viewStep, 
  onStepClick, 
  jobStatus 
}: { 
  activeStep: WizardStep; 
  viewStep: WizardStep; 
  onStepClick: (step: WizardStep) => void;
  jobStatus: string;
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
                "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg w-full transition-colors min-w-0",
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
                {state === "completed" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="min-w-0 text-left hidden sm:block">
                <p className={cn(
                  "text-xs font-medium truncate",
                  state === "completed" && "text-emerald-600 dark:text-emerald-400",
                  state === "active" && "text-foreground",
                  state === "locked" && "text-muted-foreground"
                )}>
                  {step.label}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {state === "completed" ? "Done" : state === "active" ? "Current" : "Pending"}
                </p>
              </div>
              <span className={cn(
                "text-xs font-medium sm:hidden truncate",
                state === "completed" && "text-emerald-600 dark:text-emerald-400",
                state === "active" && "text-foreground",
                state === "locked" && "text-muted-foreground"
              )}>
                {step.shortLabel}
              </span>
            </button>
            {idx < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mx-0.5" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatJobTypeName(name: string) {
  const match = name.match(/^(.*?)(\d+\s*(?:YEAR|Year|year)s?)(.*)$/i);
  if (!match) return <span>{name}</span>;
  return (
    <span>
      {match[1]}
      <span className="font-bold text-primary">{match[2]}</span>
      {match[3]}
    </span>
  );
}

function StepOverview({ job }: { job: VendorJobDetails }) {
  const isEid = job.jobType?.category === "EID";
  const applicantPhoto = job.woDocuments?.find(d => d.documentType === "Photo" && d.fileUrl);
  return (
    <div className="space-y-4" data-testid="step-overview">
      <div className="flex items-center gap-3 pb-2">
        {applicantPhoto ? (
          <div className="h-11 w-11 rounded-full overflow-hidden border-2 border-border shrink-0">
            <img
              src={applicantPhoto.fileUrl}
              alt={job.workOrder?.applicantName || "Applicant"}
              className="h-full w-full object-cover"
              data-testid="img-applicant-photo"
            />
          </div>
        ) : (
          <div className={cn(
            "h-11 w-11 rounded-full flex items-center justify-center shrink-0",
            job.urgent ? "bg-red-100 dark:bg-red-900/30" : isEid ? "bg-amber-100 dark:bg-amber-900/30" : "bg-blue-100 dark:bg-blue-900/30"
          )}>
            {job.urgent ? (
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            ) : (
              <User className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold" data-testid="text-wo-number">
              {job.workOrder?.woNumber || "N/A"}
            </h2>
            <StatusBadge status={job.status} />
            <Badge variant="secondary" className={cn(
              "no-default-hover-elevate no-default-active-elevate",
              isEid ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            )}>
              {isEid ? "Emirates ID" : "Medical"}
            </Badge>
            {job.urgent && <Badge variant="destructive">Urgent</Badge>}
            {job.workOrder?.isVip && <Badge variant="secondary">VIP</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {job.jobCode && <span className="font-mono">{job.jobCode} &middot; </span>}
            {job.workOrder?.applicantName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground shrink-0">Applicant:</span>
          <span className="font-medium truncate">{job.workOrder?.applicantName}</span>
        </div>
        {job.workOrder?.applicantPhone && (
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground shrink-0">Phone:</span>
            <span className="font-medium truncate">{job.workOrder.applicantPhone}</span>
          </div>
        )}
        {job.workOrder?.applicantEmail && (
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground shrink-0">Email:</span>
            <span className="font-medium truncate">{job.workOrder.applicantEmail}</span>
          </div>
        )}
        {job.company && (
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground shrink-0">Company:</span>
            <span className="font-medium truncate">{job.company.name}</span>
          </div>
        )}
        {job.serviceType && (
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground shrink-0">Service:</span>
            <span className="font-medium truncate">{job.serviceType.name}</span>
          </div>
        )}
        {job.jobType && (
          <div className="flex items-center gap-2 text-sm min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground shrink-0">Job Type:</span>
            <span className="font-medium truncate">{formatJobTypeName(job.jobType.name)}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm min-w-0">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground shrink-0">Sent:</span>
          <span className="font-medium">{job.sentAt ? formatDate(job.sentAt) : "Not sent yet"}</span>
        </div>
        {job.company?.deliveryAddress && (
          <div className="flex items-center gap-2 text-sm sm:col-span-2 min-w-0">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground shrink-0">Address:</span>
            <span className="font-medium truncate">{job.company.deliveryAddress}</span>
          </div>
        )}
      </div>

      {job.workOrder?.notes && (
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground mb-1">Notes</p>
          <p className="text-sm">{job.workOrder.notes}</p>
        </div>
      )}

      {isEid && (
        <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/20">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Emirates ID Reference
          </p>
          <img
            src={emiratesIdSample}
            alt="Emirates ID sample card"
            className="w-full max-w-md rounded-lg border border-border/50"
            data-testid="img-eid-sample"
          />
        </div>
      )}
    </div>
  );
}

function StepDocuments({ 
  job, 
  onAccept, 
  onResubmit, 
  onReject,
  isAccepting,
  inputFiles,
  openLightbox,
}: { 
  job: VendorJobDetails; 
  onAccept: () => void;
  onResubmit: () => void;
  onReject: () => void;
  isAccepting: boolean;
  inputFiles: FileType[];
  openLightbox: (files: FileType[], index: number) => void;
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
    return filteredRequirements
      .filter(r => r.isRequired)
      .every(r => job.woDocuments?.some(d => d.documentType === r.documentType));
  }, [filteredRequirements, job.woDocuments]);

  const isSentToVendor = job.status === "SentToVendor";
  const isWaitingForDocs = job.status === "WaitingForDocs";

  const allDownloadableFiles = useMemo(() => {
    const docs: { url: string; name: string }[] = [];
    job.woDocuments?.forEach(d => {
      if (d.fileUrl) docs.push({ url: d.fileUrl, name: d.fileName });
    });
    inputFiles.forEach(f => {
      if (f.workdriveLink) docs.push({ url: f.workdriveLink, name: f.fileName || "document" });
    });
    return docs;
  }, [job.woDocuments, inputFiles]);

  const handleDownloadAll = () => {
    allDownloadableFiles.forEach((file, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = file.url;
        a.download = file.name;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 300);
    });
  };

  return (
    <div className="space-y-4" data-testid="step-documents">
      {isWaitingForDocs && (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Waiting for Documents</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                You requested document resubmission. Waiting for the team to upload corrected documents.
              </p>
            </div>
          </div>
        </div>
      )}

      {allDownloadableFiles.length > 1 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            className="gap-2"
            data-testid="button-download-all"
          >
            <Download className="h-4 w-4" />
            Download All ({allDownloadableFiles.length})
          </Button>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <FileCheck className="h-4 w-4" />
          Document Checklist
        </h3>
        <div className="space-y-2">
          {filteredRequirements.map(req => {
            const uploaded = job.woDocuments?.find(d => d.documentType === req.documentType);
            const docLabel = DOCUMENT_TYPE_LABELS[req.documentType] || req.documentType;
            const docUrl = uploaded?.fileUrl || "";
            const isImage = uploaded?.mimeType?.startsWith("image/");

            return (
              <div key={req.id} className="p-3 rounded-lg bg-muted/50" data-testid={`doc-req-${req.documentType}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {uploaded ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">{docLabel}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {req.isRequired ? (
                      <Badge variant="secondary" className="text-xs">Required</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Optional</Badge>
                    )}
                    {uploaded && (
                      <Badge variant="secondary" className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">Uploaded</Badge>
                    )}
                  </div>
                </div>
                {uploaded && docUrl && (
                  <a 
                    href={docUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="mt-2 flex items-center gap-3 p-2 rounded-md hover-elevate cursor-pointer"
                    data-testid={`doc-preview-${req.documentType}`}
                  >
                    {isImage ? (
                      <img src={docUrl} alt={uploaded.fileName} className="h-12 w-12 rounded object-cover border shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded border flex items-center justify-center bg-red-50 dark:bg-red-900/20 shrink-0">
                        <FileText className="h-6 w-6 text-red-500" />
                      </div>
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
            <Download className="h-4 w-4" />
            Input Documents (From Company)
          </h3>
          <div className="space-y-2">
            {inputFiles.map((file) => {
              const fileUrl = file.workdriveLink || "";
              const isImage = file.fileName?.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
              const isPdf = file.fileName?.match(/\.pdf$/i);
              const filesWithUrls = inputFiles.filter(f => f.workdriveLink);
              const lbIndex = filesWithUrls.findIndex(f => f.id === file.id);
              return (
                <div 
                  key={file.id} 
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50"
                  data-testid={`input-file-${file.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isImage && fileUrl ? (
                      <div
                        className="h-10 w-10 rounded border overflow-hidden flex-shrink-0 bg-muted cursor-pointer"
                        onClick={() => openLightbox(filesWithUrls, Math.max(0, lbIndex))}
                        data-testid={`preview-input-${file.id}`}
                      >
                        <img src={fileUrl} alt={file.fileName} className="h-full w-full object-cover" />
                      </div>
                    ) : isPdf && fileUrl ? (
                      <div
                        className="h-10 w-10 rounded border flex items-center justify-center flex-shrink-0 bg-muted cursor-pointer"
                        onClick={() => openLightbox(filesWithUrls, Math.max(0, lbIndex))}
                        data-testid={`preview-input-${file.id}`}
                      >
                        <FileText className="h-5 w-5 text-red-500" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded border flex items-center justify-center flex-shrink-0 bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <span className="text-sm font-medium truncate">{file.fileName}</span>
                  </div>
                  {fileUrl && (
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="gap-1 shrink-0">
                        <Download className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Download</span>
                      </Button>
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
          <p className="text-sm font-semibold">Review Decision</p>
          {!allRequiredUploaded && filteredRequirements.some(r => r.isRequired) && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30">
              <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Some required documents are missing. Please request resubmission before accepting.
              </p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Review the documents above. If everything looks good, accept the job to start working. If documents need changes, request resubmission.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={onAccept}
              disabled={isAccepting || !allRequiredUploaded}
              className="gap-2 flex-1 sm:flex-initial"
              data-testid="button-accept-job"
            >
              {isAccepting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {isAccepting ? "Accepting..." : "Accept & Start Work"}
            </Button>
            <Button
              variant="outline"
              onClick={onResubmit}
              className="gap-2 flex-1 sm:flex-initial"
              data-testid="button-resubmission"
            >
              <RotateCcw className="h-4 w-4" />
              Request Resubmission
            </Button>
            <Button
              variant="destructive"
              onClick={onReject}
              className="gap-2 flex-1 sm:flex-initial"
              data-testid="button-reject-job"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepComplete({
  job,
  appRefNo,
  setAppRefNo,
  bioRequired,
  setBioRequired,
  bioDate,
  setBioDate,
  bioTime,
  setBioTime,
  bioCenter,
  setBioCenter,
  bioNotes,
  setBioNotes,
  onSaveBiometrics,
  isSavingBio,
  onComplete,
  isCompleting,
  onResubmit,
  outputFiles,
  onUploadComplete,
  onDeleteFile,
  openLightbox,
}: {
  job: VendorJobDetails;
  appRefNo: string;
  setAppRefNo: (v: string) => void;
  bioRequired: boolean;
  setBioRequired: (v: boolean) => void;
  bioDate: string;
  setBioDate: (v: string) => void;
  bioTime: string;
  setBioTime: (v: string) => void;
  bioCenter: string;
  setBioCenter: (v: string) => void;
  bioNotes: string;
  setBioNotes: (v: string) => void;
  onSaveBiometrics: () => void;
  isSavingBio: boolean;
  onComplete: () => void;
  isCompleting: boolean;
  onResubmit: () => void;
  outputFiles: FileType[];
  onUploadComplete: (file: { fileName: string; objectPath: string }) => void;
  onDeleteFile: (fileId: string) => void;
  openLightbox: (files: FileType[], index: number) => void;
}) {
  const isEid = job.jobType?.category === "EID";
  const isInProgress = job.status === "InProgress";
  const isTerminal = ["Returned", "SentToClient", "Cancelled", "Rejected", "OnHold", "VendorMistake"].includes(job.status);

  return (
    <div className="space-y-5" data-testid="step-complete">
      {isTerminal && (
        <div className={cn(
          "p-4 rounded-lg border",
          job.status === "Returned" || job.status === "SentToClient"
            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30"
            : "bg-muted/50"
        )}>
          <div className="flex items-start gap-3">
            {job.status === "Returned" || job.status === "SentToClient" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium">
                {job.status === "Returned" ? "Job Completed - Pending Approval" :
                 job.status === "SentToClient" ? "Job Completed & Delivered" :
                 job.status === "Cancelled" ? "Job Cancelled" :
                 job.status === "Rejected" ? "Job Rejected" :
                 job.status === "OnHold" ? "Job On Hold" :
                 "Job Status: " + job.status}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {job.status === "Returned" ? "Your work has been submitted. The team will review and approve it." :
                 job.status === "SentToClient" ? "This job has been completed and delivered to the client." :
                 "No further actions required."}
              </p>
            </div>
          </div>
        </div>
      )}

      {job.approval && (
        <div className="p-4 rounded-lg bg-muted/50 border">
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Approval Status
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={
              job.approval.status === "Pending" ? "secondary" :
              job.approval.status === "Approved" ? "default" : "destructive"
            } data-testid="badge-approval-status">
              {job.approval.status === "Pending" ? "Pending Review" :
               job.approval.status === "Approved" ? "Approved" : "Rejected"}
            </Badge>
            <span className="text-sm text-muted-foreground" data-testid="text-approval-amount">
              Amount: AED {(job.approval.adjustedAmount ?? job.approval.calculatedAmount).toLocaleString()}
            </span>
          </div>
          {job.approval.status === "Rejected" && job.approval.rejectedReason && (
            <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm font-medium text-destructive">Rejection reason:</p>
              <p className="text-sm mt-1" data-testid="text-rejection-reason">{job.approval.rejectedReason}</p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Application Reference Number
        </h3>
        <Input 
          value={appRefNo} 
          onChange={(e) => setAppRefNo(e.target.value)} 
          placeholder="e.g. 201-2024-1234567" 
          disabled={isTerminal}
          data-testid="input-app-ref" 
        />
      </div>

      {isEid && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Biometrics Details
          </h3>
          <div className="flex items-center gap-2">
            <Checkbox
              id="bio-required"
              checked={bioRequired}
              onCheckedChange={(checked) => setBioRequired(!!checked)}
              disabled={isTerminal}
              data-testid="checkbox-biometrics-required"
            />
            <label htmlFor="bio-required" className="text-sm font-medium">Biometrics appointment required</label>
          </div>
          {bioRequired && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Date</label>
                <Input type="date" value={bioDate} onChange={(e) => setBioDate(e.target.value)} disabled={isTerminal} data-testid="input-bio-date" />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Time</label>
                <Input type="time" value={bioTime} onChange={(e) => setBioTime(e.target.value)} disabled={isTerminal} data-testid="input-bio-time" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm text-muted-foreground">Center</label>
                <Input value={bioCenter} onChange={(e) => setBioCenter(e.target.value)} placeholder="EID center name" disabled={isTerminal} data-testid="input-bio-center" />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Notes</label>
            <Textarea value={bioNotes} onChange={(e) => setBioNotes(e.target.value)} placeholder="Any additional notes..." className="min-h-16 resize-none" disabled={isTerminal} data-testid="input-bio-notes" />
          </div>
          {!isTerminal && (
            <Button
              variant="outline"
              onClick={onSaveBiometrics}
              disabled={isSavingBio}
              className="gap-2"
              data-testid="button-save-biometrics"
            >
              {isSavingBio ? "Saving..." : "Save Biometrics"}
            </Button>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Upload Completed Work
        </h3>
        <EnhancedUploader
          existingFiles={outputFiles.map(f => ({
            id: f.id,
            fileName: f.fileName || "File",
            fileUrl: f.workdriveLink || undefined,
            mimeType: f.mimeType,
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
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={onComplete}
              disabled={isCompleting}
              className="gap-2 flex-1 sm:flex-initial"
              data-testid="button-complete-job"
            >
              {isCompleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {isCompleting ? "Submitting..." : "Mark as Completed"}
            </Button>
            <Button
              variant="outline"
              onClick={onResubmit}
              className="gap-2 flex-1 sm:flex-initial"
              data-testid="button-resubmission-step3"
            >
              <RotateCcw className="h-4 w-4" />
              Request Resubmission
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VendorJobDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [showResubmissionDialog, setShowResubmissionDialog] = useState(false);
  const [resubmissionDocs, setResubmissionDocs] = useState<string[]>([]);
  const [resubmissionRemarks, setResubmissionRemarks] = useState("");
  const [resubmissionScreenshotUrl, setResubmissionScreenshotUrl] = useState("");
  const [resubmissionScreenshotName, setResubmissionScreenshotName] = useState("");
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
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
    queryKey: ["/api/vendor/jobs", id],
  });

  const activeStep = job ? getActiveStep(job.status) : 1;

  useEffect(() => {
    if (job) {
      setViewStep(1);
    }
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
    mutationFn: async (data: { fileName: string; objectPath: string }) => {
      return apiRequest("POST", `/api/vendor/jobs/${id}/files`, {
        fileName: data.fileName,
        objectPath: data.objectPath,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", id] });
      toast({ title: "File uploaded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save file", variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return apiRequest("DELETE", `/api/vendor/jobs/${id}/files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", id] });
      toast({ title: "File deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete file", variant: "destructive" });
    },
  });

  const openLightbox = (files: (FileType | { id: string; fileName: string; fileUrl: string; mimeType: string | null })[], index: number) => {
    const lbFiles: LightboxFile[] = files
      .filter(f => {
        const url = "workdriveLink" in f ? f.workdriveLink : "fileUrl" in f ? f.fileUrl : "";
        return !!url;
      })
      .map(f => ({
        id: f.id,
        fileName: f.fileName || "File",
        fileUrl: ("workdriveLink" in f ? f.workdriveLink : "fileUrl" in f ? f.fileUrl : "") || "",
        mimeType: f.mimeType || null,
      }));
    setLightboxFiles(lbFiles);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const addCommentMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest("POST", `/api/vendor/jobs/${id}/comments`, { message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", id] });
      setNewComment("");
      toast({ title: "Comment added" });
    },
    onError: () => {
      toast({ title: "Failed to add comment", variant: "destructive" });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/vendor/jobs/${id}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/dashboard"] });
      toast({ title: "Job accepted - you can now start working" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to accept job", variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/vendor/jobs/${id}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/dashboard"] });
      toast({ title: "Job submitted for approval" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to complete job", variant: "destructive" });
    },
  });

  const resubmissionMutation = useMutation({
    mutationFn: async (data: { documentTypes: string[]; remarks: string; screenshotUrl?: string; screenshotName?: string }) => {
      return apiRequest("POST", `/api/vendor/jobs/${id}/resubmission`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs"] });
      setShowResubmissionDialog(false);
      setResubmissionDocs([]);
      setResubmissionRemarks("");
      setResubmissionScreenshotUrl("");
      setResubmissionScreenshotName("");
      toast({ title: "Resubmission request sent" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to send resubmission request", variant: "destructive" });
    },
  });

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingScreenshot(true);
    try {
      const res = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      const data = await res.json();
      await fetch(data.uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      setResubmissionScreenshotUrl(data.objectPath);
      setResubmissionScreenshotName(file.name);
    } catch {
      toast({ title: "Failed to upload screenshot", variant: "destructive" });
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      return apiRequest("POST", `/api/vendor/jobs/${id}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/dashboard"] });
      setShowRejectDialog(false);
      setRejectReason("");
      toast({ title: "Job rejected" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to reject job", variant: "destructive" });
    },
  });

  const biometricsMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", `/api/vendor/jobs/${id}/biometrics`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", id] });
      toast({ title: "Biometrics data saved" });
    },
    onError: () => {
      toast({ title: "Failed to save biometrics data", variant: "destructive" });
    },
  });

  const handleSubmitComment = () => {
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment.trim());
    }
  };

  const inputFiles = job?.files?.filter(f => f.direction === "Input") || [];
  const outputFiles = job?.files?.filter(f => f.direction === "Output") || [];
  const backUrl = job?.jobType?.category === "Medical" ? "/medical" : "/eid";
  const backLabel = job?.jobType?.category === "Medical" ? "Medical Jobs" : "Emirates ID Jobs";

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-6 max-w-4xl">
        <Skeleton className="h-12 rounded-md" />
        <Skeleton className="h-48 rounded-md" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center p-16">
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="Job not found"
          description="This job doesn't exist or you don't have access to it."
        />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link href={backUrl}>
          <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Button>
        </Link>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2" 
          onClick={() => setShowComments(!showComments)}
          data-testid="button-toggle-comments"
        >
          <MessageSquare className="h-4 w-4" />
          Comments
          {job.comments && job.comments.length > 0 && (
            <Badge variant="secondary" className="text-xs ml-1">
              {job.comments.length}
            </Badge>
          )}
        </Button>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <StepperBar 
            activeStep={activeStep} 
            viewStep={viewStep} 
            onStepClick={setViewStep} 
            jobStatus={job.status} 
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-6">
          {viewStep === 1 && <StepOverview job={job} />}
          {viewStep === 2 && (
            <StepDocuments
              job={job}
              onAccept={() => acceptMutation.mutate()}
              onResubmit={() => setShowResubmissionDialog(true)}
              onReject={() => setShowRejectDialog(true)}
              isAccepting={acceptMutation.isPending}
              inputFiles={inputFiles}
              openLightbox={openLightbox}
            />
          )}
          {viewStep === 3 && (
            <StepComplete
              job={job}
              appRefNo={appRefNo}
              setAppRefNo={setAppRefNo}
              bioRequired={bioRequired}
              setBioRequired={setBioRequired}
              bioDate={bioDate}
              setBioDate={setBioDate}
              bioTime={bioTime}
              setBioTime={setBioTime}
              bioCenter={bioCenter}
              setBioCenter={setBioCenter}
              bioNotes={bioNotes}
              setBioNotes={setBioNotes}
              onSaveBiometrics={() => {
                const datetime = bioDate && bioTime ? `${bioDate}T${bioTime}:00` : null;
                biometricsMutation.mutate({
                  biometricsRequired: bioRequired,
                  biometricsDatetime: datetime,
                  biometricsCenter: bioCenter || null,
                  vendorNotes: bioNotes || null,
                  applicationRefNo: appRefNo || null,
                });
              }}
              isSavingBio={biometricsMutation.isPending}
              onComplete={() => completeMutation.mutate()}
              isCompleting={completeMutation.isPending}
              onResubmit={() => setShowResubmissionDialog(true)}
              outputFiles={outputFiles}
              onUploadComplete={(file) => saveFileMutation.mutate(file)}
              onDeleteFile={(fileId) => deleteFileMutation.mutate(fileId)}
              openLightbox={openLightbox}
            />
          )}

          {viewStep < activeStep && (
            <div className="pt-4 flex justify-end">
              <Button 
                onClick={() => setViewStep(Math.min(viewStep + 1, 3) as WizardStep)}
                className="gap-2"
                data-testid="button-next-step"
              >
                Next Step
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {showComments && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a message..."
                className="min-h-16 resize-none flex-1"
                data-testid="input-comment"
              />
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || addCommentMutation.isPending}
                size="icon"
                className="shrink-0 self-end"
                data-testid="button-send-comment"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {job.comments && job.comments.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {job.comments.map(comment => (
                  <div
                    key={comment.id}
                    className={cn(
                      "p-3 rounded-lg",
                      comment.authorType === "Vendor" 
                        ? "bg-violet-50 dark:bg-violet-900/20 ml-8" 
                        : "bg-muted/50 mr-8"
                    )}
                    data-testid={`comment-${comment.id}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {comment.authorType === "Vendor" ? "You" : "Team"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {comment.createdAt ? formatDateTime(comment.createdAt) : ""}
                      </span>
                    </div>
                    <p className="text-sm">{comment.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showResubmissionDialog} onOpenChange={(open) => {
        setShowResubmissionDialog(open);
        if (!open) {
          setResubmissionDocs([]);
          setResubmissionRemarks("");
          setResubmissionScreenshotUrl("");
          setResubmissionScreenshotName("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Document Resubmission</DialogTitle>
            <DialogDescription>Select which uploaded documents need to be changed and explain what needs to be corrected.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Which documents need to be changed?</p>
              {job.woDocuments && job.woDocuments.length > 0 ? (
                job.woDocuments.map((doc) => {
                  const label = DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType;
                  const isImage = doc.mimeType?.startsWith("image/");
                  return (
                    <div key={doc.id} className="flex items-center gap-3 p-2 rounded-lg hover-elevate">
                      <Checkbox
                        id={`resub-doc-${doc.id}`}
                        checked={resubmissionDocs.includes(doc.documentType)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setResubmissionDocs(prev => prev.includes(doc.documentType) ? prev : [...prev, doc.documentType]);
                          } else {
                            setResubmissionDocs(prev => prev.filter(d => d !== doc.documentType));
                          }
                        }}
                        data-testid={`checkbox-doc-${doc.documentType}`}
                      />
                      <label htmlFor={`resub-doc-${doc.id}`} className="flex items-center gap-2 text-sm cursor-pointer flex-1 min-w-0">
                        {isImage && doc.fileUrl ? (
                          <img src={doc.fileUrl} alt={doc.fileName} className="h-8 w-8 rounded object-cover border shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded border flex items-center justify-center bg-red-50 dark:bg-red-900/20 shrink-0">
                            <FileText className="h-4 w-4 text-red-500" />
                          </div>
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
              <Textarea
                value={resubmissionRemarks}
                onChange={(e) => setResubmissionRemarks(e.target.value)}
                placeholder="Explain what needs to be corrected..."
                className="min-h-20 resize-none"
                data-testid="input-resubmission-remarks"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Attach screenshot <span className="text-muted-foreground font-normal">(optional)</span></p>
              {resubmissionScreenshotUrl ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <img src={resubmissionScreenshotUrl} alt="Screenshot" className="h-12 w-12 rounded object-cover border shrink-0" />
                  <span className="text-sm truncate flex-1">{resubmissionScreenshotName}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setResubmissionScreenshotUrl(""); setResubmissionScreenshotName(""); }}
                    data-testid="button-remove-screenshot"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotUpload}
                    className="hidden"
                    id="screenshot-upload"
                    data-testid="input-screenshot-upload"
                  />
                  <label htmlFor="screenshot-upload">
                    <Button variant="outline" asChild disabled={uploadingScreenshot}>
                      <span className="gap-2 cursor-pointer">
                        <Upload className="h-4 w-4" />
                        {uploadingScreenshot ? "Uploading..." : "Choose file"}
                      </span>
                    </Button>
                  </label>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResubmissionDialog(false)} data-testid="button-cancel-resubmission">Cancel</Button>
            <Button
              onClick={() => resubmissionMutation.mutate({ 
                documentTypes: resubmissionDocs, 
                remarks: resubmissionRemarks,
                ...(resubmissionScreenshotUrl ? { screenshotUrl: resubmissionScreenshotUrl, screenshotName: resubmissionScreenshotName } : {})
              })}
              disabled={resubmissionDocs.length === 0 || !resubmissionRemarks.trim() || resubmissionMutation.isPending || uploadingScreenshot}
              data-testid="button-confirm-resubmission"
            >
              {resubmissionMutation.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Job</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this job. The team will be notified.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">Reason</p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why are you rejecting this job?"
              className="min-h-20 resize-none"
              data-testid="input-reject-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate(rejectReason)}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageLightbox
        files={lightboxFiles}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}

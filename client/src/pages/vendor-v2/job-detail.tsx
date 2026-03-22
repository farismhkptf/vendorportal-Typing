import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  FileText, User, Clock, Calendar, Upload, Download,
  MessageSquare, Send, CheckCircle2, Building2, Briefcase,
  Phone, Mail, MapPin, AlertTriangle, Shield, FileCheck,
  RotateCcw, XCircle, Zap, Stethoscope, ChevronRight,
  Check, Eye, Loader2, X, UserCheck, MapPinned, ArrowLeft, ChevronLeft
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EnhancedUploader } from "@/components/enhanced-uploader";
import { ImageLightbox, type LightboxFile } from "@/components/image-lightbox";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { GlassCard, GlassSection, GlassSkeleton, GlassEmpty } from "@/components/vendor-v2/layout";
import emiratesIdSample from "@assets/image_1771501559423.png";
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

function getStatusClass(status: string): string {
  switch (status) {
    case "SubmittedToVendor": return "v2-status-new";
    case "InProcess": return "v2-status-inprogress";
    case "ReadyForScheduling":
    case "Returned": return "v2-status-completed";
    default: return "v2-status-default";
  }
}

function getDisplayStatus(status: string): string {
  switch (status) {
    case "SubmittedToVendor": return "New";
    case "InProcess": return "In Progress";
    case "ReadyForScheduling": return "Completed";
    case "Returned": return "Returned";
    case "Aborted": return "Aborted";
    case "Rejected": return "Rejected";
    case "OnHold": return "On Hold";
    default: return status;
  }
}

const STEPS = [
  { num: 1 as WizardStep, label: "Overview", icon: Eye },
  { num: 2 as WizardStep, label: "Documents", icon: FileCheck },
  { num: 3 as WizardStep, label: "Complete", icon: CheckCircle2 },
];

export default function V2JobDetail() {
  const params = useParams();
  const jobId = params?.id || null;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [viewStep, setViewStep] = useState<WizardStep>(1);
  const [showComments, setShowComments] = useState(false);
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

  const { data: job, isLoading } = useQuery<VendorJobDetails>({
    queryKey: ["/api/vendor/jobs", jobId],
    enabled: !!jobId,
  });

  const activeStep = job ? getActiveStep(job.status) : 1;
  const isVip = job?.workOrder?.isVip;
  const isUrgent = job?.urgent;
  const isEid = job?.jobType?.category === "EID";
  const isMedical = job?.jobType?.category === "Medical";
  const isTerminal = job ? ["ReadyForScheduling", "Returned", "Aborted", "Rejected", "OnHold"].includes(job.status) : false;
  const isInProgress = job?.status === "InProcess";
  const isSentToVendor = job?.status === "SubmittedToVendor";

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

  useEffect(() => {
    if (isEid && !bioCenter && job?.preferredCenter) {
      setBioCenter(job.preferredCenter.id);
    }
  }, [isEid, job?.preferredCenter]);

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
      toast({ title: "Work started" });
    },
    onError: (error: Error) => { toast({ title: error.message || "Failed to start work", variant: "destructive" }); },
  });

  const completeMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/vendor/jobs/${jobId}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/dashboard"] });
      toast({ title: "Job completed", description: "Cost deducted from wallet." });
    },
    onError: (error: Error) => { toast({ title: error.message || "Failed to complete job", variant: "destructive" }); },
  });

  const biometricsMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("PUT", `/api/vendor/jobs/${jobId}/biometrics`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", jobId] }); toast({ title: "Biometrics saved" }); },
    onError: () => { toast({ title: "Failed to save biometrics", variant: "destructive" }); },
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

  const inputFiles = job?.files?.filter(f => f.direction === "Input") || [];
  const outputFiles = job?.files?.filter(f => f.direction === "Output") || [];

  const filteredRequirements = useMemo(() => {
    if (!job?.documentRequirements) return [];
    return job.documentRequirements.filter(req => {
      if (job.jobType?.category === "Medical" && !req.appliesToMedical) return false;
      if (job.jobType?.category === "EID" && !req.appliesToEid) return false;
      return true;
    });
  }, [job?.documentRequirements, job?.jobType?.category]);

  const allDownloadableFiles = useMemo(() => {
    const docs: { url: string; name: string }[] = [];
    job?.woDocuments?.forEach(d => { if (d.fileUrl) docs.push({ url: d.fileUrl, name: d.fileName }); });
    inputFiles.forEach(f => { if (f.workdriveLink) docs.push({ url: f.workdriveLink, name: f.fileName || "document" }); });
    return docs;
  }, [job?.woDocuments, inputFiles]);

  const eidCentersFiltered = useMemo(() => {
    if (!job?.eidCenters) return [];
    if (isVip) return job.eidCenters.filter(c => c.tier === "VIP");
    return job.eidCenters.filter(c => c.tier === "Normal" || !c.tier);
  }, [job?.eidCenters, isVip]);

  const handleGoBack = () => {
    if (isEid) setLocation("/eid");
    else if (isMedical) setLocation("/medical");
    else setLocation("/");
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto pt-4 space-y-4">
        <GlassSkeleton className="h-12 w-48" />
        <GlassSkeleton className="h-14" />
        <GlassSkeleton className="h-48" />
        <GlassSkeleton className="h-32" />
      </div>
    );
  }

  if (!job) {
    return (
      <GlassEmpty
        icon={<FileText className="h-8 w-8" />}
        title="Job not found"
        description="This job may have been removed or you don't have access"
      />
    );
  }

  const sent = job.sentAt ? new Date(job.sentAt as string) : null;
  const sentDate = sent ? sent.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Not sent";
  const sentTime = sent ? sent.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
  const applicantPhoto = job.woDocuments?.find(d => d.documentType === "Photo" && d.fileUrl);

  return (
    <div className="max-w-2xl mx-auto pt-2 pb-4">
      <button onClick={handleGoBack} className="flex items-center gap-1 text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80 transition-colors mb-4 text-sm" data-testid="button-back">
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <div className="flex items-start gap-3 mb-4">
        {applicantPhoto ? (
          <div className="h-12 w-12 rounded-xl overflow-hidden border border-slate-200 dark:border-white/20 shrink-0">
            <img src={applicantPhoto.fileUrl} alt="Applicant" className="h-full w-full object-cover" data-testid="img-applicant-photo" />
          </div>
        ) : (
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${isEid ? "bg-amber-500/15" : "bg-teal-500/15"}`}>
            <User className="h-5 w-5 text-slate-400 dark:text-white/50" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white" data-testid="text-v2-wo-number">{job.workOrder?.woNumber || "N/A"}</h1>
            <span className={`${getStatusClass(job.status)} v2-status-badge`}>{getDisplayStatus(job.status)}</span>
            {isVip && <span className="v2-status-badge bg-amber-500/30 text-amber-300 border border-amber-500/40">VIP</span>}
            {isUrgent && <span className="v2-status-badge v2-status-urgent">Urgent</span>}
          </div>
          <p className="text-sm text-slate-500 dark:text-white/50 truncate" data-testid="text-v2-applicant">{toProperCase(job.workOrder?.applicantName)}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-slate-100 dark:bg-white/5" data-testid="v2-wizard-stepper">
        {STEPS.map((step) => {
          const state = getStepState(step.num, activeStep, job.status);
          const isViewing = viewStep === step.num;
          const canClick = state === "completed" || state === "active";
          const Icon = step.icon;
          return (
            <button
              key={step.num}
              onClick={() => canClick && setViewStep(step.num)}
              disabled={!canClick}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isViewing
                  ? state === "completed"
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                    : "bg-amber-50 dark:bg-white/15 text-slate-900 dark:text-white"
                  : canClick
                    ? "text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5"
                    : "text-slate-300 dark:text-white/20 cursor-not-allowed"
              }`}
              data-testid={`v2-step-${step.num}`}
            >
              {state === "completed" ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              {step.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div />
        <button
          onClick={() => setShowComments(!showComments)}
          className="glass-pill px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
          data-testid="button-v2-toggle-comments"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Comments
          {job.comments && job.comments.length > 0 && (
            <span className="h-4 min-w-[16px] rounded-full bg-slate-200 dark:bg-white/20 text-[10px] font-bold flex items-center justify-center px-1">{job.comments.length}</span>
          )}
        </button>
      </div>

      {viewStep === 1 && (
        <div className="space-y-4" data-testid="v2-step-overview">
          <GlassCard className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-0.5">Company</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate" data-testid="text-v2-company">{toProperCase(job.company?.name)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-0.5">Service Type</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate" data-testid="text-v2-service">{toProperCase(job.serviceType?.name)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-0.5">Job Type</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white" data-testid="text-v2-job-type">{job.jobType?.name || "N/A"}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-0.5">Received</p>
                <p className="text-sm text-slate-900 dark:text-white">{sentDate}</p>
                {sentTime && <p className="text-xs text-slate-400 dark:text-white/40">{sentTime}</p>}
              </div>
            </div>
          </GlassCard>

          {(job.workOrder?.applicantPhone || job.workOrder?.applicantEmail || job.company?.coordinatorMobile || job.company?.coordinatorEmail) && (
            <GlassCard className="p-4">
              <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-3">Contact Information</p>
              <div className="space-y-2">
                {job.workOrder?.applicantPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-slate-400 dark:text-white/30" />
                    <span className="text-slate-500 dark:text-white/50">Applicant:</span>
                    <span className="text-slate-900 dark:text-white font-medium">{job.workOrder.applicantPhone}</span>
                  </div>
                )}
                {job.workOrder?.applicantEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-slate-400 dark:text-white/30" />
                    <span className="text-slate-500 dark:text-white/50">Email:</span>
                    <span className="text-slate-900 dark:text-white font-medium truncate">{job.workOrder.applicantEmail}</span>
                  </div>
                )}
                {job.company?.coordinatorMobile && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-slate-400 dark:text-white/30" />
                    <span className="text-slate-500 dark:text-white/50">Company:</span>
                    <span className="text-slate-900 dark:text-white font-medium">{job.company.coordinatorMobile}</span>
                  </div>
                )}
                {job.company?.coordinatorEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-slate-400 dark:text-white/30" />
                    <span className="text-slate-500 dark:text-white/50">Client:</span>
                    <span className="text-slate-900 dark:text-white font-medium truncate">{job.company.coordinatorEmail}</span>
                  </div>
                )}
              </div>
            </GlassCard>
          )}

          {isEid && job.company?.deliveryAddress && (
            <GlassCard className="p-4">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-slate-400 dark:text-white/30 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-0.5">Delivery Address</p>
                  <p className="text-sm text-slate-900 dark:text-white">{job.company.deliveryAddress}</p>
                </div>
              </div>
            </GlassCard>
          )}

          {job.preferredCenter && (
            <GlassCard className="p-4">
              <div className="flex items-start gap-2">
                <MapPinned className="h-4 w-4 text-slate-400 dark:text-white/30 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-0.5">
                    {isMedical ? "Preferred Medical Center" : "Preferred Biometrics Center"}
                  </p>
                  <p className="text-sm text-slate-900 dark:text-white font-medium">{job.preferredCenter.name}</p>
                  {job.preferredCenter.area && <p className="text-xs text-slate-400 dark:text-white/40">{job.preferredCenter.area}</p>}
                </div>
              </div>
            </GlassCard>
          )}

          {job.sentByStaffName && (
            <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-white/40 px-1">
              <UserCheck className="h-3.5 w-3.5" />
              <span>Sent by:</span>
              <span className="text-slate-600 dark:text-white/60 font-medium">{toProperCase(job.sentByStaffName)}</span>
            </div>
          )}

          {job.workOrder?.notes && (
            <GlassCard accent="blue" className="p-4">
              <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-1">Special Instructions</p>
              <p className="text-sm text-slate-700 dark:text-white/80">{job.workOrder.notes}</p>
            </GlassCard>
          )}

          {job.jobCode && (
            <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-white/40 px-1">
              <FileText className="h-3.5 w-3.5" />
              <span>Job Code:</span>
              <span className="text-slate-600 dark:text-white/60 font-mono font-medium">{job.jobCode}</span>
            </div>
          )}
        </div>
      )}

      {viewStep === 2 && (
        <div className="space-y-4" data-testid="v2-step-documents">
          <p className="text-sm text-slate-500 dark:text-white/50">Review the uploaded documents. Verify everything is correct before proceeding.</p>

          {allDownloadableFiles.length > 1 && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  allDownloadableFiles.forEach((file, i) => {
                    setTimeout(() => {
                      const a = document.createElement("a");
                      a.href = file.url; a.download = file.name; a.target = "_blank"; a.rel = "noopener noreferrer";
                      document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    }, i * 300);
                  });
                }}
                className="glass-pill px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
                data-testid="v2-button-download-all"
              >
                <Download className="h-3.5 w-3.5" /> Download All ({allDownloadableFiles.length})
              </button>
            </div>
          )}

          {filteredRequirements.length > 0 && (
            <GlassCard className="p-4">
              <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-3">Document Checklist</p>
              <p className="text-xs text-slate-400 dark:text-white/40 mb-3">
                Documents marked with * are required and must be uploaded by the team before you proceed.
              </p>
              <div className="space-y-2">
                {filteredRequirements.map(req => {
                  const label = DOCUMENT_TYPE_LABELS[req.documentType] || req.documentType;
                  const matchingDoc = job.woDocuments?.find(d => d.documentType === req.documentType);
                  const isImage = matchingDoc?.mimeType?.startsWith("image/");
                  return (
                    <div key={req.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-white/5" data-testid={`v2-docreq-${req.documentType}`}>
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${matchingDoc ? "bg-emerald-500/20" : "bg-slate-100 dark:bg-white/10"}`}>
                        {matchingDoc ? <Check className="h-4 w-4 text-emerald-400" /> : <FileText className="h-4 w-4 text-slate-400 dark:text-white/30" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 dark:text-white/80">{label}{req.isRequired ? " *" : ""}</p>
                        {matchingDoc && <p className="text-[11px] text-slate-400 dark:text-white/30 truncate">{matchingDoc.fileName}</p>}
                      </div>
                      {matchingDoc?.fileUrl && (
                        <a href={matchingDoc.fileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" onClick={(e) => e.stopPropagation()}>
                          {isImage ? (
                            <img src={matchingDoc.fileUrl} alt="" className="h-8 w-8 rounded object-cover" />
                          ) : (
                            <Download className="h-4 w-4 text-slate-400 dark:text-white/40" />
                          )}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          )}

          {inputFiles.length > 0 && (
            <GlassCard className="p-4">
              <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-3">Additional Files</p>
              <div className="space-y-2">
                {inputFiles.map((f, idx) => (
                  <div key={f.id} className="flex items-center gap-3 p-2 rounded-xl bg-white/5" data-testid={`v2-input-file-${f.id}`}>
                    <div className="h-8 w-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-blue-400" />
                    </div>
                    <span className="text-sm text-slate-600 dark:text-white/70 flex-1 truncate">{f.fileName || "File"}</span>
                    {f.workdriveLink && (
                      <button onClick={() => openLightbox(inputFiles, idx)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                        <Eye className="h-4 w-4 text-slate-400 dark:text-white/40" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {isSentToVendor && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => startWorkMutation.mutate()}
                disabled={startWorkMutation.isPending}
                className="glass-btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
                data-testid="v2-button-start-work"
              >
                {startWorkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {startWorkMutation.isPending ? "Starting..." : "Accept & Start Work"}
              </button>
              <button
                onClick={() => setShowResubmissionDialog(true)}
                className="glass-pill px-4 py-2.5 text-sm font-medium flex items-center gap-2"
                data-testid="v2-button-resubmit-step2"
              >
                <RotateCcw className="h-4 w-4" /> Resubmit
              </button>
            </div>
          )}
        </div>
      )}

      {viewStep === 3 && (
        <div className="space-y-4" data-testid="v2-step-complete">
          <p className="text-sm text-slate-500 dark:text-white/50">
            {isTerminal
              ? "This job has been finalized. Review details below."
              : "Complete the fields, upload your work, and submit."}
          </p>

          {isTerminal && (
            <GlassCard accent={job.status === "ReadyForScheduling" || job.status === "Returned" ? "green" : undefined} className="p-4">
              <div className="flex items-start gap-3">
                {job.status === "ReadyForScheduling" || job.status === "Returned" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-slate-400 dark:text-white/50 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {job.status === "ReadyForScheduling" || job.status === "Returned" ? "Job Completed" :
                     job.status === "Aborted" ? "Job Aborted" :
                     job.status === "Rejected" ? "Job Rejected" :
                     job.status === "OnHold" ? "Job On Hold" : "Status: " + job.status}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-white/40 mt-0.5">
                    {job.status === "ReadyForScheduling" || job.status === "Returned"
                      ? "Your work has been submitted. Cost deducted from wallet."
                      : "No further actions required."}
                  </p>
                </div>
              </div>
            </GlassCard>
          )}

          <GlassCard className="p-4 space-y-3">
            <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider">Application Reference Number</p>
            <input
              value={appRefNo}
              onChange={(e) => setAppRefNo(e.target.value)}
              placeholder="e.g. 201-2024-1234567"
              disabled={isTerminal}
              className="glass-input w-full px-3 py-2.5 text-sm"
              data-testid="v2-input-app-ref"
            />
          </GlassCard>

          {isMedical && job.preferredCenter && (
            <GlassCard className="p-4">
              <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-2">Medical Center</p>
              <p className="text-sm text-slate-900 dark:text-white font-medium">{job.preferredCenter.name}</p>
              {job.preferredCenter.area && <p className="text-xs text-slate-400 dark:text-white/40">{job.preferredCenter.area}</p>}
            </GlassCard>
          )}

          {isEid && (
            <GlassCard className="p-4 space-y-3">
              <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider">Biometrics Details</p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="v2-bio-required"
                  checked={bioRequired}
                  onCheckedChange={(checked) => setBioRequired(!!checked)}
                  disabled={isTerminal}
                  data-testid="v2-checkbox-bio"
                  className="border-slate-300 dark:border-white/30 data-[state=checked]:bg-amber-100 dark:data-[state=checked]:bg-white/20 data-[state=checked]:border-amber-300 dark:data-[state=checked]:border-white/40"
                />
                <label htmlFor="v2-bio-required" className="text-sm text-slate-700 dark:text-white/80">Biometrics appointment required</label>
              </div>
              {bioRequired && (
                <div className="space-y-3 pl-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 dark:text-white/40 mb-1 block">Date</label>
                      <input type="date" value={bioDate} onChange={(e) => setBioDate(e.target.value)} disabled={isTerminal} className="glass-input w-full px-3 py-2 text-sm" data-testid="v2-input-bio-date" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 dark:text-white/40 mb-1 block">Time</label>
                      <input type="time" value={bioTime} onChange={(e) => setBioTime(e.target.value)} disabled={isTerminal} className="glass-input w-full px-3 py-2 text-sm" data-testid="v2-input-bio-time" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 dark:text-white/40 mb-1 block">EID Center</label>
                    {eidCentersFiltered.length > 0 ? (
                      <Select value={bioCenter} onValueChange={setBioCenter} disabled={isTerminal}>
                        <SelectTrigger className="glass-input border-0" data-testid="v2-select-bio-center">
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
                      <input value={bioCenter} onChange={(e) => setBioCenter(e.target.value)} placeholder="EID center name" disabled={isTerminal} className="glass-input w-full px-3 py-2 text-sm" data-testid="v2-input-bio-center" />
                    )}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-slate-400 dark:text-white/40 mb-1 block">Notes</label>
                <textarea
                  value={bioNotes}
                  onChange={(e) => setBioNotes(e.target.value)}
                  placeholder="Any notes about biometrics..."
                  disabled={isTerminal}
                  className="glass-input w-full px-3 py-2 text-sm min-h-[60px] resize-none"
                  data-testid="v2-input-bio-notes"
                />
              </div>
              {!isTerminal && (
                <button
                  onClick={() => {
                    const datetime = bioDate && bioTime ? `${bioDate}T${bioTime}:00` : null;
                    biometricsMutation.mutate({
                      biometricsRequired: bioRequired, biometricsDatetime: datetime,
                      biometricsCenter: bioCenter || null, vendorNotes: bioNotes || null, applicationRefNo: appRefNo || null,
                    });
                  }}
                  disabled={biometricsMutation.isPending}
                  className="glass-pill px-4 py-2 text-sm font-medium"
                  data-testid="v2-button-save-bio"
                >
                  {biometricsMutation.isPending ? "Saving..." : "Save Biometrics"}
                </button>
              )}
            </GlassCard>
          )}

          <GlassCard className="p-4 space-y-3">
            <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider">Upload Completed Work</p>
            <p className="text-xs text-slate-400 dark:text-white/30">Upload the completed application documents (up to 5 files).</p>
            <EnhancedUploader
              existingFiles={outputFiles.map(f => ({
                id: f.id, fileName: f.fileName || "File",
                fileUrl: f.workdriveLink || undefined, mimeType: f.mimeType,
                createdAt: f.createdAt ? String(f.createdAt) : undefined,
              }))}
              onUploadComplete={(file) => saveFileMutation.mutate(file)}
              onDelete={(fileId) => deleteFileMutation.mutate(fileId)}
              maxFiles={5}
              disabled={isTerminal}
              onPreviewFile={(file) => {
                if (file.fileUrl) {
                  const idx = outputFiles.findIndex(f => f.id === file.id);
                  openLightbox(outputFiles, idx >= 0 ? idx : 0);
                }
              }}
            />
          </GlassCard>

          {isInProgress && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="glass-btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
                data-testid="v2-button-complete-job"
              >
                {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {completeMutation.isPending ? "Submitting..." : "Mark as Completed"}
              </button>
              <button
                onClick={() => setShowResubmissionDialog(true)}
                className="glass-pill px-4 py-2.5 text-sm font-medium flex items-center gap-2"
                data-testid="v2-button-resubmit-step3"
              >
                <RotateCcw className="h-4 w-4" /> Resubmit
              </button>
            </div>
          )}
        </div>
      )}

      {viewStep < activeStep && (
        <div className="pt-4 flex justify-end">
          <button
            onClick={() => setViewStep(Math.min(viewStep + 1, 3) as WizardStep)}
            className="glass-btn-primary px-4 py-2 text-sm flex items-center gap-2"
            data-testid="v2-button-next-step"
          >
            Next Step <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {showComments && (
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-white/80 flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4" /> Comments
          </h3>
          <div className="flex gap-2 mb-4">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a message..."
              className="glass-input flex-1 px-3 py-2.5 text-sm min-h-[60px] resize-none"
              data-testid="v2-input-comment"
            />
            <button
              onClick={() => { if (newComment.trim()) addCommentMutation.mutate(newComment.trim()); }}
              disabled={!newComment.trim() || addCommentMutation.isPending}
              className="glass-btn-primary p-2.5 self-end rounded-xl"
              data-testid="v2-button-send-comment"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {job.comments && job.comments.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {job.comments.map(comment => (
                <div
                  key={comment.id}
                  className={`p-3 rounded-xl ${comment.authorType === "Vendor" ? "bg-purple-50 dark:bg-purple-500/15 ml-8" : "bg-slate-50 dark:bg-white/5 mr-8"}`}
                  data-testid={`v2-comment-${comment.id}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-medium text-slate-400 dark:text-white/40">{comment.authorType === "Vendor" ? "You" : "Team"}</span>
                    <span className="text-[10px] text-slate-300 dark:text-white/25">{comment.createdAt ? formatDateTime(comment.createdAt) : ""}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-white/70">{comment.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 dark:text-white/30 text-center py-4">No comments yet.</p>
          )}
        </div>
      )}

      <Dialog open={showResubmissionDialog} onOpenChange={(open) => {
        setShowResubmissionDialog(open);
        if (!open) { setResubmissionDocs([]); setResubmissionRemarks(""); setResubmissionScreenshotUrl(""); setResubmissionScreenshotName(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Document Resubmission</DialogTitle>
            <DialogDescription>Select which documents need to be changed and explain what's wrong.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Which documents need to be changed?</p>
              {Array.isArray(job.woDocuments) && job.woDocuments.length > 0 ? (
                job.woDocuments.map((doc) => {
                  const label = DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType;
                  const isImage = doc.mimeType?.startsWith("image/");
                  return (
                    <div key={doc.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                      <Checkbox
                        id={`v2-resub-doc-${doc.id}`}
                        checked={resubmissionDocs.includes(doc.documentType)}
                        onCheckedChange={(checked) => {
                          if (checked) setResubmissionDocs(prev => prev.includes(doc.documentType) ? prev : [...prev, doc.documentType]);
                          else setResubmissionDocs(prev => prev.filter(d => d !== doc.documentType));
                        }}
                        data-testid={`v2-checkbox-doc-${doc.documentType}`}
                      />
                      <label htmlFor={`v2-resub-doc-${doc.id}`} className="flex items-center gap-2 text-sm cursor-pointer flex-1 min-w-0">
                        {isImage && doc.fileUrl ? (
                          <img src={doc.fileUrl} alt={doc.fileName} className="h-8 w-8 rounded object-cover border shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded border flex items-center justify-center bg-muted shrink-0"><FileText className="h-4 w-4 text-muted-foreground" /></div>
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
                <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Reason for resubmission</p>
              <textarea
                value={resubmissionRemarks}
                onChange={(e) => setResubmissionRemarks(e.target.value)}
                placeholder="Explain what needs to be corrected..."
                className="w-full min-h-20 resize-none border rounded-md p-2 text-sm bg-background"
                data-testid="v2-input-resubmission-remarks"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Attach screenshot <span className="text-muted-foreground font-normal">(optional)</span></p>
              {resubmissionScreenshotUrl ? (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                  <img src={resubmissionScreenshotUrl} alt="Screenshot" className="h-12 w-12 rounded object-cover border shrink-0" />
                  <span className="text-sm truncate flex-1">{resubmissionScreenshotName}</span>
                  <Button variant="ghost" size="icon" onClick={() => { setResubmissionScreenshotUrl(""); setResubmissionScreenshotName(""); }} data-testid="v2-button-remove-screenshot">
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <input type="file" accept="image/*" onChange={handleScreenshotUpload} className="hidden" id="v2-screenshot-upload" data-testid="v2-input-screenshot-upload" />
                  <label htmlFor="v2-screenshot-upload">
                    <Button variant="outline" asChild disabled={uploadingScreenshot}>
                      <span className="gap-2 cursor-pointer"><Upload className="h-4 w-4" />{uploadingScreenshot ? "Uploading..." : "Choose file"}</span>
                    </Button>
                  </label>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResubmissionDialog(false)} data-testid="v2-button-cancel-resubmission">Cancel</Button>
            <Button
              onClick={() => resubmissionMutation.mutate({
                documentTypes: resubmissionDocs, remarks: resubmissionRemarks,
                ...(resubmissionScreenshotUrl ? { screenshotUrl: resubmissionScreenshotUrl, screenshotName: resubmissionScreenshotName } : {})
              })}
              disabled={resubmissionDocs.length === 0 || !resubmissionRemarks.trim() || resubmissionMutation.isPending || uploadingScreenshot}
              data-testid="v2-button-confirm-resubmission"
            >
              {resubmissionMutation.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageLightbox files={lightboxFiles} initialIndex={lightboxIndex} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </div>
  );
}

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  FileText, AlertTriangle, RotateCcw, ChevronRight,
  Loader2, MessageSquare, ChevronLeft
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { GlassSkeleton, GlassEmpty } from "@/components/vendor-v2/layout";
import { ImageLightbox, type LightboxFile } from "@/components/image-lightbox";
import type { File as FileType } from "@shared/schema";
import type { VendorJobDetails, WizardStep } from "./components/types";
import { getActiveStep } from "./components/types";
import { JobHeader } from "./components/job-header";
import { WizardStepper } from "./components/wizard-stepper";
import { OverviewStep } from "./components/overview-step";
import { DocumentsStep } from "./components/documents-step";
import { CompletionStep } from "./components/completion-step";
import { CommentsSection } from "./components/comments-section";
import { ResubmissionDialog } from "./components/resubmission-dialog";

export default function V2JobDetail() {
  const params = useParams();
  const jobId = params?.id || null;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [viewStep, setViewStep] = useState<WizardStep>(1);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [showResubmissionDialog, setShowResubmissionDialog] = useState(false);
  const [bioRequired, setBioRequired] = useState(false);
  const [bioDate, setBioDate] = useState("");
  const [bioTime, setBioTime] = useState("");
  const [bioCenter, setBioCenter] = useState("");
  const [bioNotes, setBioNotes] = useState("");
  const [appRefNo, setAppRefNo] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxFiles, setLightboxFiles] = useState<LightboxFile[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const { data: job, isLoading, isError, refetch } = useQuery<VendorJobDetails>({
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
    mutationFn: async () => {
      if (isEid) {
        const datetime = bioDate && bioTime ? `${bioDate}T${bioTime}:00` : null;
        await apiRequest("PUT", `/api/vendor/jobs/${jobId}/biometrics`, {
          biometricsRequired: bioRequired, biometricsDatetime: datetime,
          biometricsCenter: bioCenter || null, vendorNotes: bioNotes || null, applicationRefNo: appRefNo || null,
        });
      }
      return apiRequest("POST", `/api/vendor/jobs/${jobId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/dashboard"] });
      toast({ title: "Job completed", description: "Cost deducted from wallet." });
    },
    onError: (error: Error) => { toast({ title: error.message || "Failed to complete job", variant: "destructive" }); },
  });

  const resubmissionMutation = useMutation({
    mutationFn: async (data: { documentTypes: string[]; remarks: string; screenshotUrl?: string; screenshotName?: string }) => apiRequest("POST", `/api/vendor/jobs/${jobId}/resubmission`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs"] });
      setShowResubmissionDialog(false);
      toast({ title: "Resubmission request sent" });
    },
    onError: (error: Error) => { toast({ title: error.message || "Failed to send resubmission request", variant: "destructive" }); },
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

  const inputFiles = job?.files?.filter(f => f.direction === "Input") || [];
  const outputFiles = job?.files?.filter(f => f.direction === "Output") || [];

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

  if (isError) {
    return (
      <div className="max-w-2xl mx-auto pt-12 flex flex-col items-center gap-4">
        <AlertTriangle className="h-10 w-10 text-red-400" />
        <p className="text-sm text-slate-600 dark:text-white/60">Failed to load job details</p>
        <button onClick={() => refetch()} className="glass-btn-primary px-4 py-2 text-sm flex items-center gap-2" data-testid="button-retry-job-detail">
          <RotateCcw className="h-4 w-4" /> Retry
        </button>
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

  return (
    <div className="max-w-2xl mx-auto pt-2 pb-4">
      <button onClick={handleGoBack} className="flex items-center gap-1 text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80 transition-colors mb-4 text-sm" data-testid="button-back">
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <JobHeader job={job} isEid={isEid} isVip={isVip} isUrgent={isUrgent} />

      <WizardStepper
        viewStep={viewStep}
        activeStep={activeStep}
        status={job.status}
        onStepChange={setViewStep}
      />

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
        <OverviewStep
          job={job}
          isEid={isEid}
          isMedical={isMedical}
          isSentToVendor={isSentToVendor}
          onStartWork={() => startWorkMutation.mutate()}
          startWorkPending={startWorkMutation.isPending}
        />
      )}

      {viewStep === 2 && (
        <DocumentsStep
          job={job}
          inputFiles={inputFiles}
          isSentToVendor={isSentToVendor}
          onStartWork={() => startWorkMutation.mutate()}
          startWorkPending={startWorkMutation.isPending}
          onShowResubmission={() => setShowResubmissionDialog(true)}
          onOpenLightbox={openLightbox}
        />
      )}

      {viewStep === 3 && (
        <CompletionStep
          job={job}
          isEid={isEid}
          isMedical={isMedical}
          isTerminal={isTerminal}
          isInProgress={isInProgress}
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
          outputFiles={outputFiles}
          onUploadComplete={(file) => saveFileMutation.mutate(file)}
          onDeleteFile={(fileId) => deleteFileMutation.mutate(fileId)}
          onComplete={() => completeMutation.mutate()}
          completePending={completeMutation.isPending}
          onShowResubmission={() => setShowResubmissionDialog(true)}
          onOpenLightbox={openLightbox}
        />
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
        <CommentsSection
          comments={job.comments || []}
          newComment={newComment}
          setNewComment={setNewComment}
          onAddComment={(message) => addCommentMutation.mutate(message)}
          addCommentPending={addCommentMutation.isPending}
        />
      )}

      <ResubmissionDialog
        open={showResubmissionDialog}
        onOpenChange={setShowResubmissionDialog}
        woDocuments={job.woDocuments || []}
        onSubmit={(data) => resubmissionMutation.mutate(data)}
        isPending={resubmissionMutation.isPending}
      />

      <ImageLightbox files={lightboxFiles} initialIndex={lightboxIndex} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { 
  ArrowLeft, FileText, Building2, User, Clock, Calendar, 
  Upload, Download, MessageSquare, Send, ChevronRight, 
  AlertCircle, CheckCircle2, Briefcase, MapPin, History,
  UserPlus, RotateCcw, Package, Loader2, Home, XCircle,
  AlertTriangle, UserCog
} from "lucide-react";
import { DOCUMENT_TYPE_LABELS } from "@/components/documents/document-types";

interface SubmitToVendorError extends Error {
  missingDocumentTypes?: string[];
  status?: number;
}

import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { formatDateWithWeekday, formatDateTime } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EnhancedUploader } from "@/components/enhanced-uploader";
import { ImageLightbox, type LightboxFile } from "@/components/image-lightbox";
import { DocumentPanel } from "@/components/documents/document-panel";
import type { ServiceCategory } from "@/components/documents/document-types";
import { toProperCase } from "@/lib/proper-case";
import { ActivityTimeline, type ActivityItem } from "@/components/ui/activity-timeline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { 
  TypingJob, WorkOrder, Company, JobType, Vendor, 
  TypingJobResult, TypingJobComment, File as FileType, User as SchemaUser
} from "@shared/schema";

interface TypingJobWithDetails extends TypingJob {
  workOrder?: WorkOrder & { company?: Company; serviceType?: { id: string; name: string; category?: string | null } };
  jobType?: JobType;
  vendor?: Vendor;
  result?: TypingJobResult;
  comments?: TypingJobComment[];
  files?: FileType[];
  approval?: {
    id: string;
    status: string;
    calculatedAmount: number;
    adjustedAmount: number | null;
    rejectedReason: string | null;
    approvedBy: string | null;
    createdAt: string;
    resolvedAt: string | null;
  };
}

export default function TypingJobDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxFiles, setLightboxFiles] = useState<LightboxFile[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  
  // Dialog states
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showOnHoldDialog, setShowOnHoldDialog] = useState(false);
  const [showAbortDialog, setShowAbortDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedAssignUserId, setSelectedAssignUserId] = useState<string>("");
  
  // Submit to vendor form
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [missingDocumentTypes, setMissingDocumentTypes] = useState<string[]>([]);
  
  const [onHoldReason, setOnHoldReason] = useState("");
  const [abortReason, setAbortReason] = useState("");
  
  // Reassign state
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [reassignVendorId, setReassignVendorId] = useState("");

  const { data: job, isLoading } = useQuery<TypingJobWithDetails>({
    queryKey: ["/api/typing-jobs", id],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: activities = [] } = useQuery<ActivityItem[]>({
    queryKey: ["/api/audit-logs", "typing_job", id],
    enabled: !!id,
  });

  const { data: staffUsers = [] } = useQuery<Pick<SchemaUser, "id" | "name" | "email" | "role" | "active">[]>({
    queryKey: ["/api/staff-users"],
  });

  const { data: photoMap } = useQuery<Record<string, string>>({
    queryKey: ["/api/work-orders/photos"],
  });
  
  // Mutations for workflow actions
  const invalidateTypingJobQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/typing-jobs", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/typing-jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/audit-logs", "typing_job", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/vendor-wallet"] });
  };

  const applyOptimisticStatus = async (newStatus: TypingJobWithDetails["status"]) => {
    await queryClient.cancelQueries({ queryKey: ["/api/typing-jobs", id] });
    await queryClient.cancelQueries({ queryKey: ["/api/typing-jobs"] });
    const previousDetail = queryClient.getQueryData<TypingJobWithDetails>(["/api/typing-jobs", id]);
    const previousList = queryClient.getQueryData<TypingJob[]>(["/api/typing-jobs"]);
    if (previousDetail) {
      queryClient.setQueryData<TypingJobWithDetails>(["/api/typing-jobs", id], { ...previousDetail, status: newStatus });
    }
    if (previousList) {
      queryClient.setQueryData<TypingJob[]>(["/api/typing-jobs"], previousList.map(j => j.id === id ? { ...j, status: newStatus } : j));
    }
    return { previousDetail, previousList };
  };

  const rollbackOptimistic = (context: { previousDetail?: TypingJobWithDetails; previousList?: TypingJob[] } | undefined) => {
    if (context?.previousDetail) queryClient.setQueryData(["/api/typing-jobs", id], context.previousDetail);
    if (context?.previousList) queryClient.setQueryData(["/api/typing-jobs"], context.previousList);
  };

  const submitToVendorMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/typing-jobs/${id}/submit-to-vendor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId: selectedVendorId }),
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const missingDocs = Array.isArray(body.missingDocumentTypes)
          ? (body.missingDocumentTypes as string[])
          : undefined;
        const err: SubmitToVendorError = Object.assign(
          new Error(body.message || res.statusText),
          { missingDocumentTypes: missingDocs, status: res.status }
        );
        throw err;
      }
      return res;
    },
    onMutate: () => applyOptimisticStatus("SubmittedToVendor"),
    onSuccess: () => {
      setShowSubmitDialog(false);
      setSelectedVendorId("");
      setMissingDocumentTypes([]);
      toast({ title: "Job submitted to vendor" });
    },
    onError: (error: SubmitToVendorError, _vars, context) => {
      rollbackOptimistic(context);
      if (error.status === 422 && error.missingDocumentTypes?.length) {
        setMissingDocumentTypes(error.missingDocumentTypes);
      } else {
        toast({ title: "Failed to submit", description: error.message, variant: "destructive" });
      }
    },
    onSettled: () => invalidateTypingJobQueries(),
  });
  
  const onHoldMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/typing-jobs/${id}/on-hold`, { reason: onHoldReason });
    },
    onMutate: () => applyOptimisticStatus("OnHold"),
    onSuccess: () => {
      setShowOnHoldDialog(false);
      setOnHoldReason("");
      toast({ title: "Job put on hold" });
    },
    onError: (error: Error, _vars, context) => {
      rollbackOptimistic(context);
      toast({ title: "Failed to put on hold", description: error.message, variant: "destructive" });
    },
    onSettled: () => invalidateTypingJobQueries(),
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/typing-jobs/${id}/resume`, {});
    },
    onMutate: () => applyOptimisticStatus("SubmittedToVendor"),
    onSuccess: () => {
      toast({ title: "Job resumed" });
    },
    onError: (error: Error, _vars, context) => {
      rollbackOptimistic(context);
      toast({ title: "Failed to resume job", description: error.message, variant: "destructive" });
    },
    onSettled: () => invalidateTypingJobQueries(),
  });

  const abortMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/typing-jobs/${id}/abort`, { reason: abortReason });
    },
    onMutate: () => applyOptimisticStatus("Aborted"),
    onSuccess: () => {
      setShowAbortDialog(false);
      setAbortReason("");
      toast({ title: "Job aborted" });
    },
    onError: (error: Error, _vars, context) => {
      rollbackOptimistic(context);
      toast({ title: "Failed to abort job", description: error.message, variant: "destructive" });
    },
    onSettled: () => invalidateTypingJobQueries(),
  });
  
  const reassignMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/typing-jobs/${id}/reassign`, { vendorId: reassignVendorId });
    },
    onMutate: () => applyOptimisticStatus("SubmittedToVendor"),
    onSuccess: () => {
      setShowReassignDialog(false);
      setReassignVendorId("");
      toast({ title: "Job reassigned to new vendor" });
    },
    onError: (error: Error, _vars, context) => {
      rollbackOptimistic(context);
      toast({ title: "Failed to reassign", description: error.message, variant: "destructive" });
    },
    onSettled: () => invalidateTypingJobQueries(),
  });

  const assignStaffMutation = useMutation({
    mutationFn: async (assignedToUserId: string | null) => {
      return apiRequest("PATCH", `/api/typing-jobs/${id}/assign-staff`, { assignedToUserId });
    },
    onSuccess: () => {
      setShowAssignDialog(false);
      setSelectedAssignUserId("");
      toast({ title: "Staff member assigned" });
      invalidateTypingJobQueries();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to assign", description: error.message, variant: "destructive" });
    },
  });

  const saveFileMutation = useMutation({
    mutationFn: async (data: { fileName: string; objectPath: string; direction: "Input" | "Output"; expiresAt?: string | null }) => {
      return apiRequest("POST", "/api/files", {
        relatedType: "TypingJob",
        relatedId: id,
        direction: data.direction,
        fileName: data.fileName,
        workdriveLink: data.objectPath,
        uploadedByType: "Internal",
        ...(data.expiresAt ? { expiresAt: data.expiresAt } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/typing-jobs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs", "typing_job", id] });
      toast({ title: "File uploaded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save file", variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return apiRequest("DELETE", `/api/files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/typing-jobs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs", "typing_job", id] });
      toast({ title: "File deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete file", variant: "destructive" });
    },
  });

  const openLightbox = (files: any[], index: number) => {
    const lbFiles: LightboxFile[] = files
      .filter((f: any) => f.workdriveLink)
      .map((f: any) => ({
        id: f.id,
        fileName: f.fileName || "File",
        fileUrl: f.workdriveLink || "",
        mimeType: f.mimeType || null,
      }));
    setLightboxFiles(lbFiles);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const addCommentMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest("POST", `/api/typing-jobs/${id}/comments`, {
        message,
        authorType: "Internal",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/typing-jobs", id] });
      setNewComment("");
      toast({ title: "Comment added" });
    },
    onError: () => {
      toast({ title: "Failed to add comment", variant: "destructive" });
    },
  });

  const formatDateDisplay = (date: Date | string | null) => {
    if (!date) return "-";
    return formatDateWithWeekday(date);
  };

  const formatDateTimeDisplay = (date: Date | string | null) => {
    if (!date) return "-";
    return formatDateTime(date);
  };

  const inputFiles = job?.files?.filter((f) => f.direction === "Input") || [];
  const outputFiles = job?.files?.filter((f) => f.direction === "Output") || [];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!job) {
    return (
      <AppLayout>
        <div className="p-4 lg:p-6 max-w-4xl mx-auto">
          <EmptyState
            icon={<AlertCircle className="h-6 w-6" />}
            title="Typing job not found"
            description="The typing job you're looking for doesn't exist."
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="mb-3">
          <PageBreadcrumb items={[
            { label: "Typing Jobs", href: "/typing-jobs" },
            { label: job.jobCode || job.jobType?.name || "Job" }
          ]} />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Link href="/typing-jobs">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-home">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight" data-testid="page-title">
                Typing Job
              </h1>
              <StatusBadge status={job.status} />
              {job.workOrder?.isVip && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  VIP
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="font-mono text-foreground" data-testid="text-job-code-header">{job.jobCode || "-"}</span> • {job.workOrder?.woNumber} • {job.jobType?.name || "Typing Job"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/work-orders/${job.woId}`}>
              <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-view-wo">
                View WO
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Returned alert banner */}
        {job.status === "Returned" && (
          <Card className="border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700" data-testid="alert-job-returned">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Job Returned by Vendor — Action Required</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                    This job was returned by the vendor. Review the documents and comments, then resolve or re-assign the job.
                  </p>
                  {job.rejectedReason && (
                    <p className="text-xs text-amber-800 dark:text-amber-200 mt-1 font-medium">Reason: {job.rejectedReason}</p>
                  )}
                  {job.assignedToUserId && (() => {
                    const assigned = staffUsers.find(u => u.id === job.assignedToUserId);
                    return assigned ? (
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Assigned to: <span className="font-medium">{assigned.name}</span></p>
                    ) : null;
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Missing documents pre-check warning */}
        {missingDocumentTypes.length > 0 && job.status === "Draft" && (
          <Card className="border border-destructive/30 bg-destructive/5" data-testid="card-missing-docs-warning">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-destructive">Missing required documents</p>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                    The following documents must be uploaded before this job can be submitted to a vendor:
                  </p>
                  <ul className="space-y-0.5" data-testid="list-missing-docs">
                    {missingDocumentTypes.map((docType) => (
                      <li key={docType} className="flex items-center gap-1.5 text-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                        <span data-testid={`missing-doc-${docType}`}>
                          {DOCUMENT_TYPE_LABELS[docType] || docType}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-7 w-7"
                  onClick={() => setMissingDocumentTypes([])}
                  data-testid="button-dismiss-missing-docs"
                >
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons based on status */}
        <Card className="border border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-3">
              {job.status === "Draft" && (
                <Button 
                  size="sm" 
                  className="gap-2"
                  onClick={() => setShowSubmitDialog(true)}
                  data-testid="button-submit-to-vendor"
                >
                  <UserPlus className="h-4 w-4" />
                  Submit to Vendor
                </Button>
              )}
              
              {job.status === "OnHold" && (
                <Button 
                  size="sm" 
                  className="gap-2"
                  onClick={() => resumeMutation.mutate()}
                  disabled={resumeMutation.isPending}
                  data-testid="button-resume"
                >
                  {resumeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Resume Job
                </Button>
              )}
              
              {["SubmittedToVendor", "InProcess"].includes(job.status) && (
                <Button 
                  variant="outline"
                  size="sm" 
                  className="gap-2"
                  onClick={() => setShowOnHoldDialog(true)}
                  data-testid="button-on-hold"
                >
                  <Clock className="h-4 w-4" />
                  On Hold
                </Button>
              )}

              {["Draft", "SubmittedToVendor", "InProcess", "OnHold"].includes(job.status) && (
                <Button 
                  variant="destructive"
                  size="sm" 
                  className="gap-2"
                  onClick={() => setShowAbortDialog(true)}
                  data-testid="button-abort"
                >
                  <AlertCircle className="h-4 w-4" />
                  Abort
                </Button>
              )}
              
              {(job.status === "Aborted" || job.status === "Rejected") && (
                <>
                  <Badge variant="outline" className={job.status === "Rejected" 
                    ? "bg-orange-50 text-orange-700 border-orange-200"
                    : "bg-gray-50 text-gray-600 border-gray-200"
                  }>
                    {job.status === "Rejected" ? "Vendor Rejected" : "Job Aborted"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReassignDialog(true)}
                    className="gap-2"
                    data-testid="button-reassign-job"
                  >
                    <UserPlus className="h-4 w-4" />
                    Re-assign to Vendor
                  </Button>
                </>
              )}
              
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Applicant Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Job Code</p>
                <p className="text-sm font-mono font-medium" data-testid="text-job-code-detail">{job.jobCode || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Applicant Name</p>
                <p className="text-sm font-medium">{job.workOrder?.applicantName ? toProperCase(job.workOrder.applicantName) : "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Work Order</p>
                <p className="text-sm font-mono font-medium">{job.workOrder?.woNumber || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Company</p>
                <p className="text-sm font-medium">{job.workOrder?.company?.name ? toProperCase(job.workOrder.company.name) : "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Job Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Job Type</p>
                <p className="text-sm font-medium">{job.jobType?.name || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cost</p>
                <p className="text-sm font-medium">
                  {job.costSnapshot ? `AED ${job.costSnapshot}` : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vendor</p>
                <p className="text-sm font-medium">{job.vendor?.name || "Not assigned"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Assigned To</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium" data-testid="text-assigned-to">
                    {job.assignedToUserId
                      ? staffUsers.find(u => u.id === job.assignedToUserId)?.name || "Unknown"
                      : "Unassigned"}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setSelectedAssignUserId(job.assignedToUserId || "");
                      setShowAssignDialog(true);
                    }}
                    data-testid="button-assign-staff"
                  >
                    <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t border-border/50">
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">{formatDateTime(job.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sent to Vendor</p>
                <p className="text-sm">{formatDateTime(job.sentAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completed by Vendor</p>
                <p className="text-sm">{formatDateTime(job.returnedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {job.result && (
          <Card className="border border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                Application Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Application Ref No.</p>
                  <p className="text-sm font-mono font-medium">{job.result.applicationRefNo || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Center Name</p>
                  <p className="text-sm">{job.result.centerName || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Center Area</p>
                  <p className="text-sm">{job.result.centerArea || "-"}</p>
                </div>
              </div>
              {job.result.biometricsRequired && (
                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t border-border/50">
                  <div>
                    <p className="text-xs text-muted-foreground">Biometrics Required</p>
                    <Badge variant="outline">Yes</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Biometrics Date</p>
                    <p className="text-sm">{formatDateTime(job.result.biometricsDatetime)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Biometrics Center</p>
                    <p className="text-sm">{job.result.biometricsCenter || "-"}</p>
                  </div>
                </div>
              )}
              {job.result.vendorNotes && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">Vendor Notes</p>
                  <p className="text-sm">{job.result.vendorNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="files" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="files" className="gap-2" data-testid="tab-files">
              <FileText className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="comments" className="gap-2" data-testid="tab-comments">
              <MessageSquare className="h-4 w-4" />
              Comments ({job.comments?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2" data-testid="tab-activity">
              <History className="h-4 w-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="mt-4 space-y-4">
            {job.workOrder && (
              <DocumentPanel
                woId={job.woId}
                serviceCategory={(job.workOrder.serviceType?.category as ServiceCategory) || null}
                context={job.jobType?.category === "Medical" ? "medical" : job.jobType?.category === "EID" ? "eid" : "all"}
                title="Work Order Documents"
              />
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Upload className="h-4 w-4 text-blue-500" />
                    Sent to Vendor ({inputFiles.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <EnhancedUploader
                    existingFiles={inputFiles.map(f => ({
                      id: f.id,
                      fileName: f.fileName || "File",
                      fileUrl: f.workdriveLink || undefined,
                      mimeType: f.mimeType,
                      fileSize: null,
                      createdAt: f.createdAt ? String(f.createdAt) : undefined,
                      expiresAt: f.expiresAt || null,
                    }))}
                    onUploadComplete={(file) => {
                      saveFileMutation.mutate({ fileName: file.fileName, objectPath: file.objectPath, direction: "Input", expiresAt: file.expiresAt });
                    }}
                    showExpiryDate
                    onDelete={(fileId) => deleteFileMutation.mutate(fileId)}
                    maxFiles={10}
                    onPreviewFile={(file) => {
                      if (file.fileUrl) {
                        const idx = inputFiles.findIndex(f => f.id === file.id);
                        openLightbox(inputFiles, idx >= 0 ? idx : 0);
                      }
                    }}
                  />
                </CardContent>
              </Card>

              <Card className="border border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Download className="h-4 w-4 text-green-500" />
                    Received from Vendor ({outputFiles.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {outputFiles.length > 0 ? (
                    <div className="space-y-2">
                      {outputFiles.map((file, idx) => {
                        const fileUrl = file.workdriveLink || "";
                        const isImg = file.fileName?.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
                        const isPdfFile = file.fileName?.match(/\.pdf$/i);
                        return (
                          <div key={file.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3 min-w-0">
                              {isImg && fileUrl ? (
                                <button
                                  type="button"
                                  onClick={() => openLightbox(outputFiles, idx)}
                                  className="h-10 w-10 rounded border overflow-hidden flex-shrink-0 bg-muted cursor-pointer"
                                  data-testid={`preview-output-${file.id}`}
                                >
                                  <img src={fileUrl} alt={file.fileName} className="h-full w-full object-cover" />
                                </button>
                              ) : isPdfFile && fileUrl ? (
                                <button
                                  type="button"
                                  onClick={() => openLightbox(outputFiles, idx)}
                                  className="h-10 w-10 rounded border flex items-center justify-center flex-shrink-0 bg-muted cursor-pointer"
                                  data-testid={`preview-output-${file.id}`}
                                >
                                  <FileText className="h-5 w-5 text-red-500" />
                                </button>
                              ) : (
                                <div className="h-10 w-10 rounded border flex items-center justify-center flex-shrink-0 bg-muted">
                                  <FileText className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              <span className="text-sm truncate">{file.fileName}</span>
                            </div>
                            {fileUrl && (
                              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon" className="shrink-0" data-testid={`button-download-output-${file.id}`}>
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No documents received yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="comments" className="mt-4">
            <Card className="border border-border/50">
              <CardContent className="pt-4">
                <div className="flex gap-2 mb-4">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[80px] resize-none"
                    data-testid="textarea-comment"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={!newComment.trim() || addCommentMutation.isPending}
                    onClick={() => addCommentMutation.mutate(newComment)}
                    data-testid="button-add-comment"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </Button>
                </div>

                <div className="mt-6 space-y-4">
                  {job.comments && job.comments.length > 0 ? (
                    job.comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                            comment.authorType === "Vendor"
                              ? "bg-orange-100 text-orange-600"
                              : "bg-blue-100 text-blue-600"
                          }`}
                        >
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {comment.authorType === "Vendor" ? "Vendor" : "Team"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(comment.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{comment.message}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      icon={<MessageSquare className="h-5 w-5" />}
                      title="No comments yet"
                      description="Add a comment to start a conversation about this job."
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <Card className="border border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Activity Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityTimeline activities={activities} photoMap={photoMap} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Submit to Vendor Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={(open) => {
        setShowSubmitDialog(open);
        if (!open) {
          setSelectedVendorId("");
          setMissingDocumentTypes([]);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit to Vendor</DialogTitle>
            <DialogDescription>
              Select a vendor and submit this typing job. The cost will be deducted from the vendor's wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {missingDocumentTypes.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2" data-testid="dialog-missing-docs">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-sm font-medium text-destructive">Missing required documents</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload the following documents before submitting:
                </p>
                <ul className="space-y-1" data-testid="dialog-list-missing-docs">
                  {missingDocumentTypes.map((docType) => (
                    <li key={docType} className="flex items-center gap-1.5 text-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                      <span data-testid={`dialog-missing-doc-${docType}`}>
                        {DOCUMENT_TYPE_LABELS[docType] || docType}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                <SelectTrigger data-testid="select-vendor">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {job?.jobType?.cost && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Cost to deduct</p>
                <p className="text-lg font-bold tabular-nums">AED {job.jobType.cost}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => submitToVendorMutation.mutate()}
              disabled={!selectedVendorId || submitToVendorMutation.isPending}
              data-testid="button-confirm-submit"
            >
              {submitToVendorMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                "Submit to Vendor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-assign Dialog */}
      <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-assign Job to Vendor</DialogTitle>
            <DialogDescription>Select a vendor to re-assign this job to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Vendor</label>
            <Select value={reassignVendorId} onValueChange={setReassignVendorId}>
              <SelectTrigger data-testid="select-reassign-vendor">
                <SelectValue placeholder="Choose a vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.filter(v => v.active).map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReassignDialog(false)}>Cancel</Button>
            <Button
              onClick={() => reassignMutation.mutate()}
              disabled={!reassignVendorId || reassignMutation.isPending}
              data-testid="button-confirm-reassign"
            >
              {reassignMutation.isPending ? "Reassigning..." : "Re-assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* On Hold Dialog */}
      <Dialog open={showOnHoldDialog} onOpenChange={setShowOnHoldDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Put Job On Hold</DialogTitle>
            <DialogDescription>
              This will pause the job. You can resume it later to its current status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea 
                value={onHoldReason}
                onChange={(e) => setOnHoldReason(e.target.value)}
                placeholder="e.g., Waiting for client confirmation..."
                rows={3}
                data-testid="input-on-hold-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOnHoldDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => onHoldMutation.mutate()}
              disabled={onHoldMutation.isPending}
              data-testid="button-confirm-on-hold"
            >
              {onHoldMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Put On Hold"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Abort Dialog */}
      <Dialog open={showAbortDialog} onOpenChange={setShowAbortDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abort Job</DialogTitle>
            <DialogDescription>
              This will cancel the job permanently. This action cannot be undone, but the job can be re-assigned to a vendor later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea 
                value={abortReason}
                onChange={(e) => setAbortReason(e.target.value)}
                placeholder="e.g., Client cancelled the request..."
                rows={3}
                data-testid="input-abort-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAbortDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => abortMutation.mutate()}
              disabled={abortMutation.isPending}
              data-testid="button-confirm-abort"
            >
              {abortMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Aborting...
                </>
              ) : (
                "Abort Job"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Staff Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={(open) => {
        setShowAssignDialog(open);
        if (!open) setSelectedAssignUserId("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Staff Member</DialogTitle>
            <DialogDescription>
              Select a staff member to be responsible for this typing job. They will be notified when the job is returned by a vendor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Staff Member</Label>
              <Select value={selectedAssignUserId} onValueChange={setSelectedAssignUserId}>
                <SelectTrigger data-testid="select-assign-user">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {staffUsers
                    .filter(u => u.active && ["Admin", "Client Relationship Manager", "PRO", "PRO - Temporary"].includes(u.role))
                    .map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name} <span className="text-muted-foreground text-xs">({u.role})</span></SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
            <Button
              onClick={() => assignStaffMutation.mutate(selectedAssignUserId === "__none__" ? null : selectedAssignUserId || null)}
              disabled={assignStaffMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignStaffMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</>
              ) : "Save Assignment"}
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
    </AppLayout>
  );
}

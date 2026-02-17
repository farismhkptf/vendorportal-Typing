import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { 
  ArrowLeft, FileText, Building2, User, Clock, Calendar, 
  Upload, Download, MessageSquare, Send, ChevronRight, 
  AlertCircle, CheckCircle2, Briefcase, MapPin, History,
  UserPlus, RotateCcw, Package, Loader2, Home
} from "lucide-react";
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
import { ObjectUploader } from "@/components/ObjectUploader";
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
  TypingJobResult, TypingJobComment, File as FileType 
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
  const fileObjectPathsRef = useRef<Map<string, string>>(new Map());
  
  // Dialog states
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showOnHoldDialog, setShowOnHoldDialog] = useState(false);
  const [showAbortDialog, setShowAbortDialog] = useState(false);
  
  // Submit to vendor form
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  
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
  
  // Mutations for workflow actions
  const invalidateTypingJobQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/typing-jobs", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/typing-jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/audit-logs", "typing_job", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/vendor-wallet"] });
  };

  const submitToVendorMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/typing-jobs/${id}/submit-to-vendor`, {
        vendorId: selectedVendorId,
      });
    },
    onSuccess: () => {
      invalidateTypingJobQueries();
      setShowSubmitDialog(false);
      setSelectedVendorId("");
      toast({ title: "Job submitted to vendor" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to submit", description: error.message, variant: "destructive" });
    },
  });
  
  const onHoldMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/typing-jobs/${id}/on-hold`, { reason: onHoldReason });
    },
    onSuccess: () => {
      invalidateTypingJobQueries();
      setShowOnHoldDialog(false);
      setOnHoldReason("");
      toast({ title: "Job put on hold" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to put on hold", description: error.message, variant: "destructive" });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/typing-jobs/${id}/resume`, {});
    },
    onSuccess: () => {
      invalidateTypingJobQueries();
      toast({ title: "Job resumed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to resume job", description: error.message, variant: "destructive" });
    },
  });

  const abortMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/typing-jobs/${id}/abort`, { reason: abortReason });
    },
    onSuccess: () => {
      invalidateTypingJobQueries();
      setShowAbortDialog(false);
      setAbortReason("");
      toast({ title: "Job aborted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to abort job", description: error.message, variant: "destructive" });
    },
  });
  
  const resubmitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/typing-jobs/${id}/resubmit`, {});
    },
    onSuccess: () => {
      invalidateTypingJobQueries();
      toast({ title: "Job resubmitted to vendor" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to resubmit", description: error.message, variant: "destructive" });
    },
  });
  
  const deliverToClientMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/typing-jobs/${id}/deliver-to-client`, {});
    },
    onSuccess: () => {
      invalidateTypingJobQueries();
      toast({ title: "Application delivered to client" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to deliver", description: error.message, variant: "destructive" });
    },
  });

  const reassignMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/typing-jobs/${id}/reassign`, { vendorId: reassignVendorId });
    },
    onSuccess: () => {
      invalidateTypingJobQueries();
      setShowReassignDialog(false);
      setReassignVendorId("");
      toast({ title: "Job reassigned to new vendor" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to reassign", description: error.message, variant: "destructive" });
    },
  });

  const saveFileMutation = useMutation({
    mutationFn: async (data: { fileName: string; objectPath: string; direction: "Input" | "Output" }) => {
      return apiRequest("POST", "/api/files", {
        relatedType: "TypingJob",
        relatedId: id,
        direction: data.direction,
        fileName: data.fileName,
        workdriveLink: data.objectPath,
        uploadedByType: "Internal",
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

  const getUploadParameters = async (file: { name: string; size: number | null; type?: string; id?: string }) => {
    const res = await fetch("/api/uploads/request-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        size: file.size || 0,
        contentType: file.type || "application/octet-stream",
      }),
    });
    const data = await res.json();
    const key = file.id || `${file.name}-${Date.now()}`;
    fileObjectPathsRef.current.set(key, data.objectPath);
    fileObjectPathsRef.current.set(file.name, data.objectPath);
    return {
      method: "PUT" as const,
      url: data.uploadURL as string,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    };
  };

  const handleUploadComplete = (direction: "Input" | "Output") => (result: { successful?: Array<{ name: string; id?: string }> }) => {
    if (!result.successful) return;
    result.successful.forEach((file) => {
      const objectPath = file.id 
        ? fileObjectPathsRef.current.get(file.id) 
        : fileObjectPathsRef.current.get(file.name);
      if (objectPath) {
        saveFileMutation.mutate({
          fileName: file.name,
          objectPath,
          direction,
        });
        if (file.id) fileObjectPathsRef.current.delete(file.id);
        fileObjectPathsRef.current.delete(file.name);
      }
    });
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
              <h1 className="text-xl font-semibold text-foreground" data-testid="page-title">
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
              
              {job.status === "WaitingForDocs" && (
                <Button 
                  size="sm" 
                  className="gap-2"
                  onClick={() => resubmitMutation.mutate()}
                  disabled={resubmitMutation.isPending}
                  data-testid="button-resubmit"
                >
                  {resubmitMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Resubmit to Vendor
                </Button>
              )}
              
              {job.status === "Returned" && (
                <Button 
                  size="sm" 
                  className="gap-2"
                  onClick={() => deliverToClientMutation.mutate()}
                  disabled={deliverToClientMutation.isPending}
                  data-testid="button-deliver-to-client"
                >
                  {deliverToClientMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Package className="h-4 w-4" />
                  )}
                  Deliver to Client
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
              
              {["SentToVendor", "InProgress", "WaitingForDocs"].includes(job.status) && (
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

              {["Draft", "SentToVendor", "InProgress", "WaitingForDocs", "OnHold"].includes(job.status) && (
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
              
              {job.status === "SentToClient" && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Completed - Delivered to Client
                </Badge>
              )}
              
              {(job.status === "Cancelled" || job.status === "Rejected") && (
                <>
                  <Badge variant="outline" className={job.status === "Rejected" 
                    ? "bg-orange-50 text-orange-700 border-orange-200"
                    : "bg-gray-50 text-gray-600 border-gray-200"
                  }>
                    {job.status === "Rejected" ? "Vendor Rejected" : "Job Cancelled"}
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
              
              {job.status === "VendorMistake" && (
                <>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                    Vendor Mistake
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
                <p className="text-xs text-muted-foreground">Returned</p>
                <p className="text-sm">{formatDateTime(job.returnedAt)}</p>
              </div>
            </div>
            {job.status === "VendorMistake" && job.vendorMistakeReason && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">Vendor Mistake Reason</p>
                <p className="text-sm text-red-600">{job.vendorMistakeReason}</p>
              </div>
            )}
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

        {job.approval && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Vendor Approval
                </CardTitle>
                <StatusBadge status={job.approval.status as any} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Calculated Amount:</span>{" "}
                  <span className="font-medium">AED {job.approval.calculatedAmount.toLocaleString()}</span>
                </div>
                {job.approval.adjustedAmount !== null && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Adjusted Amount:</span>{" "}
                    <span className="font-medium">AED {job.approval.adjustedAmount.toLocaleString()}</span>
                  </div>
                )}
                {job.approval.rejectedReason && (
                  <div className="text-sm sm:col-span-2">
                    <span className="text-muted-foreground">Rejection Reason:</span>{" "}
                    <span className="font-medium text-destructive">{job.approval.rejectedReason}</span>
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-muted-foreground">Submitted:</span>{" "}
                  <span className="font-medium">{job.approval.createdAt ? formatDateTime(job.approval.createdAt) : ""}</span>
                </div>
                {job.approval.resolvedAt && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Resolved:</span>{" "}
                    <span className="font-medium">{formatDateTime(job.approval.resolvedAt)}</span>
                  </div>
                )}
              </div>
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
                  <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-blue-500" />
                      Sent to Vendor ({inputFiles.length})
                    </span>
                    <ObjectUploader
                      maxNumberOfFiles={5}
                      onGetUploadParameters={getUploadParameters}
                      onComplete={handleUploadComplete("Input")}
                      buttonClassName="h-8 px-3 text-sm gap-1.5"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload
                    </ObjectUploader>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {inputFiles.length > 0 ? (
                    <div className="space-y-2">
                      {inputFiles.map((file) => {
                        const fileUrl = file.workdriveLink ? `/api/objects/${encodeURIComponent(file.workdriveLink)}` : "";
                        const isImage = file.fileName?.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
                        const isPdf = file.fileName?.match(/\.pdf$/i);
                        return (
                          <div
                            key={file.id}
                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {isImage && fileUrl ? (
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded border overflow-hidden flex-shrink-0 bg-muted">
                                  <img src={fileUrl} alt={file.fileName} className="h-full w-full object-cover" />
                                </a>
                              ) : isPdf && fileUrl ? (
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded border flex items-center justify-center flex-shrink-0 bg-muted hover-elevate cursor-pointer">
                                  <FileText className="h-5 w-5 text-red-500" />
                                </a>
                              ) : (
                                <div className="h-10 w-10 rounded border flex items-center justify-center flex-shrink-0 bg-muted">
                                  <FileText className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              <span className="text-sm truncate">{file.fileName}</span>
                            </div>
                            {fileUrl && (
                              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon" className="shrink-0" data-testid={`button-download-input-${file.id}`}>
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
                      No documents uploaded yet
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-green-500" />
                      Received from Vendor ({outputFiles.length})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {outputFiles.length > 0 ? (
                    <div className="space-y-2">
                      {outputFiles.map((file) => {
                        const fileUrl = file.workdriveLink ? `/api/objects/${encodeURIComponent(file.workdriveLink)}` : "";
                        const isImage = file.fileName?.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
                        const isPdf = file.fileName?.match(/\.pdf$/i);
                        return (
                          <div
                            key={file.id}
                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {isImage && fileUrl ? (
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded border overflow-hidden flex-shrink-0 bg-muted">
                                  <img src={fileUrl} alt={file.fileName} className="h-full w-full object-cover" />
                                </a>
                              ) : isPdf && fileUrl ? (
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded border flex items-center justify-center flex-shrink-0 bg-muted hover-elevate cursor-pointer">
                                  <FileText className="h-5 w-5 text-red-500" />
                                </a>
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
                <ActivityTimeline activities={activities} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Submit to Vendor Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit to Vendor</DialogTitle>
            <DialogDescription>
              Select a vendor and submit this typing job. The cost will be deducted from the vendor's wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
                <p className="text-lg font-semibold">AED {job.jobType.cost}</p>
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
    </AppLayout>
  );
}

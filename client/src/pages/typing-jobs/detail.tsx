import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { 
  ArrowLeft, FileText, Building2, User, Clock, Calendar, 
  Upload, Download, MessageSquare, Send, ChevronRight, 
  AlertCircle, CheckCircle2, Briefcase, MapPin, History,
  UserPlus, RotateCcw, Package, Loader2, Home
} from "lucide-react";
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
  workOrder?: WorkOrder & { company?: Company };
  jobType?: JobType;
  vendor?: Vendor;
  result?: TypingJobResult;
  comments?: TypingJobComment[];
  files?: FileType[];
}

export default function TypingJobDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const fileObjectPathsRef = useRef<Map<string, string>>(new Map());
  
  // Dialog states
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showReceivedDialog, setShowReceivedDialog] = useState(false);
  const [showReturnedDialog, setShowReturnedDialog] = useState(false);
  
  // Submit to vendor form
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  
  // Mark received form
  const [receivedForm, setReceivedForm] = useState({
    applicationRefNo: "",
    centerName: "",
    centerArea: "",
    centerNotes: "",
    biometricsRequired: false,
    biometricsDatetime: "",
    biometricsCenter: "",
    vendorNotes: "",
  });
  
  // Return reason
  const [returnReason, setReturnReason] = useState("");

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
  
  const markReceivedMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/typing-jobs/${id}/mark-received`, receivedForm);
    },
    onSuccess: () => {
      invalidateTypingJobQueries();
      setShowReceivedDialog(false);
      setReceivedForm({
        applicationRefNo: "",
        centerName: "",
        centerArea: "",
        centerNotes: "",
        biometricsRequired: false,
        biometricsDatetime: "",
        biometricsCenter: "",
        vendorNotes: "",
      });
      toast({ title: "Job marked as received" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to mark received", description: error.message, variant: "destructive" });
    },
  });
  
  const markReturnedMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/typing-jobs/${id}/mark-returned`, { reason: returnReason });
    },
    onSuccess: () => {
      invalidateTypingJobQueries();
      setShowReturnedDialog(false);
      setReturnReason("");
      toast({ title: "Job marked as returned" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to mark returned", description: error.message, variant: "destructive" });
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
              
              {(job.status === "SentToVendor" || job.status === "InProgress") && (
                <>
                  <Button 
                    size="sm" 
                    className="gap-2"
                    onClick={() => setShowReceivedDialog(true)}
                    data-testid="button-mark-received"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Received
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={() => setShowReturnedDialog(true)}
                    data-testid="button-mark-returned"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Mark Returned
                  </Button>
                </>
              )}
              
              {job.status === "Returned" && (
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
              
              {job.status === "WaitingForDocs" && (
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
              
              {job.status === "SentToClient" && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Completed - Delivered to Client
                </Badge>
              )}
              
              {job.status === "Cancelled" && (
                <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                  Job Cancelled
                </Badge>
              )}
              
              {job.status === "VendorMistake" && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                  Vendor Mistake
                </Badge>
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Job Code</p>
                <p className="text-sm font-mono font-medium" data-testid="text-job-code-detail">{job.jobCode || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Applicant Name</p>
                <p className="text-sm font-medium">{job.workOrder?.applicantName || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Work Order</p>
                <p className="text-sm font-mono font-medium">{job.workOrder?.woNumber || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Company</p>
                <p className="text-sm font-medium">{job.workOrder?.company?.name || "-"}</p>
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t border-border/50">
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t border-border/50">
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

          <TabsContent value="files" className="mt-4">
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
                      {inputFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate">{file.fileName}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
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
                      {outputFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate">{file.fileName}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
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

      {/* Mark Received Dialog */}
      <Dialog open={showReceivedDialog} onOpenChange={setShowReceivedDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark as Received</DialogTitle>
            <DialogDescription>
              Enter the application details received from the vendor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Application Reference No.</Label>
              <Input 
                value={receivedForm.applicationRefNo}
                onChange={(e) => setReceivedForm(prev => ({ ...prev, applicationRefNo: e.target.value }))}
                placeholder="e.g., APP-2024-12345"
                data-testid="input-application-ref"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Center Name</Label>
                <Input 
                  value={receivedForm.centerName}
                  onChange={(e) => setReceivedForm(prev => ({ ...prev, centerName: e.target.value }))}
                  placeholder="Center name"
                />
              </div>
              <div className="space-y-2">
                <Label>Center Area</Label>
                <Input 
                  value={receivedForm.centerArea}
                  onChange={(e) => setReceivedForm(prev => ({ ...prev, centerArea: e.target.value }))}
                  placeholder="Area"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Center Notes</Label>
              <Textarea 
                value={receivedForm.centerNotes}
                onChange={(e) => setReceivedForm(prev => ({ ...prev, centerNotes: e.target.value }))}
                placeholder="Any notes about the center"
                rows={2}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="biometrics"
                checked={receivedForm.biometricsRequired}
                onCheckedChange={(checked) => setReceivedForm(prev => ({ ...prev, biometricsRequired: !!checked }))}
              />
              <Label htmlFor="biometrics" className="cursor-pointer">Biometrics Required</Label>
            </div>
            {receivedForm.biometricsRequired && (
              <div className="grid grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label>Biometrics Date/Time</Label>
                  <Input 
                    type="datetime-local"
                    value={receivedForm.biometricsDatetime}
                    onChange={(e) => setReceivedForm(prev => ({ ...prev, biometricsDatetime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Biometrics Center</Label>
                  <Input 
                    value={receivedForm.biometricsCenter}
                    onChange={(e) => setReceivedForm(prev => ({ ...prev, biometricsCenter: e.target.value }))}
                    placeholder="Center name"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Vendor Notes</Label>
              <Textarea 
                value={receivedForm.vendorNotes}
                onChange={(e) => setReceivedForm(prev => ({ ...prev, vendorNotes: e.target.value }))}
                placeholder="Any additional notes from vendor"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceivedDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => markReceivedMutation.mutate()}
              disabled={markReceivedMutation.isPending}
              data-testid="button-confirm-received"
            >
              {markReceivedMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Mark as Received"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Returned Dialog */}
      <Dialog open={showReturnedDialog} onOpenChange={setShowReturnedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Returned</DialogTitle>
            <DialogDescription>
              The vendor needs additional documents. Enter the reason for return.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Return</Label>
              <Textarea 
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="e.g., Missing passport copy, need updated visa photo..."
                rows={3}
                data-testid="input-return-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnedDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => markReturnedMutation.mutate()}
              disabled={markReturnedMutation.isPending}
              data-testid="button-confirm-returned"
            >
              {markReturnedMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Mark as Returned"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

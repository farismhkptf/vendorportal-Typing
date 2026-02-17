import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { 
  ArrowLeft, FileText, User, Clock, Calendar, 
  Upload, Download, MessageSquare, Send, CheckCircle2,
  Building2, Briefcase, Phone, Mail, MapPin, AlertTriangle,
  Shield, FileCheck, RotateCcw, XCircle, Zap
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ObjectUploader } from "@/components/ObjectUploader";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VendorHeader } from "@/components/vendor-header";
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

export default function VendorJobDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [showResubmissionDialog, setShowResubmissionDialog] = useState(false);
  const [resubmissionDocs, setResubmissionDocs] = useState<string[]>([]);
  const [resubmissionRemarks, setResubmissionRemarks] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [bioRequired, setBioRequired] = useState(false);
  const [bioDate, setBioDate] = useState("");
  const [bioTime, setBioTime] = useState("");
  const [bioCenter, setBioCenter] = useState("");
  const [bioNotes, setBioNotes] = useState("");
  const [appRefNo, setAppRefNo] = useState("");

  const { data: job, isLoading } = useQuery<VendorJobDetails>({
    queryKey: ["/api/vendor/jobs", id],
  });

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

  const fileObjectPathsRef = useRef<Map<string, string>>(new Map());

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

  const handleUploadComplete = (result: { successful?: Array<{ name: string; id?: string }> }) => {
    if (!result.successful) return;
    result.successful.forEach((file) => {
      const objectPath = file.id 
        ? fileObjectPathsRef.current.get(file.id) 
        : fileObjectPathsRef.current.get(file.name);
      if (objectPath) {
        saveFileMutation.mutate({ fileName: file.name, objectPath });
        if (file.id) fileObjectPathsRef.current.delete(file.id);
        fileObjectPathsRef.current.delete(file.name);
      }
    });
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
      toast({ title: "Job accepted" });
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
      toast({ title: "Job marked as completed" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to complete job", variant: "destructive" });
    },
  });

  const resubmissionMutation = useMutation({
    mutationFn: async (data: { documentTypes: string[]; remarks: string }) => {
      return apiRequest("POST", `/api/vendor/jobs/${id}/resubmission`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs"] });
      setShowResubmissionDialog(false);
      setResubmissionDocs([]);
      setResubmissionRemarks("");
      toast({ title: "Resubmission request sent" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to send resubmission request", variant: "destructive" });
    },
  });

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <VendorHeader />
        <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background">
        <VendorHeader />
        <div className="flex items-center justify-center p-16">
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="Job not found"
            description="This job doesn't exist or you don't have access to it."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <VendorHeader />
      
      <div className="px-4 lg:px-8 py-3 border-b border-border/50">
        <Link href="/vendor/jobs">
          <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            Back to Jobs
          </Button>
        </Link>
      </div>

      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                  job.urgent ? "bg-red-100 dark:bg-red-900/30" : "bg-violet-100 dark:bg-violet-900/30"
                }`}>
                  {job.urgent ? (
                    <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  ) : (
                    <FileText className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-xl" data-testid="text-wo-number">
                      {job.workOrder?.woNumber || "N/A"}
                    </CardTitle>
                    <StatusBadge status={job.status} />
                    {job.urgent && <Badge variant="destructive">Urgent</Badge>}
                    {job.workOrder?.isVip && <Badge variant="secondary">VIP</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {job.jobCode && <span className="font-mono">{job.jobCode} &middot; </span>}
                    {job.workOrder?.applicantName}
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Applicant:</span>
                <span className="font-medium">{job.workOrder?.applicantName}</span>
              </div>
              {job.workOrder?.applicantPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-medium">{job.workOrder.applicantPhone}</span>
                </div>
              )}
              {job.workOrder?.applicantEmail && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{job.workOrder.applicantEmail}</span>
                </div>
              )}
              {job.company && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Company:</span>
                  <span className="font-medium">{job.company.name}</span>
                </div>
              )}
              {job.serviceType && (
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Service:</span>
                  <span className="font-medium">{job.serviceType.name}</span>
                </div>
              )}
              {job.jobType && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Job Type:</span>
                  <StatusBadge status={job.jobType.category} />
                  <span className="font-medium">{job.jobType.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Sent:</span>
                <span className="font-medium">{job.sentAt ? formatDate(job.sentAt) : "Not sent yet"}</span>
              </div>
              {job.company?.deliveryAddress && (
                <div className="flex items-center gap-2 text-sm sm:col-span-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Delivery Address:</span>
                  <span className="font-medium">{job.company.deliveryAddress}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t space-y-3">
              <p className="text-sm font-medium">Actions</p>

              {job.status === "SentToVendor" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => acceptMutation.mutate()}
                    disabled={acceptMutation.isPending}
                    className="gap-2"
                    data-testid="button-accept-job"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {acceptMutation.isPending ? "Accepting..." : "Accept Job"}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setShowRejectDialog(true)}
                    className="gap-2"
                    data-testid="button-reject-job"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              )}

              {job.status === "InProgress" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending}
                    className="gap-2"
                    data-testid="button-complete-job"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {completeMutation.isPending ? "Completing..." : "Mark Completed"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowResubmissionDialog(true)}
                    className="gap-2"
                    data-testid="button-resubmission"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Request Resubmission
                  </Button>
                </div>
              )}

              {job.status === "WaitingForDocs" && (
                <p className="text-sm text-muted-foreground">
                  Waiting for the team to resubmit documents.
                </p>
              )}

              {(job.status === "Returned" || job.status === "SentToClient" || job.status === "Cancelled" || job.status === "Rejected" || job.status === "OnHold") && (
                <p className="text-sm text-muted-foreground">
                  No actions available for this job status.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {job.approval && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Approval Status
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}

        {job.documentRequirements && job.documentRequirements.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Required Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {job.documentRequirements.map((req) => {
                  const uploaded = job.woDocuments?.find(d => d.documentType === req.documentType);
                  return (
                    <div key={req.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50" data-testid={`doc-req-${req.documentType}`}>
                      <div className="flex items-center gap-3">
                        {uploaded ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                        )}
                        <span className="text-sm font-medium">
                          {DOCUMENT_TYPE_LABELS[req.documentType] || req.documentType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
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
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {job.jobType?.category === "EID" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Biometrics & Application Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bio-required"
                  checked={bioRequired}
                  onCheckedChange={(checked) => setBioRequired(!!checked)}
                  data-testid="checkbox-biometrics-required"
                />
                <label htmlFor="bio-required" className="text-sm font-medium">Biometrics appointment required</label>
              </div>

              {bioRequired && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">Date</label>
                    <Input type="date" value={bioDate} onChange={(e) => setBioDate(e.target.value)} data-testid="input-bio-date" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">Time</label>
                    <Input type="time" value={bioTime} onChange={(e) => setBioTime(e.target.value)} data-testid="input-bio-time" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-sm text-muted-foreground">Center</label>
                    <Input value={bioCenter} onChange={(e) => setBioCenter(e.target.value)} placeholder="EID center name" data-testid="input-bio-center" />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Application Reference No.</label>
                <Input value={appRefNo} onChange={(e) => setAppRefNo(e.target.value)} placeholder="e.g. 201-2024-1234567" data-testid="input-app-ref" />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Notes</label>
                <Textarea value={bioNotes} onChange={(e) => setBioNotes(e.target.value)} placeholder="Any additional notes..." className="min-h-16 resize-none" data-testid="input-bio-notes" />
              </div>

              <Button
                onClick={() => {
                  const datetime = bioDate && bioTime ? `${bioDate}T${bioTime}:00` : null;
                  biometricsMutation.mutate({
                    biometricsRequired: bioRequired,
                    biometricsDatetime: datetime,
                    biometricsCenter: bioCenter || null,
                    vendorNotes: bioNotes || null,
                    applicationRefNo: appRefNo || null,
                  });
                }}
                disabled={biometricsMutation.isPending}
                className="gap-2"
                data-testid="button-save-biometrics"
              >
                {biometricsMutation.isPending ? "Saving..." : "Save Details"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="documents" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="documents" className="gap-2" data-testid="tab-documents">
              <Upload className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="comments" className="gap-2" data-testid="tab-comments">
              <MessageSquare className="h-4 w-4" />
              Comments
              {job.comments && job.comments.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {job.comments.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Input Documents (From Company)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {inputFiles.length > 0 ? (
                  <div className="space-y-2">
                    {inputFiles.map(file => (
                      <div 
                        key={file.id} 
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50"
                        data-testid={`input-file-${file.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{file.fileName}</span>
                        </div>
                        {file.workdriveLink && (
                          <a 
                            href={`/api/objects/${encodeURIComponent(file.workdriveLink)}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="sm" className="gap-1">
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </Button>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<FileText className="h-5 w-5" />}
                    title="No input documents"
                    description="No documents have been sent for this job yet."
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Output Documents (Upload Completed Work)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {outputFiles.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {outputFiles.map(file => (
                      <div 
                        key={file.id} 
                        className="flex items-center justify-between gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20"
                        data-testid={`output-file-${file.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm font-medium">{file.fileName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {file.createdAt ? formatDateTime(file.createdAt) : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <ObjectUploader
                  onGetUploadParameters={getUploadParameters}
                  onComplete={handleUploadComplete}
                  maxNumberOfFiles={5}
                >
                  Upload Documents
                </ObjectUploader>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comments" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Add Comment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a message or ask a question..."
                  className="min-h-24 resize-none"
                  data-testid="input-comment"
                />
                <Button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                  className="gap-2"
                  data-testid="button-send-comment"
                >
                  <Send className="h-4 w-4" />
                  {addCommentMutation.isPending ? "Sending..." : "Send"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Message History</CardTitle>
              </CardHeader>
              <CardContent>
                {job.comments && job.comments.length > 0 ? (
                  <div className="space-y-4">
                    {job.comments.map(comment => (
                      <div
                        key={comment.id}
                        className={`p-3 rounded-lg ${
                          comment.authorType === "Vendor" 
                            ? "bg-violet-50 dark:bg-violet-900/20 ml-8" 
                            : "bg-muted/50 mr-8"
                        }`}
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
                  <EmptyState
                    icon={<MessageSquare className="h-5 w-5" />}
                    title="No comments yet"
                    description="Start a conversation about this job."
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showResubmissionDialog} onOpenChange={setShowResubmissionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Document Resubmission</DialogTitle>
            <DialogDescription>Select which documents need to be resubmitted and provide details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Documents to Resubmit</p>
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`doc-${key}`}
                    checked={resubmissionDocs.includes(key)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setResubmissionDocs(prev => [...prev, key]);
                      } else {
                        setResubmissionDocs(prev => prev.filter(d => d !== key));
                      }
                    }}
                    data-testid={`checkbox-doc-${key}`}
                  />
                  <label htmlFor={`doc-${key}`} className="text-sm">{label}</label>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Remarks</p>
              <Textarea
                value={resubmissionRemarks}
                onChange={(e) => setResubmissionRemarks(e.target.value)}
                placeholder="Explain what needs to be corrected..."
                className="min-h-20 resize-none"
                data-testid="input-resubmission-remarks"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResubmissionDialog(false)}>Cancel</Button>
            <Button
              onClick={() => resubmissionMutation.mutate({ documentTypes: resubmissionDocs, remarks: resubmissionRemarks })}
              disabled={resubmissionDocs.length === 0 || !resubmissionRemarks.trim() || resubmissionMutation.isPending}
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
    </div>
  );
}

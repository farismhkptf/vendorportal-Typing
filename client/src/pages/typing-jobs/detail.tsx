import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { 
  FileText, Building2, User, Clock, Calendar, 
  Upload, Download, MessageSquare, Send, 
  AlertCircle, CheckCircle2, Briefcase, MapPin, History,
  Loader2, UserCog
} from "lucide-react";

interface SubmitToVendorError extends Error {
  missingDocumentTypes?: string[];
  status?: number;
}

import { formatDateWithWeekday, formatDateTime } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { toProperCase } from "@/lib/proper-case";
import { queryKeys } from "@/lib/query-keys";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ActivityItem } from "@/components/ui/activity-timeline";
import type { 
  TypingJob, WorkOrder, Company, JobType, Vendor, 
  TypingJobResult, TypingJobComment, File as FileType, User as SchemaUser
} from "@shared/schema";

import { JobHeader, type TypingJobWithDetails } from "./components/job-header";
import { WorkflowActions } from "./components/workflow-actions";
import {
  SubmitToVendorDialog,
  ReassignDialog,
  OnHoldDialog,
  AbortDialog,
  AssignStaffDialog,
} from "./components/workflow-dialogs";
import { TjDetailTabs } from "./components/tj-detail-tabs";

export default function TypingJobDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showOnHoldDialog, setShowOnHoldDialog] = useState(false);
  const [showAbortDialog, setShowAbortDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedAssignUserId, setSelectedAssignUserId] = useState<string>("");
  
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [missingDocumentTypes, setMissingDocumentTypes] = useState<string[]>([]);
  
  const [onHoldReason, setOnHoldReason] = useState("");
  const [abortReason, setAbortReason] = useState("");
  
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [reassignVendorId, setReassignVendorId] = useState("");

  const { data: job, isLoading } = useQuery<TypingJobWithDetails>({
    queryKey: queryKeys.typingJob(id!),
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: queryKeys.vendors,
  });

  const { data: activities = [] } = useQuery<ActivityItem[]>({
    queryKey: queryKeys.auditLogs("typing_job", id!),
    enabled: !!id,
  });

  const { data: staffUsers = [] } = useQuery<Pick<SchemaUser, "id" | "name" | "email" | "role" | "active">[]>({
    queryKey: queryKeys.staffUsers,
  });

  const { data: photoMap } = useQuery<Record<string, string>>({
    queryKey: queryKeys.workOrderPhotos,
  });

  const { data: docCompleteness, isLoading: isDocCompletenessLoading } = useQuery<{ complete: boolean; missingDocumentTypes: string[] }>({
    queryKey: queryKeys.workOrderDocumentCompleteness(job?.woId ?? ""),
    enabled: !!job?.woId && job?.status === "Draft",
  });
  
  const invalidateTypingJobQueries = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.typingJob(id!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.typingJobsAll });
    queryClient.invalidateQueries({ queryKey: queryKeys.auditLogs("typing_job", id!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
    queryClient.invalidateQueries({ queryKey: queryKeys.vendorWallet });
  };

  const applyOptimisticStatus = async (newStatus: TypingJobWithDetails["status"]) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.typingJob(id!) });
    await queryClient.cancelQueries({ queryKey: queryKeys.typingJobsAll });
    const previousDetail = queryClient.getQueryData<TypingJobWithDetails>(queryKeys.typingJob(id!));
    const previousList = queryClient.getQueryData<TypingJob[]>(queryKeys.typingJobsAll);
    if (previousDetail) {
      queryClient.setQueryData<TypingJobWithDetails>(queryKeys.typingJob(id!), { ...previousDetail, status: newStatus });
    }
    if (previousList) {
      queryClient.setQueryData<TypingJob[]>(queryKeys.typingJobsAll, previousList.map(j => j.id === id ? { ...j, status: newStatus } : j));
    }
    return { previousDetail, previousList };
  };

  const rollbackOptimistic = (context: { previousDetail?: TypingJobWithDetails; previousList?: TypingJob[] } | undefined) => {
    if (context?.previousDetail) queryClient.setQueryData(queryKeys.typingJob(id!), context.previousDetail);
    if (context?.previousList) queryClient.setQueryData(queryKeys.typingJobsAll, context.previousList);
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
        <JobHeader
          job={job}
          staffUsers={staffUsers}
          missingDocumentTypes={missingDocumentTypes}
          onDismissMissingDocs={() => setMissingDocumentTypes([])}
        />

        <WorkflowActions
          job={job}
          onSubmitToVendor={() => setShowSubmitDialog(true)}
          onResume={() => resumeMutation.mutate()}
          onOnHold={() => setShowOnHoldDialog(true)}
          onAbort={() => setShowAbortDialog(true)}
          onReassign={() => setShowReassignDialog(true)}
          resumePending={resumeMutation.isPending}
          missingDocumentTypes={docCompleteness?.missingDocumentTypes ?? []}
          submitToVendorPending={job?.status === "Draft" && !!job?.woId && isDocCompletenessLoading}
        />

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

        <TjDetailTabs job={job} activities={activities} photoMap={photoMap} />
      </div>

      <SubmitToVendorDialog
        open={showSubmitDialog}
        onOpenChange={(open) => {
          setShowSubmitDialog(open);
          if (!open) {
            setSelectedVendorId("");
            setMissingDocumentTypes([]);
          }
        }}
        vendors={vendors}
        selectedVendorId={selectedVendorId}
        onVendorChange={setSelectedVendorId}
        missingDocumentTypes={missingDocumentTypes}
        job={job}
        onSubmit={() => submitToVendorMutation.mutate()}
        isPending={submitToVendorMutation.isPending}
      />

      <ReassignDialog
        open={showReassignDialog}
        onOpenChange={setShowReassignDialog}
        vendors={vendors}
        reassignVendorId={reassignVendorId}
        onVendorChange={setReassignVendorId}
        onSubmit={() => reassignMutation.mutate()}
        isPending={reassignMutation.isPending}
      />

      <OnHoldDialog
        open={showOnHoldDialog}
        onOpenChange={setShowOnHoldDialog}
        onHoldReason={onHoldReason}
        onReasonChange={setOnHoldReason}
        onSubmit={() => onHoldMutation.mutate()}
        isPending={onHoldMutation.isPending}
      />

      <AbortDialog
        open={showAbortDialog}
        onOpenChange={setShowAbortDialog}
        abortReason={abortReason}
        onReasonChange={setAbortReason}
        onConfirm={async () => { await abortMutation.mutateAsync(); }}
        isPending={abortMutation.isPending}
      />

      <AssignStaffDialog
        open={showAssignDialog}
        onOpenChange={(open) => {
          setShowAssignDialog(open);
          if (!open) setSelectedAssignUserId("");
        }}
        staffUsers={staffUsers}
        selectedAssignUserId={selectedAssignUserId}
        onUserChange={setSelectedAssignUserId}
        onSubmit={() => assignStaffMutation.mutate(selectedAssignUserId === "__none__" ? null : selectedAssignUserId || null)}
        isPending={assignStaffMutation.isPending}
      />
    </AppLayout>
  );
}

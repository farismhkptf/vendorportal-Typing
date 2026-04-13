import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Send,
  Plus,
  Loader2,
  ClipboardList,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/query-keys";
import type { JobType, Vendor } from "@shared/schema";
import { ExpandedTypingJobCard } from "./expanded-typing-job-card";
import type { WorkOrderDetail, TypingJobWithType } from "./types";

interface WoTypingTabProps {
  workOrder: WorkOrderDetail;
  id: string;
  vendors: Vendor[];
  jobTypes?: JobType[];
  openNewJobForm?: boolean;
  onNewJobFormOpened?: () => void;
}

export function WoTypingTab({ workOrder, id, vendors, jobTypes, openNewJobForm, onNewJobFormOpened }: WoTypingTabProps) {
  const { toast } = useToast();
  const [showNewTypingJobForm, setShowNewTypingJobForm] = useState(false);
  const [typeMedical, setTypeMedical] = useState(true);
  const [typeEid, setTypeEid] = useState(true);
  const [isCreatingJobs, setIsCreatingJobs] = useState(false);
  const [showSendToVendorDialog, setShowSendToVendorDialog] = useState(false);
  const [sendVendorId, setSendVendorId] = useState("");

  const medicalJobType = jobTypes?.find(jt => jt.category === "Medical") || null;
  const eidJobType = jobTypes?.find(jt => jt.category === "EID") || null;

  const draftTypingJobs = workOrder.typingJobs?.filter(j => j.status === "Draft") || [];
  const existingMedicalJob = workOrder.typingJobs?.find(j => j.jobType?.category === "Medical" && j.status !== "Aborted") || null;
  const existingEidJob = workOrder.typingJobs?.find(j => j.jobType?.category === "EID" && j.status !== "Aborted") || null;
  const canCreateNewJob = !existingMedicalJob || !existingEidJob;

  useEffect(() => {
    if (openNewJobForm && canCreateNewJob) {
      setTypeMedical(!existingMedicalJob);
      setTypeEid(!existingEidJob);
      setShowNewTypingJobForm(true);
      onNewJobFormOpened?.();
    }
  }, [openNewJobForm, canCreateNewJob, existingMedicalJob, existingEidJob, onNewJobFormOpened]);

  const handleRefreshWo = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.workOrder(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.typingJobsAll });
  };

  const sendToVendorMutation = useMutation({
    mutationFn: async () => {
      const ids = draftTypingJobs.map(j => j.id);
      return apiRequest("POST", "/api/typing-jobs/bulk-assign-vendor", {
        ids,
        vendorId: sendVendorId,
      });
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workOrder(id) });
      const previousWo = queryClient.getQueryData<WorkOrderDetail>(queryKeys.workOrder(id));
      const jobIds = new Set(draftTypingJobs.map(j => j.id));
      if (previousWo?.typingJobs) {
        queryClient.setQueryData<WorkOrderDetail>(
          queryKeys.workOrder(id),
          { ...previousWo, typingJobs: previousWo.typingJobs.map(j => jobIds.has(j.id) ? { ...j, status: "SubmittedToVendor" } : j) },
        );
      }
      return { previousWo };
    },
    onSuccess: async (res) => {
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
      setShowSendToVendorDialog(false);
      setSendVendorId("");
      if (result.failed > 0) {
        toast({
          title: `${result.updated} job${result.updated !== 1 ? 's' : ''} sent, ${result.failed} failed`,
          description: result.errors?.join(". "),
          variant: "destructive",
        });
      } else {
        toast({ title: `${result.updated} job${result.updated !== 1 ? 's' : ''} sent to vendor`, variant: "success" });
      }
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previousWo) queryClient.setQueryData(queryKeys.workOrder(id), context.previousWo);
      toast({ title: "Failed to send jobs", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrder(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.typingJobsAll });
    },
  });

  const handleCreateTypingJobs = async () => {
    const jobsToCreate: Array<{ woId: string; jobTypeId: string; name: string }> = [];

    if (typeMedical && medicalJobType) {
      jobsToCreate.push({ woId: id, jobTypeId: medicalJobType.id, name: "Medical" });
    }

    if (typeEid && eidJobType) {
      jobsToCreate.push({ woId: id, jobTypeId: eidJobType.id, name: "EID" });
    }

    if (jobsToCreate.length === 0) {
      toast({ title: "Please select at least one job type", variant: "destructive" });
      return;
    }

    setIsCreatingJobs(true);
    const results = { success: 0, failed: 0 };

    for (const job of jobsToCreate) {
      try {
        await apiRequest("POST", "/api/typing-jobs", {
          woId: job.woId,
          jobTypeId: job.jobTypeId,
          status: "Draft",
        });
        results.success++;
      } catch (error) {
        results.failed++;
        const safeJobName = job.name.replace(/[\r\n]/g, " ");
        console.error("Failed to create typing job:", safeJobName, error);
      }
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.typingJobsAll });
    queryClient.invalidateQueries({ queryKey: queryKeys.workOrder(id) });

    setIsCreatingJobs(false);

    if (results.failed === 0) {
      toast({ title: `${results.success} typing job${results.success > 1 ? 's' : ''} created successfully` });
      setShowNewTypingJobForm(false);
      setTypeMedical(true);
      setTypeEid(true);
    } else if (results.success > 0) {
      toast({
        title: "Partial success",
        description: `Created ${results.success} job(s), ${results.failed} failed`,
        variant: "destructive"
      });
      setShowNewTypingJobForm(false);
    } else {
      toast({ title: "Failed to create typing jobs", variant: "destructive" });
    }
  };

  return (
    <>
      <TabsContent value="typing" className="p-3 sm:p-6">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
          <h3 className="font-medium text-foreground">Typing Jobs</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {draftTypingJobs.length > 0 && (
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={() => setShowSendToVendorDialog(true)}
                data-testid="button-send-to-vendor"
              >
                <Send className="h-4 w-4" />
                Send {draftTypingJobs.length > 1 ? `${draftTypingJobs.length} Jobs` : "to Vendor"}
              </Button>
            )}
            {canCreateNewJob && !showNewTypingJobForm && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setTypeMedical(!existingMedicalJob);
                  setTypeEid(!existingEidJob);
                  setShowNewTypingJobForm(true);
                }}
                data-testid="button-new-typing-job"
              >
                <Plus className="h-4 w-4" />
                New Typing Job
              </Button>
            )}
          </div>
        </div>

        {showNewTypingJobForm && (
          <Card className="border border-border/50 mb-4">
            <CardContent className="p-4 space-y-4">
              <h4 className="font-medium text-foreground">Create Typing Job</h4>
              <p className="text-sm text-muted-foreground">
                Select the types of applications to submit for typing:
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="typeMedical"
                    checked={typeMedical}
                    onCheckedChange={(checked) => setTypeMedical(checked === true)}
                    disabled={!!existingMedicalJob}
                    data-testid="checkbox-type-medical"
                  />
                  <Label htmlFor="typeMedical" className={`text-sm font-medium ${existingMedicalJob ? "text-muted-foreground" : "cursor-pointer"}`}>
                    Medical Application
                  </Label>
                  {existingMedicalJob ? (
                    <Link href={`/typing-jobs/${existingMedicalJob.id}`}>
                      <span className="text-xs text-primary hover:underline cursor-pointer">
                        Already exists ({existingMedicalJob.jobCode} · {existingMedicalJob.status})
                      </span>
                    </Link>
                  ) : medicalJobType && (
                    <span className="text-xs text-muted-foreground">
                      (AED {medicalJobType.cost || 0})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="typeEid"
                    checked={typeEid}
                    onCheckedChange={(checked) => setTypeEid(checked === true)}
                    disabled={!!existingEidJob}
                    data-testid="checkbox-type-eid"
                  />
                  <Label htmlFor="typeEid" className={`text-sm font-medium ${existingEidJob ? "text-muted-foreground" : "cursor-pointer"}`}>
                    Emirates ID Application
                  </Label>
                  {existingEidJob ? (
                    <Link href={`/typing-jobs/${existingEidJob.id}`}>
                      <span className="text-xs text-primary hover:underline cursor-pointer">
                        Already exists ({existingEidJob.jobCode} · {existingEidJob.status})
                      </span>
                    </Link>
                  ) : eidJobType && (
                    <span className="text-xs text-muted-foreground">
                      (AED {eidJobType.cost || 0})
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowNewTypingJobForm(false);
                    setTypeMedical(true);
                    setTypeEid(true);
                  }}
                  data-testid="button-cancel-typing-job"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={handleCreateTypingJobs}
                  disabled={isCreatingJobs || (!typeMedical && !typeEid)}
                  data-testid="button-create-typing-job"
                >
                  {isCreatingJobs ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <ClipboardList className="h-4 w-4" />
                      Create Job{typeMedical && typeEid ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {workOrder.typingJobs && workOrder.typingJobs.length > 0 ? (
          <div className="space-y-3">
            {workOrder.typingJobs.map((job: TypingJobWithType) => (
              <ExpandedTypingJobCard key={job.id} job={job} woId={id} onRefresh={handleRefreshWo} />
            ))}
          </div>
        ) : !showNewTypingJobForm && (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No typing jobs"
            description="Create a typing job to send to the vendor."
          />
        )}
      </TabsContent>

      <Dialog open={showSendToVendorDialog} onOpenChange={setShowSendToVendorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Vendor</DialogTitle>
            <DialogDescription>
              Select a vendor to assign {draftTypingJobs.length > 1 ? `${draftTypingJobs.length} draft jobs` : "this draft job"} to. Each job will be tracked independently.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Select value={sendVendorId} onValueChange={setSendVendorId}>
                <SelectTrigger data-testid="select-send-vendor">
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
            <div className="space-y-2">
              <Label className="text-muted-foreground">Jobs to send</Label>
              <div className="space-y-2">
                {draftTypingJobs.map((job: TypingJobWithType) => {
                  const category = job.jobType?.category;
                  const cost = job.jobType?.cost || 0;
                  return (
                    <div key={job.id} className="flex items-center justify-between gap-2 p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium">
                          {category === "Medical" ? "Medical" : category === "EID" ? "Emirates ID" : "Typing"}
                        </span>
                        {job.jobCode && (
                          <span className="text-xs text-muted-foreground font-mono">{job.jobCode}</span>
                        )}
                      </div>
                      <span className="text-sm font-semibold shrink-0">AED {cost}</span>
                    </div>
                  );
                })}
              </div>
              {draftTypingJobs.length > 1 && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-sm font-semibold">
                    AED {draftTypingJobs.reduce((sum: number, job: TypingJobWithType) => sum + (job.jobType?.cost || 0), 0)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowSendToVendorDialog(false); setSendVendorId(""); }} data-testid="button-cancel-send-vendor">
              Cancel
            </Button>
            <Button
              onClick={() => sendToVendorMutation.mutate()}
              disabled={!sendVendorId || sendToVendorMutation.isPending}
              className="gap-2"
              data-testid="button-confirm-send-vendor"
            >
              {sendToVendorMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send {draftTypingJobs.length > 1 ? `${draftTypingJobs.length} Jobs` : "to Vendor"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

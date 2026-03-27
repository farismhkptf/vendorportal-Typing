import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import {
  ArrowLeft,
  Home,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  PlayCircle,
  AlertTriangle,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WorkOrder, ServiceType } from "@shared/schema";
import type { WorkOrderDetail } from "./types";

interface WoDetailHeaderProps {
  workOrder: WorkOrderDetail;
  serviceTypes?: ServiceType[];
  isCrm: boolean;
  onEdit: () => void;
}

export function WoDetailHeader({ workOrder, serviceTypes, isCrm, onEdit }: WoDetailHeaderProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const id = workOrder.id;

  const [woDeletionRequest, setWoDeletionRequest] = useState<{ reason: string } | null>(null);
  const [woDeletionReason, setWoDeletionReason] = useState("");
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [showDeliverDialog, setShowDeliverDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [activateEntryPermit, setActivateEntryPermit] = useState(false);
  const [activateChangeStatus, setActivateChangeStatus] = useState(false);
  const [activateIsMinor, setActivateIsMinor] = useState<"adult" | "minor">("adult");

  const activateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/work-orders/${id}/activate`, {
        isMinor: activateIsMinor === "minor",
      });
      return res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workOrder(id) });
      await queryClient.cancelQueries({ queryKey: queryKeys.workOrders });
      const previousDetail = queryClient.getQueryData<WorkOrderDetail>(queryKeys.workOrder(id));
      const previousList = queryClient.getQueryData<WorkOrder[]>(queryKeys.workOrders);
      if (previousDetail) {
        queryClient.setQueryData<WorkOrderDetail>(queryKeys.workOrder(id), { ...previousDetail, status: "Scheduled" });
      }
      if (previousList) {
        queryClient.setQueryData<WorkOrder[]>(queryKeys.workOrders, previousList.map(wo => wo.id === id ? { ...wo, status: "Scheduled" } : wo));
      }
      return { previousDetail, previousList };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
      setShowActivateDialog(false);
      setActivateEntryPermit(false);
      setActivateChangeStatus(false);
      setActivateIsMinor("adult");
      toast({ title: "Work order activated", description: "The work order is now active and ready for processing.", variant: "success" });
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previousDetail) queryClient.setQueryData(queryKeys.workOrder(id), context.previousDetail);
      if (context?.previousList) queryClient.setQueryData(queryKeys.workOrders, context.previousList);
      toast({ title: "Failed to activate", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrder(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders });
    },
  });

  const deliverMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", `/api/work-orders/${id}`, { status: "Completed" });
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workOrder(id) });
      await queryClient.cancelQueries({ queryKey: queryKeys.workOrders });
      const previousDetail = queryClient.getQueryData<WorkOrderDetail>(queryKeys.workOrder(id));
      const previousList = queryClient.getQueryData<WorkOrder[]>(queryKeys.workOrders);
      if (previousDetail) {
        queryClient.setQueryData<WorkOrderDetail>(queryKeys.workOrder(id), { ...previousDetail, status: "Completed" });
      }
      if (previousList) {
        queryClient.setQueryData<WorkOrder[]>(queryKeys.workOrders, previousList.map(wo => wo.id === id ? { ...wo, status: "Completed" } : wo));
      }
      return { previousDetail, previousList };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
      setShowDeliverDialog(false);
      toast({ title: "Work order completed", description: "The work order has been marked as completed and delivered.", variant: "success" });
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previousDetail) queryClient.setQueryData(queryKeys.workOrder(id), context.previousDetail);
      if (context?.previousList) queryClient.setQueryData(queryKeys.workOrders, context.previousList);
      toast({ title: "Failed to complete", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrder(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/work-orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders });
      toast({ title: "Work order deleted" });
      setLocation("/work-orders");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const requestWoDeletionMutation = useMutation({
    mutationFn: async ({ reason }: { reason: string }) => {
      const res = await apiRequest("POST", "/api/deletion-requests", {
        entityType: "work_order",
        entityId: id,
        entityLabel: `WO ${workOrder.woNumber} — ${workOrder.applicantName}`,
        reason,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deletion request submitted", description: "Admin will review your request." });
      setWoDeletionRequest(null);
      setWoDeletionReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to submit request", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <PageHeader
        title={workOrder.woNumber}
        subtitle={workOrder.applicantName ? workOrder.applicantName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") : ""}
        breadcrumbs={[
          { label: "Work Orders", href: "/work-orders" },
          { label: workOrder.woNumber }
        ]}
        actions={
          <div className="flex items-center flex-wrap gap-2">
            <StatusBadge status={workOrder.status} isDelayed={!!workOrder.isDelayed} />
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5" 
              onClick={onEdit}
              data-testid="button-edit-wo"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            {isCrm ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive"
                  onClick={() => setWoDeletionRequest({ reason: "" })}
                  data-testid="button-delete-wo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Request Deletion
                </Button>
                <Dialog
                  open={!!woDeletionRequest}
                  onOpenChange={(open) => { if (!open) { setWoDeletionRequest(null); setWoDeletionReason(""); } }}
                >
                  <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Request Work Order Deletion</DialogTitle>
                      <DialogDescription>As CRM, deletions require Admin approval. Submit a request with a reason.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Work Order</p>
                        <p className="text-sm font-medium">{workOrder.woNumber} — {workOrder.applicantName}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Reason *</p>
                        <Input
                          placeholder="Why should this work order be deleted?"
                          value={woDeletionReason}
                          onChange={(e) => setWoDeletionReason(e.target.value)}
                          data-testid="input-wo-deletion-reason"
                        />
                      </div>
                    </div>
                    <DialogFooter className="gap-2 mt-2">
                      <Button variant="outline" onClick={() => { setWoDeletionRequest(null); setWoDeletionReason(""); }} data-testid="button-cancel-wo-deletion">Cancel</Button>
                      <Button
                        disabled={!woDeletionReason.trim() || requestWoDeletionMutation.isPending}
                        onClick={() => {
                          if (!woDeletionReason.trim()) return;
                          requestWoDeletionMutation.mutate({ reason: woDeletionReason.trim() });
                        }}
                        data-testid="button-submit-wo-deletion"
                      >
                        {requestWoDeletionMutation.isPending ? "Submitting..." : "Submit Request"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => setShowDeleteDialog(true)} data-testid="button-delete-wo">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
                <ConfirmationDialog
                  open={showDeleteDialog}
                  onOpenChange={setShowDeleteDialog}
                  title="Delete Work Order"
                  description={`Are you sure you want to delete work order ${workOrder.woNumber}? This action cannot be undone.`}
                  confirmLabel="Delete"
                  destructive
                  onConfirm={async () => { await deleteMutation.mutateAsync(); }}
                  loading={deleteMutation.isPending}
                >
                  {((workOrder.typingJobs?.length || 0) > 0 || (workOrder.appointments?.length || 0) > 0) && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm space-y-1">
                      <p className="font-medium text-destructive">The following will also be deleted:</p>
                      {(workOrder.typingJobs?.length || 0) > 0 && (
                        <p>• {workOrder.typingJobs!.length} typing job{workOrder.typingJobs!.length > 1 ? "s" : ""}</p>
                      )}
                      {(workOrder.appointments?.length || 0) > 0 && (
                        <p>• {workOrder.appointments!.length} appointment{workOrder.appointments!.length > 1 ? "s" : ""}</p>
                      )}
                      <p>• All associated documents, notes, and files</p>
                    </div>
                  )}
                </ConfirmationDialog>
              </>
            )}
            <div className="flex items-center gap-1">
              <Link href="/work-orders">
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
          </div>
        }
      />

      <Dialog open={showActivateDialog} onOpenChange={(open) => {
        if (!open) {
          setActivateEntryPermit(false);
          setActivateChangeStatus(false);
          setActivateIsMinor("adult");
        }
        setShowActivateDialog(open);
      }}>
        <DialogContent className="rounded-2xl max-w-md" data-testid="dialog-activate-wo">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" />
              Activate Work Order
            </DialogTitle>
            <DialogDescription>
              Confirm that the required external approvals have been obtained before activating.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Required Approvals</p>
              <div
                className="flex items-center gap-3 p-3 rounded-lg border border-border/60 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => setActivateEntryPermit(!activateEntryPermit)}
                data-testid="checkbox-entry-permit"
              >
                <Checkbox
                  checked={activateEntryPermit}
                  onCheckedChange={(v) => setActivateEntryPermit(!!v)}
                  id="entry-permit"
                />
                <label htmlFor="entry-permit" className="text-sm cursor-pointer select-none">
                  Entry Permit has been approved
                </label>
              </div>
              <div
                className="flex items-center gap-3 p-3 rounded-lg border border-border/60 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => setActivateChangeStatus(!activateChangeStatus)}
                data-testid="checkbox-change-status"
              >
                <Checkbox
                  checked={activateChangeStatus}
                  onCheckedChange={(v) => setActivateChangeStatus(!!v)}
                  id="change-status"
                />
                <label htmlFor="change-status" className="text-sm cursor-pointer select-none">
                  Change Status has been approved
                </label>
              </div>
            </div>

            {serviceTypes?.find(st => st.id === workOrder.serviceTypeId)?.isDependent && (
              <div className="space-y-3 pt-1">
                <p className="text-sm font-medium text-foreground">Applicant Age</p>
                <p className="text-xs text-muted-foreground -mt-2">This is a dependent visa. Medical typing may not be required for minors.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setActivateIsMinor("adult")}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors",
                      activateIsMinor === "adult"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border/60 text-muted-foreground hover:bg-muted/40"
                    )}
                    data-testid="radio-adult"
                  >
                    <User className="h-4 w-4" />
                    Adult
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivateIsMinor("minor")}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors",
                      activateIsMinor === "minor"
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                        : "border-border/60 text-muted-foreground hover:bg-muted/40"
                    )}
                    data-testid="radio-minor"
                  >
                    <User className="h-4 w-4" />
                    Minor (under 18)
                  </button>
                </div>
                {activateIsMinor === "minor" && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Medical typing and scheduling will be skipped for this work order.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setShowActivateDialog(false)}
              data-testid="button-cancel-activate"
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl gap-1.5"
              disabled={!activateEntryPermit || !activateChangeStatus || activateMutation.isPending}
              onClick={() => activateMutation.mutate()}
              data-testid="button-confirm-activate"
            >
              {activateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" />
                  Activate Work Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeliverDialog} onOpenChange={setShowDeliverDialog}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-deliver">
          <DialogHeader>
            <DialogTitle>Complete & Deliver</DialogTitle>
            <DialogDescription>
              Mark this work order as completed and delivered. This will change the status to "Completed".
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/20 dark:border-emerald-800 p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>All pipeline steps are complete for <strong>{workOrder.woNumber}</strong></span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setShowDeliverDialog(false)}
              data-testid="button-cancel-deliver"
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              disabled={deliverMutation.isPending}
              onClick={() => deliverMutation.mutate()}
              data-testid="button-confirm-deliver"
            >
              {deliverMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Complete & Deliver
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

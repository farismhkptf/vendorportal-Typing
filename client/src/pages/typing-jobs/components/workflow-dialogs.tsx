import { XCircle, Loader2 } from "lucide-react";
import { DOCUMENT_TYPE_LABELS } from "@/components/documents/document-types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Vendor, User as SchemaUser } from "@shared/schema";
import type { TypingJobWithDetails } from "./job-header";

interface SubmitToVendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendors: Vendor[];
  selectedVendorId: string;
  onVendorChange: (id: string) => void;
  missingDocumentTypes: string[];
  job: TypingJobWithDetails | undefined;
  onSubmit: () => void;
  isPending: boolean;
}

export function SubmitToVendorDialog({
  open,
  onOpenChange,
  vendors,
  selectedVendorId,
  onVendorChange,
  missingDocumentTypes,
  job,
  onSubmit,
  isPending,
}: SubmitToVendorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Select value={selectedVendorId} onValueChange={onVendorChange}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!selectedVendorId || isPending}
            data-testid="button-confirm-submit"
          >
            {isPending ? (
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
  );
}

interface ReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendors: Vendor[];
  reassignVendorId: string;
  onVendorChange: (id: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function ReassignDialog({
  open,
  onOpenChange,
  vendors,
  reassignVendorId,
  onVendorChange,
  onSubmit,
  isPending,
}: ReassignDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Re-assign Job to Vendor</DialogTitle>
          <DialogDescription>Select a vendor to re-assign this job to.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Vendor</label>
          <Select value={reassignVendorId} onValueChange={onVendorChange}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={onSubmit}
            disabled={!reassignVendorId || isPending}
            data-testid="button-confirm-reassign"
          >
            {isPending ? "Reassigning..." : "Re-assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface OnHoldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHoldReason: string;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function OnHoldDialog({
  open,
  onOpenChange,
  onHoldReason,
  onReasonChange,
  onSubmit,
  isPending,
}: OnHoldDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="e.g., Waiting for client confirmation..."
              rows={3}
              data-testid="input-on-hold-reason"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isPending}
            data-testid="button-confirm-on-hold"
          >
            {isPending ? (
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
  );
}

interface AbortDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  abortReason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => Promise<void>;
  isPending: boolean;
}

export function AbortDialog({
  open,
  onOpenChange,
  abortReason,
  onReasonChange,
  onConfirm,
  isPending,
}: AbortDialogProps) {
  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Abort Job"
      description="This will cancel the job permanently. This action cannot be undone, but the job can be re-assigned to a vendor later."
      confirmLabel="Abort Job"
      destructive
      onConfirm={onConfirm}
      loading={isPending}
    >
      <div className="space-y-2">
        <Label>Reason (optional)</Label>
        <Textarea
          value={abortReason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="e.g., Client cancelled the request..."
          rows={3}
          data-testid="input-abort-reason"
        />
      </div>
    </ConfirmationDialog>
  );
}

interface AssignStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffUsers: Pick<SchemaUser, "id" | "name" | "email" | "role" | "active">[];
  selectedAssignUserId: string;
  onUserChange: (id: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function AssignStaffDialog({
  open,
  onOpenChange,
  staffUsers,
  selectedAssignUserId,
  onUserChange,
  onSubmit,
  isPending,
}: AssignStaffDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Select value={selectedAssignUserId} onValueChange={onUserChange}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={onSubmit}
            disabled={isPending}
            data-testid="button-confirm-assign"
          >
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</>
            ) : "Save Assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import {
  Calendar, Stethoscope, CreditCard,
  Building2, User, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDateWithWeekday, formatTime } from "@/lib/format-date";
import { toProperCase } from "@/lib/proper-case";
import type { AppointmentWithRelations } from "./types";

interface ConfirmDialogState {
  open: boolean;
  type: "complete" | "cancel" | "reschedule" | "follow_up";
  appointment: AppointmentWithRelations | null;
  reason: string;
}

interface AppointmentConfirmationDialogProps {
  confirmDialog: ConfirmDialogState;
  onClose: () => void;
  onConfirm: () => void;
  onReasonChange: (reason: string) => void;
  isPending: boolean;
}

export function AppointmentConfirmationDialog({
  confirmDialog,
  onClose,
  onConfirm,
  onReasonChange,
  isPending,
}: AppointmentConfirmationDialogProps) {
  const apt = confirmDialog.appointment;
  const { type } = confirmDialog;

  const titles: Record<typeof type, string> = {
    complete: "Appointment Done",
    cancel: "Cancel Appointment",
    reschedule: "Reschedule Appointment",
    follow_up: "Mark Follow-Up Required",
  };

  const descriptions: Record<typeof type, string> = {
    complete: "This will mark the appointment as completed.",
    cancel: "This will cancel the appointment. You'll have 15 seconds to undo.",
    reschedule: "This will mark the current appointment as rescheduled and take you to schedule a new one for the same work order.",
    follow_up: "This will mark the medical appointment as requiring a follow-up retest.",
  };

  const confirmLabels: Record<typeof type, string> = {
    complete: "Appointment Done",
    cancel: "Cancel Appointment",
    reschedule: "Reschedule",
    follow_up: "Mark Follow-Up Required",
  };

  const isDestructive = type === "cancel";
  const requiresReason = type === "cancel" || type === "reschedule";
  const reasonEmpty = requiresReason && !confirmDialog.reason.trim();

  return (
    <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDestructive && <AlertCircle className="h-5 w-5 text-destructive" />}
            {titles[type]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">{descriptions[type]}</p>

          {apt && (
            <div className="rounded-lg border border-border/40 bg-muted/30 p-3 space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium">{apt.workOrder?.applicantName ? toProperCase(apt.workOrder.applicantName) : "Unknown"}</span>
                {apt.workOrder?.woNumber && (
                  <span className="text-muted-foreground font-mono text-xs ml-auto">{apt.workOrder.woNumber}</span>
                )}
              </div>
              {apt.workOrder?.company?.name && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{toProperCase(apt.workOrder.company.name)}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                {apt.type === "Medical" ? (
                  <Stethoscope className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="text-muted-foreground">
                  {apt.type} · {formatDateWithWeekday(apt.datetime)} at {formatTime(apt.datetime)}
                </span>
              </div>
              {apt.center?.name && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{apt.center.name}</span>
                </div>
              )}
              {apt.applicationNumber && type === "reschedule" && (
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 shrink-0 text-center text-xs font-bold text-muted-foreground">#</span>
                  <span className="text-muted-foreground">App # {apt.applicationNumber}</span>
                </div>
              )}
            </div>
          )}

          {requiresReason && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                {type === "cancel" ? "Reason for cancellation" : "Reason for rescheduling"}
                <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder={type === "cancel" ? "e.g. Applicant unavailable, Center closed..." : "e.g. Center unavailable, Client request..."}
                className="h-16 text-sm resize-none"
                value={confirmDialog.reason}
                onChange={(e) => onReasonChange(e.target.value)}
                data-testid={`textarea-${type}-reason`}
                autoFocus
              />
              {reasonEmpty && (
                <p className="text-xs text-muted-foreground">A reason is required to proceed.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-confirm-cancel">
            Go Back
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isPending || reasonEmpty}
            data-testid="button-confirm-ok"
          >
            {isPending ? "Processing..." : confirmLabels[type]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

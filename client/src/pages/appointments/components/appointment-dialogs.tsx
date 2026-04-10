import DOMPurify from "dompurify";
import {
  Calendar, Stethoscope, CreditCard,
  Building2, User,
  Mail, MessageCircle, Copy, Check, Maximize2,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateWithWeekday, formatTime } from "@/lib/format-date";
import { toProperCase } from "@/lib/proper-case";
import type { Staff } from "@shared/schema";
import type { AppointmentWithRelations } from "./types";

interface ConfirmDialogState {
  open: boolean;
  type: "complete" | "cancel" | "reschedule" | "follow_up";
  appointment: AppointmentWithRelations | null;
}

interface AppointmentConfirmationDialogProps {
  confirmDialog: ConfirmDialogState;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function AppointmentConfirmationDialog({
  confirmDialog,
  onClose,
  onConfirm,
  isPending,
}: AppointmentConfirmationDialogProps) {
  return (
    <ConfirmationDialog
      open={confirmDialog.open}
      onOpenChange={(open) => !open && onClose()}
      title={
        confirmDialog.type === "complete" ? "Mark as Completed" :
        confirmDialog.type === "cancel" ? "Cancel Appointment" :
        confirmDialog.type === "reschedule" ? "Reschedule Appointment" :
        "Mark Follow-Up Required"
      }
      description={
        confirmDialog.type === "complete" ? "This will mark the appointment as completed." :
        confirmDialog.type === "cancel" ? "This will cancel the appointment. This action cannot be undone." :
        confirmDialog.type === "reschedule" ? "This will mark the current appointment as rescheduled and take you to schedule a new one for the same work order." :
        "This will mark the medical appointment as requiring a follow-up retest. You can then schedule a follow-up appointment at the designated center."
      }
      confirmLabel={
        confirmDialog.type === "complete" ? "Mark Completed" :
        confirmDialog.type === "cancel" ? "Cancel Appointment" :
        confirmDialog.type === "follow_up" ? "Mark Follow-Up Required" :
        "Reschedule"
      }
      cancelLabel="Go Back"
      destructive={confirmDialog.type === "cancel"}
      onConfirm={onConfirm}
      loading={isPending}
    >
      {confirmDialog.appointment && (
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Applicant:</span>{" "}
            <span className="font-medium">{confirmDialog.appointment.workOrder?.applicantName ? toProperCase(confirmDialog.appointment.workOrder.applicantName) : "Unknown"}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Type:</span>{" "}
            <span className="font-medium">{confirmDialog.appointment.type}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Date:</span>{" "}
            <span className="font-medium">{formatDateWithWeekday(confirmDialog.appointment.datetime)} at {formatTime(confirmDialog.appointment.datetime)}</span>
          </p>
        </div>
      )}
    </ConfirmationDialog>
  );
}

interface MessagesDialogProps {
  viewMessagesApt: AppointmentWithRelations | null;
  onClose: () => void;
  viewMessagesData: { emailBody: string; whatsappBody: string } | null;
  viewEmailPreviewHtml: string;
  messageCopied: "email" | "whatsapp" | null;
  onCopyMessage: (type: "email" | "whatsapp") => void;
  onFullscreen: () => void;
}

export function MessagesDialog({
  viewMessagesApt,
  onClose,
  viewMessagesData,
  viewEmailPreviewHtml,
  messageCopied,
  onCopyMessage,
  onFullscreen,
}: MessagesDialogProps) {
  return (
    <Dialog open={!!viewMessagesApt} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {viewMessagesApt?.type === "Medical" ? (
              <Stethoscope className="h-5 w-5 text-emerald-600" />
            ) : (
              <CreditCard className="h-5 w-5 text-blue-600" />
            )}
            Appointment Messages
          </DialogTitle>
        </DialogHeader>

        {viewMessagesData && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{toProperCase(viewMessagesApt?.workOrder?.applicantName || "")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{toProperCase(viewMessagesApt?.workOrder?.company?.name || "")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {viewMessagesApt ? formatDateWithWeekday(viewMessagesApt.datetime) : ""} at {viewMessagesApt ? formatTime(viewMessagesApt.datetime) : ""}
                  </span>
                </div>
              </div>
            </div>

            <Tabs defaultValue="email">
              <TabsList className="w-full">
                <TabsTrigger value="email" className="flex-1 gap-1.5" data-testid="tab-view-email">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="whatsapp" className="flex-1 gap-1.5" data-testid="tab-view-whatsapp">
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="space-y-3 mt-3">
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  {viewEmailPreviewHtml ? (
                    <iframe
                      srcDoc={viewEmailPreviewHtml}
                      className="w-full"
                      style={{ height: "320px", border: "none" }}
                      sandbox="allow-same-origin"
                      title="Email Preview"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                      Loading email preview…
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => onCopyMessage("email")}
                    className="gap-2"
                    data-testid="button-copy-email-message"
                  >
                    {messageCopied === "email" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {messageCopied === "email" ? "Copied!" : "Copy Email"}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onFullscreen}
                    data-testid="button-email-fullscreen"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="whatsapp" className="space-y-3 mt-3">
                <div className="rounded-lg border border-border/50 bg-muted/20 p-4 max-h-[40vh] overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-foreground">
                    {viewMessagesData.whatsappBody}
                  </pre>
                </div>
                <Button
                  onClick={() => onCopyMessage("whatsapp")}
                  className="gap-2"
                  data-testid="button-copy-whatsapp-message"
                >
                  {messageCopied === "whatsapp" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {messageCopied === "whatsapp" ? "Copied!" : "Copy WhatsApp"}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EmailDraftDialogProps {
  viewEmailDraftApt: AppointmentWithRelations | null;
  onClose: () => void;
  staffList?: Staff[];
}

export function EmailDraftDialog({
  viewEmailDraftApt,
  onClose,
  staffList,
}: EmailDraftDialogProps) {
  return (
    <Dialog open={!!viewEmailDraftApt} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden p-0">
        <DialogHeader className={`px-6 py-4 border-b ${viewEmailDraftApt?.type === "Medical" ? "bg-gradient-to-r from-emerald-700 to-emerald-900" : "bg-gradient-to-r from-blue-600 to-blue-800"}`}>
          <DialogTitle className="text-white flex items-center gap-2">
            {viewEmailDraftApt?.type === "Medical" ? (
              <Stethoscope className="h-5 w-5" />
            ) : (
              <CreditCard className="h-5 w-5" />
            )}
            Stored Email Draft
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pt-4 pb-2">
          {viewEmailDraftApt && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30 mb-4">
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{toProperCase(viewEmailDraftApt.workOrder?.applicantName || "")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{toProperCase(viewEmailDraftApt.workOrder?.company?.name || "")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {formatDateWithWeekday(viewEmailDraftApt.datetime)} at {formatTime(viewEmailDraftApt.datetime)}
                  </span>
                </div>
                <StatusBadge status={viewEmailDraftApt.status} />
                {viewEmailDraftApt.assignedStaffId && staffList && (() => {
                  const s = staffList.find(st => st.id === viewEmailDraftApt.assignedStaffId);
                  return s ? (
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">{s.name}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          )}
        </div>
        <div className="px-6 pb-4 overflow-y-auto max-h-[calc(85vh-200px)]">
          {viewEmailDraftApt?.emailDraft ? (
            <div
              className="rounded-lg border border-border/50 p-4 bg-white dark:bg-gray-950"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewEmailDraftApt.emailDraft, { FORCE_BODY: true }) }}
              data-testid="email-draft-content"
            />
          ) : (
            <EmptyState
              icon={<Mail className="h-6 w-6" />}
              title="No email draft stored"
              description="This appointment was created before email draft storage was enabled."
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface FullscreenPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewMessagesApt: AppointmentWithRelations | null;
  viewEmailPreviewHtml: string;
  messageCopied: "email" | "whatsapp" | null;
  onCopyMessage: (type: "email" | "whatsapp") => void;
}

export function FullscreenPreviewDialog({
  open,
  onOpenChange,
  viewMessagesApt,
  viewEmailPreviewHtml,
  messageCopied,
  onCopyMessage,
}: FullscreenPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className={`px-6 py-4 border-b ${viewMessagesApt?.type === "Medical" ? "bg-gradient-to-r from-emerald-700 to-emerald-900" : "bg-gradient-to-r from-blue-600 to-blue-800"}`}>
          <DialogTitle className="text-white flex items-center gap-2">
            {viewMessagesApt?.type === "Medical" ? (
              <Stethoscope className="h-5 w-5" />
            ) : (
              <CreditCard className="h-5 w-5" />
            )}
            Email Preview
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {viewEmailPreviewHtml ? (
            <iframe
              srcDoc={viewEmailPreviewHtml}
              className="w-full"
              style={{ height: "calc(90vh - 200px)", border: "none" }}
              sandbox="allow-same-origin"
              title="Email Preview Full"
            />
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Loading email preview…
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t flex items-center justify-end gap-2">
          <Button
            onClick={() => onCopyMessage("email")}
            className="gap-2"
            data-testid="button-fullscreen-copy-email"
          >
            {messageCopied === "email" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {messageCopied === "email" ? "Copied!" : "Copy Email"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

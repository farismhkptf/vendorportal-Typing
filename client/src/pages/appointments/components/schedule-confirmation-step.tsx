import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import {
  Check, Building2, User, Mail, Copy, MessageSquare,
  CheckCircle2, Pencil, Maximize2, X, Plus
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatTime12h } from "@/lib/format-date";
import { toProperCase } from "@/lib/proper-case";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Center, Staff, Company } from "@shared/schema";
import type { AppointmentForm, SchedulingQueueItem, SchedulerType } from "./schedule-shared-types";
import { getSchedulerConfig } from "./schedule-shared-types";

interface ScheduleConfirmationStepProps {
  schedulerType: SchedulerType;
  form: UseFormReturn<AppointmentForm>;
  selectedQueueItem: SchedulingQueueItem;
  selectedCompany: Company | null;
  selectedCenter: Center | undefined;
  centers?: Center[];
  companyAssist: Staff | null;
  companyCRM: Staff | null;
  emailPreview: string;
  whatsappPreview: string;
  previewHtml: string;
  scheduledApptId: string | null;
  emailSendStatus: "idle" | "sending" | "sent" | "failed";
  setEmailSendStatus: (s: "idle" | "sending" | "sent" | "failed") => void;
  emailSentTo: string | null;
  setEmailSentTo: (v: string | null) => void;
  overrideEmail: string | null;
  setOverrideEmail: (v: string | null) => void;
  onEditDetails: () => void;
  onRegeneratePreviews: () => void;
  companyEmailsList?: Array<{ id: string; label: string; email: string }>;
}

export function ScheduleConfirmationStep({
  schedulerType,
  form,
  selectedQueueItem,
  selectedCompany,
  selectedCenter,
  centers,
  companyAssist,
  companyCRM,
  emailPreview,
  whatsappPreview,
  previewHtml,
  scheduledApptId,
  emailSendStatus,
  setEmailSendStatus,
  emailSentTo,
  setEmailSentTo,
  overrideEmail,
  setOverrideEmail,
  onEditDetails,
  onRegeneratePreviews,
  companyEmailsList,
}: ScheduleConfirmationStepProps) {
  const { toast } = useToast();
  const config = getSchedulerConfig(schedulerType);
  const prefix = schedulerType === "EID" ? "eid-" : "";
  const [messageCopied, setMessageCopied] = useState<"email" | "whatsapp" | null>(null);
  const [emailFullscreen, setEmailFullscreen] = useState(false);
  const [confirmEmailDialogOpen, setConfirmEmailDialogOpen] = useState(false);
  const [customEmailInput, setCustomEmailInput] = useState("");
  const [emailPopoverOpen, setEmailPopoverOpen] = useState(false);

  const sendEmailMutation = useMutation({
    mutationFn: async (apptId: string) => {
      const res = await apiRequest("POST", `/api/appointments/${apptId}/send-email`, overrideEmail ? { overrideEmail } : undefined);
      return res.json();
    },
    onSuccess: (data: { sentTo: string }) => {
      setEmailSendStatus("sent");
      setEmailSentTo(data.sentTo);
      toast({
        title: "Email sent",
        description: `Confirmation sent to ${data.sentTo}.`,
        variant: "success",
      });
    },
    onError: (error: Error) => {
      setEmailSendStatus("failed");
      toast({
        title: "Email failed",
        description: error.message || "Could not send email.",
        variant: "destructive",
      });
    },
  });

  const handleCopyMessage = async (type: "email" | "whatsapp") => {
    if (type === "whatsapp") {
      await navigator.clipboard.writeText(whatsappPreview);
    } else {
      const htmlToCopy = previewHtml || emailPreview;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([htmlToCopy], { type: "text/html" }),
            "text/plain": new Blob([emailPreview], { type: "text/plain" }),
          }),
        ]);
      } catch {
        await navigator.clipboard.writeText(emailPreview);
      }
    }
    setMessageCopied(type);
    setTimeout(() => setMessageCopied(null), 2000);
    toast({
      title: "Copied!",
      description: `${type === "email" ? "Email (with formatting)" : "WhatsApp"} message copied to clipboard.`,
    });
  };

  const assistLabel = schedulerType === "Medical" ? "Medical Assist" : "Assist";
  const gradientFrom = schedulerType === "Medical" ? "#4a7c59" : "#2563eb";
  const gradientTo = schedulerType === "Medical" ? "#2d5a3d" : "#1e40af";

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold tracking-tight">Review & Send</h2>
        <p className="text-sm text-muted-foreground">Preview and send appointment notification</p>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Appointment Summary
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onEditDetails}
              className="gap-1.5 text-xs"
              data-testid={`${prefix}button-edit-details`}
            >
              <Pencil className="h-3 w-3" />
              Edit Details
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Work Order:</span>
              <span className="ml-2 font-medium">{selectedQueueItem?.woNumber}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Applicant:</span>
              <span className="ml-2 font-medium">{toProperCase(selectedQueueItem?.applicantName || "")}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Company:</span>
              <span className="ml-2 font-medium">{toProperCase(selectedCompany?.name || "")}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Center:</span>
              <span className="ml-2 font-medium">{selectedCenter?.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Date:</span>
              <span className="ml-2 font-medium">
                {new Date(form.getValues("appointmentDate")).toLocaleDateString("en-GB")}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Time:</span>
              <span className="ml-2 font-medium">{formatTime12h(form.getValues("appointmentTime"))}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{assistLabel}:</span>
              <span className="ml-2 font-medium">{companyAssist?.name || "Not assigned"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">CRM:</span>
              <span className="ml-2 font-medium">{companyCRM?.name || "Not assigned"}</span>
            </div>
            {form.getValues("applicationNumber") && (
              <div>
                <span className="text-muted-foreground">App No:</span>
                <span className="ml-2 font-medium">{form.getValues("applicationNumber")}</span>
              </div>
            )}
          </div>
          <div className="pt-2 border-t">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">Notes (editable)</label>
              <Textarea
                value={form.getValues("notes") || ""}
                placeholder="Add any notes for this appointment..."
                className="text-sm h-16 resize-none"
                onChange={(e) => {
                  form.setValue("notes", e.target.value);
                  onRegeneratePreviews();
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email" data-testid={`${prefix}tab-email`}>
            <Mail className="h-4 w-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger value="whatsapp" data-testid={`${prefix}tab-whatsapp`}>
            <MessageSquare className="h-4 w-4 mr-2" />
            WhatsApp
          </TabsTrigger>
        </TabsList>
        <TabsContent value="email">
          <div className="space-y-3">
            {emailSendStatus === "sent" ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" data-testid={`text-${prefix}email-recipient`}>
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span>Sent to {emailSentTo}</span>
              </div>
            ) : emailSendStatus === "failed" ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-destructive/10 text-destructive" data-testid={`text-${prefix}email-recipient`}>
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span>Failed — will retry to {overrideEmail || selectedQueueItem?.applicantEmail}</span>
              </div>
            ) : emailSendStatus === "sending" ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-muted/40 text-muted-foreground" data-testid={`text-${prefix}email-recipient`}>
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span>Sending to {overrideEmail || selectedQueueItem?.applicantEmail}…</span>
              </div>
            ) : (
              <Popover open={emailPopoverOpen} onOpenChange={setEmailPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-muted/40 text-muted-foreground hover:bg-muted/70 transition-colors cursor-pointer text-left"
                    data-testid={`button-${prefix}email-recipient`}
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">
                      {overrideEmail
                        ? <><span className="text-foreground font-medium">{overrideEmail}</span> <span className="text-muted-foreground/70">(overridden)</span></>
                        : selectedQueueItem?.applicantEmail
                        ? <>Will send to <span className="text-foreground font-medium">{selectedQueueItem.applicantEmail}</span></>
                        : "No email on file — tap to set recipient"}
                    </span>
                    <Plus className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="start" data-testid={`popover-${prefix}email-recipient`}>
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground">Select or enter email recipient</p>
                    {selectedQueueItem?.applicantEmail && (
                      <button
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-colors text-left ${(!overrideEmail || overrideEmail === selectedQueueItem.applicantEmail) ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/40"}`}
                        onClick={() => { setOverrideEmail(null); setEmailPopoverOpen(false); }}
                        data-testid={`button-${prefix}recipient-applicant`}
                      >
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <div>
                          <div className="font-medium">Applicant</div>
                          <div className="text-muted-foreground">{selectedQueueItem.applicantEmail}</div>
                        </div>
                      </button>
                    )}
                    {selectedCompany?.clientCoordinator?.email && selectedCompany.clientCoordinator.email !== selectedQueueItem?.applicantEmail && (
                      <button
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-colors text-left ${overrideEmail === selectedCompany.clientCoordinator.email ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/40"}`}
                        onClick={() => { setOverrideEmail(selectedCompany!.clientCoordinator!.email!); setEmailPopoverOpen(false); }}
                        data-testid={`button-${prefix}recipient-coordinator`}
                      >
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <div>
                          <div className="font-medium">Coordinator — {selectedCompany.clientCoordinator.name}</div>
                          <div className="text-muted-foreground">{selectedCompany.clientCoordinator.email}</div>
                        </div>
                      </button>
                    )}
                    {selectedCompany?.clientManager?.email && selectedCompany.clientManager.email !== selectedQueueItem?.applicantEmail && (
                      <button
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-colors text-left ${overrideEmail === selectedCompany.clientManager.email ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/40"}`}
                        onClick={() => { setOverrideEmail(selectedCompany!.clientManager!.email!); setEmailPopoverOpen(false); }}
                        data-testid={`button-${prefix}recipient-manager`}
                      >
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <div>
                          <div className="font-medium">Manager — {selectedCompany.clientManager.name}</div>
                          <div className="text-muted-foreground">{selectedCompany.clientManager.email}</div>
                        </div>
                      </button>
                    )}
                    {companyEmailsList?.map((ce) => (
                      <button
                        key={ce.id}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-colors text-left ${overrideEmail === ce.email ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/40"}`}
                        onClick={() => { setOverrideEmail(ce.email); setEmailPopoverOpen(false); }}
                        data-testid={`button-${prefix}recipient-company-email-${ce.id}`}
                      >
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <div>
                          <div className="font-medium">{ce.label}</div>
                          <div className="text-muted-foreground">{ce.email}</div>
                        </div>
                      </button>
                    ))}
                    <div className="flex gap-1.5 pt-1 border-t">
                      <Input
                        type="email"
                        placeholder="Custom email address..."
                        className="h-7 text-xs"
                        value={customEmailInput}
                        onChange={(e) => setCustomEmailInput(e.target.value)}
                        data-testid={`input-${prefix}custom-recipient-email`}
                      />
                      <Button
                        size="sm"
                        className="h-7 px-2 shrink-0"
                        disabled={!customEmailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customEmailInput)}
                        onClick={() => { setOverrideEmail(customEmailInput); setCustomEmailInput(""); setEmailPopoverOpen(false); }}
                        data-testid={`button-${prefix}set-custom-email`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            <div className="relative max-h-[500px] overflow-auto rounded-lg border">
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 z-10 shadow-sm"
                onClick={() => setEmailFullscreen(true)}
                data-testid={`${prefix}button-expand-email`}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              {previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full"
                  style={{ height: "280px", border: "none" }}
                  sandbox="allow-same-origin"
                  title="Email Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  Loading email preview…
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleCopyMessage("email")}
                data-testid={`${prefix}button-copy-email`}
              >
                {messageCopied === "email" ? (
                  <><Check className="h-4 w-4 mr-2" />Copied!</>
                ) : (
                  <><Copy className="h-4 w-4 mr-2" />Copy</>
                )}
              </Button>
              {scheduledApptId && (overrideEmail || selectedQueueItem?.applicantEmail) && (
                <Button
                  variant={emailSendStatus === "sent" ? "outline" : "default"}
                  className={`flex-1 ${emailSendStatus === "sent" ? "text-emerald-600 border-emerald-300" : ""}`}
                  onClick={() => setConfirmEmailDialogOpen(true)}
                  disabled={sendEmailMutation.isPending || emailSendStatus === "sending"}
                  data-testid={`${prefix}button-send-email`}
                >
                  {emailSendStatus === "sending" || sendEmailMutation.isPending ? (
                    <><Mail className="h-4 w-4 mr-2 animate-pulse" />Sending…</>
                  ) : emailSendStatus === "sent" ? (
                    <><Check className="h-4 w-4 mr-2" />Resend</>
                  ) : (
                    <><Mail className="h-4 w-4 mr-2" />Send Email</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="whatsapp">
          <Card>
            <CardContent className="pt-4">
              <pre className="whitespace-pre-wrap text-sm font-sans bg-muted/30 p-4 rounded-lg max-h-64 overflow-auto">
                {whatsappPreview}
              </pre>
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={() => handleCopyMessage("whatsapp")}
                data-testid={`${prefix}button-copy-whatsapp`}
              >
                {messageCopied === "whatsapp" ? (
                  <><Check className="h-4 w-4 mr-2" />Copied!</>
                ) : (
                  <><Copy className="h-4 w-4 mr-2" />Copy WhatsApp</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={confirmEmailDialogOpen} onOpenChange={setConfirmEmailDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Confirm Email Send
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">Please review the details before sending the confirmation email.</p>
            <div className="rounded-xl border border-border/50 bg-muted/30 divide-y divide-border/40">
              <div className="flex gap-3 px-4 py-3">
                <span className="text-xs font-medium text-muted-foreground w-16 shrink-0 pt-0.5">To</span>
                <span className="text-sm font-medium text-foreground break-all">{overrideEmail || selectedQueueItem?.applicantEmail}</span>
              </div>
              <div className="flex gap-3 px-4 py-3">
                <span className="text-xs font-medium text-muted-foreground w-16 shrink-0 pt-0.5">Subject</span>
                <span className="text-sm text-foreground">
                  {config.emailSubjectPrefix} — {toProperCase(selectedQueueItem?.applicantName || "")}. {selectedQueueItem?.woNumber}
                </span>
              </div>
              <div className="flex gap-3 px-4 py-3">
                <span className="text-xs font-medium text-muted-foreground w-16 shrink-0 pt-0.5">Date</span>
                <span className="text-sm text-foreground">
                  {form.getValues("appointmentDate")
                    ? new Date(form.getValues("appointmentDate")).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                    : "—"}
                  {form.getValues("appointmentTime") ? ` at ${form.getValues("appointmentTime")}` : ""}
                </span>
              </div>
              <div className="flex gap-3 px-4 py-3">
                <span className="text-xs font-medium text-muted-foreground w-16 shrink-0 pt-0.5">Center</span>
                <span className="text-sm text-foreground">
                  {centers?.find(c => c.id === form.getValues("centerId"))?.name || selectedCenter?.name || "—"}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setConfirmEmailDialogOpen(false)}
              data-testid={`${prefix}button-cancel-send-email`}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              onClick={() => {
                setConfirmEmailDialogOpen(false);
                setEmailSendStatus("sending");
                if (scheduledApptId) sendEmailMutation.mutate(scheduledApptId);
              }}
              disabled={sendEmailMutation.isPending}
              data-testid={`${prefix}button-confirm-send-email`}
            >
              <Mail className="h-4 w-4 mr-2" />
              Confirm & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailFullscreen} onOpenChange={setEmailFullscreen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 py-4 border-b" style={{ background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})` }}>
            <DialogTitle className="flex items-center justify-between gap-2 text-white">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Preview
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-white"
                onClick={() => setEmailFullscreen(false)}
                data-testid={`${prefix}button-close-email-fullscreen`}
              >
                <X className="h-5 w-5" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[calc(90vh-140px)]">
            {previewHtml ? (
              <iframe
                srcDoc={previewHtml}
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
          <DialogFooter className="px-6 py-4 border-t">
            <Button
              variant="default"
              onClick={() => {
                handleCopyMessage("email");
                setEmailFullscreen(false);
              }}
              data-testid={`${prefix}button-copy-email-fullscreen`}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Email to Clipboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

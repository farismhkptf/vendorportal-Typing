import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Mail, User, Building2, Check, X, Plus, Maximize2, Send,
  Stethoscope, CreditCard,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { toProperCase } from "@/lib/proper-case";
import { formatDateWithWeekday, formatTime } from "@/lib/format-date";
import type { AppointmentWithRelations } from "./types";
import type { Company } from "@shared/schema";

interface ResendEmailDialogProps {
  appointment: AppointmentWithRelations | null;
  onClose: () => void;
  companies?: Company[];
}

interface RecipientOption {
  id: string;
  label: string;
  sublabel: string;
  email: string;
  icon: "user" | "building";
}

export function ResendEmailDialog({
  appointment,
  onClose,
  companies,
}: ResendEmailDialogProps) {
  const { toast } = useToast();
  const apt = appointment;

  const companyId = apt?.workOrder?.companyId;
  const company = companyId ? companies?.find(c => c.id === companyId) : undefined;

  const buildRecipientOptions = useCallback((): RecipientOption[] => {
    const opts: RecipientOption[] = [];
    if (apt?.workOrder?.applicantEmail) {
      opts.push({
        id: "applicant",
        label: "Applicant",
        sublabel: apt.workOrder.applicantEmail,
        email: apt.workOrder.applicantEmail,
        icon: "user",
      });
    }
    if (company?.clientCoordinator?.email) {
      opts.push({
        id: "coordinator",
        label: `Coordinator — ${company.clientCoordinator.name || ""}`,
        sublabel: company.clientCoordinator.email,
        email: company.clientCoordinator.email,
        icon: "user",
      });
    }
    if (company?.clientManager?.email) {
      opts.push({
        id: "manager",
        label: `Manager — ${company.clientManager.name || ""}`,
        sublabel: company.clientManager.email,
        email: company.clientManager.email,
        icon: "user",
      });
    }
    return opts;
  }, [apt, company]);

  const { data: companyEmailsList } = useQuery<Array<{ id: string; label: string; email: string }>>({
    queryKey: ["/api/companies", companyId, "emails"],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await fetch(`/api/companies/${companyId}/emails`);
      return res.ok ? res.json() : [];
    },
    enabled: !!companyId,
  });

  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [customEmailInput, setCustomEmailInput] = useState("");
  const [customEmails, setCustomEmails] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [emailFullscreen, setEmailFullscreen] = useState(false);
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  const recipientOptions = buildRecipientOptions();

  const fetchPreview = useCallback(async (notesValue: string) => {
    if (!apt) return;
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/email-preview/appointment/${apt.id}?notes=${encodeURIComponent(notesValue)}`);
      if (res.ok) setPreviewHtml(await res.text());
    } catch {
    } finally {
      setPreviewLoading(false);
    }
  }, [apt?.id]);

  useEffect(() => {
    if (!apt) {
      setSelectedEmails(new Set());
      setCustomEmails([]);
      setNotes("");
      setPreviewHtml("");
      setSendStatus("idle");
      return;
    }
    const initialNotes = apt.notes || "";
    setNotes(initialNotes);
    const defaultSet = new Set<string>();
    const coordEmail = company?.clientCoordinator?.email;
    const managerEmail = company?.clientManager?.email;
    if (coordEmail) defaultSet.add(coordEmail);
    else if (managerEmail) defaultSet.add(managerEmail);
    setSelectedEmails(defaultSet);
    fetchPreview(initialNotes);
  }, [apt?.id]);

  const handleNotesChange = (val: string) => {
    setNotes(val);
    fetchPreview(val);
  };

  const toggleEmail = (email: string) => {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const addCustomEmail = () => {
    const email = customEmailInput.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (!customEmails.includes(email)) setCustomEmails(prev => [...prev, email]);
    setSelectedEmails(prev => new Set(prev).add(email));
    setCustomEmailInput("");
  };

  const removeCustomEmail = (email: string) => {
    setCustomEmails(prev => prev.filter(e => e !== email));
    setSelectedEmails(prev => {
      const next = new Set(prev);
      next.delete(email);
      return next;
    });
  };

  const allRecipients = [...Array.from(selectedEmails)].filter(Boolean);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!apt) throw new Error("No appointment selected");
      const res = await apiRequest("POST", `/api/appointments/${apt.id}/send-email`, {
        recipients: allRecipients,
        notes: notes || null,
      });
      return res.json();
    },
    onSuccess: (data: { sentTo: string; sentToList?: string[] }) => {
      setSendStatus("sent");
      toast({
        title: "Email sent",
        description: `Confirmation sent to ${data.sentTo}.`,
        variant: "success",
      });
      setTimeout(() => {
        onClose();
        setSendStatus("idle");
      }, 1200);
    },
    onError: (err: Error) => {
      setSendStatus("failed");
      toast({
        title: "Failed to send email",
        description: err.message || "Could not send email.",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (allRecipients.length === 0) {
      toast({ title: "No recipients selected", description: "Please select at least one recipient.", variant: "destructive" });
      return;
    }
    setSendStatus("sending");
    sendMutation.mutate();
  };

  if (!apt) return null;

  return (
    <>
      <Dialog open={!!apt} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {apt.type === "Medical" ? (
                <Stethoscope className="h-5 w-5 text-emerald-600" />
              ) : (
                <CreditCard className="h-5 w-5 text-blue-600" />
              )}
              Resend Email
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-muted/30 border border-border/40 p-3 text-sm space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground">Applicant:</span>
                <span className="font-medium">{toProperCase(apt.workOrder?.applicantName || "—")}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{apt.type}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>{formatDateWithWeekday(apt.datetime)}</span>
                <span>·</span>
                <span>{formatTime(apt.datetime)}</span>
                {apt.center?.name && <><span>·</span><span>{apt.center.name}</span></>}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recipients</p>
              <div className="space-y-1.5">
                {recipientOptions.map(opt => (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${selectedEmails.has(opt.email) ? "border-primary/40 bg-primary/5" : "border-border/40 hover:bg-muted/30"}`}
                    data-testid={`resend-recipient-${opt.id}`}
                  >
                    <Checkbox
                      checked={selectedEmails.has(opt.email)}
                      onCheckedChange={() => toggleEmail(opt.email)}
                      data-testid={`checkbox-resend-${opt.id}`}
                    />
                    {opt.icon === "user" ? (
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-tight">{opt.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{opt.sublabel}</div>
                    </div>
                  </label>
                ))}

                {companyEmailsList?.map(ce => (
                  <label
                    key={ce.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${selectedEmails.has(ce.email) ? "border-primary/40 bg-primary/5" : "border-border/40 hover:bg-muted/30"}`}
                    data-testid={`resend-recipient-company-${ce.id}`}
                  >
                    <Checkbox
                      checked={selectedEmails.has(ce.email)}
                      onCheckedChange={() => toggleEmail(ce.email)}
                      data-testid={`checkbox-resend-company-${ce.id}`}
                    />
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-tight">{ce.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{ce.email}</div>
                    </div>
                  </label>
                ))}

                {customEmails.map(email => (
                  <div
                    key={email}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${selectedEmails.has(email) ? "border-primary/40 bg-primary/5" : "border-border/40"}`}
                    data-testid={`resend-recipient-custom-${email}`}
                  >
                    <Checkbox
                      checked={selectedEmails.has(email)}
                      onCheckedChange={() => toggleEmail(email)}
                    />
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-tight truncate">{email}</div>
                      <div className="text-xs text-muted-foreground">Custom</div>
                    </div>
                    <button
                      onClick={() => removeCustomEmail(email)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      data-testid={`button-remove-custom-email-${email}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                <div className="flex gap-1.5 pt-1">
                  <Input
                    type="email"
                    placeholder="Add custom email address..."
                    className="h-8 text-xs"
                    value={customEmailInput}
                    onChange={(e) => setCustomEmailInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomEmail(); } }}
                    data-testid="input-resend-custom-email"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 shrink-0"
                    disabled={!customEmailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customEmailInput)}
                    onClick={addCustomEmail}
                    data-testid="button-resend-add-custom-email"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {allRecipients.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-xs text-muted-foreground">Sending to:</span>
                  {allRecipients.map(email => (
                    <Badge key={email} variant="secondary" className="text-xs gap-1" data-testid={`badge-recipient-${email}`}>
                      <Mail className="h-2.5 w-2.5" />
                      {email}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes (optional)</label>
              <Textarea
                value={notes}
                placeholder="Add any notes for this appointment email..."
                className="text-sm h-16 resize-none"
                onChange={(e) => handleNotesChange(e.target.value)}
                data-testid="textarea-resend-notes"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email Preview</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 gap-1 text-xs"
                  onClick={() => setEmailFullscreen(true)}
                  data-testid="button-resend-expand-preview"
                >
                  <Maximize2 className="h-3 w-3" />
                  Expand
                </Button>
              </div>
              <div className="rounded-lg border border-border/50 overflow-hidden">
                {previewLoading ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    Loading preview…
                  </div>
                ) : previewHtml ? (
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full"
                    style={{ height: "240px", border: "none" }}
                    sandbox="allow-same-origin"
                    title="Email Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    Preview unavailable
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              data-testid="button-resend-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sendMutation.isPending || allRecipients.length === 0 || sendStatus === "sent"}
              className={sendStatus === "sent" ? "bg-emerald-600 text-white" : ""}
              data-testid="button-resend-send"
            >
              {sendStatus === "sent" ? (
                <><Check className="h-4 w-4 mr-2" />Sent!</>
              ) : sendMutation.isPending ? (
                <><Mail className="h-4 w-4 mr-2 animate-pulse" />Sending…</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />Send to {allRecipients.length > 0 ? allRecipients.length : ""} {allRecipients.length === 1 ? "Recipient" : allRecipients.length > 1 ? "Recipients" : "Recipients"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailFullscreen} onOpenChange={setEmailFullscreen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className={`px-6 py-4 border-b ${apt.type === "Medical" ? "bg-gradient-to-r from-emerald-700 to-emerald-900" : "bg-gradient-to-r from-blue-600 to-blue-800"}`}>
            <DialogTitle className="text-white flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Preview
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 overflow-y-auto max-h-[calc(90vh-100px)]">
            {previewHtml ? (
              <iframe
                srcDoc={previewHtml}
                className="w-full"
                style={{ height: "calc(90vh - 180px)", border: "none" }}
                sandbox="allow-same-origin"
                title="Email Preview Full"
              />
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Loading preview…
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

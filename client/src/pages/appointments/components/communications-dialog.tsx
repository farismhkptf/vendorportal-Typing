import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import {
  Mail, MessageCircle, Copy, Check, Maximize2,
  Stethoscope, CreditCard, FileText, User, Building2, Calendar, Send,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateWithWeekday, formatTime } from "@/lib/format-date";
import { toProperCase } from "@/lib/proper-case";
import type { AppointmentWithRelations } from "./types";
import type { EmailSendLogEntry } from "@shared/schema";

interface CommunicationsDialogProps {
  apt: AppointmentWithRelations | null;
  onClose: () => void;
  whatsappBody: string;
}

export function CommunicationsDialog({ apt, onClose, whatsappBody }: CommunicationsDialogProps) {
  const [messageCopied, setMessageCopied] = useState<"email" | "whatsapp" | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const { data: appSettings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    staleTime: 300000,
  });

  const { data: livePreviewHtml = "" } = useQuery<string>({
    queryKey: ["/api/email-preview/appointment", apt?.id, "live"],
    queryFn: async () => {
      if (!apt) return "";
      const res = await fetch(`/api/email-preview/appointment/${apt.id}`);
      return res.ok ? res.text() : "";
    },
    enabled: !!apt,
    staleTime: 60000,
  });

  const { data: sendLog = [] } = useQuery<EmailSendLogEntry[]>({
    queryKey: ["/api/appointments", apt?.id, "send-log"],
    queryFn: async () => {
      if (!apt) return [];
      const res = await fetch(`/api/appointments/${apt.id}/send-log`);
      return res.ok ? res.json() : [];
    },
    enabled: !!apt,
  });

  if (!apt) return null;

  const fromEmail = appSettings?.fromEmail || appSettings?.from_email;
  const fromName = appSettings?.fromName || appSettings?.from_name;
  const firstSend = sendLog[0];

  const senderInfo = (
    <div className="text-xs text-muted-foreground px-3 py-2 rounded-lg bg-muted/30 border border-border/30 space-y-0.5">
      {fromEmail && (
        <div className="flex items-center gap-1.5">
          <Send className="h-3 w-3 shrink-0" />
          <span><span className="font-medium">Sending from:</span> {fromName ? `${fromName} <${fromEmail}>` : fromEmail}</span>
        </div>
      )}
      {firstSend?.sentBy && (
        <div><span className="font-medium">Originally sent by:</span> {firstSend.sentBy}</div>
      )}
      {firstSend?.sentTo?.length > 0 && (
        <div><span className="font-medium">Originally sent to:</span> {firstSend.sentTo.join(", ")}</div>
      )}
    </div>
  );

  const handleCopy = async (type: "email" | "whatsapp") => {
    if (type === "whatsapp") {
      await navigator.clipboard.writeText(whatsappBody);
    } else {
      const html = apt.emailDraft || livePreviewHtml;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([html], { type: "text/plain" }),
          }),
        ]);
      } catch {
        await navigator.clipboard.writeText(html);
      }
    }
    setMessageCopied(type);
    setTimeout(() => setMessageCopied(null), 2000);
  };

  return (
    <>
      <Dialog open={!!apt} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {apt.type === "Medical" ? (
                <Stethoscope className="h-5 w-5 text-emerald-600" />
              ) : (
                <CreditCard className="h-5 w-5 text-blue-600" />
              )}
              Communications
            </DialogTitle>
          </DialogHeader>

          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-3 flex-wrap text-sm">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{toProperCase(apt.workOrder?.applicantName || "")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{toProperCase(apt.workOrder?.company?.name || "")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {formatDateWithWeekday(apt.datetime)} at {formatTime(apt.datetime)}
                </span>
              </div>
            </div>
          </div>

          <Tabs defaultValue="stored">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="stored" className="gap-1.5 text-xs" data-testid="tab-comm-stored">
                <FileText className="h-3.5 w-3.5" />
                Stored Draft
              </TabsTrigger>
              <TabsTrigger value="live" className="gap-1.5 text-xs" data-testid="tab-comm-live">
                <Mail className="h-3.5 w-3.5" />
                Live Email
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-1.5 text-xs" data-testid="tab-comm-whatsapp">
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stored" className="space-y-3 mt-3">
              {senderInfo}
              {apt.emailDraft ? (
                <>
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <div
                      className="bg-white dark:bg-gray-950 p-4"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(apt.emailDraft, { FORCE_BODY: true }) }}
                      data-testid="comm-stored-draft-content"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleCopy("email")} className="gap-2" data-testid="button-comm-copy-stored">
                      {messageCopied === "email" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {messageCopied === "email" ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={<FileText className="h-6 w-6" />}
                  title="No stored draft"
                  description="This appointment was created before email draft storage was enabled, or an email has not been sent yet."
                />
              )}
            </TabsContent>

            <TabsContent value="live" className="space-y-3 mt-3">
              {senderInfo}
              <div className="rounded-lg border border-border/50 overflow-hidden">
                {livePreviewHtml ? (
                  <iframe
                    srcDoc={livePreviewHtml}
                    className="w-full"
                    style={{ height: "320px", border: "none" }}
                    sandbox="allow-same-origin"
                    title="Live Email Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    Loading preview…
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleCopy("email")} className="gap-2" data-testid="button-comm-copy-live">
                  {messageCopied === "email" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {messageCopied === "email" ? "Copied!" : "Copy Email"}
                </Button>
                <Button variant="outline" size="icon" onClick={() => setFullscreen(true)} data-testid="button-comm-fullscreen">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="whatsapp" className="space-y-3 mt-3">
              {senderInfo}
              <div className="rounded-lg border border-border/50 bg-muted/20 p-4 max-h-[40vh] overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-foreground">
                  {whatsappBody || "WhatsApp message template will appear here."}
                </pre>
              </div>
              <Button onClick={() => handleCopy("whatsapp")} className="gap-2" data-testid="button-comm-copy-whatsapp">
                {messageCopied === "whatsapp" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {messageCopied === "whatsapp" ? "Copied!" : "Copy WhatsApp"}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className={`px-6 py-4 border-b ${apt.type === "Medical" ? "bg-gradient-to-r from-emerald-700 to-emerald-900" : "bg-gradient-to-r from-blue-600 to-blue-800"}`}>
            <DialogTitle className="text-white flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Preview — Full Screen
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {livePreviewHtml ? (
              <iframe
                srcDoc={livePreviewHtml}
                className="w-full"
                style={{ height: "calc(90vh - 200px)", border: "none" }}
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

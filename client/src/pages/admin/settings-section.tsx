import { useState, useRef, type ChangeEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Pencil, Trash2, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { AppSettings } from "@shared/schema";

type SettingsWithSso = AppSettings & { sharedJwtSecretConfigured?: boolean };

const senderEmailSchema = z.object({
  fromEmail: z.string().email("Must be a valid email address"),
});

const ccRecipientsSchema = z.object({
  alwaysCc: z.string(),
});

const thresholdSchema = z.object({
  lowBalanceThreshold: z.coerce.number().min(0, "Must be 0 or greater"),
});

const delayThresholdSchema = z.object({
  vendorDelayThresholdHours: z.coerce.number().min(1, "Must be at least 1 hour"),
});

export function AdminSettingsSection() {
  const [editSenderEmailDialogOpen, setEditSenderEmailDialogOpen] = useState(false);
  const [editCcDialogOpen, setEditCcDialogOpen] = useState(false);
  const [editTestRedirectOpen, setEditTestRedirectOpen] = useState(false);
  const [testRedirectValue, setTestRedirectValue] = useState("");
  const [editThresholdDialogOpen, setEditThresholdDialogOpen] = useState(false);
  const [editDelayThresholdDialogOpen, setEditDelayThresholdDialogOpen] = useState(false);
  const [editMaintenanceMsgOpen, setEditMaintenanceMsgOpen] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState("");
  const [editWhatsappOpen, setEditWhatsappOpen] = useState(false);
  const [whatsappNum, setWhatsappNum] = useState("");
  const [editFollowUpCenterOpen, setEditFollowUpCenterOpen] = useState(false);
  const [followUpCenterVal, setFollowUpCenterVal] = useState("");
  const [editLegalOpen, setEditLegalOpen] = useState(false);
  const [legalContent, setLegalContent] = useState("");
  const [legalType, setLegalType] = useState<"privacy" | "terms">("privacy");
  const [editWebhookUrlOpen, setEditWebhookUrlOpen] = useState(false);
  const [webhookUrlVal, setWebhookUrlVal] = useState("");
  const [editOutboundKeyOpen, setEditOutboundKeyOpen] = useState(false);
  const [outboundKeyVal, setOutboundKeyVal] = useState("");
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: settings } = useQuery<SettingsWithSso>({ queryKey: ["/api/settings"] });

  const senderEmailForm = useForm({ resolver: zodResolver(senderEmailSchema), defaultValues: { fromEmail: "" } });
  const ccForm = useForm({ resolver: zodResolver(ccRecipientsSchema), defaultValues: { alwaysCc: "" } });
  const thresholdForm = useForm({ resolver: zodResolver(thresholdSchema), defaultValues: { lowBalanceThreshold: 1000 } });
  const delayThresholdForm = useForm({ resolver: zodResolver(delayThresholdSchema), defaultValues: { vendorDelayThresholdHours: 48 } });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<AppSettings>) => apiRequest("PUT", "/api/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings updated successfully" });
      setEditCcDialogOpen(false);
      setEditThresholdDialogOpen(false);
      setEditDelayThresholdDialogOpen(false);
      setEditSenderEmailDialogOpen(false);
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const maintenanceToggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => { const res = await apiRequest("PUT", "/api/settings", { maintenanceMode: enabled }); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/settings"] }); toast({ title: "Maintenance mode updated" }); },
    onError: (error: Error) => toast({ title: "Failed to update", description: error.message, variant: "destructive" }),
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/settings/logo", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Failed to upload logo");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/settings"] }); toast({ title: "Company logo updated" }); },
    onError: (error: Error) => toast({ title: "Upload failed", description: error.message, variant: "destructive" }),
  });

  const removeLogoMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", "/api/settings/logo"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/settings"] }); toast({ title: "Company logo removed" }); },
    onError: (error: Error) => toast({ title: "Failed to remove logo", description: error.message, variant: "destructive" }),
  });

  const handleEditSenderEmail = () => { senderEmailForm.reset({ fromEmail: settings?.fromEmail || "" }); setEditSenderEmailDialogOpen(true); };
  const handleSubmitSenderEmail = (data: z.infer<typeof senderEmailSchema>) => { updateSettingsMutation.mutate({ fromEmail: data.fromEmail }); setEditSenderEmailDialogOpen(false); };
  const handleEditCc = () => { ccForm.reset({ alwaysCc: settings?.alwaysCc?.join(", ") || "" }); setEditCcDialogOpen(true); };
  const handleSubmitCc = (data: z.infer<typeof ccRecipientsSchema>) => { const emails = data.alwaysCc.split(",").map(e => e.trim()).filter(e => e.length > 0); updateSettingsMutation.mutate({ alwaysCc: emails }); };
  const handleEditTestRedirect = () => { setTestRedirectValue(settings?.testEmailRedirect || ""); setEditTestRedirectOpen(true); };
  const handleSaveTestRedirect = () => { updateSettingsMutation.mutate({ testEmailRedirect: testRedirectValue.trim() || null }); setEditTestRedirectOpen(false); };
  const handleClearTestRedirect = () => { updateSettingsMutation.mutate({ testEmailRedirect: null }); setEditTestRedirectOpen(false); };
  const handleEditThreshold = () => { thresholdForm.reset({ lowBalanceThreshold: settings?.lowBalanceThreshold || 1000 }); setEditThresholdDialogOpen(true); };
  const handleSubmitThreshold = (data: z.infer<typeof thresholdSchema>) => { updateSettingsMutation.mutate({ lowBalanceThreshold: data.lowBalanceThreshold }); };
  const handleEditDelayThreshold = () => { delayThresholdForm.reset({ vendorDelayThresholdHours: settings?.vendorDelayThresholdHours || 48 }); setEditDelayThresholdDialogOpen(true); };
  const handleSubmitDelayThreshold = (data: z.infer<typeof delayThresholdSchema>) => { updateSettingsMutation.mutate({ vendorDelayThresholdHours: data.vendorDelayThresholdHours }); };

  return (
    <div className="premium-card overflow-hidden p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-semibold text-foreground mb-4">Email Configuration</h3>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {settings?.logoUrl ? (
                    <img src={settings.logoUrl} alt="Company logo" className="w-10 h-10 rounded-lg object-contain border border-border/50" data-testid="img-company-email-logo" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-foreground text-background flex items-center justify-center text-sm font-semibold" data-testid="placeholder-company-email-logo">K</div>
                  )}
                  <div>
                    <p className="font-medium text-foreground">Company Email Logo</p>
                    <p className="text-sm text-muted-foreground mt-1">{settings?.logoUrl ? "Logo configured" : "Using default placeholder"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <input ref={logoFileInputRef} type="file" accept="image/*" className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) uploadLogoMutation.mutate(file); e.target.value = ""; }} data-testid="input-upload-email-logo" />
                  <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => logoFileInputRef.current?.click()} disabled={uploadLogoMutation.isPending} data-testid="button-upload-email-logo">
                    {uploadLogoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </Button>
                  {settings?.logoUrl && (
                    <Button variant="ghost" size="icon" className="rounded-xl text-destructive hover:text-destructive" onClick={() => removeLogoMutation.mutate()} disabled={removeLogoMutation.isPending} data-testid="button-remove-email-logo">
                      {removeLogoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">Sender Email Address</p>
                  <p className="text-sm text-muted-foreground mt-1">{settings?.fromEmail || "Not configured"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Appointment confirmation emails are sent from this address</p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={handleEditSenderEmail} data-testid="button-edit-sender-email"><Pencil className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">Always CC Recipients</p>
                  <p className="text-sm text-muted-foreground mt-1">{settings?.alwaysCc?.join(", ") || "No CC recipients configured"}</p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={handleEditCc} data-testid="button-edit-cc"><Pencil className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${settings?.testEmailRedirect ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700" : "bg-muted/30 border-border/30"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">Test Email Redirect</p>
                    {settings?.testEmailRedirect && (<span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">ACTIVE</span>)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 truncate">{settings?.testEmailRedirect || "Not set — emails go to actual recipients"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">When set, all appointment emails are redirected to this address only</p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl shrink-0" onClick={handleEditTestRedirect} data-testid="button-edit-test-redirect"><Pencil className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">Low Balance Threshold</p>
                  <p className="text-sm text-muted-foreground mt-1">AED {settings?.lowBalanceThreshold?.toLocaleString() || "1,000"}</p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={handleEditThreshold} data-testid="button-edit-threshold"><Pencil className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/30 border border-red-200/50 dark:border-red-800/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">Vendor Delay Threshold</p>
                  <p className="text-sm text-muted-foreground mt-1">{settings?.vendorDelayThresholdHours || 48} hours</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Work orders marked as Delayed when vendor exceeds this time</p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={handleEditDelayThreshold} data-testid="button-edit-delay-threshold"><Pencil className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-foreground mb-4">System Status</h3>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">Maintenance Mode</p>
                  <p className="text-sm text-muted-foreground mt-1">When enabled, a maintenance banner will appear on login pages.</p>
                </div>
                <Switch checked={settings?.maintenanceMode || false} onCheckedChange={(checked) => maintenanceToggleMutation.mutate(checked)} data-testid="switch-maintenance-mode" />
              </div>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">Maintenance Message</p>
                  <p className="text-sm text-muted-foreground mt-1">{settings?.maintenanceMessage || "Default message will be shown"}</p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => { setMaintenanceMsg(settings?.maintenanceMessage || ""); setEditMaintenanceMsgOpen(true); }} data-testid="button-edit-maintenance-msg"><Pencil className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">WhatsApp Support Number</p>
                  <p className="text-sm text-muted-foreground mt-1">{settings?.whatsappNumber || "Not configured"}</p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => { setWhatsappNum(settings?.whatsappNumber || ""); setEditWhatsappOpen(true); }} data-testid="button-edit-whatsapp"><Pencil className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">Follow-Up Center</p>
                  <p className="text-sm text-muted-foreground mt-1">{settings?.followUpCenter || "Not configured"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Default center for medical follow-up appointments</p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => { setFollowUpCenterVal(settings?.followUpCenter || ""); setEditFollowUpCenterOpen(true); }} data-testid="button-edit-followup-center"><Pencil className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-foreground mb-4">Legal Pages</h3>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">Privacy Policy</p>
                  <p className="text-sm text-muted-foreground mt-1">{settings?.privacyPolicyHtml ? "Content configured" : "Not yet configured"}</p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => { setLegalContent(settings?.privacyPolicyHtml || ""); setLegalType("privacy"); setEditLegalOpen(true); }} data-testid="button-edit-privacy-policy"><Pencil className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">Terms of Service</p>
                  <p className="text-sm text-muted-foreground mt-1">{settings?.termsOfServiceHtml ? "Content configured" : "Not yet configured"}</p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => { setLegalContent(settings?.termsOfServiceHtml || ""); setLegalType("terms"); setEditLegalOpen(true); }} data-testid="button-edit-terms-of-service"><Pencil className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-foreground mb-1">Client Portal Integration</h3>
          <p className="text-sm text-muted-foreground mb-4">Configure the outbound webhook connection to the Client Portal. Status updates from this portal (work order progress, typing jobs, medical) will be pushed to the Client Portal in real time.</p>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">Client Portal Webhook URL</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {settings?.clientPortalWebhookUrl ? settings.clientPortalWebhookUrl : "Not configured"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">The endpoint on the Client Portal that receives status push events</p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => { setEditWebhookUrlOpen(true); setWebhookUrlVal(settings?.clientPortalWebhookUrl || ""); }} data-testid="button-edit-webhook-url"><Pencil className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">Outbound API Key</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {settings?.clientPortalOutboundApiKey ? "••••••••" + settings.clientPortalOutboundApiKey.slice(-4) : "Not configured"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sent as X-Api-Key header in outbound push requests to the Client Portal</p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => { setEditOutboundKeyOpen(true); setOutboundKeyVal(""); }} data-testid="button-edit-outbound-key"><Pencil className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30" data-testid="row-shared-jwt-secret">
              <div className="flex items-center gap-3">
                <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${settings?.sharedJwtSecretConfigured ? "bg-emerald-500" : "bg-slate-400"}`} />
                <div>
                  <p className="font-medium text-foreground">Shared JWT Secret</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {settings?.sharedJwtSecretConfigured ? "Configured — SSO redirect login is active" : "Not configured — set the SHARED_JWT_SECRET environment variable to enable SSO"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Both apps must share the same secret for cross-portal silent login to work</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editWebhookUrlOpen} onOpenChange={setEditWebhookUrlOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Client Portal Webhook URL</DialogTitle>
            <DialogDescription>The Client Portal endpoint that receives work order status updates from this portal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={webhookUrlVal} onChange={(e) => setWebhookUrlVal(e.target.value)} placeholder="https://clientportal.example.com/api/integration/events" className="h-11 rounded-xl" data-testid="input-webhook-url" />
            <div className="flex justify-end gap-3">
              <Button variant="outline" className="rounded-xl" onClick={() => setEditWebhookUrlOpen(false)}>Cancel</Button>
              <Button className="rounded-xl" onClick={async () => {
                try {
                  await apiRequest("PUT", "/api/settings", { clientPortalWebhookUrl: webhookUrlVal.trim() || null });
                  queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
                  toast({ title: "Webhook URL updated" });
                  setEditWebhookUrlOpen(false);
                } catch { toast({ title: "Failed to update", variant: "destructive" }); }
              }} data-testid="button-save-webhook-url">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOutboundKeyOpen} onOpenChange={setEditOutboundKeyOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Outbound API Key</DialogTitle>
            <DialogDescription>This key is sent as an X-Api-Key header in push requests to the Client Portal. Enter a new key to replace the existing one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={outboundKeyVal} onChange={(e) => setOutboundKeyVal(e.target.value)} placeholder="Enter new API key..." className="h-11 rounded-xl font-mono" data-testid="input-outbound-key" />
            <p className="text-xs text-muted-foreground">Leave blank to keep the existing key unchanged.</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" className="rounded-xl" onClick={() => setEditOutboundKeyOpen(false)}>Cancel</Button>
              <Button className="rounded-xl" onClick={async () => {
                if (!outboundKeyVal.trim()) { setEditOutboundKeyOpen(false); return; }
                try {
                  await apiRequest("PUT", "/api/settings", { clientPortalOutboundApiKey: outboundKeyVal.trim() });
                  queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
                  toast({ title: "Outbound API key updated" });
                  setEditOutboundKeyOpen(false);
                } catch { toast({ title: "Failed to update", variant: "destructive" }); }
              }} data-testid="button-save-outbound-key">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editSenderEmailDialogOpen} onOpenChange={setEditSenderEmailDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Edit Sender Email Address</DialogTitle></DialogHeader>
          <Form {...senderEmailForm}>
            <form onSubmit={senderEmailForm.handleSubmit(handleSubmitSenderEmail)} className="space-y-4">
              <FormField control={senderEmailForm.control} name="fromEmail" render={({ field }) => (
                <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input {...field} type="email" placeholder="appointments@procompany.ae" className="rounded-xl" data-testid="input-sender-email" /></FormControl><p className="text-xs text-muted-foreground">Appointment confirmation emails will be sent from this address</p><FormMessage /></FormItem>
              )} />
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditSenderEmailDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="rounded-xl" disabled={updateSettingsMutation.isPending}>{updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={editCcDialogOpen} onOpenChange={setEditCcDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Edit CC Recipients</DialogTitle></DialogHeader>
          <Form {...ccForm}>
            <form onSubmit={ccForm.handleSubmit(handleSubmitCc)} className="space-y-4">
              <FormField control={ccForm.control} name="alwaysCc" render={({ field }) => (
                <FormItem><FormLabel>Email Addresses</FormLabel><FormControl><Textarea {...field} placeholder="email1@example.com, email2@example.com" className="rounded-xl" rows={3} /></FormControl><p className="text-xs text-muted-foreground">Separate multiple emails with commas</p><FormMessage /></FormItem>
              )} />
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditCcDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="rounded-xl" disabled={updateSettingsMutation.isPending}>{updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={editTestRedirectOpen} onOpenChange={setEditTestRedirectOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Test Email Redirect</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">When set, <strong>all</strong> appointment emails (Medical & EID) will be sent only to this address — no real clients or CC recipients will receive anything. Leave blank to send normally.</p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Redirect To (your test email)</label>
              <Input value={testRedirectValue} onChange={(e) => setTestRedirectValue(e.target.value)} placeholder="yourname@procompany.ae" className="h-11 rounded-xl" type="email" data-testid="input-test-redirect-email" />
            </div>
            {settings?.testEmailRedirect && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-200">
                Currently active — emails redirecting to <strong>{settings.testEmailRedirect}</strong>
              </div>
            )}
            <div className="flex justify-between gap-3 pt-2">
              <Button type="button" variant="outline" className="rounded-xl text-destructive border-destructive/30" onClick={handleClearTestRedirect} disabled={!settings?.testEmailRedirect || updateSettingsMutation.isPending} data-testid="button-clear-test-redirect">Clear Redirect</Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditTestRedirectOpen(false)}>Cancel</Button>
                <Button type="button" className="rounded-xl" onClick={handleSaveTestRedirect} disabled={updateSettingsMutation.isPending}>{updateSettingsMutation.isPending ? "Saving..." : "Save"}</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editThresholdDialogOpen} onOpenChange={setEditThresholdDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Edit Low Balance Threshold</DialogTitle></DialogHeader>
          <Form {...thresholdForm}>
            <form onSubmit={thresholdForm.handleSubmit(handleSubmitThreshold)} className="space-y-4">
              <FormField control={thresholdForm.control} name="lowBalanceThreshold" render={({ field }) => (
                <FormItem><FormLabel>Threshold Amount (AED)</FormLabel><FormControl><Input {...field} type="number" placeholder="1000" className="h-11 rounded-xl" onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl><p className="text-xs text-muted-foreground">You'll be warned when balance falls below this amount</p><FormMessage /></FormItem>
              )} />
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditThresholdDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="rounded-xl" disabled={updateSettingsMutation.isPending}>{updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={editDelayThresholdDialogOpen} onOpenChange={setEditDelayThresholdDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Vendor Delay Threshold</DialogTitle></DialogHeader>
          <Form {...delayThresholdForm}>
            <form onSubmit={delayThresholdForm.handleSubmit(handleSubmitDelayThreshold)} className="space-y-4">
              <FormField control={delayThresholdForm.control} name="vendorDelayThresholdHours" render={({ field }) => (
                <FormItem><FormLabel>Threshold (hours)</FormLabel><FormControl><Input {...field} type="number" placeholder="48" className="h-11 rounded-xl" onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl><p className="text-xs text-muted-foreground">Work orders will be marked as Delayed when typing jobs exceed this time at vendor</p><FormMessage /></FormItem>
              )} />
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditDelayThresholdDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="rounded-xl" disabled={updateSettingsMutation.isPending}>{updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={editMaintenanceMsgOpen} onOpenChange={setEditMaintenanceMsgOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Edit Maintenance Message</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea value={maintenanceMsg} onChange={(e) => setMaintenanceMsg(e.target.value)} placeholder="System maintenance in progress..." rows={3} className="rounded-xl" data-testid="input-maintenance-message" />
            <div className="flex justify-end gap-3">
              <Button variant="outline" className="rounded-xl" onClick={() => setEditMaintenanceMsgOpen(false)}>Cancel</Button>
              <Button className="rounded-xl" onClick={async () => { try { await apiRequest("PUT", "/api/settings", { maintenanceMessage: maintenanceMsg }); queryClient.invalidateQueries({ queryKey: ["/api/settings"] }); toast({ title: "Maintenance message updated" }); setEditMaintenanceMsgOpen(false); } catch { toast({ title: "Failed to update", variant: "destructive" }); } }} data-testid="button-save-maintenance-msg">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editWhatsappOpen} onOpenChange={setEditWhatsappOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Edit WhatsApp Number</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input value={whatsappNum} onChange={(e) => setWhatsappNum(e.target.value)} placeholder="+971000000000" className="h-11 rounded-xl" data-testid="input-whatsapp-number" />
            <p className="text-xs text-muted-foreground">Include country code (e.g., +971 for UAE)</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" className="rounded-xl" onClick={() => setEditWhatsappOpen(false)}>Cancel</Button>
              <Button className="rounded-xl" onClick={async () => { try { await apiRequest("PUT", "/api/settings", { whatsappNumber: whatsappNum }); queryClient.invalidateQueries({ queryKey: ["/api/settings"] }); toast({ title: "WhatsApp number updated" }); setEditWhatsappOpen(false); } catch { toast({ title: "Failed to update", variant: "destructive" }); } }} data-testid="button-save-whatsapp">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editFollowUpCenterOpen} onOpenChange={setEditFollowUpCenterOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Edit Follow-Up Center</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input value={followUpCenterVal} onChange={(e) => setFollowUpCenterVal(e.target.value)} placeholder="Center name for follow-up appointments" className="h-11 rounded-xl" data-testid="input-followup-center" />
            <p className="text-xs text-muted-foreground">The default center used when scheduling medical follow-up appointments (e.g. retests)</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" className="rounded-xl" onClick={() => setEditFollowUpCenterOpen(false)}>Cancel</Button>
              <Button className="rounded-xl" onClick={async () => { try { await apiRequest("PUT", "/api/settings", { followUpCenter: followUpCenterVal || null }); queryClient.invalidateQueries({ queryKey: ["/api/settings"] }); toast({ title: "Follow-up center updated" }); setEditFollowUpCenterOpen(false); } catch { toast({ title: "Failed to update", variant: "destructive" }); } }} data-testid="button-save-followup-center">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editLegalOpen} onOpenChange={setEditLegalOpen}>
        <DialogContent className="rounded-2xl max-w-2xl">
          <DialogHeader>
            <DialogTitle>{legalType === "privacy" ? "Privacy Policy" : "Terms of Service"}</DialogTitle>
            <DialogDescription>Enter the content in HTML format. This will be displayed on the public-facing page.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea value={legalContent} onChange={(e) => setLegalContent(e.target.value)} placeholder="<h2>Section Title</h2><p>Content here...</p>" rows={12} className="rounded-xl font-mono text-sm" data-testid="input-legal-content" />
            <div className="flex justify-end gap-3">
              <Button variant="outline" className="rounded-xl" onClick={() => setEditLegalOpen(false)}>Cancel</Button>
              <Button className="rounded-xl" onClick={async () => { try { const field = legalType === "privacy" ? "privacyPolicyHtml" : "termsOfServiceHtml"; await apiRequest("PUT", "/api/settings", { [field]: legalContent }); queryClient.invalidateQueries({ queryKey: ["/api/settings"] }); toast({ title: `${legalType === "privacy" ? "Privacy Policy" : "Terms of Service"} updated` }); setEditLegalOpen(false); } catch { toast({ title: "Failed to update", variant: "destructive" }); } }} data-testid="button-save-legal">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

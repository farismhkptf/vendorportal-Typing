import { useState, useMemo, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, ArrowRight, Check, AlertTriangle, Home, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AppLayout } from "@/components/layout/app-layout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { toProperCase } from "@/lib/proper-case";
import type { WorkOrder, Company, Center, Staff, Appointment, ServiceType } from "@shared/schema";
import {
  appointmentSchema, getTomorrow, buildQueueItemFromWo, generateMedicalPreviews,
  type AppointmentForm, type SchedulingQueueItem, type SchedulingQueueResponse,
} from "./components/schedule-shared-types";
import { ScheduleWoSelector } from "./components/schedule-wo-selector";
import { ScheduleAppointmentForm } from "./components/schedule-appointment-form";
import { ScheduleConfirmationStep } from "./components/schedule-confirmation-step";

export default function ScheduleMedical() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedQueueItem, setSelectedQueueItem] = useState<SchedulingQueueItem | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCenterWarning, setShowCenterWarning] = useState(false);
  const [emailPreview, setEmailPreview] = useState("");
  const [whatsappPreview, setWhatsappPreview] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [urlWoProcessed, setUrlWoProcessed] = useState(false);
  const [appNumberAutoFilled, setAppNumberAutoFilled] = useState(false);
  const [scheduledApptId, setScheduledApptId] = useState<string | null>(null);
  const [scheduledRescheduleToken, setScheduledRescheduleToken] = useState<string | null>(null);
  const [emailSendStatus, setEmailSendStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [overrideEmail, setOverrideEmail] = useState<string | null>(null);
  const [selectedRecipients, setSelectedRecipients] = useState<string[] | null>(null);

  const { data: schedulingQueue, isLoading: queueLoading } = useQuery<SchedulingQueueResponse>({ queryKey: ["/api/appointments/scheduling-queue"] });
  const { data: companies } = useQuery<Company[]>({ queryKey: ["/api/companies"] });
  const { data: centers } = useQuery<Center[]>({ queryKey: ["/api/centers"] });
  const { data: staffList } = useQuery<Staff[]>({ queryKey: ["/api/staff"] });
  const { data: workOrders } = useQuery<WorkOrder[]>({ queryKey: ["/api/work-orders"] });
  const { data: serviceTypes } = useQuery<ServiceType[]>({ queryKey: ["/api/service-types"] });
  const { data: appSettings } = useQuery<Record<string, string>>({ queryKey: ["/api/settings"] });
  const { data: photoMap } = useQuery<Record<string, string>>({ queryKey: ["/api/work-orders/photos"], staleTime: 60000 });
  const { data: companyEmailsList } = useQuery<Array<{ id: string; label: string; email: string }>>({
    queryKey: ["/api/companies", selectedQueueItem?.companyId, "emails"],
    queryFn: async () => {
      if (!selectedQueueItem?.companyId) return [];
      const res = await fetch(`/api/companies/${selectedQueueItem.companyId}/emails`);
      return res.ok ? res.json() : [];
    },
    enabled: !!selectedQueueItem?.companyId,
  });

  const isFollowUp = useMemo(() => new URLSearchParams(searchParams).get("followup") === "true", [searchParams]);
  const woServiceTypeName = useMemo(() => {
    if (!selectedQueueItem?.serviceTypeId || !serviceTypes) return "Medical Examination";
    return serviceTypes.find(st => st.id === selectedQueueItem.serviceTypeId)?.name || "Medical Examination";
  }, [selectedQueueItem, serviceTypes]);
  const medicalCenters = useMemo(() => centers?.filter(c => c.type === "Medical" || c.type === "Both") || [], [centers]);
  const companyMedicalAssist = useMemo(() => (!selectedCompany?.assistStaffId || !staffList) ? null : staffList.find(s => s.id === selectedCompany.assistStaffId) || null, [selectedCompany, staffList]);
  const companyCRM = useMemo(() => (!selectedCompany?.rmStaffId || !staffList) ? null : staffList.find(s => s.id === selectedCompany.rmStaffId) || null, [selectedCompany, staffList]);
  const medicalQueue = useMemo(() => schedulingQueue?.medical || [], [schedulingQueue]);

  useEffect(() => { setOverrideEmail(null); setEmailSendStatus("idle"); setEmailSentTo(null); }, [selectedQueueItem?.woId]);

  const filteredWorkOrders = useMemo(() => {
    if (!workOrders || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return workOrders.filter(wo => wo.woNumber.toLowerCase().includes(q) || wo.applicantName.toLowerCase().includes(q)).slice(0, 10);
  }, [workOrders, searchQuery]);

  const form = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: { woId: "", isVip: false, centerId: "", applicationNumber: "", appointmentDate: getTomorrow(), appointmentTime: "11:00", assignedStaffId: "", notes: "" },
  });
  const watchedIsVip = useWatch({ control: form.control, name: "isVip" });
  const filteredCenters = useMemo(() => medicalCenters.filter(c => watchedIsVip ? c.tier === "VIP" : c.tier === "Normal"), [medicalCenters, watchedIsVip]);
  const selectedCenter = centers?.find(c => c.id === form.getValues("centerId"));

  const applyQueueItemToForm = (item: SchedulingQueueItem, company: Company | null | undefined) => {
    form.setValue("woId", item.woId);
    form.setValue("isVip", item.isVip);
    if (item.applicationRefNo) { form.setValue("applicationNumber", item.applicationRefNo); setAppNumberAutoFilled(true); }
    else { form.setValue("applicationNumber", ""); setAppNumberAutoFilled(false); }
    const preferredCenter = item.isVip ? item.preferredMedicalCenterVipId : item.preferredMedicalCenterId;
    if (preferredCenter) form.setValue("centerId", preferredCenter);
    if (item.assistStaffId) form.setValue("assignedStaffId", item.assistStaffId);
  };

  const handleSelectQueueItem = (item: SchedulingQueueItem) => {
    setSelectedQueueItem(item);
    const company = companies?.find(c => c.id === item.companyId);
    setSelectedCompany(company || null);
    applyQueueItemToForm(item, company);
    setShowManualSearch(false);
    setSearchQuery("");
  };

  const handleSelectManualWo = async (wo: WorkOrder) => {
    const company = companies?.find(c => c.id === wo.companyId);
    setSelectedCompany(company || null);
    const queueItem = buildQueueItemFromWo(wo, company);
    setSelectedQueueItem(queueItem);
    applyQueueItemToForm(queueItem, company);
    try {
      const response = await fetch(`/api/work-orders/${wo.id}`);
      if (response.ok) {
        const woDetails = await response.json();
        const medicalJob = woDetails.typingJobs?.find(
          (job: { jobType?: { category?: string }; result?: { applicationRefNo?: string } }) =>
            job.jobType?.category === "Medical" && job.result?.applicationRefNo
        );
        if (medicalJob?.result?.applicationRefNo) {
          form.setValue("applicationNumber", medicalJob.result.applicationRefNo);
          setAppNumberAutoFilled(true);
          setSelectedQueueItem(prev => prev ? { ...prev, applicationRefNo: medicalJob.result.applicationRefNo } : prev);
        }
      }
    } catch (error) { console.error("Failed to fetch WO details:", error); }
    setShowManualSearch(false);
    setSearchQuery("");
  };

  useEffect(() => {
    if (urlWoProcessed || !schedulingQueue || !workOrders || !companies) return;
    const woId = new URLSearchParams(searchParams).get("wo");
    if (woId) {
      const qi = medicalQueue.find(item => item.woId === woId);
      if (qi) handleSelectQueueItem(qi);
      else { const wo = workOrders.find(w => w.id === woId); if (wo) handleSelectManualWo(wo); }
    }
    setUrlWoProcessed(true);
  }, [schedulingQueue, workOrders, companies, searchParams, urlWoProcessed]);

  useEffect(() => {
    if (!isFollowUp || !appSettings?.followUpCenter || !centers) return;
    const fc = centers.find(c => c.name === appSettings.followUpCenter || c.id === appSettings.followUpCenter);
    if (fc) form.setValue("centerId", fc.id);
  }, [isFollowUp, appSettings, centers]);

  const generatePreviews = () => {
    if (!selectedQueueItem || !selectedCompany) return;
    const center = centers?.find(c => c.id === form.getValues("centerId"));
    const previews = generateMedicalPreviews(selectedQueueItem, selectedCompany, form.getValues(), center, staffList || undefined, woServiceTypeName);
    setEmailPreview(previews.emailPreview);
    setWhatsappPreview(previews.whatsappPreview);
    const d = form.getValues("appointmentDate"), t = form.getValues("appointmentTime");
    fetch("/api/appointments/email-preview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ woId: form.getValues("woId"), centerId: form.getValues("centerId") || undefined, assignedStaffId: form.getValues("assignedStaffId") || undefined, datetime: d && t ? `${d}T${t}:00` : undefined, applicationNumber: form.getValues("applicationNumber") || undefined, type: "Medical" }),
    }).then(r => r.text()).then(html => setPreviewHtml(html)).catch(() => {});
  };

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: AppointmentForm) => {
      const res = await apiRequest("POST", "/api/appointments", { woId: data.woId, type: "Medical", isVip: data.isVip, datetime: `${data.appointmentDate}T${data.appointmentTime}:00`, centerId: data.centerId, assignedStaffId: data.assignedStaffId, applicationNumber: data.applicationNumber, notes: data.notes, status: "Scheduled" });
      return res.json() as Promise<Appointment>;
    },
    onSuccess: async (appt) => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/scheduling-queue"] });
      setScheduledApptId(appt.id);
      if (appt.rescheduleToken) setScheduledRescheduleToken(appt.rescheduleToken);
      const effectiveRecipients = selectedRecipients !== null ? selectedRecipients : (overrideEmail ? [overrideEmail] : selectedQueueItem?.applicantEmail ? [selectedQueueItem.applicantEmail] : []);
      if (effectiveRecipients.length > 0 && appt.id) {
        setEmailSendStatus("sending");
        try {
          const body = selectedRecipients !== null ? { recipients: selectedRecipients } : overrideEmail ? { overrideEmail } : undefined;
          const r = await apiRequest("POST", `/api/appointments/${appt.id}/send-email`, body);
          const d = await r.json();
          setEmailSendStatus("sent"); setEmailSentTo(d.sentTo || effectiveRecipients.join(", "));
          toast({ title: "Appointment scheduled", description: `Confirmation email sent to ${d.sentTo || effectiveRecipients.join(", ")}.`, variant: "success" });
        } catch { setEmailSendStatus("failed"); toast({ title: "Appointment scheduled", description: "Email notification could not be sent — use Copy Email as a backup.", variant: "destructive" }); }
      } else { toast({ title: "Appointment scheduled", description: selectedQueueItem?.applicantEmail ? "No recipients selected — email not sent." : "No applicant email on file — notification not sent.", variant: "success" }); }
      setLocation("/appointments");
    },
    onError: (error: Error) => { toast({ title: "Error", description: error.message || "Failed to schedule appointment", variant: "destructive" }); },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (apptId: string) => { const res = await apiRequest("POST", `/api/appointments/${apptId}/send-email`, overrideEmail ? { overrideEmail } : undefined); return res.json() as Promise<{ sentTo: string }>; },
    onSuccess: (data) => { setEmailSendStatus("sent"); setEmailSentTo(data.sentTo); toast({ title: "Email sent", description: `Confirmation sent to ${data.sentTo}.`, variant: "success" }); },
    onError: (error: Error) => { setEmailSendStatus("failed"); toast({ title: "Email failed", description: error.message || "Could not send email.", variant: "destructive" }); },
  });

  const handleNextStep = () => {
    if (currentStep === 1) {
      const cid = form.getValues("centerId");
      const pref = watchedIsVip ? selectedCompany?.preferredMedicalCenterVipId : selectedCompany?.preferredMedicalCenterId;
      if (cid && pref && cid !== pref) { setShowCenterWarning(true); return; }
      generatePreviews();
    }
    setCurrentStep(2);
  };

  const handleSaveAndSend = async () => {
    if (!(await form.trigger())) { toast({ title: "Validation error", description: "Please fill in all required fields.", variant: "destructive" }); return; }
    setScheduledRescheduleToken(null);
    createAppointmentMutation.mutate(form.getValues());
  };

  const STEP_LABELS = ["Select & Configure", "Review & Send"];

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/work-orders")} data-testid="button-back"><ArrowLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-home"><Home className="h-4 w-4" /></Button>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">{isFollowUp ? "Schedule Follow-Up Medical" : "Schedule Medical"}</h1>
            <p className="text-sm text-muted-foreground">{isFollowUp ? "Schedule a follow-up medical retest appointment" : "Create a medical appointment and notify the client"}</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-1 mb-6" data-testid="step-indicator">
              {[1, 2].map((step) => (
                <div key={step} className="flex items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all", currentStep === step ? "bg-primary text-primary-foreground shadow-sm" : currentStep > step ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>{currentStep > step ? <Check className="h-4 w-4" /> : step}</div>
                    <span className={cn("text-[10px] font-medium", currentStep === step ? "text-primary" : currentStep > step ? "text-emerald-600" : "text-muted-foreground")}>{STEP_LABELS[step - 1]}</span>
                  </div>
                  {step < 2 && <div className={cn("w-12 sm:w-20 h-0.5 mx-1 mt-[-12px]", currentStep > step ? "bg-emerald-500" : "bg-muted")} />}
                </div>
              ))}
            </div>
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-4">
                  <h2 className="text-lg font-semibold tracking-tight" data-testid="text-step1-title">Select & Configure</h2>
                  <p className="text-sm text-muted-foreground">Choose from the ready-to-schedule queue or search manually</p>
                </div>
                <ScheduleWoSelector schedulerType="Medical" selectedQueueItem={selectedQueueItem} selectedCompany={selectedCompany} queue={medicalQueue} queueLoading={queueLoading} showManualSearch={showManualSearch} setShowManualSearch={setShowManualSearch} searchQuery={searchQuery} setSearchQuery={setSearchQuery} filteredWorkOrders={filteredWorkOrders} companies={companies} photoMap={photoMap} selectedWoId={selectedQueueItem?.woId || null} onSelectQueueItem={handleSelectQueueItem} onSelectManualWo={handleSelectManualWo} onClearSelection={() => { setSelectedQueueItem(null); setSelectedCompany(null); form.reset(); }} />
                {selectedQueueItem && (
                  <ScheduleAppointmentForm schedulerType="Medical" form={form} selectedQueueItem={selectedQueueItem} selectedCompany={selectedCompany} filteredCenters={filteredCenters} selectedCenter={selectedCenter} companyAssist={companyMedicalAssist} companyCRM={companyCRM} photoMap={photoMap} appNumberAutoFilled={appNumberAutoFilled} setAppNumberAutoFilled={setAppNumberAutoFilled} />
                )}
              </div>
            )}
            {currentStep === 2 && selectedQueueItem && (
              <ScheduleConfirmationStep schedulerType="Medical" form={form} selectedQueueItem={selectedQueueItem} selectedCompany={selectedCompany} selectedCenter={selectedCenter} companyAssist={companyMedicalAssist} companyCRM={companyCRM} emailPreview={emailPreview} whatsappPreview={whatsappPreview} previewHtml={previewHtml} scheduledApptId={scheduledApptId} rescheduleToken={scheduledRescheduleToken} emailSendStatus={emailSendStatus} emailSentTo={emailSentTo} setEmailSentTo={setEmailSentTo} overrideEmail={overrideEmail} setOverrideEmail={setOverrideEmail} setEmailSendStatus={setEmailSendStatus} onEditDetails={() => { setSelectedRecipients(null); setCurrentStep(1); }} onRegeneratePreviews={generatePreviews} companyEmailsList={companyEmailsList} onRecipientsChange={setSelectedRecipients} />
            )}
            <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t mt-6 -mx-6 px-6 py-4 flex justify-between gap-2 z-[9999]">
              {currentStep > 1 ? <Button variant="outline" onClick={() => { setSelectedRecipients(null); setCurrentStep(1); }} data-testid="button-back-step"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button> : <div />}
              {currentStep === 1 ? (
                <Button onClick={handleNextStep} disabled={!selectedQueueItem} data-testid="button-next">Next<ArrowRight className="h-4 w-4 ml-2" /></Button>
              ) : (
                <Button onClick={handleSaveAndSend} disabled={createAppointmentMutation.isPending || emailSendStatus === "sending"} className="bg-emerald-600 text-white" data-testid="button-schedule">
                  {createAppointmentMutation.isPending ? "Scheduling…" : emailSendStatus === "sending" ? (<><Mail className="h-4 w-4 mr-2 animate-pulse" />Sending Email…</>) : (<><Check className="h-4 w-4 mr-2" />{(overrideEmail || selectedQueueItem?.applicantEmail) ? "Schedule & Notify Client" : "Schedule Appointment"}</>)}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={showCenterWarning} onOpenChange={setShowCenterWarning}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />Different Center Selected</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">You selected <span className="font-medium text-foreground">{selectedCenter?.name}</span> instead of the company's preferred {watchedIsVip ? "VIP" : "normal"} medical center. Would you like to set this as the new default for <span className="font-medium text-foreground">{selectedCompany ? toProperCase(selectedCompany.name) : "this company"}</span>?</p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowCenterWarning(false)} data-testid="button-center-warning-back">Go Back</Button>
            <Button variant="secondary" onClick={() => { setShowCenterWarning(false); generatePreviews(); setCurrentStep(2); }} data-testid="button-center-warning-continue">Continue Without Changing</Button>
            <Button onClick={async () => {
              const centerId = form.getValues("centerId");
              if (selectedCompany && centerId) {
                try {
                  await apiRequest("PUT", `/api/companies/${selectedCompany.id}`, watchedIsVip ? { preferredMedicalCenterVipId: centerId } : { preferredMedicalCenterId: centerId });
                  queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
                  if (watchedIsVip) selectedCompany.preferredMedicalCenterVipId = centerId;
                  else selectedCompany.preferredMedicalCenterId = centerId;
                  toast({ title: "Default updated", description: `${selectedCenter?.name} is now the preferred ${watchedIsVip ? "VIP" : "normal"} medical center for ${toProperCase(selectedCompany.name)}.` });
                } catch { toast({ title: "Could not update default", description: "The appointment will continue but the company default was not changed.", variant: "destructive" }); }
              }
              setShowCenterWarning(false); generatePreviews(); setCurrentStep(2);
            }} data-testid="button-center-warning-set-default">Set as Default & Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

import { useState, useMemo, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, ArrowRight, Check, Mail, Home, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AppLayout } from "@/components/layout/app-layout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toProperCase } from "@/lib/proper-case";
import { cn } from "@/lib/utils";
import type { WorkOrder, Company, Center, Staff, Appointment, ServiceType } from "@shared/schema";
import {
  appointmentSchema, getTomorrow,
  getPreferredCenterId, getCenterUpdateField, getSchedulerConfig,
  buildQueueItemFromWo, generateEidPreviews, applyQueueItemToForm,
} from "./components/schedule-shared-types";
import type { AppointmentForm, SchedulingQueueItem, SchedulingQueueResponse } from "./components/schedule-shared-types";
import { ScheduleWoSelector } from "./components/schedule-wo-selector";
import { ScheduleAppointmentForm } from "./components/schedule-appointment-form";
import { ScheduleConfirmationStep } from "./components/schedule-confirmation-step";

const SCHEDULER_TYPE = "EID" as const;
const config = getSchedulerConfig(SCHEDULER_TYPE);

export default function ScheduleEid() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedQueueItem, setSelectedQueueItem] = useState<SchedulingQueueItem | null>(null);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWoId, setSelectedWoId] = useState<string | null>(null);
  const [showCenterWarning, setShowCenterWarning] = useState(false);
  const [emailPreview, setEmailPreview] = useState("");
  const [whatsappPreview, setWhatsappPreview] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [urlWoProcessed, setUrlWoProcessed] = useState(false);
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
  const { data: serviceTypes } = useQuery<ServiceType[]>({ queryKey: ["/api/service-types"] });
  const { data: photoMap } = useQuery<Record<string, string>>({ queryKey: ["/api/work-orders/photos"], staleTime: 60000 });

  const hasWoParam = useMemo(() => !!new URLSearchParams(searchParams).get("wo"), [searchParams]);
  const { data: workOrders } = useQuery<WorkOrder[]>({ queryKey: ["/api/work-orders"], enabled: showManualSearch || hasWoParam });

  const { data: companyEmailsList } = useQuery<Array<{ id: string; label: string; email: string }>>({
    queryKey: ["/api/companies", selectedQueueItem?.companyId, "emails"],
    queryFn: async () => {
      if (!selectedQueueItem?.companyId) return [];
      const res = await fetch(`/api/companies/${selectedQueueItem.companyId}/emails`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedQueueItem?.companyId,
  });

  const eidQueue = useMemo(() => schedulingQueue?.eid || [], [schedulingQueue]);
  const selectedCompany = useMemo(() => selectedQueueItem?.companyId ? companies?.find(c => c.id === selectedQueueItem.companyId) || null : null, [selectedQueueItem, companies]);
  const eidCenters = useMemo(() => centers?.filter(c => c.type === "EID" || c.type === "Both") || [], [centers]);
  const companyAssist = useMemo(() => selectedQueueItem?.assistStaffId ? staffList?.find(s => s.id === selectedQueueItem.assistStaffId) || null : null, [selectedQueueItem, staffList]);
  const companyCRM = useMemo(() => selectedQueueItem?.rmStaffId ? staffList?.find(s => s.id === selectedQueueItem.rmStaffId) || null : null, [selectedQueueItem, staffList]);
  const woServiceTypeName = useMemo(() => selectedQueueItem?.serviceTypeId ? serviceTypes?.find(st => st.id === selectedQueueItem.serviceTypeId)?.name || "Emirates ID" : "Emirates ID", [selectedQueueItem, serviceTypes]);
  const filteredWorkOrders = useMemo(() => !workOrders || !searchQuery.trim() ? [] : workOrders.filter(wo => { const q = searchQuery.toLowerCase(); return wo.woNumber.toLowerCase().includes(q) || wo.applicantName.toLowerCase().includes(q); }).slice(0, 10), [workOrders, searchQuery]);

  useEffect(() => { setOverrideEmail(null); setEmailSendStatus("idle"); setEmailSentTo(null); }, [selectedQueueItem?.woId]);

  const form = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: { woId: "", isVip: false, centerId: "", applicationNumber: "", appointmentDate: getTomorrow(), appointmentTime: "11:00", assignedStaffId: "", notes: "" },
  });
  const watchedIsVip = useWatch({ control: form.control, name: "isVip" });
  const filteredCenters = useMemo(() => eidCenters.filter(c => watchedIsVip ? c.tier === "VIP" : c.tier === "Normal"), [eidCenters, watchedIsVip]);
  const selectedCenter = centers?.find(c => c.id === form.getValues("centerId"));

  const handleSelectQueueItem = (item: SchedulingQueueItem) => {
    setSelectedQueueItem(item);
    setSelectedWoId(item.woId);
    applyQueueItemToForm(item, SCHEDULER_TYPE, centers, form as { setValue: (name: string, value: unknown) => void });
  };

  const handleSelectWorkOrderManual = async (wo: WorkOrder) => {
    const company = companies?.find(c => c.id === wo.companyId);
    const manualItem = buildQueueItemFromWo(wo, company);
    try {
      const response = await fetch(`/api/work-orders/${wo.id}`);
      if (response.ok) {
        const woDetails = await response.json();
        const eidJob = woDetails.typingJobs?.find((job: Record<string, unknown>) => {
          const jt = job.jobType as Record<string, unknown> | null;
          const res = job.result as Record<string, unknown> | null;
          return jt?.category === "EID" && res?.applicationRefNo;
        });
        if (eidJob) manualItem.applicationRefNo = (eidJob.result as Record<string, unknown>).applicationRefNo as string;
      }
    } catch { /* ignore */ }
    setSelectedQueueItem(manualItem);
    setSelectedWoId(wo.id);
    applyQueueItemToForm(manualItem, SCHEDULER_TYPE, centers, form as { setValue: (name: string, value: unknown) => void });
    setSearchQuery(""); setShowManualSearch(false);
  };

  useEffect(() => {
    if (urlWoProcessed || !schedulingQueue) return;
    const woId = new URLSearchParams(searchParams).get("wo");
    if (woId) {
      const queueItem = eidQueue.find(item => item.woId === woId);
      if (queueItem) handleSelectQueueItem(queueItem);
      else if (workOrders) { const wo = workOrders.find(w => w.id === woId); if (wo) handleSelectWorkOrderManual(wo); }
    }
    setUrlWoProcessed(true);
  }, [schedulingQueue, workOrders, searchParams, urlWoProcessed]);

  const generatePreviews = () => {
    if (!selectedQueueItem || !selectedCompany) return;
    const center = centers?.find(c => c.id === form.getValues("centerId"));
    const formValues = form.getValues();
    const previews = generateEidPreviews(selectedQueueItem, selectedCompany, formValues, center, staffList, woServiceTypeName);
    setEmailPreview(previews.emailPreview);
    setWhatsappPreview(previews.whatsappPreview);
    const datetimeIso = formValues.appointmentDate && formValues.appointmentTime ? `${formValues.appointmentDate}T${formValues.appointmentTime}:00` : undefined;
    fetch("/api/appointments/email-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ woId: formValues.woId, centerId: formValues.centerId || undefined, assignedStaffId: formValues.assignedStaffId || undefined, datetime: datetimeIso, applicationNumber: formValues.applicationNumber || undefined, type: "EID" }) }).then(r => r.text()).then(html => setPreviewHtml(html)).catch(() => {});
  };

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: AppointmentForm) => {
      const res = await apiRequest("POST", "/api/appointments", { woId: data.woId, type: "EID", isVip: data.isVip, datetime: `${data.appointmentDate}T${data.appointmentTime}:00`, centerId: data.centerId, assignedStaffId: data.assignedStaffId, applicationNumber: data.applicationNumber, notes: data.notes, status: "Scheduled" });
      return res.json() as Promise<Appointment>;
    },
    onSuccess: async (appointment) => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/scheduling-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/appointments-summary"] });
      setScheduledApptId(appointment.id);
      if (appointment.rescheduleToken) setScheduledRescheduleToken(appointment.rescheduleToken);
      const effectiveRecipients = selectedRecipients !== null ? selectedRecipients : (overrideEmail ? [overrideEmail] : selectedQueueItem?.applicantEmail ? [selectedQueueItem.applicantEmail] : []);
      if (effectiveRecipients.length > 0 && appointment.id) {
        setEmailSendStatus("sending");
        try {
          const body = selectedRecipients !== null ? { recipients: selectedRecipients } : overrideEmail ? { overrideEmail } : undefined;
          const emailRes = await apiRequest("POST", `/api/appointments/${appointment.id}/send-email`, body);
          const emailData = await emailRes.json();
          setEmailSendStatus("sent"); setEmailSentTo(emailData.sentTo || effectiveRecipients.join(", "));
          toast({ title: "Appointment scheduled", description: `Confirmation email sent to ${emailData.sentTo || effectiveRecipients.join(", ")}.`, variant: "success" });
        } catch {
          setEmailSendStatus("failed");
          toast({ title: "Appointment scheduled", description: "Email notification could not be sent — use Copy Email as a backup.", variant: "destructive" });
        }
      } else {
        toast({ title: "Appointment scheduled", description: selectedQueueItem?.applicantEmail ? "No recipients selected — email not sent." : "No applicant email on file — notification not sent.", variant: "success" });
      }
      setLocation("/appointments");
    },
    onError: (error: Error) => { toast({ title: "Error", description: error.message || "Failed to schedule appointment", variant: "destructive" }); },
  });

  const handleNextStep = () => {
    if (currentStep === 1) {
      const selectedCenterId = form.getValues("centerId");
      const preferredCenter = getPreferredCenterId(selectedQueueItem!, watchedIsVip, SCHEDULER_TYPE);
      if (selectedCenterId && preferredCenter && selectedCenterId !== preferredCenter) { setShowCenterWarning(true); return; }
      generatePreviews();
    }
    setCurrentStep(2);
  };

  const handleSaveAndSend = async () => {
    const isValid = await form.trigger();
    if (!isValid) { toast({ title: "Validation error", description: "Please fill in all required fields.", variant: "destructive" }); return; }
    setScheduledRescheduleToken(null);
    createAppointmentMutation.mutate(form.getValues());
  };

  const STEP_LABELS = ["Select & Configure", "Review & Send"];
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1 mb-6" data-testid="eid-step-indicator">
      {[1, 2].map((step) => (
        <div key={step} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all", currentStep === step ? "bg-primary text-primary-foreground shadow-sm" : currentStep > step ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
              {currentStep > step ? <Check className="h-4 w-4" /> : step}
            </div>
            <span className={cn("text-[10px] font-medium", currentStep === step ? "text-primary" : currentStep > step ? "text-emerald-600" : "text-muted-foreground")}>{STEP_LABELS[step - 1]}</span>
          </div>
          {step < 2 && <div className={cn("w-12 sm:w-20 h-0.5 mx-1 mt-[-12px]", currentStep > step ? "bg-emerald-500" : "bg-muted")} />}
        </div>
      ))}
    </div>
  );

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/work-orders")} data-testid="eid-button-back"><ArrowLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="eid-button-home"><Home className="h-4 w-4" /></Button>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{config.pageTitle}</h1>
            <p className="text-sm text-muted-foreground">{config.pageSubtitle}</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {renderStepIndicator()}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h2 className="text-lg font-semibold tracking-tight">Select & Configure</h2>
                  <p className="text-sm text-muted-foreground">Choose from the ready-to-schedule queue and configure details</p>
                </div>
                <ScheduleWoSelector
                  schedulerType={SCHEDULER_TYPE} selectedQueueItem={selectedQueueItem} selectedCompany={selectedCompany}
                  queue={eidQueue} queueLoading={queueLoading} showManualSearch={showManualSearch} setShowManualSearch={setShowManualSearch}
                  searchQuery={searchQuery} setSearchQuery={setSearchQuery} filteredWorkOrders={filteredWorkOrders}
                  companies={companies} photoMap={photoMap} selectedWoId={selectedWoId}
                  onSelectQueueItem={handleSelectQueueItem} onSelectManualWo={handleSelectWorkOrderManual}
                  onClearSelection={() => { setSelectedQueueItem(null); setSelectedWoId(null); form.reset(); }}
                />
                {selectedQueueItem && (
                  <>
                    <div className="border-t pt-4 mt-4" />
                    <ScheduleAppointmentForm
                      schedulerType={SCHEDULER_TYPE} form={form} selectedQueueItem={selectedQueueItem} selectedCompany={selectedCompany}
                      filteredCenters={filteredCenters} selectedCenter={selectedCenter} staffList={staffList}
                      companyAssist={companyAssist} companyCRM={companyCRM} photoMap={photoMap}
                    />
                  </>
                )}
              </div>
            )}
            {currentStep === 2 && selectedQueueItem && (
              <ScheduleConfirmationStep
                schedulerType={SCHEDULER_TYPE} form={form} selectedQueueItem={selectedQueueItem} selectedCompany={selectedCompany}
                selectedCenter={selectedCenter} centers={centers} companyAssist={companyAssist} companyCRM={companyCRM}
                emailPreview={emailPreview} whatsappPreview={whatsappPreview} previewHtml={previewHtml}
                scheduledApptId={scheduledApptId} rescheduleToken={scheduledRescheduleToken}
                emailSendStatus={emailSendStatus} setEmailSendStatus={setEmailSendStatus}
                emailSentTo={emailSentTo} setEmailSentTo={setEmailSentTo} overrideEmail={overrideEmail} setOverrideEmail={setOverrideEmail}
                onEditDetails={() => { setSelectedRecipients(null); setCurrentStep(1); }} onRegeneratePreviews={generatePreviews} companyEmailsList={companyEmailsList}
                onRecipientsChange={setSelectedRecipients}
              />
            )}
            <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t mt-6 -mx-6 px-6 py-4 flex justify-between gap-2 z-[9999]">
              {currentStep > 1 ? (
                <Button variant="outline" onClick={() => { setSelectedRecipients(null); setCurrentStep(1); }} data-testid="eid-button-back-step"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
              ) : <div />}
              {currentStep < 2 ? (
                <Button onClick={handleNextStep} disabled={!selectedQueueItem} data-testid="eid-button-next">Next<ArrowRight className="h-4 w-4 ml-2" /></Button>
              ) : (
                <Button onClick={handleSaveAndSend} disabled={createAppointmentMutation.isPending || emailSendStatus === "sending"} className="bg-emerald-600 text-white" data-testid="eid-button-schedule">
                  {createAppointmentMutation.isPending ? "Scheduling…" : emailSendStatus === "sending" ? <><Mail className="h-4 w-4 mr-2 animate-pulse" />Sending Email…</> : <><Check className="h-4 w-4 mr-2" />{(overrideEmail || selectedQueueItem?.applicantEmail) ? "Schedule & Notify Client" : "Schedule Appointment"}</>}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCenterWarning} onOpenChange={setShowCenterWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />Different Center Selected</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You selected <span className="font-medium text-foreground">{selectedCenter?.name}</span> instead of the company's preferred {watchedIsVip ? "VIP" : "normal"} EID center. Would you like to set this as the new default for <span className="font-medium text-foreground">{selectedCompany ? toProperCase(selectedCompany.name) : "this company"}</span>?
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowCenterWarning(false)} data-testid="button-eid-center-warning-back">Go Back</Button>
            <Button variant="secondary" onClick={() => { setShowCenterWarning(false); generatePreviews(); setCurrentStep(2); }} data-testid="button-eid-center-warning-continue">Continue Without Changing</Button>
            <Button onClick={async () => {
              const centerId = form.getValues("centerId");
              if (selectedCompany && centerId) {
                try {
                  await apiRequest("PUT", `/api/companies/${selectedCompany.id}`, getCenterUpdateField(centerId, watchedIsVip, SCHEDULER_TYPE));
                  queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
                  toast({ title: "Default updated", description: `${selectedCenter?.name} is now the preferred ${watchedIsVip ? "VIP" : "normal"} EID center for ${toProperCase(selectedCompany.name)}.` });
                } catch {
                  toast({ title: "Could not update default", description: "The appointment will continue but the company default was not changed.", variant: "destructive" });
                }
              }
              setShowCenterWarning(false); generatePreviews(); setCurrentStep(2);
            }} data-testid="button-eid-center-warning-set-default">Set as Default & Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

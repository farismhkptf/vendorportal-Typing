import { useState, useMemo, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { 
  ArrowLeft, ArrowRight, Check, Building2, User, Calendar, Clock, MapPin, 
  Phone, Mail, Star, Copy, Send, AlertTriangle,
  CreditCard, FileText, UserCheck, MessageSquare, CheckCircle2, Pencil,
  Maximize2, X, Home, Shield, Activity, Stethoscope, Search, ExternalLink
} from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AppLayout } from "@/components/layout/app-layout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WorkOrder, Company, Center, Staff, Appointment, ServiceType } from "@shared/schema";
import { cn } from "@/lib/utils";
import { toProperCase } from "@/lib/proper-case";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const TIME_SLOTS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30", "21:00"
];

const formatTime12h = (time24: string) => {
  const [hours, minutes] = time24.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

const getTomorrow = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
};

const appointmentSchema = z.object({
  woId: z.string().min(1, "Work order is required"),
  isVip: z.boolean().default(false),
  centerId: z.string().min(1, "Emirates ID center is required"),
  applicationNumber: z.string().optional(),
  appointmentDate: z.string().min(1, "Date is required"),
  appointmentTime: z.string().min(1, "Time is required"),
  assignedStaffId: z.string().optional(),
  notes: z.string().optional(),
});

type AppointmentForm = z.infer<typeof appointmentSchema>;

interface SchedulingQueueItem {
  typingJobId: string;
  jobCode: string | null;
  woId: string;
  woNumber: string;
  applicantName: string;
  applicantPhone: string | null;
  applicantEmail: string | null;
  isVip: boolean;
  serviceTypeId: string | null;
  companyId: string | null;
  companyName: string | null;
  preferredMedicalCenterId: string | null;
  preferredMedicalCenterVipId: string | null;
  preferredBiometricsCenterId: string | null;
  preferredBiometricsCenterVipId: string | null;
  assistStaffId: string | null;
  rmStaffId: string | null;
  applicationRefNo: string | null;
  biometricsRequired: boolean;
  biometricsDatetime: string | null;
  biometricsCenter: string | null;
  notes: string | null;
  returnedAt: string | null;
  completedAt: string | null;
}

interface SchedulingQueueResponse {
  medical: SchedulingQueueItem[];
  eid: SchedulingQueueItem[];
}

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
  const [messageCopied, setMessageCopied] = useState<"email" | "whatsapp" | null>(null);
  const [emailFullscreen, setEmailFullscreen] = useState(false);
  const [urlWoProcessed, setUrlWoProcessed] = useState(false);

  const { data: schedulingQueue, isLoading: queueLoading } = useQuery<SchedulingQueueResponse>({
    queryKey: ["/api/appointments/scheduling-queue"],
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: centers } = useQuery<Center[]>({
    queryKey: ["/api/centers"],
  });

  const { data: staffList } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const hasWoParam = useMemo(() => {
    const params = new URLSearchParams(searchParams);
    return !!params.get("wo");
  }, [searchParams]);

  const { data: workOrders } = useQuery<WorkOrder[]>({
    queryKey: ["/api/work-orders"],
    enabled: showManualSearch || hasWoParam,
  });

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const { data: photoMap } = useQuery<Record<string, string>>({
    queryKey: ["/api/work-orders/photos"],
    staleTime: 60000,
  });

  const eidQueue = useMemo(() => {
    return schedulingQueue?.eid || [];
  }, [schedulingQueue]);

  const woServiceTypeName = useMemo(() => {
    if (!selectedQueueItem?.serviceTypeId || !serviceTypes) return "Emirates ID";
    const serviceType = serviceTypes.find(st => st.id === selectedQueueItem.serviceTypeId);
    return serviceType?.name || "Emirates ID";
  }, [selectedQueueItem, serviceTypes]);

  const selectedCompany = useMemo(() => {
    if (!selectedQueueItem?.companyId || !companies) return null;
    return companies.find(c => c.id === selectedQueueItem.companyId) || null;
  }, [selectedQueueItem, companies]);

  const eidCenters = useMemo(() => {
    if (!centers) return [];
    return centers.filter(c => c.type === "EID" || c.type === "Both");
  }, [centers]);

  const companyAssist = useMemo(() => {
    if (!selectedQueueItem?.assistStaffId || !staffList) return null;
    return staffList.find(s => s.id === selectedQueueItem.assistStaffId) || null;
  }, [selectedQueueItem, staffList]);

  const companyCRM = useMemo(() => {
    if (!selectedQueueItem?.rmStaffId || !staffList) return null;
    return staffList.find(s => s.id === selectedQueueItem.rmStaffId) || null;
  }, [selectedQueueItem, staffList]);

  const filteredWorkOrders = useMemo(() => {
    if (!workOrders || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return workOrders.filter(wo => 
      wo.woNumber.toLowerCase().includes(q) ||
      wo.applicantName.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [workOrders, searchQuery]);

  const form = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      woId: "",
      isVip: false,
      centerId: "",
      applicationNumber: "",
      appointmentDate: getTomorrow(),
      appointmentTime: "11:00",
      assignedStaffId: "",
      notes: "",
    },
  });

  const watchedIsVip = useWatch({ control: form.control, name: "isVip" });

  const filteredCenters = useMemo(() => {
    return eidCenters.filter(c => 
      watchedIsVip ? c.tier === "VIP" : c.tier === "Normal"
    );
  }, [eidCenters, watchedIsVip]);

  const selectedCenter = centers?.find(c => c.id === form.getValues("centerId"));

  const handleSelectQueueItem = (item: SchedulingQueueItem) => {
    setSelectedQueueItem(item);
    setSelectedWoId(item.woId);

    form.setValue("woId", item.woId);
    form.setValue("isVip", item.isVip);
    form.setValue("applicationNumber", item.applicationRefNo || "");

    const preferredCenter = item.isVip 
      ? item.preferredBiometricsCenterVipId 
      : item.preferredBiometricsCenterId;

    if (item.biometricsCenter && centers) {
      const suggestedCenter = centers.find(c => 
        c.name.toLowerCase().includes(item.biometricsCenter!.toLowerCase()) ||
        item.biometricsCenter!.toLowerCase().includes(c.name.toLowerCase())
      );
      if (suggestedCenter) {
        form.setValue("centerId", suggestedCenter.id);
      } else if (preferredCenter) {
        form.setValue("centerId", preferredCenter);
      }
    } else if (preferredCenter) {
      form.setValue("centerId", preferredCenter);
    }

    if (item.assistStaffId) {
      form.setValue("assignedStaffId", item.assistStaffId);
    }

    if (item.biometricsDatetime) {
      const dt = new Date(item.biometricsDatetime);
      if (!isNaN(dt.getTime())) {
        const dateStr = dt.toISOString().split("T")[0];
        form.setValue("appointmentDate", dateStr);
        const hours = dt.getHours().toString().padStart(2, "0");
        const mins = dt.getMinutes() >= 30 ? "30" : "00";
        const timeStr = `${hours}:${mins}`;
        if (TIME_SLOTS.includes(timeStr)) {
          form.setValue("appointmentTime", timeStr);
        }
      }
    }
  };

  const handleSelectWorkOrderManual = async (wo: WorkOrder) => {
    const company = companies?.find(c => c.id === wo.companyId);
    
    const manualItem: SchedulingQueueItem = {
      typingJobId: "",
      jobCode: null,
      woId: wo.id,
      woNumber: wo.woNumber,
      applicantName: wo.applicantName,
      applicantPhone: wo.applicantPhone,
      applicantEmail: wo.applicantEmail,
      isVip: wo.isVip || false,
      serviceTypeId: wo.serviceTypeId,
      companyId: company?.id || null,
      companyName: company?.name || null,
      preferredMedicalCenterId: company?.preferredMedicalCenterId || null,
      preferredMedicalCenterVipId: company?.preferredMedicalCenterVipId || null,
      preferredBiometricsCenterId: company?.preferredBiometricsCenterId || null,
      preferredBiometricsCenterVipId: company?.preferredBiometricsCenterVipId || null,
      assistStaffId: company?.assistStaffId || null,
      rmStaffId: company?.rmStaffId || null,
      applicationRefNo: null,
      biometricsRequired: false,
      biometricsDatetime: null,
      biometricsCenter: null,
      notes: null,
      returnedAt: null,
      completedAt: null,
    };

    try {
      const response = await fetch(`/api/work-orders/${wo.id}`);
      if (response.ok) {
        const woDetails = await response.json();
        if (woDetails.typingJobs) {
          const eidJob = woDetails.typingJobs.find(
            (job: any) => job.jobType?.category === "EID" && job.result?.applicationRefNo
          );
          if (eidJob?.result?.applicationRefNo) {
            manualItem.applicationRefNo = eidJob.result.applicationRefNo;
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch WO details:", error);
    }

    setSelectedQueueItem(manualItem);
    setSelectedWoId(wo.id);
    
    form.setValue("woId", wo.id);
    form.setValue("isVip", wo.isVip || false);
    form.setValue("applicationNumber", manualItem.applicationRefNo || "");

    if (company) {
      const preferredCenter = wo.isVip 
        ? company.preferredBiometricsCenterVipId 
        : company.preferredBiometricsCenterId;
      if (preferredCenter) {
        form.setValue("centerId", preferredCenter);
      }
      if (company.assistStaffId) {
        form.setValue("assignedStaffId", company.assistStaffId);
      }
    }

    setSearchQuery("");
    setShowManualSearch(false);
  };

  useEffect(() => {
    if (urlWoProcessed || !schedulingQueue) return;
    
    const params = new URLSearchParams(searchParams);
    const woId = params.get("wo");
    
    if (woId) {
      const queueItem = eidQueue.find(item => item.woId === woId);
      if (queueItem) {
        handleSelectQueueItem(queueItem);
      } else if (workOrders) {
        const wo = workOrders.find(w => w.id === woId);
        if (wo) {
          handleSelectWorkOrderManual(wo);
        }
      }
    }
    setUrlWoProcessed(true);
  }, [schedulingQueue, workOrders, searchParams, urlWoProcessed]);

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: AppointmentForm) => {
      const datetime = new Date(`${data.appointmentDate}T${data.appointmentTime}:00`);
      return apiRequest("POST", "/api/appointments", {
        woId: data.woId,
        type: "EID",
        isVip: data.isVip,
        datetime: datetime.toISOString(),
        centerId: data.centerId,
        assignedStaffId: data.assignedStaffId,
        applicationNumber: data.applicationNumber,
        notes: data.notes,
        status: "Scheduled",
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/scheduling-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/appointments-summary"] });
      toast({
        title: "Appointment scheduled",
        description: "Emirates ID appointment has been scheduled successfully.",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule appointment",
        variant: "destructive",
      });
    },
  });

  const generatePreviews = () => {
    if (!selectedQueueItem || !selectedCompany) return;
    
    const center = centers?.find(c => c.id === form.getValues("centerId"));
    const assist = staffList?.find(s => s.id === selectedQueueItem.assistStaffId);
    const crm = staffList?.find(s => s.id === selectedQueueItem.rmStaffId);
    const date = form.getValues("appointmentDate");
    const time = form.getValues("appointmentTime");
    const appNum = form.getValues("applicationNumber");
    
    const formattedDate = new Date(date).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric", 
      month: "long",
      year: "numeric"
    });
    
    const contactLines = [];
    if (assist) {
      contactLines.push(`Field Assistant: ${assist.name}${assist.phone ? ` - ${assist.phone}` : ""}`);
    }
    if (crm) {
      contactLines.push(`Client Relations: ${crm.name}${crm.phone ? ` - ${crm.phone}` : ""}`);
    }
    const contactSection = contactLines.length > 0 
      ? `Your P.R.O. Team:\n${contactLines.join("\n")}` 
      : "";
    
    const emailBody = `Dear ${toProperCase(selectedCompany.name)} Team,

We have scheduled an Emirates ID appointment for your employee:

Applicant: ${toProperCase(selectedQueueItem.applicantName)}
${selectedQueueItem.applicantPhone ? `Contact: ${selectedQueueItem.applicantPhone}` : ""}

Appointment Details:
- Date: ${formattedDate}
- Time: ${formatTime12h(time)}
- Emirates ID Center: ${center?.name || "TBD"}
${center?.address ? `- Address: ${center.address}` : ""}
${center?.googleMapsUrl ? `- Location: ${center.googleMapsUrl}` : ""}
${appNum ? `- Application Number: ${appNum}` : ""}

${contactSection}

${form.getValues("notes") ? `Note: ${form.getValues("notes")}` : ""}

Please ensure the applicant arrives 15 minutes before the scheduled time with all required documents.

Once the Emirates ID process is completed, we will update you with the status.

Best regards,
The P.R.O. Company\u2122`;

    const assistanceSection = assist 
      ? `\u{1F464} Assistance: ${assist.name}
\u{1F4DE} ${assist.phone || ""}` 
      : "";

    const locationLink = center?.address 
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(center.address)}`
      : "";

    const whatsappBody = `Hello \u{1F44B}

Your Emirates ID appointment has been scheduled successfully for the following work.

\u{1F4C4} WO: ${selectedQueueItem.woNumber}
\u{1F464} Applicant: ${toProperCase(selectedQueueItem.applicantName)}
\u{1F3E2} Company: ${toProperCase(selectedCompany?.name || "")}
\u{1F9FE} Service: ${toProperCase(woServiceTypeName)}
${appNum ? `\u{1F522} Application No: ${appNum}` : ""}

\u{1FAAA} Emirates ID Center: ${center?.name || "TBD"}
\u{1F4C5} Date: ${formattedDate}
\u23F0 Time: ${formatTime12h(time)}
${center?.address ? `\u{1F4CD} Location: ${center.address}` : ""}
${locationLink ? `\u{1F5FA}\uFE0F Map: ${locationLink}` : ""}

${assistanceSection}

\u26A0\uFE0F *Important:*
\u2022 Please arrive at least *10 minutes before* the scheduled time.
\u2022 Please ensure the applicant brings their *original passport*.
${form.getValues("notes") ? `\u2022 ${form.getValues("notes")}` : ""}

Once the Emirates ID process is completed, we will update you with the status.

Thank you,
*The P.R.O. Company\u2122*`;

    setEmailPreview(emailBody);
    setWhatsappPreview(whatsappBody);

    const date2 = form.getValues("appointmentDate");
    const time2 = form.getValues("appointmentTime");
    let datetimeIso: string | undefined;
    if (date2 && time2) {
      const [h, m] = time2.split(":").map(Number);
      const dt = new Date(date2);
      dt.setHours(h, m, 0, 0);
      datetimeIso = dt.toISOString();
    }

    fetch("/api/appointments/email-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        woId: form.getValues("woId"),
        centerId: form.getValues("centerId") || undefined,
        assignedStaffId: form.getValues("assignedStaffId") || undefined,
        datetime: datetimeIso,
        applicationNumber: form.getValues("applicationNumber") || undefined,
        type: "EID",
      }),
    })
      .then(r => r.text())
      .then(html => setPreviewHtml(html))
      .catch(() => {});
  };

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
      } catch (err) {
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

  const handleNextStep = () => {
    if (currentStep === 1) {
      const selectedCenterId = form.getValues("centerId");
      const preferredCenter = watchedIsVip 
        ? selectedQueueItem?.preferredBiometricsCenterVipId 
        : selectedQueueItem?.preferredBiometricsCenterId;
      
      if (selectedCenterId && preferredCenter && selectedCenterId !== preferredCenter) {
        setShowCenterWarning(true);
        return;
      }
      
      generatePreviews();
    }
    setCurrentStep(2);
  };

  const handleSaveAndSend = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast({
        title: "Validation error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    
    createAppointmentMutation.mutate(form.getValues());
  };

  const getTimeSince = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    const diffMs = Date.now() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const STEP_LABELS = ["Select & Configure", "Review & Send"];

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1 mb-6" data-testid="eid-step-indicator">
      {[1, 2].map((step) => (
        <div key={step} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                currentStep === step
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : currentStep > step
                  ? "bg-emerald-500 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {currentStep > step ? <Check className="h-4 w-4" /> : step}
            </div>
            <span className={cn(
              "text-[10px] font-medium",
              currentStep === step ? "text-primary" : currentStep > step ? "text-emerald-600" : "text-muted-foreground"
            )}>
              {STEP_LABELS[step - 1]}
            </span>
          </div>
          {step < 2 && (
            <div
              className={cn(
                "w-12 sm:w-20 h-0.5 mx-1 mt-[-12px]",
                currentStep > step ? "bg-emerald-500" : "bg-muted"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Select & Configure</h2>
        <p className="text-sm text-muted-foreground">Choose from the ready-to-schedule queue and configure details</p>
      </div>

      {queueLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : eidQueue.length > 0 ? (
        <div className="space-y-1.5" data-testid="eid-scheduling-queue">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Ready to Schedule ({eidQueue.length})
            </span>
            <Badge variant="outline" className="text-xs">Biometrics Required</Badge>
          </div>
          {eidQueue.map((item) => {
            const isSelected = selectedWoId === item.woId;
            const timeSince = getTimeSince(item.completedAt);
            return (
              <button
                key={item.typingJobId}
                onClick={() => handleSelectQueueItem(item)}
                className={cn(
                  "w-full p-3 text-left rounded-lg flex items-center justify-between gap-3 transition-all",
                  isSelected
                    ? "bg-primary/10 border border-primary/30 shadow-sm"
                    : "hover-elevate border border-transparent"
                )}
                data-testid={`eid-queue-item-${item.woNumber}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    <span className="font-medium text-sm">{item.woNumber}</span>
                    {item.isVip && (
                      <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">VIP</Badge>
                    )}
                  </div>
                  <span className="text-sm truncate">{toProperCase(item.applicantName)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{toProperCase(item.companyName || "")}</span>
                  {timeSince && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{timeSince}</Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground" data-testid="eid-queue-empty">
          <Shield className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No EID appointments to schedule right now</p>
          <p className="text-xs mt-1">Only WOs with biometrics required appear here</p>
        </div>
      )}

      {!showManualSearch ? (
        <button
          onClick={() => setShowManualSearch(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto"
          data-testid="eid-link-manual-search"
        >
          <Search className="h-3 w-3" />
          Schedule for a different WO
        </button>
      ) : (
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Manual Search</span>
            <Button variant="ghost" size="sm" onClick={() => setShowManualSearch(false)} className="text-xs">
              <X className="h-3 w-3 mr-1" />
              Close
            </Button>
          </div>
          <div className="relative">
            <Input
              placeholder="Search WO number or applicant name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="eid-input-manual-search"
            />
            {filteredWorkOrders.length > 0 && (
              <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-auto">
                <CardContent className="p-2">
                  {filteredWorkOrders.map((wo) => {
                    const company = companies?.find(c => c.id === wo.companyId);
                    return (
                      <button
                        key={wo.id}
                        onClick={() => handleSelectWorkOrderManual(wo)}
                        className="w-full p-2 text-left rounded hover-elevate flex items-center justify-between gap-3 text-sm"
                        data-testid={`eid-manual-wo-${wo.woNumber}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{wo.woNumber}</span>
                          {wo.isVip && <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">VIP</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground truncate">{toProperCase(wo.applicantName)}</span>
                          <span className="text-xs text-muted-foreground">{toProperCase(company?.name || "")}</span>
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {selectedQueueItem && (
        <>
          <div className="border-t pt-4 mt-4" />

          {(selectedQueueItem.biometricsDatetime || selectedQueueItem.biometricsCenter || selectedQueueItem.completedAt || selectedQueueItem.applicationRefNo || selectedQueueItem.notes) && (
            <Card className="border-amber-500/20 bg-amber-500/5" data-testid="eid-schedule-context">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="h-5 w-5 rounded bg-amber-500/10 flex items-center justify-center">
                    <Calendar className="h-3 w-3 text-amber-600" />
                  </div>
                  Suggested Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                  {selectedQueueItem.applicationRefNo && (
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">App Ref No:</span>
                      <span className="font-medium">{selectedQueueItem.applicationRefNo}</span>
                    </div>
                  )}
                  {selectedQueueItem.completedAt && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Completed:</span>
                      <span className="font-medium">{new Date(selectedQueueItem.completedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                    </div>
                  )}
                  {selectedQueueItem.biometricsCenter && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Suggested Center:</span>
                      <span className="font-medium">{selectedQueueItem.biometricsCenter}</span>
                    </div>
                  )}
                  {selectedQueueItem.biometricsDatetime && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Suggested Date:</span>
                      <span className="font-medium">
                        {new Date(selectedQueueItem.biometricsDatetime).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        {" "}
                        {new Date(selectedQueueItem.biometricsDatetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                      </span>
                    </div>
                  )}
                </div>
                {selectedQueueItem.notes && (
                  <div className="text-xs p-2 rounded bg-background/50 border border-amber-500/10">
                    <span className="text-muted-foreground">Notes: </span>
                    <span>{selectedQueueItem.notes}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Form {...form}>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-8 w-8 shrink-0" data-testid={`avatar-eid-${selectedQueueItem.woNumber}`}>
                    {photoMap?.[selectedQueueItem.woId] ? (
                      <AvatarImage src={photoMap[selectedQueueItem.woId]} alt={selectedQueueItem.applicantName} />
                    ) : null}
                    <AvatarFallback className="text-xs font-medium">
                      {getInitials(selectedQueueItem.applicantName)}
                    </AvatarFallback>
                  </Avatar>
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium text-sm">{selectedQueueItem.woNumber}</span>
                  {selectedQueueItem.isVip && <Badge className="bg-amber-500 text-white text-xs">VIP</Badge>}
                  <span className="text-sm text-muted-foreground truncate">{toProperCase(selectedQueueItem.applicantName)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{toProperCase(selectedQueueItem.companyName || "")}</span>
                </div>
              </div>

              <FormField
                control={form.control}
                name="isVip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EID Type</FormLabel>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={!field.value ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => {
                          field.onChange(false);
                          form.setValue("centerId", "");
                        }}
                        disabled={selectedQueueItem?.isVip}
                        data-testid="eid-button-normal-eid"
                      >
                        Normal EID
                      </Button>
                      <Button
                        type="button"
                        variant={field.value ? "default" : "outline"}
                        className={cn("flex-1", field.value && "bg-amber-500 text-white border-amber-500")}
                        onClick={() => {
                          field.onChange(true);
                          form.setValue("centerId", "");
                        }}
                        data-testid="eid-button-vip-eid"
                      >
                        <Star className={cn("h-4 w-4 mr-2", field.value && "fill-current")} />
                        VIP EID
                      </Button>
                    </div>
                    {selectedQueueItem?.isVip && (
                      <p className="text-xs text-amber-600 mt-1">VIP locked based on work order</p>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="centerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emirates ID Center</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="eid-select-center">
                          <SelectValue placeholder="Select Emirates ID center" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredCenters.map((center) => (
                          <SelectItem key={center.id} value={center.id}>
                            <div className="flex items-center gap-2">
                              {center.name}
                              {center.id === (watchedIsVip ? selectedQueueItem?.preferredBiometricsCenterVipId : selectedQueueItem?.preferredBiometricsCenterId) && (
                                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedCenter?.googleMapsUrl && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={selectedCenter.googleMapsUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    View on Google Maps
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              <FormField
                control={form.control}
                name="applicationNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EID Application Number</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter application number" 
                        {...field} 
                        data-testid="eid-input-application-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="appointmentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          data-testid="eid-input-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="appointmentTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="eid-select-time">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIME_SLOTS.map((time) => (
                            <SelectItem key={time} value={time}>
                              {formatTime12h(time)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="assignedStaffId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Staff</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="eid-select-staff">
                          <SelectValue placeholder="Select staff member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {staffList?.filter(s => s.status === "Active" || s.status === "TempActive").map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <div className="flex items-center gap-2">
                              {s.name}
                              {s.id === selectedQueueItem?.assistStaffId && (
                                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <span className="text-sm font-medium">Company Team Contacts</span>
                {!companyAssist && !companyCRM && (
                  <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>No team members assigned to this company.</span>
                  </div>
                )}
                <div className="grid gap-2">
                  {companyAssist && (
                    <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{companyAssist.name}</p>
                          <p className="text-xs text-muted-foreground">Field Assistant</p>
                        </div>
                      </div>
                      {companyAssist.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{companyAssist.phone}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {companyCRM && (
                    <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{companyCRM.name}</p>
                          <p className="text-xs text-muted-foreground">Client Relation Manager</p>
                        </div>
                      </div>
                      {companyCRM.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{companyCRM.phone}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Special instructions..." 
                        className="min-h-[80px]"
                        {...field} 
                        data-testid="eid-input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Form>
        </>
      )}
    </div>
  );

  const renderStep2 = () => (
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
              onClick={() => setCurrentStep(1)}
              className="gap-1.5 text-xs"
              data-testid="eid-button-edit-details"
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
              <span className="text-muted-foreground">Assist:</span>
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
                  generatePreviews();
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedCompany?.clientCoordinator?.email && (
        <div className="flex items-center gap-2 text-sm bg-muted/50 p-3 rounded-lg mb-4">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Recipient:</span>
          <span>{selectedCompany.clientCoordinator.email}</span>
        </div>
      )}

      <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email" data-testid="eid-tab-email">
            <Mail className="h-4 w-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger value="whatsapp" data-testid="eid-tab-whatsapp">
            <MessageSquare className="h-4 w-4 mr-2" />
            WhatsApp
          </TabsTrigger>
        </TabsList>
        <TabsContent value="email">
          <div className="space-y-3">
            <div className="relative max-h-[500px] overflow-auto rounded-lg border">
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 z-10 shadow-sm"
                onClick={() => setEmailFullscreen(true)}
                data-testid="eid-button-expand-email"
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
            <Button 
              variant="default"
              className="w-full"
              onClick={() => handleCopyMessage("email")}
              data-testid="eid-button-copy-email"
            >
              {messageCopied === "email" ? (
                <><Check className="h-4 w-4 mr-2" />Copied to Clipboard!</>
              ) : (
                <><Copy className="h-4 w-4 mr-2" />Copy Email to Clipboard</>
              )}
            </Button>
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
                data-testid="eid-button-copy-whatsapp"
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
    </div>
  );

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/work-orders")} data-testid="eid-button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="eid-button-home">
              <Home className="h-4 w-4" />
            </Button>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Schedule Emirates ID</h1>
            <p className="text-sm text-muted-foreground">Create an Emirates ID appointment and notify the client</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {renderStepIndicator()}
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}

            <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t mt-6 -mx-6 px-6 py-4 flex justify-between gap-2 z-[9999]">
              {currentStep > 1 ? (
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  data-testid="eid-button-back-step"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              ) : (
                <div />
              )}
              
              {currentStep < 2 ? (
                <Button
                  onClick={handleNextStep}
                  disabled={!selectedQueueItem}
                  data-testid="eid-button-next"
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSaveAndSend}
                  disabled={createAppointmentMutation.isPending}
                  className="bg-emerald-600 text-white"
                  data-testid="eid-button-schedule"
                >
                  {createAppointmentMutation.isPending ? "Scheduling..." : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Schedule Appointment
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCenterWarning} onOpenChange={setShowCenterWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Different Center Selected
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You selected <span className="font-medium text-foreground">{selectedCenter?.name}</span> instead of the company's preferred {watchedIsVip ? "VIP" : "normal"} EID center. Would you like to set this as the new default for <span className="font-medium text-foreground">{selectedCompany ? toProperCase(selectedCompany.name) : "this company"}</span>?
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowCenterWarning(false)} data-testid="button-eid-center-warning-back">
              Go Back
            </Button>
            <Button variant="secondary" onClick={() => {
              setShowCenterWarning(false);
              generatePreviews();
              setCurrentStep(2);
            }} data-testid="button-eid-center-warning-continue">
              Continue Without Changing
            </Button>
            <Button onClick={async () => {
              const centerId = form.getValues("centerId");
              if (selectedCompany && centerId) {
                try {
                  const updateField = watchedIsVip 
                    ? { preferredBiometricsCenterVipId: centerId }
                    : { preferredBiometricsCenterId: centerId };
                  await apiRequest("PUT", `/api/companies/${selectedCompany.id}`, updateField);
                  queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
                  toast({
                    title: "Default updated",
                    description: `${selectedCenter?.name} is now the preferred ${watchedIsVip ? "VIP" : "normal"} EID center for ${toProperCase(selectedCompany.name)}.`,
                  });
                } catch (error) {
                  toast({
                    title: "Could not update default",
                    description: "The appointment will continue but the company default was not changed.",
                    variant: "destructive",
                  });
                }
              }
              setShowCenterWarning(false);
              generatePreviews();
              setCurrentStep(2);
            }} data-testid="button-eid-center-warning-set-default">
              Set as Default & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailFullscreen} onOpenChange={setEmailFullscreen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-[#2563eb] to-[#1e40af]">
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
                data-testid="eid-button-close-email-fullscreen"
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
              data-testid="eid-button-copy-email-fullscreen"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Email to Clipboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

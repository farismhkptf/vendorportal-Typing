import { useState, useMemo, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { 
  ArrowLeft, ArrowRight, Check, Building2, User, Calendar, MapPin, 
  Phone, Mail, Star, Copy, AlertTriangle, 
  Stethoscope, FileText, UserCheck, MessageSquare, CheckCircle2, Pencil,
  Maximize2, X, Home, Search, Package
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
  centerId: z.string().min(1, "Medical center is required"),
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

  const { data: workOrders } = useQuery<WorkOrder[]>({
    queryKey: ["/api/work-orders"],
  });

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const { data: appSettings } = useQuery<any>({
    queryKey: ["/api/settings"],
  });

  const { data: appointments } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: photoMap } = useQuery<Record<string, string>>({
    queryKey: ["/api/work-orders/photos"],
    staleTime: 60000,
  });

  const isFollowUp = useMemo(() => {
    const params = new URLSearchParams(searchParams);
    return params.get("followup") === "true";
  }, [searchParams]);

  const woServiceTypeName = useMemo(() => {
    if (!selectedQueueItem?.serviceTypeId || !serviceTypes) return "Medical Examination";
    const serviceType = serviceTypes.find(st => st.id === selectedQueueItem.serviceTypeId);
    return serviceType?.name || "Medical Examination";
  }, [selectedQueueItem, serviceTypes]);

  const medicalCenters = useMemo(() => {
    if (!centers) return [];
    return centers.filter(c => c.type === "Medical" || c.type === "Both");
  }, [centers]);

  const activeStaff = useMemo(() => {
    if (!staffList) return [];
    return staffList.filter(s => s.status === "Active" || s.status === "TempActive");
  }, [staffList]);

  const companyMedicalAssist = useMemo(() => {
    if (!selectedCompany?.assistStaffId || !staffList) return null;
    return staffList.find(s => s.id === selectedCompany.assistStaffId) || null;
  }, [selectedCompany, staffList]);

  const companyCRM = useMemo(() => {
    if (!selectedCompany?.rmStaffId || !staffList) return null;
    return staffList.find(s => s.id === selectedCompany.rmStaffId) || null;
  }, [selectedCompany, staffList]);

  const medicalQueue = useMemo(() => {
    return schedulingQueue?.medical || [];
  }, [schedulingQueue]);

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

  const handleSelectQueueItem = (item: SchedulingQueueItem) => {
    setSelectedQueueItem(item);
    const company = companies?.find(c => c.id === item.companyId);
    setSelectedCompany(company || null);

    form.setValue("woId", item.woId);
    form.setValue("isVip", item.isVip);

    if (item.applicationRefNo) {
      form.setValue("applicationNumber", item.applicationRefNo);
    }

    const preferredCenter = item.isVip
      ? item.preferredMedicalCenterVipId
      : item.preferredMedicalCenterId;
    if (preferredCenter) {
      form.setValue("centerId", preferredCenter);
    }

    if (item.assistStaffId) {
      form.setValue("assignedStaffId", item.assistStaffId);
    }

    setShowManualSearch(false);
    setSearchQuery("");
  };

  const handleSelectManualWo = async (wo: WorkOrder) => {
    const company = companies?.find(c => c.id === wo.companyId);
    setSelectedCompany(company || null);

    const queueItem: SchedulingQueueItem = {
      typingJobId: "",
      jobCode: null,
      woId: wo.id,
      woNumber: wo.woNumber,
      applicantName: wo.applicantName,
      applicantPhone: wo.applicantPhone || null,
      applicantEmail: wo.applicantEmail || null,
      isVip: wo.isVip || false,
      serviceTypeId: wo.serviceTypeId || null,
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

    setSelectedQueueItem(queueItem);
    form.setValue("woId", wo.id);
    form.setValue("isVip", wo.isVip || false);

    if (company) {
      const preferredCenter = wo.isVip
        ? company.preferredMedicalCenterVipId
        : company.preferredMedicalCenterId;
      if (preferredCenter) {
        form.setValue("centerId", preferredCenter);
      }
      if (company.assistStaffId) {
        form.setValue("assignedStaffId", company.assistStaffId);
      }
    }

    try {
      const response = await fetch(`/api/work-orders/${wo.id}`);
      if (response.ok) {
        const woDetails = await response.json();
        if (woDetails.typingJobs) {
          const medicalJob = woDetails.typingJobs.find(
            (job: any) => job.jobType?.category === "Medical" && job.result?.applicationRefNo
          );
          if (medicalJob?.result?.applicationRefNo) {
            form.setValue("applicationNumber", medicalJob.result.applicationRefNo);
            setSelectedQueueItem(prev => prev ? { ...prev, applicationRefNo: medicalJob.result.applicationRefNo } : prev);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch WO details:", error);
    }

    setShowManualSearch(false);
    setSearchQuery("");
  };

  useEffect(() => {
    if (urlWoProcessed || !schedulingQueue || !workOrders || !companies) return;

    const params = new URLSearchParams(searchParams);
    const woId = params.get("wo");

    if (woId) {
      const queueItem = medicalQueue.find(item => item.woId === woId);
      if (queueItem) {
        handleSelectQueueItem(queueItem);
      } else {
        const wo = workOrders.find(w => w.id === woId);
        if (wo) {
          handleSelectManualWo(wo);
        }
      }
    }
    setUrlWoProcessed(true);
  }, [schedulingQueue, workOrders, companies, searchParams, urlWoProcessed]);

  useEffect(() => {
    if (!isFollowUp || !appSettings?.followUpCenter || !centers) return;
    const followUpCenter = centers.find(c => c.name === appSettings.followUpCenter || c.id === appSettings.followUpCenter);
    if (followUpCenter) {
      form.setValue("centerId", followUpCenter.id);
    }
  }, [isFollowUp, appSettings, centers]);

  const filteredCenters = useMemo(() => {
    return medicalCenters.filter(c => 
      watchedIsVip ? c.tier === "VIP" : c.tier === "Normal"
    );
  }, [medicalCenters, watchedIsVip]);

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: AppointmentForm) => {
      const datetime = new Date(`${data.appointmentDate}T${data.appointmentTime}:00`);
      return apiRequest("POST", "/api/appointments", {
        woId: data.woId,
        type: "Medical",
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
      toast({
        title: "Appointment scheduled",
        description: "Medical appointment has been scheduled successfully.",
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
    const medicalAssist = staffList?.find(s => s.id === selectedCompany.assistStaffId);
    const crm = staffList?.find(s => s.id === selectedCompany.rmStaffId);
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
    if (medicalAssist) {
      contactLines.push(`Medical Assistant: ${medicalAssist.name}${medicalAssist.phone ? ` - ${medicalAssist.phone}` : ""}`);
    }
    if (crm) {
      contactLines.push(`Client Relations: ${crm.name}${crm.phone ? ` - ${crm.phone}` : ""}`);
    }
    const contactSection = contactLines.length > 0 
      ? `Your P.R.O. Team:\n${contactLines.join("\n")}` 
      : "";
    
    const emailBody = `Dear ${toProperCase(selectedCompany.name)} Team,

We have scheduled a medical appointment for your employee:

Applicant: ${toProperCase(selectedQueueItem.applicantName)}
${selectedQueueItem.applicantPhone ? `Contact: ${selectedQueueItem.applicantPhone}` : ""}

Appointment Details:
- Date: ${formattedDate}
- Time: ${formatTime12h(time)}
- Medical Center: ${center?.name || "TBD"}
${center?.address ? `- Address: ${center.address}` : ""}
${center?.googleMapsUrl ? `- Location: ${center.googleMapsUrl}` : ""}
${appNum ? `- Application Number: ${appNum}` : ""}

${contactSection}

${form.getValues("notes") ? `Note: ${form.getValues("notes")}` : ""}

Please ensure the applicant arrives 15 minutes before the scheduled time with all required documents.

Best regards,
The P.R.O. Company™`;

    const assistanceSection = medicalAssist 
      ? `Assistance: ${medicalAssist.name}
${medicalAssist.phone || ""}` 
      : "";

    const locationLink = center?.address 
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(center.address)}`
      : "";

    const whatsappBody = `Hello

Your medical appointment has been scheduled successfully for the following work.

WO: ${selectedQueueItem.woNumber}
Applicant: ${toProperCase(selectedQueueItem.applicantName)}
Company: ${toProperCase(selectedCompany?.name || "")}
Service: ${toProperCase(woServiceTypeName)}
${appNum ? `Application No: ${appNum}` : ""}

Medical Center: ${center?.name || "TBD"}
Date: ${formattedDate}
Time: ${formatTime12h(time)}
${center?.address ? `Location: ${center.address}` : ""}
${locationLink ? `Map: ${locationLink}` : ""}

${assistanceSection}

*Important:*
- Please arrive at least *10 minutes before* the scheduled time.
- Please ensure the applicant brings their *original passport*.
${form.getValues("notes") ? `- ${form.getValues("notes")}` : ""}

Thank you,
*The P.R.O. Company*`;

    setEmailPreview(emailBody);
    setWhatsappPreview(whatsappBody);

    const previewDate = form.getValues("appointmentDate");
    const previewTime = form.getValues("appointmentTime");
    let datetimeIso: string | undefined;
    if (previewDate && previewTime) {
      const [h, m] = previewTime.split(":").map(Number);
      const dt = new Date(previewDate);
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
        type: "Medical",
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
        ? selectedCompany?.preferredMedicalCenterVipId 
        : selectedCompany?.preferredMedicalCenterId;
      
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

  const selectedCenter = centers?.find(c => c.id === form.getValues("centerId"));

  const getTimeSinceCompleted = (completedAt: string | null) => {
    if (!completedAt) return null;
    const completed = new Date(completedAt);
    const now = new Date();
    const diffMs = now.getTime() - completed.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return "Just now";
  };

  const STEP_LABELS = ["Select & Configure", "Review & Send"];

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1 mb-6" data-testid="step-indicator">
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
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-lg font-semibold" data-testid="text-step1-title">Select & Configure</h2>
        <p className="text-sm text-muted-foreground">Choose from the ready-to-schedule queue or search manually</p>
      </div>

      {!selectedQueueItem && (
        <>
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Ready to Schedule
                {medicalQueue.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{medicalQueue.length}</Badge>
                )}
              </h3>
              <button
                onClick={() => setShowManualSearch(!showManualSearch)}
                className="text-xs text-primary hover:underline"
                data-testid="button-manual-search-toggle"
              >
                {showManualSearch ? "Hide manual search" : "Schedule for a different WO"}
              </button>
            </div>

            {queueLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : medicalQueue.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No medical appointments pending scheduling</p>
                <button
                  onClick={() => setShowManualSearch(true)}
                  className="text-xs text-primary hover:underline mt-2"
                  data-testid="button-show-manual-empty"
                >
                  Search for a work order manually
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto" data-testid="list-scheduling-queue">
                {medicalQueue.map((item) => {
                  const timeSince = getTimeSinceCompleted(item.completedAt);
                  return (
                    <button
                      key={item.typingJobId}
                      onClick={() => handleSelectQueueItem(item)}
                      className="w-full p-3 text-left rounded-lg border hover-elevate transition-colors"
                      data-testid={`button-queue-item-${item.woNumber}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-sm">{item.woNumber}</span>
                          {item.isVip && (
                            <Badge className="bg-amber-500 text-white text-[10px]">VIP</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {timeSince && (
                            <span className="text-[11px] text-muted-foreground">{timeSince}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 mt-1">
                        <span className="text-sm text-foreground truncate">{toProperCase(item.applicantName)}</span>
                        <span className="text-xs text-muted-foreground truncate">{toProperCase(item.companyName || "")}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {showManualSearch && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Search className="h-4 w-4" />
                Manual Search
              </h3>
              <div className="relative">
                <Input
                  placeholder="Search WO number or applicant name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-wo-search"
                />
                {filteredWorkOrders.length > 0 && (
                  <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-auto">
                    <CardContent className="p-2">
                      {filteredWorkOrders.map((wo) => {
                        const company = companies?.find(c => c.id === wo.companyId);
                        return (
                          <button
                            key={wo.id}
                            onClick={() => handleSelectManualWo(wo)}
                            className="w-full p-3 text-left rounded-lg hover-elevate flex items-center justify-between gap-3"
                            data-testid={`button-select-wo-${wo.woNumber}`}
                          >
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {wo.woNumber}
                                {wo.isVip && (
                                  <Badge className="bg-amber-500 text-white text-xs">VIP</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">{toProperCase(wo.applicantName)}</div>
                            </div>
                            <div className="text-sm text-muted-foreground">{toProperCase(company?.name || "")}</div>
                          </button>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {selectedQueueItem && (
        <>
          <Card className="border-primary/20 bg-primary/5" data-testid="card-selected-wo">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {selectedQueueItem.woNumber}
                  {selectedQueueItem.isVip && (
                    <Badge className="bg-amber-500 text-white">VIP</Badge>
                  )}
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedQueueItem(null);
                    setSelectedCompany(null);
                    form.reset();
                  }}
                  data-testid="button-change-wo"
                >
                  Change
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 shrink-0" data-testid={`avatar-medical-${selectedQueueItem.woNumber}`}>
                  {photoMap?.[selectedQueueItem.woId] ? (
                    <AvatarImage src={photoMap[selectedQueueItem.woId]} alt={selectedQueueItem.applicantName} />
                  ) : null}
                  <AvatarFallback className="text-xs font-medium">
                    {getInitials(selectedQueueItem.applicantName)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{toProperCase(selectedQueueItem.applicantName)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{toProperCase(selectedCompany?.name || selectedQueueItem.companyName || "—")}</span>
                </div>
                {selectedQueueItem.applicantPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedQueueItem.applicantPhone}</span>
                  </div>
                )}
                {selectedQueueItem.applicantEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedQueueItem.applicantEmail}</span>
                  </div>
                )}
                </div>
              </div>
            </CardContent>
          </Card>

          {(selectedQueueItem.applicationRefNo || selectedQueueItem.completedAt || selectedQueueItem.notes) && (
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20" data-testid="card-job-context">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Job Details</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {selectedQueueItem.applicationRefNo && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">App Ref No:</span>
                      <span className="font-medium text-blue-700 dark:text-blue-300">{selectedQueueItem.applicationRefNo}</span>
                    </div>
                  )}
                  {selectedQueueItem.completedAt && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Completed:</span>
                      <span>{new Date(selectedQueueItem.completedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                    </div>
                  )}
                </div>
                {selectedQueueItem.notes && (
                  <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                    <span className="text-xs text-muted-foreground">Notes:</span>
                    <p className="text-sm mt-0.5">{selectedQueueItem.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Form {...form}>
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Appointment Details
              </h3>

              <FormField
                control={form.control}
                name="isVip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medical Type</FormLabel>
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
                        data-testid="button-normal-medical"
                      >
                        Normal Medical
                      </Button>
                      <Button
                        type="button"
                        variant={field.value ? "default" : "outline"}
                        className={cn("flex-1", field.value && "bg-amber-500 text-white border-amber-500")}
                        onClick={() => {
                          field.onChange(true);
                          form.setValue("centerId", "");
                        }}
                        data-testid="button-vip-medical"
                      >
                        <Star className={cn("h-4 w-4 mr-2", field.value && "fill-current")} />
                        VIP Medical
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
                    <FormLabel>Medical Center</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-center">
                          <SelectValue placeholder="Select medical center" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredCenters.map((center) => (
                          <SelectItem key={center.id} value={center.id}>
                            <div className="flex items-center gap-2">
                              {center.name}
                              {center.id === (form.getValues("isVip") 
                                ? selectedCompany?.preferredMedicalCenterVipId 
                                : selectedCompany?.preferredMedicalCenterId) && (
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
                    className="text-primary hover:underline"
                  >
                    View on Google Maps
                  </a>
                </div>
              )}

              <FormField
                control={form.control}
                name="applicationNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medical Application Number</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter application number" 
                        {...field} 
                        data-testid="input-application-number"
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
                          data-testid="input-date"
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
                          <SelectTrigger data-testid="select-time">
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

              <div className="space-y-2">
                <FormLabel>Company Team Contacts</FormLabel>
                {!companyMedicalAssist && !companyCRM && (
                  <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>No team members assigned to this company. Please update the company profile.</span>
                  </div>
                )}
                <div className="grid gap-2">
                  {companyMedicalAssist ? (
                    <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{companyMedicalAssist.name}</p>
                          <p className="text-xs text-muted-foreground">Medical Assistant Support</p>
                        </div>
                      </div>
                      {companyMedicalAssist.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{companyMedicalAssist.phone}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                      No Medical Assistant assigned to this company
                    </div>
                  )}
                  {companyCRM ? (
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
                  ) : (
                    <div className="p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                      No Client Relation Manager assigned to this company
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
                        data-testid="input-notes"
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
        <h2 className="text-lg font-semibold" data-testid="text-step2-title">Review & Send</h2>
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
              data-testid="button-edit-details"
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
              <span className="text-muted-foreground">Medical Assist:</span>
              <span className="ml-2 font-medium">{companyMedicalAssist?.name || "Not assigned"}</span>
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
                onChange={(e) => {
                  form.setValue("notes", e.target.value);
                  generatePreviews();
                }}
                placeholder="Add any notes..."
                className="min-h-[60px] text-sm"
                data-testid="input-review-notes"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="email">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email" data-testid="tab-email">
            <Mail className="h-4 w-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger value="whatsapp" data-testid="tab-whatsapp">
            <MessageSquare className="h-4 w-4 mr-2" />
            WhatsApp
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-end gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmailFullscreen(true)}
                  className="gap-1.5 text-xs"
                  data-testid="button-expand-email"
                >
                  <Maximize2 className="h-3 w-3" />
                  Full Preview
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden" data-testid="preview-email">
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
                variant="outline" 
                className="w-full"
                onClick={() => handleCopyMessage("email")}
                data-testid="button-copy-email"
              >
                {messageCopied === "email" ? (
                  <><Check className="h-4 w-4 mr-2" />Copied!</>
                ) : (
                  <><Copy className="h-4 w-4 mr-2" />Copy Email</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card>
            <CardContent className="pt-4">
              <pre className="whitespace-pre-wrap text-sm font-sans bg-muted/30 p-4 rounded-lg max-h-64 overflow-auto" data-testid="preview-whatsapp">
                {whatsappPreview}
              </pre>
              <Button 
                variant="outline" 
                className="mt-3 w-full"
                onClick={() => handleCopyMessage("whatsapp")}
                data-testid="button-copy-whatsapp"
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
            <Button variant="ghost" size="icon" onClick={() => setLocation("/work-orders")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-home">
              <Home className="h-4 w-4" />
            </Button>
          </div>
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-page-title">
              {isFollowUp ? "Schedule Follow-Up Medical" : "Schedule Medical"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isFollowUp ? "Schedule a follow-up medical retest appointment" : "Create a medical appointment and notify the client"}
            </p>
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
                  data-testid="button-back-step"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              ) : (
                <div />
              )}
              
              {currentStep === 1 ? (
                <Button
                  onClick={handleNextStep}
                  disabled={!selectedQueueItem}
                  data-testid="button-next"
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSaveAndSend}
                  disabled={createAppointmentMutation.isPending}
                  className="bg-emerald-600 text-white"
                  data-testid="button-schedule"
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
            You selected <span className="font-medium text-foreground">{selectedCenter?.name}</span> instead of the company's preferred {watchedIsVip ? "VIP" : "normal"} medical center. Would you like to set this as the new default for <span className="font-medium text-foreground">{selectedCompany ? toProperCase(selectedCompany.name) : "this company"}</span>?
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowCenterWarning(false)} data-testid="button-center-warning-back">
              Go Back
            </Button>
            <Button variant="secondary" onClick={() => {
              setShowCenterWarning(false);
              generatePreviews();
              setCurrentStep(2);
            }} data-testid="button-center-warning-continue">
              Continue Without Changing
            </Button>
            <Button onClick={async () => {
              const centerId = form.getValues("centerId");
              if (selectedCompany && centerId) {
                try {
                  const updateField = watchedIsVip 
                    ? { preferredMedicalCenterVipId: centerId }
                    : { preferredMedicalCenterId: centerId };
                  await apiRequest("PUT", `/api/companies/${selectedCompany.id}`, updateField);
                  queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
                  if (selectedCompany) {
                    if (watchedIsVip) {
                      selectedCompany.preferredMedicalCenterVipId = centerId;
                    } else {
                      selectedCompany.preferredMedicalCenterId = centerId;
                    }
                  }
                  toast({
                    title: "Default updated",
                    description: `${selectedCenter?.name} is now the preferred ${watchedIsVip ? "VIP" : "normal"} medical center for ${toProperCase(selectedCompany.name)}.`,
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
            }} data-testid="button-center-warning-set-default">
              Set as Default & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailFullscreen} onOpenChange={setEmailFullscreen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-[#4a7c59] to-[#2d5a3d]">
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
                data-testid="button-close-email-fullscreen"
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
              data-testid="button-copy-email-fullscreen"
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

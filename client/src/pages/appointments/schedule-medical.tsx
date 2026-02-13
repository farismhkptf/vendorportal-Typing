import { useState, useMemo, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { 
  ArrowLeft, ArrowRight, Check, Building2, User, Calendar, Clock, MapPin, 
  Phone, Mail, Star, Copy, Send, AlertTriangle, Zap, ListOrdered,
  Stethoscope, FileText, UserCheck, MessageSquare, CheckCircle2, Pencil,
  Maximize2, X, Home
} from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AppLayout } from "@/components/layout/app-layout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WorkOrder, Company, Center, Staff, Appointment, ServiceType } from "@shared/schema";
import { cn } from "@/lib/utils";
import { toProperCase } from "@/lib/proper-case";
import { MedicalAppointmentEmail, generateMedicalAppointmentEmailHtml } from "@/components/email-templates/medical-appointment-email";

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

const quickWoSchema = z.object({
  woNumber: z.string().min(1, "WO number required").regex(/^[A-Z]\d{5,6}$/, "Format: Letter + 5-6 digits"),
  applicantName: z.string().min(1, "Applicant name required"),
  applicantPhone: z.string().optional(),
  isVip: z.boolean().default(false),
  companyId: z.string().min(1, "Company required"),
});

type QuickWoForm = z.infer<typeof quickWoSchema>;

interface TypingJobWithResult {
  id: string;
  woId: string;
  jobTypeId: string;
  status: string;
  jobType?: { id: string; name: string; category: string };
  result?: { applicationRefNo?: string | null };
}

interface WorkOrderWithDetails extends WorkOrder {
  company?: Company;
  typingJobs?: TypingJobWithResult[];
}

export default function ScheduleMedical() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const { toast } = useToast();
  const [mode, setMode] = useState<"wizard" | "quick">("wizard");
  const [currentStep, setCurrentStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWo, setSelectedWo] = useState<WorkOrderWithDetails | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showCreateWoModal, setShowCreateWoModal] = useState(false);
  const [showCenterWarning, setShowCenterWarning] = useState(false);
  const [emailPreview, setEmailPreview] = useState("");
  const [whatsappPreview, setWhatsappPreview] = useState("");
  const [messageCopied, setMessageCopied] = useState<"email" | "whatsapp" | null>(null);
  const [emailFullscreen, setEmailFullscreen] = useState(false);
  const [urlWoProcessed, setUrlWoProcessed] = useState(false);

  const { data: workOrders } = useQuery<WorkOrder[]>({
    queryKey: ["/api/work-orders"],
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

  const { data: appointments } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  // Derive service type name from WO's serviceTypeId or default to "Medical Examination"
  const woServiceTypeName = useMemo(() => {
    if (!selectedWo?.serviceTypeId || !serviceTypes) return "Medical Examination";
    const serviceType = serviceTypes.find(st => st.id === selectedWo.serviceTypeId);
    return serviceType?.name || "Medical Examination";
  }, [selectedWo, serviceTypes]);

  const existingAppointments = useMemo(() => {
    if (!appointments || !selectedWo) return [];
    return appointments.filter(a => a.woId === selectedWo.id);
  }, [appointments, selectedWo]);

  const medicalCenters = useMemo(() => {
    if (!centers) return [];
    return centers.filter(c => c.type === "Medical" || c.type === "Both");
  }, [centers]);

  const activeStaff = useMemo(() => {
    if (!staffList) return [];
    return staffList.filter(s => s.status === "Active" || s.status === "TempActive");
  }, [staffList]);

  // Get company's assigned staff members
  const companyMedicalAssist = useMemo(() => {
    if (!selectedCompany?.assistStaffId || !staffList) return null;
    return staffList.find(s => s.id === selectedCompany.assistStaffId) || null;
  }, [selectedCompany, staffList]);

  const companyCRM = useMemo(() => {
    if (!selectedCompany?.rmStaffId || !staffList) return null;
    return staffList.find(s => s.id === selectedCompany.rmStaffId) || null;
  }, [selectedCompany, staffList]);

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

  const quickWoForm = useForm<QuickWoForm>({
    resolver: zodResolver(quickWoSchema),
    defaultValues: {
      woNumber: "",
      applicantName: "",
      applicantPhone: "",
      isVip: false,
      companyId: "",
    },
  });

  const watchedIsVip = useWatch({ control: form.control, name: "isVip" });

  const handleSelectWorkOrder = async (wo: WorkOrder) => {
    const company = companies?.find(c => c.id === wo.companyId);
    setSelectedWo({ ...wo, company });
    setSelectedCompany(company || null);
    form.setValue("woId", wo.id);
    form.setValue("isVip", wo.isVip || false);
    
    // Fetch full work order details to get typing job application numbers
    try {
      const response = await fetch(`/api/work-orders/${wo.id}`);
      if (response.ok) {
        const woDetails = await response.json() as WorkOrderWithDetails;
        
        // Auto-fill application number from Medical typing job result
        if (woDetails.typingJobs) {
          const medicalJob = woDetails.typingJobs.find(
            job => job.jobType?.category === "Medical" && job.result?.applicationRefNo
          );
          if (medicalJob?.result?.applicationRefNo) {
            form.setValue("applicationNumber", medicalJob.result.applicationRefNo);
          }
        }
      }
    } catch (error) {
      // Silently fail - application number auto-fill is a convenience feature
      console.error("Failed to fetch WO details for application number:", error);
    }
    
    if (company) {
      const preferredCenter = wo.isVip 
        ? company.preferredMedicalCenterVipId 
        : company.preferredMedicalCenterId;
      if (preferredCenter) {
        form.setValue("centerId", preferredCenter);
      }
      // Auto-assign the company's Medical Assistant Support
      if (company.assistStaffId) {
        form.setValue("assignedStaffId", company.assistStaffId);
      }
    }
    
    setSearchQuery("");
    if (mode === "wizard") {
      setCurrentStep(2);
    }
  };

  // Handle URL parameter for pre-selecting work order
  useEffect(() => {
    if (urlWoProcessed || !workOrders || !companies) return;
    
    const params = new URLSearchParams(searchParams);
    const woId = params.get("wo");
    
    if (woId) {
      const wo = workOrders.find(w => w.id === woId);
      if (wo) {
        // Reuse existing handler which handles all setup: form values, fetch details,
        // auto-fill application number, preferred center, assigned staff, and step advancement
        handleSelectWorkOrder(wo);
      }
    }
    setUrlWoProcessed(true);
  }, [workOrders, companies, searchParams, urlWoProcessed]);

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
      toast({
        title: "Appointment scheduled",
        description: "Medical appointment has been scheduled successfully.",
      });
      if (mode === "quick") {
        setLocation("/work-orders");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule appointment",
        variant: "destructive",
      });
    },
  });

  const createQuickWoMutation = useMutation({
    mutationFn: async (data: QuickWoForm) => {
      return apiRequest("POST", "/api/work-orders", {
        ...data,
        status: "Draft",
      });
    },
    onSuccess: async (response) => {
      const wo = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setShowCreateWoModal(false);
      toast({
        title: "Work order created",
        description: `Work order ${wo.woNumber} created.`,
      });
      handleSelectWorkOrder(wo);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create work order",
        variant: "destructive",
      });
    },
  });

  const generatePreviews = () => {
    if (!selectedWo || !selectedCompany) return;
    
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
    
    // Build contact lines for team members
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

Applicant: ${toProperCase(selectedWo.applicantName)}
${selectedWo.applicantPhone ? `Contact: ${selectedWo.applicantPhone}` : ""}

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

    // WhatsApp assistance section
    const assistanceSection = medicalAssist 
      ? `👤 Assistance: ${medicalAssist.name}
📞 ${medicalAssist.phone || ""}` 
      : "";

    // Google Maps link for location
    const locationLink = center?.address 
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(center.address)}`
      : "";

    const whatsappBody = `Hello 👋

Your medical appointment has been scheduled successfully for the following work.

📄 WO: ${selectedWo.woNumber}
👤 Applicant: ${toProperCase(selectedWo.applicantName)}
🏢 Company: ${toProperCase(selectedCompany?.name || "")}
🧾 Service: ${toProperCase(woServiceTypeName)}
${appNum ? `🔢 Application No: ${appNum}` : ""}

🏥 Medical Center: ${center?.name || "TBD"}
📅 Date: ${formattedDate}
⏰ Time: ${formatTime12h(time)}
${center?.address ? `📍 Location: ${center.address}` : ""}
${locationLink ? `🗺️ Map: ${locationLink}` : ""}

${assistanceSection}

⚠️ *Important:*
• Please arrive at least *10 minutes before* the scheduled time.
• Please ensure the applicant brings their *original passport*.
${form.getValues("notes") ? `• ${form.getValues("notes")}` : ""}

Thank you,
*The P.R.O. Company™*`;

    setEmailPreview(emailBody);
    setWhatsappPreview(whatsappBody);
  };

  const handleCopyMessage = async (type: "email" | "whatsapp") => {
    if (type === "whatsapp") {
      await navigator.clipboard.writeText(whatsappPreview);
    } else {
      // Copy HTML for email to preserve formatting when pasted
      const emailHtml = generateMedicalAppointmentEmailHtml({
        woNumber: selectedWo?.woNumber || "",
        companyName: toProperCase(selectedCompany?.name || ""),
        applicantName: toProperCase(selectedWo?.applicantName || ""),
        serviceType: toProperCase(woServiceTypeName),
        centerName: selectedCenter?.name || "TBD",
        centerAddress: selectedCenter?.address || undefined,
        centerType: selectedCenter?.tier === "VIP" ? "VIP" : "Normal",
        appointmentDate: form.getValues("appointmentDate") 
          ? new Date(form.getValues("appointmentDate")).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric"
            })
          : "TBD",
        appointmentTime: form.getValues("appointmentTime") 
          ? formatTime12h(form.getValues("appointmentTime"))
          : "TBD",
        applicationNumber: form.getValues("applicationNumber") || undefined,
        medicalAssistName: companyMedicalAssist?.name,
        medicalAssistPhone: companyMedicalAssist?.phone || undefined,
        crmName: companyCRM?.name,
        crmPhone: companyCRM?.phone || undefined,
        notes: form.getValues("notes") || undefined,
      });
      
      try {
        // Use Clipboard API to copy both HTML and plain text
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([emailHtml], { type: "text/html" }),
            "text/plain": new Blob([emailPreview], { type: "text/plain" }),
          }),
        ]);
      } catch (err) {
        // Fallback to plain text if HTML copy fails
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
    if (currentStep === 2) {
      const selectedCenter = form.getValues("centerId");
      const preferredCenter = watchedIsVip 
        ? selectedCompany?.preferredMedicalCenterVipId 
        : selectedCompany?.preferredMedicalCenterId;
      
      if (selectedCenter && preferredCenter && selectedCenter !== preferredCenter) {
        setShowCenterWarning(true);
        return;
      }
      
      generatePreviews();
    }
    setCurrentStep(prev => Math.min(prev + 1, 3));
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

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
              currentStep === step
                ? "bg-primary text-primary-foreground"
                : currentStep > step
                ? "bg-emerald-500 text-white"
                : "bg-muted text-muted-foreground"
            )}
          >
            {currentStep > step ? <Check className="h-4 w-4" /> : step}
          </div>
          {step < 3 && (
            <div
              className={cn(
                "w-12 h-0.5 mx-1",
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
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold">Select Work Order</h2>
        <p className="text-sm text-muted-foreground">Search by WO number or applicant name</p>
      </div>

      <div className="relative">
        <Input
          placeholder="Search WO number or applicant name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 text-lg"
          data-testid="input-wo-search"
        />
        
        {filteredWorkOrders.length > 0 && (
          <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-auto">
            <CardContent className="p-2">
              {filteredWorkOrders.map((wo) => {
                const company = companies?.find(c => c.id === wo.companyId);
                return (
                  <button
                    key={wo.id}
                    onClick={() => handleSelectWorkOrder(wo)}
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

      {searchQuery && filteredWorkOrders.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">No work order found</p>
          <Button 
            onClick={() => setShowCreateWoModal(true)}
            data-testid="button-create-wo"
          >
            Create New Work Order
          </Button>
        </div>
      )}

      {selectedWo && (
        <Card className="mt-6 border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {selectedWo.woNumber}
                {selectedWo.isVip && (
                  <Badge className="bg-amber-500 text-white">VIP</Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedWo.status}</Badge>
                <Badge variant="secondary">Selected</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{toProperCase(selectedWo.applicantName)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{toProperCase(selectedCompany?.name || "—")}</span>
              </div>
              {selectedWo.applicantPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{selectedWo.applicantPhone}</span>
                </div>
              )}
              {selectedWo.applicantEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{selectedWo.applicantEmail}</span>
                </div>
              )}
              {selectedCompany?.preferredMedicalCenterId && (
                <div className="flex items-center gap-2 col-span-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-muted-foreground">
                    Preferred Center: {centers?.find(c => c.id === (selectedWo.isVip ? selectedCompany.preferredMedicalCenterVipId : selectedCompany.preferredMedicalCenterId))?.name || "Not set"}
                  </span>
                </div>
              )}
            </div>

            {existingAppointments.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Existing Appointments</p>
                <div className="space-y-2">
                  {existingAppointments.map((apt) => {
                    const aptCenter = centers?.find(c => c.id === apt.centerId);
                    return (
                      <div 
                        key={apt.id} 
                        className="flex items-center justify-between gap-3 p-2 rounded-md bg-background/50"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant={apt.type === "Medical" ? "default" : "secondary"} className="text-xs">
                            {apt.type}
                          </Badge>
                          <span className="text-sm">
                            {new Date(apt.datetime).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {new Date(apt.datetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{aptCenter?.name}</span>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              apt.status === "Completed" && "border-green-500 text-green-600",
                              apt.status === "Cancelled" && "border-red-500 text-red-600",
                              apt.status === "Scheduled" && "border-blue-500 text-blue-600"
                            )}
                          >
                            {apt.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderStep2 = () => (
    <Form {...form}>
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold">Appointment Details</h2>
          <p className="text-sm text-muted-foreground">Configure the medical appointment</p>
        </div>

        <div className="grid gap-4">
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
                    disabled={selectedWo?.isVip}
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
                {selectedWo?.isVip && (
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

          {/* Company Team Contacts */}
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
      </div>
    </Form>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold">Review & Send</h2>
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
              onClick={() => setCurrentStep(2)}
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
              <span className="ml-2 font-medium">{selectedWo?.woNumber}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Applicant:</span>
              <span className="ml-2 font-medium">{toProperCase(selectedWo?.applicantName || "")}</span>
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
          <div className="space-y-3">
            <div className="relative max-h-[500px] overflow-auto rounded-lg border">
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 z-10 shadow-sm"
                onClick={() => setEmailFullscreen(true)}
                data-testid="button-expand-email"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <MedicalAppointmentEmail
                woNumber={selectedWo?.woNumber || ""}
                companyName={toProperCase(selectedCompany?.name || "")}
                applicantName={toProperCase(selectedWo?.applicantName || "")}
                serviceType={toProperCase(woServiceTypeName)}
                centerName={selectedCenter?.name || "TBD"}
                centerAddress={selectedCenter?.address || undefined}
                centerType={selectedCenter?.tier === "VIP" ? "VIP" : "Normal"}
                appointmentDate={form.getValues("appointmentDate") 
                  ? new Date(form.getValues("appointmentDate")).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    })
                  : "TBD"}
                appointmentTime={form.getValues("appointmentTime") 
                  ? formatTime12h(form.getValues("appointmentTime"))
                  : "TBD"}
                applicationNumber={form.getValues("applicationNumber") || undefined}
                medicalAssistName={companyMedicalAssist?.name}
                medicalAssistPhone={companyMedicalAssist?.phone || undefined}
                crmName={companyCRM?.name}
                crmPhone={companyCRM?.phone || undefined}
                notes={form.getValues("notes") || undefined}
              />
            </div>
            <Button 
              variant="default"
              className="w-full"
              onClick={() => handleCopyMessage("email")}
              data-testid="button-copy-email"
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

  const renderQuickMode = () => (
    <Form {...form}>
      <div className="space-y-4">
        <div className="relative">
          <Input
            placeholder="Search WO number or applicant name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10"
            data-testid="input-quick-wo-search"
          />
          
          {filteredWorkOrders.length > 0 && (
            <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-auto">
              <CardContent className="p-2">
                {filteredWorkOrders.map((wo) => {
                  const company = companies?.find(c => c.id === wo.companyId);
                  return (
                    <button
                      key={wo.id}
                      onClick={() => handleSelectWorkOrder(wo)}
                      className="w-full p-2 text-left rounded hover-elevate flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="font-medium">{wo.woNumber}</span>
                      <span className="text-muted-foreground">{toProperCase(wo.applicantName)}</span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {selectedWo && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  {selectedWo.woNumber}
                  {selectedWo.isVip && <Badge className="bg-amber-500 text-white text-xs">VIP</Badge>}
                </div>
                <Badge variant="outline" className="text-xs">{selectedWo.status}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{toProperCase(selectedWo.applicantName)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{toProperCase(selectedCompany?.name || "")}</span>
                </div>
                {selectedWo.applicantPhone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{selectedWo.applicantPhone}</span>
                  </div>
                )}
                {selectedWo.applicantEmail && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{selectedWo.applicantEmail}</span>
                  </div>
                )}
              </div>
              {existingAppointments.length > 0 && (
                <div className="border-t pt-2">
                  <p className="text-xs text-muted-foreground mb-1">Existing: {existingAppointments.length} appointment(s)</p>
                  <div className="flex flex-wrap gap-1">
                    {existingAppointments.slice(0, 3).map((apt) => (
                      <Badge 
                        key={apt.id} 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          apt.status === "Scheduled" && "border-blue-500 text-blue-600"
                        )}
                      >
                        {apt.type} - {new Date(apt.datetime).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      </Badge>
                    ))}
                    {existingAppointments.length > 3 && (
                      <Badge variant="secondary" className="text-xs">+{existingAppointments.length - 3} more</Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="centerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Center</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select center" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {filteredCenters.map((center) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="appointmentDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Date</FormLabel>
                <FormControl>
                  <Input type="date" className="h-9" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="appointmentTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Time</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-9">
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
              </FormItem>
            )}
          />

        </div>

        {/* Compact Company Team Display */}
        {selectedWo && (
          <div className="space-y-2">
            {!companyMedicalAssist && !companyCRM && (
              <div className="flex items-center gap-1 p-2 bg-amber-500/10 rounded text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                <span>No team assigned to company</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-muted/50 rounded">
                <p className="text-muted-foreground">Medical Assist</p>
                {companyMedicalAssist ? (
                  <div>
                    <p className="font-medium">{companyMedicalAssist.name}</p>
                    {companyMedicalAssist.phone && <p className="text-muted-foreground">{companyMedicalAssist.phone}</p>}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Not assigned</p>
                )}
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <p className="text-muted-foreground">CRM</p>
                {companyCRM ? (
                  <div>
                    <p className="font-medium">{companyCRM.name}</p>
                    {companyCRM.phone && <p className="text-muted-foreground">{companyCRM.phone}</p>}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Not assigned</p>
                )}
              </div>
            </div>
          </div>
        )}

        <FormField
          control={form.control}
          name="applicationNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Application Number</FormLabel>
              <FormControl>
                <Input className="h-9" placeholder="Optional" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Preview Message
          </summary>
          <Card className="mt-2">
            <CardContent className="pt-3">
              <pre className="whitespace-pre-wrap text-xs font-sans bg-muted/30 p-3 rounded max-h-32 overflow-auto">
                {whatsappPreview || "Select WO and fill details to preview"}
              </pre>
            </CardContent>
          </Card>
        </details>

        <Button 
          className="w-full"
          disabled={!selectedWo || createAppointmentMutation.isPending}
          onClick={() => {
            generatePreviews();
            handleSaveAndSend();
          }}
          data-testid="button-quick-save"
        >
          {createAppointmentMutation.isPending ? "Saving..." : "Save & Send"}
        </Button>
      </div>
    </Form>
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
            <h1 className="text-xl font-semibold">Schedule Medical</h1>
            <p className="text-sm text-muted-foreground">Create a medical appointment and notify the client</p>
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button
              size="sm"
              variant={mode === "wizard" ? "default" : "ghost"}
              onClick={() => { setMode("wizard"); setCurrentStep(1); }}
              className="gap-2"
              data-testid="button-wizard-mode"
            >
              <ListOrdered className="h-4 w-4" />
              Wizard
            </Button>
            <Button
              size="sm"
              variant={mode === "quick" ? "default" : "ghost"}
              onClick={() => setMode("quick")}
              className="gap-2"
              data-testid="button-quick-mode"
            >
              <Zap className="h-4 w-4" />
              Quick
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {mode === "wizard" ? (
              <>
                {renderStepIndicator()}
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}

                <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t mt-6 -mx-6 px-6 py-4 flex justify-between gap-2 z-[9999]">
                  {currentStep > 1 ? (
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(prev => prev - 1)}
                      data-testid="button-back"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  ) : (
                    <div />
                  )}
                  
                  {currentStep < 3 ? (
                    <Button
                      onClick={handleNextStep}
                      disabled={currentStep === 1 && !selectedWo}
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
              </>
            ) : (
              renderQuickMode()
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateWoModal} onOpenChange={setShowCreateWoModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Work Order</DialogTitle>
          </DialogHeader>
          <Form {...quickWoForm}>
            <div className="space-y-4">
              <FormField
                control={quickWoForm.control}
                name="woNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WO Number</FormLabel>
                    <FormControl>
                      <Input placeholder="J016309" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={quickWoForm.control}
                name="applicantName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Applicant Name</FormLabel>
                    <FormControl>
                      <Input {...field} onBlur={(e) => { field.onBlur(); if (e.target.value) quickWoForm.setValue("applicantName", toProperCase(e.target.value)); }} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={quickWoForm.control}
                name="applicantPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={quickWoForm.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={quickWoForm.control}
                name="isVip"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={field.value ? "default" : "outline"}
                        className={cn(field.value && "bg-amber-500 text-white border-amber-500")}
                        onClick={() => field.onChange(!field.value)}
                      >
                        <Star className={cn("h-4 w-4 mr-1", field.value && "fill-current")} />
                        VIP
                      </Button>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </Form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateWoModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={quickWoForm.handleSubmit((data) => createQuickWoMutation.mutate(data))}
              disabled={createQuickWoMutation.isPending}
            >
              {createQuickWoMutation.isPending ? "Creating..." : "Create WO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              setCurrentStep(3);
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
              setCurrentStep(3);
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
            <MedicalAppointmentEmail
              woNumber={selectedWo?.woNumber || ""}
              companyName={toProperCase(selectedCompany?.name || "")}
              applicantName={toProperCase(selectedWo?.applicantName || "")}
              serviceType={toProperCase(woServiceTypeName)}
              centerName={selectedCenter?.name || "TBD"}
              centerAddress={selectedCenter?.address || undefined}
              centerType={selectedCenter?.tier === "VIP" ? "VIP" : "Normal"}
              appointmentDate={form.getValues("appointmentDate") 
                ? new Date(form.getValues("appointmentDate")).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                  })
                : "TBD"}
              appointmentTime={form.getValues("appointmentTime") 
                ? formatTime12h(form.getValues("appointmentTime"))
                : "TBD"}
              applicationNumber={form.getValues("applicationNumber") || undefined}
              medicalAssistName={companyMedicalAssist?.name}
              medicalAssistPhone={companyMedicalAssist?.phone || undefined}
              crmName={companyCRM?.name}
              crmPhone={companyCRM?.phone || undefined}
              notes={form.getValues("notes") || undefined}
            />
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

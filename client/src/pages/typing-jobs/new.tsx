import { useState, useMemo, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  ArrowLeft, ArrowRight, Check, Home, 
  FileText, Send, Stethoscope, 
  CheckCircle2, Loader2
} from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form } from "@/components/ui/form";
import { AppLayout } from "@/components/layout/app-layout";
import type { ServiceCategory } from "@/components/documents/document-types";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toProperCase } from "@/lib/proper-case";
import type { WorkOrder, Company, Center, Staff, ServiceType, Vendor, JobType } from "@shared/schema";
import { cn } from "@/lib/utils";
import { WoSelector } from "./components/wo-selector";
import { QuickCreateWoDialog } from "./components/quick-create-wo-dialog";
import { JobDetailsStep } from "./components/job-details-step";
import { EmailPreviewStep } from "./components/email-preview-step";

const typingJobSchema = z.object({
  woId: z.string().min(1, "Work order is required"),
  typeMedical: z.boolean().default(true),
  typeEid: z.boolean().default(true),
  isVip: z.boolean().default(false),
  centerAuthority: z.enum(["DHA", "EHS"]).optional(),
  medicalCenterId: z.string().optional(),
  hadIdBefore: z.boolean().default(false),
  biometricsCenterId: z.string().optional(),
  deliveryAddress: z.string().optional(),
  notes: z.string().optional(),
});

type TypingJobForm = z.infer<typeof typingJobSchema>;

const quickWoSchema = z.object({
  woNumber: z.string().min(1, "WO number required").regex(/^[A-Z]\d{5,6}$/, "Format: Letter + 5-6 digits"),
  applicantName: z.string().min(1, "Applicant name required"),
  applicantPhone: z.string().optional(),
  isVip: z.boolean().default(false),
  companyId: z.string().min(1, "Company required"),
});

type QuickWoForm = z.infer<typeof quickWoSchema>;

interface WorkOrderWithDetails extends WorkOrder {
  company?: Company;
}

const RENEWAL_KEYWORDS = ["renewal", "renew"];

function isRenewalService(serviceName: string | undefined): boolean {
  if (!serviceName) return false;
  const lowerName = serviceName.toLowerCase();
  return RENEWAL_KEYWORDS.some(kw => lowerName.includes(kw));
}

export default function NewTypingJob() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<"wizard" | "quick">("wizard");
  const [currentStep, setCurrentStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWo, setSelectedWo] = useState<WorkOrderWithDetails | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showCreateWoModal, setShowCreateWoModal] = useState(false);
  const [emailPreview, setEmailPreview] = useState("");
  const [isRenewal, setIsRenewal] = useState(false);
  const [initialWoLoaded, setInitialWoLoaded] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const preselectedWoId = urlParams.get("woId");

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

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: jobTypes } = useQuery<JobType[]>({
    queryKey: ["/api/job-types"],
  });

  const medicalJobType = useMemo(() => {
    if (!jobTypes) return null;
    return jobTypes.find(jt => jt.category === "Medical") || null;
  }, [jobTypes]);

  const eidJobType = useMemo(() => {
    if (!jobTypes) return null;
    return jobTypes.find(jt => jt.category === "EID") || null;
  }, [jobTypes]);

  const woServiceTypeName = useMemo(() => {
    if (!selectedWo?.serviceTypeId || !serviceTypes) return "Service";
    const serviceType = serviceTypes.find(st => st.id === selectedWo.serviceTypeId);
    return serviceType?.name || "Service";
  }, [selectedWo, serviceTypes]);

  const woServiceCategory = useMemo(() => {
    if (!selectedWo?.serviceTypeId || !serviceTypes) return null;
    const serviceType = serviceTypes.find(st => st.id === selectedWo.serviceTypeId);
    return (serviceType?.category as ServiceCategory) || null;
  }, [selectedWo, serviceTypes]);

  const medicalCenters = useMemo(() => {
    if (!centers) return [];
    return centers.filter(c => c.type === "Medical" || c.type === "Both");
  }, [centers]);

  const eidCenters = useMemo(() => {
    if (!centers) return [];
    return centers.filter(c => c.type === "EID" || c.type === "Both");
  }, [centers]);

  const filteredWorkOrders = useMemo(() => {
    if (!workOrders || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return workOrders.filter(wo => 
      wo.woNumber.toLowerCase().includes(q) ||
      wo.applicantName.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [workOrders, searchQuery]);

  const form = useForm<TypingJobForm>({
    resolver: zodResolver(typingJobSchema),
    defaultValues: {
      woId: "",
      typeMedical: true,
      typeEid: true,
      isVip: false,
      centerAuthority: "DHA",
      medicalCenterId: "",
      hadIdBefore: false,
      biometricsCenterId: "",
      deliveryAddress: "",
      notes: "",
    },
  });

  const woForm = useForm<QuickWoForm>({
    resolver: zodResolver(quickWoSchema),
    defaultValues: {
      woNumber: "",
      applicantName: "",
      applicantPhone: "",
      isVip: false,
      companyId: "",
    },
  });

  const typeMedical = useWatch({ control: form.control, name: "typeMedical" });
  const typeEid = useWatch({ control: form.control, name: "typeEid" });
  const isVip = useWatch({ control: form.control, name: "isVip" });
  const centerAuthority = useWatch({ control: form.control, name: "centerAuthority" });

  const docContext = useMemo((): "medical" | "eid" | "all" => {
    if (typeMedical && typeEid) return "all";
    if (typeMedical) return "medical";
    if (typeEid) return "eid";
    return "all";
  }, [typeMedical, typeEid]);

  const filteredMedicalCenters = useMemo(() => {
    let filtered = medicalCenters;
    if (centerAuthority) {
      filtered = filtered.filter(c => c.authority === centerAuthority);
    }
    if (isVip) {
      filtered = filtered.filter(c => c.tier === "VIP");
    } else {
      filtered = filtered.filter(c => c.tier === "Normal" || !c.tier);
    }
    return filtered;
  }, [medicalCenters, centerAuthority, isVip]);

  useEffect(() => {
    if (preselectedWoId && workOrders && companies && !initialWoLoaded) {
      const wo = workOrders.find(w => w.id === preselectedWoId);
      if (wo) {
        const company = companies.find(c => c.id === wo.companyId);
        setSelectedWo({ ...wo, company } as WorkOrderWithDetails);
        setSelectedCompany(company || null);
        form.setValue("woId", wo.id);
        setCurrentStep(2);
        setInitialWoLoaded(true);
      }
    }
  }, [preselectedWoId, workOrders, companies, initialWoLoaded, form]);

  useEffect(() => {
    if (selectedWo && selectedCompany) {
      const serviceType = serviceTypes?.find(st => st.id === selectedWo.serviceTypeId);
      const isRenewalType = isRenewalService(serviceType?.name);
      setIsRenewal(isRenewalType);
      
      const woIsVip = selectedWo.isVip || false;
      form.setValue("isVip", woIsVip);
      form.setValue("hadIdBefore", isRenewalType);
      
      if (woIsVip && selectedCompany.preferredMedicalCenterVipId) {
        form.setValue("medicalCenterId", selectedCompany.preferredMedicalCenterVipId);
      } else if (!woIsVip && selectedCompany.preferredMedicalCenterId) {
        form.setValue("medicalCenterId", selectedCompany.preferredMedicalCenterId);
      }
      
      if (selectedCompany.preferredBiometricsCenterId) {
        form.setValue("biometricsCenterId", selectedCompany.preferredBiometricsCenterId);
      }
      
      if (selectedCompany.deliveryAddress) {
        form.setValue("deliveryAddress", selectedCompany.deliveryAddress);
      }
    }
  }, [selectedWo, selectedCompany, serviceTypes, form]);

  const createWoMutation = useMutation({
    mutationFn: async (data: QuickWoForm) => {
      return apiRequest("POST", "/api/work-orders", data);
    },
    onSuccess: async (response) => {
      const newWo = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      const company = companies?.find(c => c.id === newWo.companyId);
      setSelectedWo({ ...newWo, company });
      setSelectedCompany(company || null);
      form.setValue("woId", newWo.id);
      setShowCreateWoModal(false);
      toast({ title: "Work order created" });
      if (mode === "wizard") {
        setCurrentStep(2);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSelectWo = (wo: WorkOrder) => {
    const company = companies?.find(c => c.id === wo.companyId);
    setSelectedWo({ ...wo, company });
    setSelectedCompany(company || null);
    form.setValue("woId", wo.id);
    setSearchQuery("");
    if (mode === "wizard") {
      setCurrentStep(2);
    }
  };

  const generateEmailPreview = () => {
    if (!selectedWo || !selectedCompany) return;
    
    const medicalCenter = centers?.find(c => c.id === form.getValues("medicalCenterId"));
    const biometricsCenter = centers?.find(c => c.id === form.getValues("biometricsCenterId"));
    const typeMed = form.getValues("typeMedical");
    const typeEidVal = form.getValues("typeEid");
    const vip = form.getValues("isVip");
    const hadId = form.getValues("hadIdBefore");
    const deliveryAddr = form.getValues("deliveryAddress");

    let subject = "Typing Request - ";
    const jobTypeNames = [];
    if (typeMed) jobTypeNames.push("Medical Application");
    if (typeEidVal) jobTypeNames.push("Emirates ID Application");
    subject += jobTypeNames.join(" & ");
    subject += ` - ${selectedWo.woNumber}`;

    let body = `Dear Typing Team,

Please type the following application(s):

Work Order: ${selectedWo.woNumber}
Applicant: ${toProperCase(selectedWo.applicantName)}
Company: ${selectedCompany.name}
Service: ${woServiceTypeName}
`;

    if (typeMed) {
      body += `
--- MEDICAL APPLICATION ---
Type: ${vip ? "VIP" : "Normal"}
Medical Center: ${medicalCenter?.name || "To be assigned"}
Authority: ${form.getValues("centerAuthority") || "N/A"}
`;
    }

    if (typeEidVal) {
      body += `
--- EMIRATES ID APPLICATION ---
Had ID Before: ${hadId ? "Yes" : "No"}
Biometrics Center: ${biometricsCenter?.name || "To be assigned"}
Delivery Address: ${deliveryAddr || "N/A"}
`;
    }

    if (form.getValues("notes")) {
      body += `
Notes: ${form.getValues("notes")}
`;
    }

    body += `
Please process at your earliest convenience.

Best regards,
The P.R.O. Company™`;

    setEmailPreview(`Subject: ${subject}\n\n${body}`);
  };

  const submitMutation = useMutation({
    mutationFn: async (data: TypingJobForm) => {
      const jobs = [];
      
      if (data.typeMedical && medicalJobType) {
        jobs.push({
          woId: data.woId,
          jobTypeId: medicalJobType.id,
          status: "Draft",
        });
      }
      
      if (data.typeEid && eidJobType) {
        jobs.push({
          woId: data.woId,
          jobTypeId: eidJobType.id,
          status: "Draft",
        });
      }

      if (jobs.length === 0) {
        throw new Error("No valid job types found. Please ensure job types are configured in Admin.");
      }
      
      return Promise.all(jobs.map(job => 
        apiRequest("POST", "/api/typing-jobs", job)
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/typing-jobs"] });
      toast({ title: "Typing job(s) created successfully" });
      setLocation("/typing-jobs");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleNext = () => {
    if (currentStep === 1 && !selectedWo) {
      toast({ title: "Please select a work order", variant: "destructive" });
      return;
    }
    if (currentStep === 2) {
      if (!typeMedical && !typeEid) {
        toast({ title: "Please select at least one job type", variant: "destructive" });
        return;
      }
      generateEmailPreview();
    }
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const steps = [
    { number: 1, title: "Select WO", icon: FileText },
    { number: 2, title: "Job Details", icon: Stethoscope },
    { number: 3, title: "Review & Send", icon: Send },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="sticky top-0 z-[9999] bg-background/80 backdrop-blur-md border-b border-border/50">
          <div className="max-w-4xl mx-auto px-4 lg:px-6 pt-4 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setLocation("/typing-jobs")}
                    data-testid="button-back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setLocation("/")}
                    data-testid="button-home"
                  >
                    <Home className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight">New Typing Job</h1>
                  <p className="text-sm text-muted-foreground">Send applications to vendor for typing</p>
                </div>
              </div>
              
              <Tabs value={mode} onValueChange={(v) => setMode(v as "wizard" | "quick")}>
                <TabsList className="h-9">
                  <TabsTrigger value="wizard" className="text-xs px-3" data-testid="tab-wizard">
                    Wizard
                  </TabsTrigger>
                  <TabsTrigger value="quick" className="text-xs px-3" data-testid="tab-quick">
                    Quick
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 lg:px-6 py-6">
          {mode === "wizard" && (
            <div className="flex items-center justify-center mb-8">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center">
                  <div 
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
                      currentStep === step.number 
                        ? "bg-primary text-primary-foreground" 
                        : currentStep > step.number
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {currentStep > step.number ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <step.icon className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={cn(
                      "w-12 h-0.5 mx-2",
                      currentStep > step.number ? "bg-primary" : "bg-muted"
                    )} />
                  )}
                </div>
              ))}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => submitMutation.mutate(data))}>
              {(mode === "quick" || currentStep === 1) && (
                <WoSelector
                  selectedWo={selectedWo}
                  selectedCompany={selectedCompany}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  filteredWorkOrders={filteredWorkOrders}
                  onSelectWo={handleSelectWo}
                  onClearWo={() => {
                    setSelectedWo(null);
                    setSelectedCompany(null);
                    form.setValue("woId", "");
                  }}
                  onCreateWo={() => setShowCreateWoModal(true)}
                />
              )}

              {(mode === "quick" || currentStep === 2) && selectedWo && (
                <JobDetailsStep
                  form={form}
                  selectedWo={selectedWo}
                  selectedCompany={selectedCompany}
                  serviceTypes={serviceTypes}
                  typeMedical={typeMedical}
                  typeEid={typeEid}
                  isVip={isVip}
                  centerAuthority={centerAuthority}
                  isRenewal={isRenewal}
                  filteredMedicalCenters={filteredMedicalCenters}
                  eidCenters={eidCenters}
                  woServiceCategory={woServiceCategory}
                  docContext={docContext}
                />
              )}

              {(mode === "wizard" && currentStep === 3) && (
                <EmailPreviewStep emailPreview={emailPreview} />
              )}

              {mode === "wizard" && (
                <div className="sticky bottom-0 z-[9999] bg-background/80 backdrop-blur-md border-t border-border/50 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 mt-6">
                  <div className="flex items-center justify-between gap-2 max-w-4xl mx-auto">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                      disabled={currentStep === 1}
                      className="gap-2"
                      data-testid="button-back-step"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                    
                    {currentStep < 3 ? (
                      <Button
                        type="button"
                        onClick={handleNext}
                        className="gap-2"
                        data-testid="button-next-step"
                      >
                        Next
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        disabled={submitMutation.isPending}
                        className="gap-2"
                        data-testid="button-submit"
                      >
                        {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {submitMutation.isPending ? "Creating..." : "Create Typing Job"}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {mode === "quick" && selectedWo && (
                <div className="mt-6">
                  <Button
                    type="submit"
                    disabled={submitMutation.isPending}
                    className="w-full gap-2"
                    data-testid="button-submit-quick"
                  >
                    {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {submitMutation.isPending ? "Creating..." : "Create Typing Job"}
                  </Button>
                </div>
              )}
            </form>
          </Form>
        </div>
      </div>

      <QuickCreateWoDialog
        open={showCreateWoModal}
        onOpenChange={setShowCreateWoModal}
        woForm={woForm}
        companies={companies}
        onSubmit={(data) => createWoMutation.mutate(data)}
        isPending={createWoMutation.isPending}
      />
    </AppLayout>
  );
}

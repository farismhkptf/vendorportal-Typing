import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Settings, 
  MapPin, 
  Users, 
  FileText, 
  Briefcase,
  Building2,
  Mail,
  User,
  Plus,
  Pencil,
  Search,
  Trash2,
  Calendar,
  ChevronDown,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Center, Staff, ServiceType, JobType, AppSettings, Company, CompanyEmail } from "@shared/schema";
import { toProperCase } from "@/lib/proper-case";

interface CompanyWithRelations extends Company {
  rmStaff?: Staff;
  assistStaff?: Staff;
  preferredMedicalCenter?: Center;
  preferredEidCenter?: Center;
  emails?: CompanyEmail[];
}

const centerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["Medical", "EID", "Both"]),
  authority: z.enum(["DHA", "EHS"]).optional().nullable(),
  tier: z.enum(["Normal", "VIP"]).optional().nullable(),
  address: z.string().optional(),
  area: z.string().optional(),
  googleMapsUrl: z.string().url().optional().or(z.literal("")),
  timingText: z.string().optional(),
  notes: z.string().optional(),
});

const staffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  roleTitle: z.string().min(1, "Role is required"),
  staffType: z.enum(["Permanent", "Temporary"]).default("Permanent"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  status: z.enum(["Active", "OnLeave", "Cancelled", "TempActive", "TempInactive"]).default("Active"),
  replacementId: z.string().optional().nullable(),
  leaveEndDate: z.string().optional().nullable(),
});

const serviceTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  requiresMedicalTyping: z.boolean().default(false),
  requiresMedicalScheduling: z.boolean().default(false),
  requiresIdTyping2Years: z.boolean().default(false),
  requiresIdTyping1Year: z.boolean().default(false),
  requiresIdTyping10Years: z.boolean().default(false),
  requiresIdBiometrics: z.boolean().default(false),
});

const jobTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.enum(["Medical", "EID"]),
  cost: z.coerce.number().min(0, "Cost must be positive"),
});

const ccRecipientsSchema = z.object({
  alwaysCc: z.string(),
});

const thresholdSchema = z.object({
  lowBalanceThreshold: z.coerce.number().min(0, "Must be 0 or greater"),
});

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("companies");
  const [centerDialogOpen, setCenterDialogOpen] = useState(false);
  const [editCenterDialogOpen, setEditCenterDialogOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [editStaffDialogOpen, setEditStaffDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editServiceDialogOpen, setEditServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [jobTypeDialogOpen, setJobTypeDialogOpen] = useState(false);
  const [editJobTypeDialogOpen, setEditJobTypeDialogOpen] = useState(false);
  const [editingJobType, setEditingJobType] = useState<JobType | null>(null);
  const [editCcDialogOpen, setEditCcDialogOpen] = useState(false);
  const [editThresholdDialogOpen, setEditThresholdDialogOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [bulkServiceDialogOpen, setBulkServiceDialogOpen] = useState(false);
  const [bulkServiceNames, setBulkServiceNames] = useState("");
  const [selectedCenters, setSelectedCenters] = useState<string[]>([]);
  const [centerSectionsOpen, setCenterSectionsOpen] = useState({
    vip: true,
    normal: true,
    eid: true
  });
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [statusPopoverId, setStatusPopoverId] = useState<string | null>(null);
  const [statusChangeData, setStatusChangeData] = useState<{
    status: string;
    leaveEndDate: string;
    replacementId: string;
  }>({ status: "", leaveEndDate: "", replacementId: "" });
  const { toast } = useToast();

  const { data: companies, isLoading: companiesLoading } = useQuery<CompanyWithRelations[]>({
    queryKey: ["/api/companies"],
  });

  const { data: centers, isLoading: centersLoading } = useQuery<Center[]>({
    queryKey: ["/api/centers"],
  });

  const { data: staffList, isLoading: staffLoading } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const { data: serviceTypes, isLoading: servicesLoading } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const { data: jobTypes, isLoading: jobTypesLoading } = useQuery<JobType[]>({
    queryKey: ["/api/job-types"],
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const filteredCompanies = companies?.filter((company) =>
    !companySearch || company.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  const centerForm = useForm({
    resolver: zodResolver(centerSchema),
    defaultValues: {
      name: "",
      type: "Both" as const,
      authority: null as "DHA" | "EHS" | null,
      tier: null as "Normal" | "VIP" | null,
      address: "",
      area: "",
      googleMapsUrl: "",
      timingText: "",
      notes: "",
    },
  });

  const editCenterForm = useForm<z.infer<typeof centerSchema>>({
    resolver: zodResolver(centerSchema),
    defaultValues: {
      name: "",
      type: "Both",
      authority: null,
      tier: null,
      address: "",
      area: "",
      googleMapsUrl: "",
      timingText: "",
      notes: "",
    },
  });

  const staffForm = useForm<z.infer<typeof staffSchema>>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: "",
      roleTitle: "",
      staffType: "Permanent",
      phone: "",
      email: "",
      status: "Active",
      replacementId: null,
    },
  });

  const editStaffForm = useForm<z.infer<typeof staffSchema>>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: "",
      roleTitle: "",
      staffType: "Permanent",
      phone: "",
      email: "",
      status: "Active",
      replacementId: null,
    },
  });

  const serviceForm = useForm({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: {
      name: "",
      requiresMedicalTyping: false,
      requiresMedicalScheduling: false,
      requiresIdTyping2Years: false,
      requiresIdTyping1Year: false,
      requiresIdTyping10Years: false,
      requiresIdBiometrics: false,
    },
  });

  const editServiceForm = useForm({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: {
      name: "",
      requiresMedicalTyping: false,
      requiresMedicalScheduling: false,
      requiresIdTyping2Years: false,
      requiresIdTyping1Year: false,
      requiresIdTyping10Years: false,
      requiresIdBiometrics: false,
    },
  });

  const jobTypeForm = useForm({
    resolver: zodResolver(jobTypeSchema),
    defaultValues: {
      name: "",
      category: "Medical" as const,
      cost: 0,
    },
  });

  const editJobTypeForm = useForm<z.infer<typeof jobTypeSchema>>({
    resolver: zodResolver(jobTypeSchema),
    defaultValues: {
      name: "",
      category: "Medical",
      cost: 0,
    },
  });

  const ccForm = useForm({
    resolver: zodResolver(ccRecipientsSchema),
    defaultValues: {
      alwaysCc: "",
    },
  });

  const thresholdForm = useForm({
    resolver: zodResolver(thresholdSchema),
    defaultValues: {
      lowBalanceThreshold: 1000,
    },
  });

  const createCenterMutation = useMutation({
    mutationFn: async (data: z.infer<typeof centerSchema>) => {
      return apiRequest("POST", "/api/centers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centers"] });
      toast({ title: "Center added successfully" });
      setCenterDialogOpen(false);
      centerForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateCenterMutation = useMutation({
    mutationFn: async (data: z.infer<typeof centerSchema> & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PUT", `/api/centers/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centers"] });
      toast({ title: "Center updated successfully" });
      setEditCenterDialogOpen(false);
      setEditingCenter(null);
      editCenterForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createStaffMutation = useMutation({
    mutationFn: async (data: z.infer<typeof staffSchema>) => {
      return apiRequest("POST", "/api/staff", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff added successfully" });
      setStaffDialogOpen(false);
      staffForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateStaffMutation = useMutation({
    mutationFn: async (data: z.infer<typeof staffSchema> & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PUT", `/api/staff/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff updated successfully" });
      setEditStaffDialogOpen(false);
      setEditingStaff(null);
      editStaffForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateStaffStatusMutation = useMutation({
    mutationFn: async (data: { 
      id: string; 
      status: string; 
      leaveEndDate?: string; 
      replacementId?: string;
    }) => {
      const { id, ...rest } = data;
      // Update the staff member's status
      await apiRequest("PUT", `/api/staff/${id}`, rest);
      
      // If a replacement is selected and they are temporary, activate them
      if (rest.status === "OnLeave" && rest.replacementId) {
        const replacement = staffList?.find((s: Staff) => s.id === rest.replacementId);
        if (replacement && replacement.staffType === "Temporary") {
          await apiRequest("PUT", `/api/staff/${rest.replacementId}`, { status: "TempActive" });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff status updated successfully" });
      setStatusPopoverId(null);
      setStatusChangeData({ status: "", leaveEndDate: "", replacementId: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof serviceTypeSchema>) => {
      return apiRequest("POST", "/api/service-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
      toast({ title: "Service type added successfully" });
      setServiceDialogOpen(false);
      serviceForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof serviceTypeSchema> & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PUT", `/api/service-types/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
      toast({ title: "Service type updated successfully" });
      setEditServiceDialogOpen(false);
      setEditingService(null);
      editServiceForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createJobTypeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof jobTypeSchema>) => {
      return apiRequest("POST", "/api/job-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-types"] });
      toast({ title: "Job type added successfully" });
      setJobTypeDialogOpen(false);
      jobTypeForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateJobTypeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof jobTypeSchema> & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PUT", `/api/job-types/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-types"] });
      toast({ title: "Job type updated successfully" });
      setEditJobTypeDialogOpen(false);
      setEditingJobType(null);
      editJobTypeForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<AppSettings>) => {
      return apiRequest("PUT", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings updated successfully" });
      setEditCcDialogOpen(false);
      setEditThresholdDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteCenterMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/centers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centers"] });
      toast({ title: "Center deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/staff/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff member deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/service-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
      toast({ title: "Service type deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteJobTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/job-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-types"] });
      toast({ title: "Job type deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkCreateServicesMutation = useMutation({
    mutationFn: async (names: string[]) => {
      return apiRequest("POST", "/api/service-types/bulk", { names });
    },
    onSuccess: (_, names) => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
      toast({ title: `${names.length} service types added successfully` });
      setBulkServiceDialogOpen(false);
      setBulkServiceNames("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteCentersMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("DELETE", "/api/centers/bulk", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centers"] });
      toast({ title: `${selectedCenters.length} centers deleted successfully` });
      setSelectedCenters([]);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteStaffMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("DELETE", "/api/staff/bulk", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: `${selectedStaff.length} staff members deleted successfully` });
      setSelectedStaff([]);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteServicesMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("DELETE", "/api/service-types/bulk", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
      toast({ title: `${selectedServices.length} service types deleted successfully` });
      setSelectedServices([]);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteJobTypesMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("DELETE", "/api/job-types/bulk", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-types"] });
      toast({ title: `${selectedJobTypes.length} job types deleted successfully` });
      setSelectedJobTypes([]);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEditCenter = (center: Center) => {
    setEditingCenter(center);
    editCenterForm.reset({
      name: center.name,
      type: center.type as "Medical" | "EID" | "Both",
      authority: center.authority as "DHA" | "EHS" | null,
      tier: center.tier as "Normal" | "VIP" | null,
      address: center.address || "",
      area: center.area || "",
      googleMapsUrl: center.googleMapsUrl || "",
      timingText: center.timingText || "",
      notes: center.notes || "",
    });
    setEditCenterDialogOpen(true);
  };

  const handleEditStaff = (member: Staff) => {
    setEditingStaff(member);
    editStaffForm.reset({
      name: member.name,
      roleTitle: member.roleTitle,
      staffType: member.staffType || "Permanent",
      phone: member.phone || "",
      email: member.email || "",
      status: member.status || "Active",
      replacementId: member.replacementId ?? null,
    });
    setEditStaffDialogOpen(true);
  };

  const handleEditService = (service: ServiceType) => {
    setEditingService(service);
    editServiceForm.reset({
      name: service.name,
      requiresMedicalTyping: service.requiresMedicalTyping,
      requiresMedicalScheduling: service.requiresMedicalScheduling,
      requiresIdTyping2Years: service.requiresIdTyping2Years,
      requiresIdTyping1Year: service.requiresIdTyping1Year,
      requiresIdTyping10Years: service.requiresIdTyping10Years,
      requiresIdBiometrics: service.requiresIdBiometrics,
    });
    setEditServiceDialogOpen(true);
  };

  const handleEditJobType = (jobType: JobType) => {
    setEditingJobType(jobType);
    editJobTypeForm.reset({
      name: jobType.name,
      category: jobType.category as "Medical" | "EID",
      cost: jobType.cost,
    });
    setEditJobTypeDialogOpen(true);
  };

  const handleEditCc = () => {
    ccForm.reset({
      alwaysCc: settings?.alwaysCc?.join(", ") || "",
    });
    setEditCcDialogOpen(true);
  };

  const handleEditThreshold = () => {
    thresholdForm.reset({
      lowBalanceThreshold: settings?.lowBalanceThreshold || 1000,
    });
    setEditThresholdDialogOpen(true);
  };

  const handleSubmitCc = (data: z.infer<typeof ccRecipientsSchema>) => {
    const emails = data.alwaysCc
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email.length > 0);
    updateSettingsMutation.mutate({ alwaysCc: emails });
  };

  const handleSubmitThreshold = (data: z.infer<typeof thresholdSchema>) => {
    updateSettingsMutation.mutate({ lowBalanceThreshold: data.lowBalanceThreshold });
  };

  return (
    <AppLayout>
      {/* Header Section */}
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Admin Console
        </h1>
      </div>

      <div className="px-4 lg:px-6 pb-6">
        <div className="premium-card overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start border-b border-border/50 rounded-none bg-transparent p-0 h-auto overflow-x-auto">
              <TabsTrigger 
                value="companies" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm"
                data-testid="tab-companies"
              >
                <Building2 className="h-4 w-4 mr-2" />
                Companies
              </TabsTrigger>
              <TabsTrigger 
                value="centers" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm"
                data-testid="tab-centers"
              >
                <MapPin className="h-4 w-4 mr-2" />
                Centers
              </TabsTrigger>
              <TabsTrigger 
                value="staff" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm"
                data-testid="tab-staff"
              >
                <Users className="h-4 w-4 mr-2" />
                Staff
              </TabsTrigger>
              <TabsTrigger 
                value="services" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm"
                data-testid="tab-services"
              >
                <FileText className="h-4 w-4 mr-2" />
                Services
              </TabsTrigger>
              <TabsTrigger 
                value="jobtypes" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm"
                data-testid="tab-jobtypes"
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Vendor Jobs
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm"
                data-testid="tab-settings"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </TabsTrigger>
            </TabsList>

            {/* Companies Tab */}
            <TabsContent value="companies" className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search companies..."
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    className="pl-9 h-9"
                    data-testid="input-search-companies"
                  />
                </div>
                <Link href="/companies/new">
                  <Button size="sm" className="gap-1.5 rounded-lg" data-testid="button-add-company">
                    <Plus className="h-4 w-4" />
                    Add Company
                  </Button>
                </Link>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {companiesLoading ? (
                  <>
                    <Skeleton className="h-32 rounded-lg" />
                    <Skeleton className="h-32 rounded-lg" />
                    <Skeleton className="h-32 rounded-lg" />
                  </>
                ) : filteredCompanies && filteredCompanies.length > 0 ? (
                  filteredCompanies.map((company, index) => (
                    <Link key={company.id} href={`/companies/${company.id}`}>
                      <div 
                        className="p-4 rounded-lg bg-muted/30 border border-border/30 opacity-0 animate-fade-in cursor-pointer hover:bg-muted/50 transition-colors"
                        style={{ animationDelay: `${index * 0.03}s` }}
                        data-testid={`company-card-${company.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="icon-container icon-container-sm shrink-0">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground text-sm truncate">{company.name}</h3>
                            {company.emails && company.emails.filter(e => e.active).length > 0 && (
                              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {company.emails.filter(e => e.active).length} email(s)
                              </div>
                            )}
                            {(company.rmStaff || company.assistStaff) && (
                              <div className="flex items-center gap-1.5 mt-2">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <div className="flex gap-1 flex-wrap">
                                  {company.rmStaff && (
                                    <Badge variant="secondary" className="text-xs rounded-md px-1.5 py-0">
                                      {company.rmStaff.name}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="col-span-full">
                    <EmptyState
                      icon={<Building2 className="h-5 w-5" />}
                      title="No companies found"
                      description={companySearch ? "Try adjusting your search" : "Add your first company to get started."}
                      action={
                        !companySearch && (
                          <Link href="/companies/new">
                            <Button size="sm" className="gap-1.5 rounded-lg">
                              <Plus className="h-4 w-4" />
                              Add Company
                            </Button>
                          </Link>
                        )
                      }
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Centers Tab */}
            <TabsContent value="centers" className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-foreground text-sm">Medical & EID Centers</h3>
                  {selectedCenters.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="gap-1.5 rounded-xl" data-testid="button-bulk-delete-centers">
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete ({selectedCenters.length})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Selected Centers</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {selectedCenters.length} centers? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            className="rounded-xl"
                            onClick={() => bulkDeleteCentersMutation.mutate(selectedCenters)}
                          >
                            Delete All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <Dialog open={centerDialogOpen} onOpenChange={setCenterDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2 rounded-xl" data-testid="button-add-center">
                      <Plus className="h-4 w-4" />
                      Add Center
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New Center</DialogTitle>
                    </DialogHeader>
                    <Form {...centerForm}>
                      <form onSubmit={centerForm.handleSubmit((data) => createCenterMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={centerForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Center Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., AMER Center Dubai" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) centerForm.setValue("name", toProperCase(e.target.value)); }} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={centerForm.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-11 rounded-xl">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="Medical">Medical</SelectItem>
                                  <SelectItem value="EID">Emirates ID</SelectItem>
                                  <SelectItem value="Both">Both</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={centerForm.control}
                          name="area"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Area</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., Downtown Dubai" className="h-11 rounded-xl" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={centerForm.control}
                          name="googleMapsUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Google Maps URL</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="https://maps.google.com/..." className="h-11 rounded-xl" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end gap-3 pt-4">
                          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setCenterDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" className="rounded-xl" disabled={createCenterMutation.isPending}>
                            {createCenterMutation.isPending ? "Adding..." : "Add Center"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Edit Center Dialog */}
              <Dialog open={editCenterDialogOpen} onOpenChange={setEditCenterDialogOpen}>
                <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Center</DialogTitle>
                  </DialogHeader>
                  <Form {...editCenterForm}>
                    <form onSubmit={editCenterForm.handleSubmit((data) => editingCenter && updateCenterMutation.mutate({ ...data, id: editingCenter.id }))} className="space-y-4">
                      <FormField
                        control={editCenterForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Center Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., AMER Center Dubai" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) editCenterForm.setValue("name", toProperCase(e.target.value)); }} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCenterForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11 rounded-xl">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="Medical">Medical</SelectItem>
                                <SelectItem value="EID">Emirates ID</SelectItem>
                                <SelectItem value="Both">Both</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCenterForm.control}
                        name="authority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Authority</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger className="h-11 rounded-xl">
                                  <SelectValue placeholder="Select authority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="DHA">DHA</SelectItem>
                                <SelectItem value="EHS">EHS</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCenterForm.control}
                        name="tier"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tier</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger className="h-11 rounded-xl">
                                  <SelectValue placeholder="Select tier" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="Normal">Normal</SelectItem>
                                <SelectItem value="VIP">VIP</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCenterForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Full address" className="h-11 rounded-xl" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCenterForm.control}
                        name="area"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Area</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Downtown Dubai" className="h-11 rounded-xl" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCenterForm.control}
                        name="googleMapsUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Google Maps URL</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="https://maps.google.com/..." className="h-11 rounded-xl" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCenterForm.control}
                        name="timingText"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Timing Text</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Sun-Thu 8AM-4PM" className="h-11 rounded-xl" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCenterForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Additional notes..." className="rounded-xl" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditCenterDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" className="rounded-xl" disabled={updateCenterMutation.isPending}>
                          {updateCenterMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              {centersLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-20 rounded-xl" />
                </div>
              ) : centers && centers.length > 0 ? (
                <div className="space-y-4">
                  {/* Medical VIP Centers */}
                  {(() => {
                    const vipCenters = centers.filter((c: Center) => c.type === "Medical" && c.tier === "VIP");
                    if (vipCenters.length === 0) return null;
                    return (
                      <Collapsible 
                        open={centerSectionsOpen.vip} 
                        onOpenChange={(open) => setCenterSectionsOpen(prev => ({ ...prev, vip: open }))}
                      >
                        <CollapsibleTrigger 
                          className="flex items-center justify-between gap-2 w-full p-3 rounded-lg bg-amber-500/5 border border-amber-400/30"
                          data-testid="button-toggle-section-vip"
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                              <Star className="h-3 w-3 text-white fill-white" />
                            </div>
                            <span className="font-medium text-sm">Medical Centers (VIP)</span>
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300 text-xs" data-testid="text-center-count-vip">
                              {vipCenters.length}
                            </Badge>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${centerSectionsOpen.vip ? "rotate-180" : ""}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2 space-y-2">
                          {vipCenters.map((center: Center, index: number) => (
                            <div
                              key={center.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-amber-500/5 to-amber-400/10 border-2 border-amber-400/40 opacity-0 animate-fade-in"
                              style={{ animationDelay: `${index * 0.03}s` }}
                            >
                              <div className="flex items-center gap-2.5">
                                <Checkbox
                                  checked={selectedCenters.includes(center.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedCenters([...selectedCenters, center.id]);
                                    } else {
                                      setSelectedCenters(selectedCenters.filter(id => id !== center.id));
                                    }
                                  }}
                                  data-testid={`checkbox-center-${center.id}`}
                                />
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center ring-2 ring-amber-300/50">
                                  <MapPin className="h-3.5 w-3.5 text-white" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-foreground text-sm">{center.name}</p>
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300 text-[10px] px-1.5 py-0" data-testid={`badge-medical-vip-${center.id}`}>
                                      Medical VIP
                                    </Badge>
                                  </div>
                                  {center.area && (
                                    <span className="text-xs text-muted-foreground">{center.area}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="rounded-lg"
                                  onClick={() => handleEditCenter(center)}
                                  data-testid={`button-edit-center-${center.id}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="rounded-lg text-destructive"
                                      data-testid={`button-delete-center-${center.id}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="rounded-2xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Center</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{center.name}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                      <AlertDialogAction 
                                        className="rounded-xl"
                                        onClick={() => deleteCenterMutation.mutate(center.id)}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })()}

                  {/* Medical Normal Centers */}
                  {(() => {
                    const normalCenters = centers.filter((c: Center) => c.type === "Medical" && c.tier !== "VIP");
                    if (normalCenters.length === 0) return null;
                    return (
                      <Collapsible 
                        open={centerSectionsOpen.normal} 
                        onOpenChange={(open) => setCenterSectionsOpen(prev => ({ ...prev, normal: open }))}
                      >
                        <CollapsibleTrigger 
                          className="flex items-center justify-between gap-2 w-full p-3 rounded-lg bg-muted/30 border border-border/30"
                          data-testid="button-toggle-section-normal"
                        >
                          <div className="flex items-center gap-2">
                            <div className="icon-container icon-container-sm">
                              <MapPin className="h-3.5 w-3.5" />
                            </div>
                            <span className="font-medium text-sm">Medical Centers (Normal)</span>
                            <Badge variant="outline" className="text-xs" data-testid="text-center-count-normal">
                              {normalCenters.length}
                            </Badge>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${centerSectionsOpen.normal ? "rotate-180" : ""}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2 space-y-2">
                          {normalCenters.map((center: Center, index: number) => (
                            <div
                              key={center.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30 opacity-0 animate-fade-in"
                              style={{ animationDelay: `${index * 0.03}s` }}
                            >
                              <div className="flex items-center gap-2.5">
                                <Checkbox
                                  checked={selectedCenters.includes(center.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedCenters([...selectedCenters, center.id]);
                                    } else {
                                      setSelectedCenters(selectedCenters.filter(id => id !== center.id));
                                    }
                                  }}
                                  data-testid={`checkbox-center-${center.id}`}
                                />
                                <div className="icon-container icon-container-sm">
                                  <MapPin className="h-3.5 w-3.5" />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground text-sm">{center.name}</p>
                                  {center.area && (
                                    <span className="text-xs text-muted-foreground">{center.area}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="rounded-lg"
                                  onClick={() => handleEditCenter(center)}
                                  data-testid={`button-edit-center-${center.id}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="rounded-lg text-destructive"
                                      data-testid={`button-delete-center-${center.id}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="rounded-2xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Center</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{center.name}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                      <AlertDialogAction 
                                        className="rounded-xl"
                                        onClick={() => deleteCenterMutation.mutate(center.id)}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })()}

                  {/* Emirates ID Biometric Centers */}
                  {(() => {
                    const eidCenters = centers.filter((c: Center) => c.type === "EID" || c.type === "Both");
                    if (eidCenters.length === 0) return null;
                    return (
                      <Collapsible 
                        open={centerSectionsOpen.eid} 
                        onOpenChange={(open) => setCenterSectionsOpen(prev => ({ ...prev, eid: open }))}
                      >
                        <CollapsibleTrigger 
                          className="flex items-center justify-between gap-2 w-full p-3 rounded-lg bg-blue-500/5 border border-blue-400/30"
                          data-testid="button-toggle-section-eid"
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                              <User className="h-3 w-3 text-white" />
                            </div>
                            <span className="font-medium text-sm">Emirates ID Biometric Centers</span>
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-300 text-xs" data-testid="text-center-count-eid">
                              {eidCenters.length}
                            </Badge>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${centerSectionsOpen.eid ? "rotate-180" : ""}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2 space-y-2">
                          {eidCenters.map((center: Center, index: number) => (
                            <div
                              key={center.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-400/20 opacity-0 animate-fade-in"
                              style={{ animationDelay: `${index * 0.03}s` }}
                            >
                              <div className="flex items-center gap-2.5">
                                <Checkbox
                                  checked={selectedCenters.includes(center.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedCenters([...selectedCenters, center.id]);
                                    } else {
                                      setSelectedCenters(selectedCenters.filter(id => id !== center.id));
                                    }
                                  }}
                                  data-testid={`checkbox-center-${center.id}`}
                                />
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                                  <User className="h-3.5 w-3.5 text-white" />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground text-sm">{center.name}</p>
                                  {center.area && (
                                    <span className="text-xs text-muted-foreground">{center.area}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="rounded-lg"
                                  onClick={() => handleEditCenter(center)}
                                  data-testid={`button-edit-center-${center.id}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="rounded-lg text-destructive"
                                      data-testid={`button-delete-center-${center.id}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="rounded-2xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Center</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{center.name}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                      <AlertDialogAction 
                                        className="rounded-xl"
                                        onClick={() => deleteCenterMutation.mutate(center.id)}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })()}
                </div>
              ) : (
                <EmptyState
                  icon={<MapPin className="h-6 w-6" />}
                  title="No centers added"
                  description="Add medical and EID centers to get started."
                />
              )}
            </TabsContent>

            {/* Staff Tab */}
            <TabsContent value="staff" className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-foreground">Staff Members</h3>
                  {selectedStaff.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="gap-1.5 rounded-xl" data-testid="button-bulk-delete-staff">
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete ({selectedStaff.length})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Selected Staff</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {selectedStaff.length} staff members? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            className="rounded-xl"
                            onClick={() => bulkDeleteStaffMutation.mutate(selectedStaff)}
                          >
                            Delete All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <Dialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2 rounded-xl" data-testid="button-add-staff">
                      <Plus className="h-4 w-4" />
                      Add Staff
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Add Staff Member</DialogTitle>
                    </DialogHeader>
                    <Form {...staffForm}>
                      <form onSubmit={staffForm.handleSubmit((data) => createStaffMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={staffForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., John Smith" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) staffForm.setValue("name", toProperCase(e.target.value)); }} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={staffForm.control}
                          name="roleTitle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Role Title</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., PRO, Ops Manager" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) staffForm.setValue("roleTitle", toProperCase(e.target.value)); }} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={staffForm.control}
                          name="staffType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Staff Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-11 rounded-xl">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="Permanent">Permanent Staff</SelectItem>
                                  <SelectItem value="Temporary">Temporary Staff</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={staffForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone</FormLabel>
                              <FormControl>
                                <MaskedInput
                                  mask="phone"
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder="+971 50 000 0000"
                                  className="h-11 rounded-xl"
                                  aria-label="Staff phone number"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={staffForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="name@company.com" className="h-11 rounded-xl" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={staffForm.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-11 rounded-xl">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="Active">Active</SelectItem>
                                  <SelectItem value="OnLeave">On Leave</SelectItem>
                                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                                  <SelectItem value="TempActive">Temporarily Active</SelectItem>
                                  <SelectItem value="TempInactive">Temporarily Inactive</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {staffForm.watch("status") === "OnLeave" && (
                          <FormField
                            control={staffForm.control}
                            name="replacementId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Replacement Staff</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ""}>
                                  <FormControl>
                                    <SelectTrigger className="h-11 rounded-xl">
                                      <SelectValue placeholder="Select replacement..." />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="rounded-xl">
                                    {staffList?.filter((s: Staff) => s.status === "Active").map((s: Staff) => (
                                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        <div className="flex justify-end gap-3 pt-4">
                          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setStaffDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" className="rounded-xl" disabled={createStaffMutation.isPending}>
                            {createStaffMutation.isPending ? "Adding..." : "Add Staff"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Edit Staff Dialog - Modern Compact Design */}
              <Dialog open={editStaffDialogOpen} onOpenChange={setEditStaffDialogOpen}>
                <DialogContent className="rounded-2xl max-w-md p-0 gap-0 overflow-hidden">
                  <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-4 border-b">
                    <DialogHeader>
                      <DialogTitle className="text-base font-semibold">Edit Staff Member</DialogTitle>
                    </DialogHeader>
                  </div>
                  <Form {...editStaffForm}>
                    <form onSubmit={editStaffForm.handleSubmit((data) => editingStaff && updateStaffMutation.mutate({ ...data, id: editingStaff.id }))} className="p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={editStaffForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel className="text-xs text-muted-foreground">Full Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., John Smith" className="h-9 rounded-lg" onBlur={(e) => { field.onBlur(); if (e.target.value) editStaffForm.setValue("name", toProperCase(e.target.value)); }} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editStaffForm.control}
                          name="roleTitle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Role Title</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., P.R.O." className="h-9 rounded-lg" onBlur={(e) => { field.onBlur(); if (e.target.value) editStaffForm.setValue("roleTitle", toProperCase(e.target.value)); }} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editStaffForm.control}
                          name="staffType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Staff Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-9 rounded-lg">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-lg">
                                  <SelectItem value="Permanent">Permanent</SelectItem>
                                  <SelectItem value="Temporary">Temporary</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editStaffForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Phone</FormLabel>
                              <FormControl>
                                <MaskedInput
                                  mask="phone"
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder="050 000 0000"
                                  className="h-9 rounded-lg"
                                  aria-label="Staff phone number"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editStaffForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Email</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="name@company.com" className="h-9 rounded-lg" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                        <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={() => setEditStaffDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" size="sm" className="rounded-lg" disabled={updateStaffMutation.isPending}>
                          {updateStaffMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <div className="space-y-3">
                {staffLoading ? (
                  <>
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                  </>
                ) : staffList && staffList.length > 0 ? (
                  staffList.map((member, index) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/30 opacity-0 animate-fade-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedStaff.includes(member.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedStaff([...selectedStaff, member.id]);
                            } else {
                              setSelectedStaff(selectedStaff.filter(id => id !== member.id));
                            }
                          }}
                          data-testid={`checkbox-staff-${member.id}`}
                        />
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-primary/10">
                          <span className="text-sm font-medium text-primary">
                            {member.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{member.name}</p>
                            {member.staffType === "Temporary" && (
                              <Badge 
                                variant="outline" 
                                className="text-xs rounded-full bg-red-500/10 text-red-600 border-red-200"
                              >
                                Temp
                              </Badge>
                            )}
                            <Popover 
                              open={statusPopoverId === member.id} 
                              onOpenChange={(open) => {
                                if (open) {
                                  setStatusPopoverId(member.id);
                                  setStatusChangeData({ 
                                    status: member.status, 
                                    leaveEndDate: (member as any).leaveEndDate || "", 
                                    replacementId: member.replacementId || "" 
                                  });
                                } else {
                                  setStatusPopoverId(null);
                                }
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  className={`h-auto py-0.5 px-2 text-xs rounded-full gap-1 ${
                                    member.status === "Active" ? "bg-green-500/10 text-green-700 border-green-200" :
                                    member.status === "OnLeave" ? "bg-amber-500/10 text-amber-700 border-amber-200" :
                                    member.status === "Cancelled" ? "bg-red-500/10 text-red-700 border-red-200" :
                                    member.status === "TempActive" ? "bg-cyan-500/10 text-cyan-700 border-cyan-200" :
                                    "bg-gray-500/10 text-gray-700 border-gray-200"
                                  }`}
                                  data-testid={`button-status-${member.id}`}
                                >
                                  {member.status === "OnLeave" ? "On Leave" :
                                   member.status === "TempActive" ? "Temp Active" :
                                   member.status === "TempInactive" ? "Inactive" :
                                   member.status}
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72 rounded-xl p-4" align="start">
                                <div className="space-y-4">
                                  <div className="font-medium text-sm">Change Status</div>
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Status</Label>
                                    <Select
                                      value={statusChangeData.status}
                                      onValueChange={(value) => setStatusChangeData(prev => ({ ...prev, status: value }))}
                                    >
                                      <SelectTrigger className="h-9 rounded-lg">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="rounded-lg">
                                        {member.staffType === "Permanent" ? (
                                          <>
                                            <SelectItem value="Active">Active</SelectItem>
                                            <SelectItem value="OnLeave">On Leave</SelectItem>
                                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                                          </>
                                        ) : (
                                          <>
                                            <SelectItem value="TempActive">Temp Active</SelectItem>
                                            <SelectItem value="TempInactive">Inactive</SelectItem>
                                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                                          </>
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  {statusChangeData.status === "OnLeave" && (
                                    <>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Leave Ends On</Label>
                                        <Input
                                          type="date"
                                          value={statusChangeData.leaveEndDate}
                                          onChange={(e) => setStatusChangeData(prev => ({ ...prev, leaveEndDate: e.target.value }))}
                                          className="h-9 rounded-lg"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Replacement</Label>
                                        <Select
                                          value={statusChangeData.replacementId}
                                          onValueChange={(value) => setStatusChangeData(prev => ({ ...prev, replacementId: value }))}
                                        >
                                          <SelectTrigger className="h-9 rounded-lg">
                                            <SelectValue placeholder="Select replacement" />
                                          </SelectTrigger>
                                          <SelectContent className="rounded-lg">
                                            {staffList?.filter((s: Staff) => s.id !== member.id).map((s: Staff) => (
                                              <SelectItem key={s.id} value={s.id}>
                                                {s.name} {s.staffType === "Temporary" ? "(Temp)" : ""}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </>
                                  )}
                                  
                                  <div className="flex gap-2 pt-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 rounded-lg"
                                      onClick={() => setStatusPopoverId(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="flex-1 rounded-lg"
                                      disabled={updateStaffStatusMutation.isPending}
                                      onClick={() => {
                                        updateStaffStatusMutation.mutate({
                                          id: member.id,
                                          status: statusChangeData.status,
                                          leaveEndDate: statusChangeData.leaveEndDate || undefined,
                                          replacementId: statusChangeData.replacementId || undefined,
                                        });
                                      }}
                                    >
                                      {updateStaffStatusMutation.isPending ? "Saving..." : "Save"}
                                    </Button>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span>{member.roleTitle}</span>
                            {member.phone && <span>{member.phone}</span>}
                            {member.email && <span>{member.email}</span>}
                          </div>
                          {member.status === "OnLeave" && member.replacementId && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Covered by: {staffList?.find((s: Staff) => s.id === member.replacementId)?.name || "Unknown"}
                              {(member as any).leaveEndDate && ` (until ${new Date((member as any).leaveEndDate).toLocaleDateString()})`}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-xl"
                          onClick={() => handleEditStaff(member)}
                          data-testid={`button-edit-staff-${member.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="rounded-xl text-destructive"
                              data-testid={`button-delete-staff-${member.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Staff Member</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{member.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                className="rounded-xl"
                                onClick={() => deleteStaffMutation.mutate(member.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={<Users className="h-6 w-6" />}
                    title="No staff members"
                    description="Add your team members to assign them to work orders."
                  />
                )}
              </div>
            </TabsContent>

            {/* Service Types Tab */}
            <TabsContent value="services" className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-foreground">Service Types</h3>
                  {selectedServices.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="gap-1.5 rounded-xl" data-testid="button-bulk-delete-services">
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete ({selectedServices.length})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Selected Services</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {selectedServices.length} service types? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            className="rounded-xl"
                            onClick={() => bulkDeleteServicesMutation.mutate(selectedServices)}
                          >
                            Delete All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Dialog open={bulkServiceDialogOpen} onOpenChange={setBulkServiceDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-2 rounded-xl" data-testid="button-bulk-add-service">
                        <Plus className="h-4 w-4" />
                        Bulk Import
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl">
                      <DialogHeader>
                        <DialogTitle>Bulk Import Services</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Enter one service name per line
                        </p>
                        <Textarea
                          value={bulkServiceNames}
                          onChange={(e) => setBulkServiceNames(e.target.value)}
                          placeholder={"New Visa\nVisa Renewal\nLabour Card\n..."}
                          className="min-h-[200px] rounded-xl"
                          data-testid="textarea-bulk-services"
                        />
                        <div className="flex justify-end gap-3 pt-4">
                          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setBulkServiceDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            className="rounded-xl" 
                            disabled={bulkCreateServicesMutation.isPending || !bulkServiceNames.trim()}
                            onClick={() => {
                              const names = bulkServiceNames.split('\n').map(n => n.trim()).filter(n => n.length > 0);
                              if (names.length > 0) {
                                bulkCreateServicesMutation.mutate(names);
                              }
                            }}
                            data-testid="button-submit-bulk-services"
                          >
                            {bulkCreateServicesMutation.isPending ? "Importing..." : `Import ${bulkServiceNames.split('\n').filter(n => n.trim()).length} Services`}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2 rounded-xl" data-testid="button-add-service">
                        <Plus className="h-4 w-4" />
                        Add Service
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="rounded-2xl max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add Service Type</DialogTitle>
                    </DialogHeader>
                    <Form {...serviceForm}>
                      <form onSubmit={serviceForm.handleSubmit((data) => createServiceMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={serviceForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Service Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., New Employment Visa - Inside" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) serviceForm.setValue("name", toProperCase(e.target.value)); }} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="space-y-3">
                          <FormLabel className="text-sm font-medium">Requirements</FormLabel>
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={serviceForm.control}
                              name="requiresMedicalTyping"
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">Medical Typing</FormLabel>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={serviceForm.control}
                              name="requiresMedicalScheduling"
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">Medical Scheduling</FormLabel>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={serviceForm.control}
                              name="requiresIdTyping2Years"
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">ID Typing (2 Years)</FormLabel>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={serviceForm.control}
                              name="requiresIdTyping1Year"
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">ID Typing (1 Year)</FormLabel>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={serviceForm.control}
                              name="requiresIdTyping10Years"
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">ID Typing (10 Years)</FormLabel>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={serviceForm.control}
                              name="requiresIdBiometrics"
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">ID Biometrics</FormLabel>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setServiceDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" className="rounded-xl" disabled={createServiceMutation.isPending}>
                            {createServiceMutation.isPending ? "Adding..." : "Add Service"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
                </div>
              </div>

              {/* Edit Service Dialog */}
              <Dialog open={editServiceDialogOpen} onOpenChange={setEditServiceDialogOpen}>
                <DialogContent className="rounded-2xl max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Edit Service Type</DialogTitle>
                  </DialogHeader>
                  <Form {...editServiceForm}>
                    <form onSubmit={editServiceForm.handleSubmit((data) => editingService && updateServiceMutation.mutate({ ...data, id: editingService.id }))} className="space-y-4">
                      <FormField
                        control={editServiceForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Service Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., New Employment Visa - Inside" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) editServiceForm.setValue("name", toProperCase(e.target.value)); }} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-3">
                        <FormLabel className="text-sm font-medium">Requirements</FormLabel>
                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={editServiceForm.control}
                            name="requiresMedicalTyping"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">Medical Typing</FormLabel>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editServiceForm.control}
                            name="requiresMedicalScheduling"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">Medical Scheduling</FormLabel>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editServiceForm.control}
                            name="requiresIdTyping2Years"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">ID Typing (2 Years)</FormLabel>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editServiceForm.control}
                            name="requiresIdTyping1Year"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">ID Typing (1 Year)</FormLabel>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editServiceForm.control}
                            name="requiresIdTyping10Years"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">ID Typing (10 Years)</FormLabel>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editServiceForm.control}
                            name="requiresIdBiometrics"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">ID Biometrics</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditServiceDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" className="rounded-xl" disabled={updateServiceMutation.isPending}>
                          {updateServiceMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <div className="space-y-3">
                {servicesLoading ? (
                  <Skeleton className="h-16 rounded-xl" />
                ) : serviceTypes && serviceTypes.length > 0 ? (
                  serviceTypes.map((service, index) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/30 opacity-0 animate-fade-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedServices.includes(service.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedServices([...selectedServices, service.id]);
                            } else {
                              setSelectedServices(selectedServices.filter(id => id !== service.id));
                            }
                          }}
                          data-testid={`checkbox-service-${service.id}`}
                        />
                        <div className="icon-container">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <p className="font-medium text-foreground">{service.name}</p>
                          <div className="flex flex-wrap gap-1">
                            {service.requiresMedicalTyping && (
                              <Badge variant="outline" className="text-xs rounded-full px-2 py-0">Med Typing</Badge>
                            )}
                            {service.requiresMedicalScheduling && (
                              <Badge variant="outline" className="text-xs rounded-full px-2 py-0">Med Sched</Badge>
                            )}
                            {service.requiresIdTyping2Years && (
                              <Badge variant="outline" className="text-xs rounded-full px-2 py-0">ID 2Y</Badge>
                            )}
                            {service.requiresIdTyping1Year && (
                              <Badge variant="outline" className="text-xs rounded-full px-2 py-0">ID 1Y</Badge>
                            )}
                            {service.requiresIdTyping10Years && (
                              <Badge variant="outline" className="text-xs rounded-full px-2 py-0">ID 10Y</Badge>
                            )}
                            {service.requiresIdBiometrics && (
                              <Badge variant="outline" className="text-xs rounded-full px-2 py-0">Biometrics</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-xl"
                          onClick={() => handleEditService(service)}
                          data-testid={`button-edit-service-${service.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="rounded-xl text-destructive"
                              data-testid={`button-delete-service-${service.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Service Type</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{service.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                className="rounded-xl"
                                onClick={() => deleteServiceMutation.mutate(service.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={<FileText className="h-6 w-6" />}
                    title="No service types"
                    description="Add service types for work orders."
                  />
                )}
              </div>
            </TabsContent>

            {/* Vendor Jobs Tab */}
            <TabsContent value="jobtypes" className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-foreground">Vendor Jobs & Pricing</h3>
                  {selectedJobTypes.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="gap-1.5 rounded-xl" data-testid="button-bulk-delete-jobtypes">
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete ({selectedJobTypes.length})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Selected Vendor Jobs</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {selectedJobTypes.length} vendor jobs? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            className="rounded-xl"
                            onClick={() => bulkDeleteJobTypesMutation.mutate(selectedJobTypes)}
                          >
                            Delete All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <Dialog open={jobTypeDialogOpen} onOpenChange={setJobTypeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2 rounded-xl" data-testid="button-add-jobtype">
                      <Plus className="h-4 w-4" />
                      Add Vendor Job
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Add Vendor Job</DialogTitle>
                    </DialogHeader>
                    <Form {...jobTypeForm}>
                      <form onSubmit={jobTypeForm.handleSubmit((data) => createJobTypeMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={jobTypeForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Vendor Job Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., Medical Application Normal" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) jobTypeForm.setValue("name", toProperCase(e.target.value)); }} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={jobTypeForm.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-11 rounded-xl">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="Medical">Medical</SelectItem>
                                  <SelectItem value="EID">EID</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={jobTypeForm.control}
                          name="cost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cost (AED)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  placeholder="0" 
                                  className="h-11 rounded-xl"
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end gap-3 pt-4">
                          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setJobTypeDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" className="rounded-xl" disabled={createJobTypeMutation.isPending}>
                            {createJobTypeMutation.isPending ? "Adding..." : "Add Vendor Job"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Edit Vendor Job Dialog */}
              <Dialog open={editJobTypeDialogOpen} onOpenChange={setEditJobTypeDialogOpen}>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Edit Vendor Job</DialogTitle>
                  </DialogHeader>
                  <Form {...editJobTypeForm}>
                    <form onSubmit={editJobTypeForm.handleSubmit((data) => editingJobType && updateJobTypeMutation.mutate({ ...data, id: editingJobType.id }))} className="space-y-4">
                      <FormField
                        control={editJobTypeForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vendor Job Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Medical Application Normal" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) editJobTypeForm.setValue("name", toProperCase(e.target.value)); }} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editJobTypeForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11 rounded-xl">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="Medical">Medical</SelectItem>
                                <SelectItem value="EID">EID</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editJobTypeForm.control}
                        name="cost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cost (AED)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                placeholder="0" 
                                className="h-11 rounded-xl"
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditJobTypeDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" className="rounded-xl" disabled={updateJobTypeMutation.isPending}>
                          {updateJobTypeMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <div className="space-y-3">
                {jobTypesLoading ? (
                  <>
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                  </>
                ) : jobTypes && jobTypes.length > 0 ? (
                  jobTypes.map((job, index) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/30 opacity-0 animate-fade-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedJobTypes.includes(job.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedJobTypes([...selectedJobTypes, job.id]);
                            } else {
                              setSelectedJobTypes(selectedJobTypes.filter(id => id !== job.id));
                            }
                          }}
                          data-testid={`checkbox-jobtype-${job.id}`}
                        />
                        <div className="icon-container">
                          <Briefcase className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{job.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <StatusBadge status={job.category as any} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">AED {job.cost}</p>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-xl"
                            onClick={() => handleEditJobType(job)}
                            data-testid={`button-edit-jobtype-${job.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="rounded-xl text-destructive"
                                data-testid={`button-delete-jobtype-${job.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Vendor Job</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{job.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  className="rounded-xl"
                                  onClick={() => deleteJobTypeMutation.mutate(job.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={<Briefcase className="h-6 w-6" />}
                    title="No vendor jobs"
                    description="Vendor jobs define pricing for typing work."
                  />
                )}
              </div>
            </TabsContent>

            {/* Email Settings Tab */}
            <TabsContent value="settings" className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-foreground mb-4">Email Configuration</h3>
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">Always CC Recipients</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {settings?.alwaysCc?.join(", ") || "No CC recipients configured"}
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-xl"
                          onClick={handleEditCc}
                          data-testid="button-edit-cc"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">Low Balance Threshold</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            AED {settings?.lowBalanceThreshold?.toLocaleString() || "1,000"}
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-xl"
                          onClick={handleEditThreshold}
                          data-testid="button-edit-threshold"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Edit CC Recipients Dialog */}
              <Dialog open={editCcDialogOpen} onOpenChange={setEditCcDialogOpen}>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Edit CC Recipients</DialogTitle>
                  </DialogHeader>
                  <Form {...ccForm}>
                    <form onSubmit={ccForm.handleSubmit(handleSubmitCc)} className="space-y-4">
                      <FormField
                        control={ccForm.control}
                        name="alwaysCc"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Addresses</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="email1@example.com, email2@example.com" 
                                className="rounded-xl"
                                rows={3}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">Separate multiple emails with commas</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditCcDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" className="rounded-xl" disabled={updateSettingsMutation.isPending}>
                          {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              {/* Edit Threshold Dialog */}
              <Dialog open={editThresholdDialogOpen} onOpenChange={setEditThresholdDialogOpen}>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Edit Low Balance Threshold</DialogTitle>
                  </DialogHeader>
                  <Form {...thresholdForm}>
                    <form onSubmit={thresholdForm.handleSubmit(handleSubmitThreshold)} className="space-y-4">
                      <FormField
                        control={thresholdForm.control}
                        name="lowBalanceThreshold"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Threshold Amount (AED)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                placeholder="1000" 
                                className="h-11 rounded-xl"
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">You'll be warned when balance falls below this amount</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditThresholdDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" className="rounded-xl" disabled={updateSettingsMutation.isPending}>
                          {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}

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
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Center, Staff, ServiceType, JobType, AppSettings, Company, CompanyEmail } from "@shared/schema";

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
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

const serviceTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
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

  const staffForm = useForm({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: "",
      roleTitle: "",
      phone: "",
      email: "",
    },
  });

  const editStaffForm = useForm({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: "",
      roleTitle: "",
      phone: "",
      email: "",
    },
  });

  const serviceForm = useForm({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: {
      name: "",
    },
  });

  const editServiceForm = useForm({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: {
      name: "",
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
      phone: member.phone || "",
      email: member.email || "",
    });
    setEditStaffDialogOpen(true);
  };

  const handleEditService = (service: ServiceType) => {
    setEditingService(service);
    editServiceForm.reset({
      name: service.name,
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
          Admin
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
                Job Types
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
                <h3 className="font-medium text-foreground text-sm">Medical & EID Centers</h3>
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
                                <Input {...field} placeholder="e.g., AMER Center Dubai" className="h-11 rounded-xl" />
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
                              <Input {...field} placeholder="e.g., AMER Center Dubai" className="h-11 rounded-xl" />
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

              <div className="space-y-3">
                {centersLoading ? (
                  <>
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                  </>
                ) : centers && centers.length > 0 ? (
                  centers.map((center, index) => (
                    <div
                      key={center.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30 opacity-0 animate-fade-in"
                      style={{ animationDelay: `${index * 0.03}s` }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="icon-container icon-container-sm">
                          <MapPin className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{center.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <StatusBadge status={center.type as any} />
                            {center.area && (
                              <span className="text-xs text-muted-foreground">{center.area}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-lg h-8 w-8"
                        onClick={() => handleEditCenter(center)}
                        data-testid={`button-edit-center-${center.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={<MapPin className="h-6 w-6" />}
                    title="No centers added"
                    description="Add medical and EID centers to get started."
                  />
                )}
              </div>
            </TabsContent>

            {/* Staff Tab */}
            <TabsContent value="staff" className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-medium text-foreground">Staff Members</h3>
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
                                <Input {...field} placeholder="e.g., John Smith" className="h-11 rounded-xl" />
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
                                <Input {...field} placeholder="e.g., PRO, Ops Manager" className="h-11 rounded-xl" />
                              </FormControl>
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
                                <Input {...field} placeholder="+971 50 000 0000" className="h-11 rounded-xl" />
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

              {/* Edit Staff Dialog */}
              <Dialog open={editStaffDialogOpen} onOpenChange={setEditStaffDialogOpen}>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Edit Staff Member</DialogTitle>
                  </DialogHeader>
                  <Form {...editStaffForm}>
                    <form onSubmit={editStaffForm.handleSubmit((data) => editingStaff && updateStaffMutation.mutate({ ...data, id: editingStaff.id }))} className="space-y-4">
                      <FormField
                        control={editStaffForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., John Smith" className="h-11 rounded-xl" />
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
                            <FormLabel>Role Title</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., PRO, Ops Manager" className="h-11 rounded-xl" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editStaffForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="+971 50 000 0000" className="h-11 rounded-xl" />
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
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="name@company.com" className="h-11 rounded-xl" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditStaffDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" className="rounded-xl" disabled={updateStaffMutation.isPending}>
                          {updateStaffMutation.isPending ? "Saving..." : "Save Changes"}
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
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-primary/10">
                          <span className="text-sm font-medium text-primary">
                            {member.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{member.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs rounded-full">{member.roleTitle}</Badge>
                            {member.email && (
                              <span className="text-sm text-muted-foreground">{member.email}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-xl"
                        onClick={() => handleEditStaff(member)}
                        data-testid={`button-edit-staff-${member.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
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
                <h3 className="font-medium text-foreground">Service Types</h3>
                <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2 rounded-xl" data-testid="button-add-service">
                      <Plus className="h-4 w-4" />
                      Add Service
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl">
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
                                <Input {...field} placeholder="e.g., New Visa, Visa Renewal" className="h-11 rounded-xl" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
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

              {/* Edit Service Dialog */}
              <Dialog open={editServiceDialogOpen} onOpenChange={setEditServiceDialogOpen}>
                <DialogContent className="rounded-2xl">
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
                              <Input {...field} placeholder="e.g., New Visa, Visa Renewal" className="h-11 rounded-xl" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                        <div className="icon-container">
                          <FileText className="h-4 w-4" />
                        </div>
                        <p className="font-medium text-foreground">{service.name}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-xl"
                        onClick={() => handleEditService(service)}
                        data-testid={`button-edit-service-${service.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
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

            {/* Job Types Tab */}
            <TabsContent value="jobtypes" className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-medium text-foreground">Job Types & Pricing</h3>
                <Dialog open={jobTypeDialogOpen} onOpenChange={setJobTypeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2 rounded-xl" data-testid="button-add-jobtype">
                      <Plus className="h-4 w-4" />
                      Add Job Type
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Add Job Type</DialogTitle>
                    </DialogHeader>
                    <Form {...jobTypeForm}>
                      <form onSubmit={jobTypeForm.handleSubmit((data) => createJobTypeMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={jobTypeForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Job Type Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., New Visa Application" className="h-11 rounded-xl" />
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
                            {createJobTypeMutation.isPending ? "Adding..." : "Add Job Type"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Edit Job Type Dialog */}
              <Dialog open={editJobTypeDialogOpen} onOpenChange={setEditJobTypeDialogOpen}>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Edit Job Type</DialogTitle>
                  </DialogHeader>
                  <Form {...editJobTypeForm}>
                    <form onSubmit={editJobTypeForm.handleSubmit((data) => editingJobType && updateJobTypeMutation.mutate({ ...data, id: editingJobType.id }))} className="space-y-4">
                      <FormField
                        control={editJobTypeForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Job Type Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., New Visa Application" className="h-11 rounded-xl" />
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
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-xl h-8 w-8"
                          onClick={() => handleEditJobType(job)}
                          data-testid={`button-edit-jobtype-${job.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={<Briefcase className="h-6 w-6" />}
                    title="No job types"
                    description="Job types define pricing for typing work."
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

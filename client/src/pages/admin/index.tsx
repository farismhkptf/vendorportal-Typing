import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Settings, 
  MapPin, 
  Users, 
  FileText, 
  Briefcase,
  Plus,
  Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import type { Center, Staff, ServiceType, JobType, AppSettings } from "@shared/schema";

const centerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["Medical", "EID", "Both"]),
  googleMapsUrl: z.string().url().optional().or(z.literal("")),
  area: z.string().optional(),
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

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("centers");
  const [centerDialogOpen, setCenterDialogOpen] = useState(false);
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const { toast } = useToast();

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

  const centerForm = useForm({
    resolver: zodResolver(centerSchema),
    defaultValues: {
      name: "",
      type: "Both" as const,
      googleMapsUrl: "",
      area: "",
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

  const serviceForm = useForm({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: {
      name: "",
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

  return (
    <AppLayout>
      {/* Header Section */}
      <div className="px-6 lg:px-10 pt-8 pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
            Admin Settings
          </h1>
          <p className="text-muted-foreground">
            Manage centers, staff, service types, and system settings
          </p>
        </div>
      </div>

      <div className="px-6 lg:px-10 pb-10">
        <div className="premium-card overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start border-b border-border/50 rounded-none bg-transparent p-0 h-auto overflow-x-auto">
              <TabsTrigger 
                value="centers" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-4 whitespace-nowrap text-sm"
                data-testid="tab-centers"
              >
                <MapPin className="h-4 w-4 mr-2" />
                Centers
              </TabsTrigger>
              <TabsTrigger 
                value="staff" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-4 whitespace-nowrap text-sm"
                data-testid="tab-staff"
              >
                <Users className="h-4 w-4 mr-2" />
                Staff
              </TabsTrigger>
              <TabsTrigger 
                value="services" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-4 whitespace-nowrap text-sm"
                data-testid="tab-services"
              >
                <FileText className="h-4 w-4 mr-2" />
                Service Types
              </TabsTrigger>
              <TabsTrigger 
                value="jobtypes" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-4 whitespace-nowrap text-sm"
                data-testid="tab-jobtypes"
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Job Types
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-4 whitespace-nowrap text-sm"
                data-testid="tab-settings"
              >
                <Settings className="h-4 w-4 mr-2" />
                Email Settings
              </TabsTrigger>
            </TabsList>

            {/* Centers Tab */}
            <TabsContent value="centers" className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-medium text-foreground">Medical & EID Centers</h3>
                <Dialog open={centerDialogOpen} onOpenChange={setCenterDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2 rounded-xl" data-testid="button-add-center">
                      <Plus className="h-4 w-4" />
                      Add Center
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl">
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
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/30 opacity-0 animate-fade-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="icon-container">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{center.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <StatusBadge status={center.type as any} />
                            {center.area && (
                              <span className="text-sm text-muted-foreground">{center.area}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="rounded-xl">
                        <Pencil className="h-4 w-4" />
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
                      <Button variant="ghost" size="icon" className="rounded-xl">
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
                      <Button variant="ghost" size="icon" className="rounded-xl">
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
              </div>

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
                      <div className="text-right">
                        <p className="font-semibold text-foreground">AED {job.defaultCost}</p>
                        <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8">
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
                          <p className="font-medium text-foreground">BCC Recipients</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {settings?.defaultBccEmail || "No default BCC configured"}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="rounded-xl">
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
                        <Button variant="ghost" size="icon" className="rounded-xl">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}

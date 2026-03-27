import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Plus, Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ServiceType } from "@shared/schema";
import { toProperCase } from "@/lib/proper-case";

const serviceTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  requiresMedicalTyping: z.boolean().default(false),
  requiresMedicalScheduling: z.boolean().default(false),
  requiresIdTyping2Years: z.boolean().default(false),
  requiresIdTyping1Year: z.boolean().default(false),
  requiresIdTyping10Years: z.boolean().default(false),
  requiresIdBiometrics: z.boolean().default(false),
  requiresAttestation: z.boolean().default(false),
  isDependent: z.boolean().default(false),
});

export function AdminServicesTab() {
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editServiceDialogOpen, setEditServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [bulkServiceDialogOpen, setBulkServiceDialogOpen] = useState(false);
  const [bulkServiceNames, setBulkServiceNames] = useState("");
  const { toast } = useToast();

  const { data: serviceTypes, isLoading: servicesLoading } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const filteredAdminServices = useMemo(() => {
    if (!serviceTypes) return [];
    if (!serviceSearch.trim()) return serviceTypes;
    const q = serviceSearch.toLowerCase();
    return serviceTypes.filter(s => s.name.toLowerCase().includes(q));
  }, [serviceTypes, serviceSearch]);

  const serviceForm = useForm({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: { name: "", requiresMedicalTyping: false, requiresMedicalScheduling: false, requiresIdTyping2Years: false, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: false, requiresAttestation: false, isDependent: false },
  });

  const editServiceForm = useForm({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: { name: "", requiresMedicalTyping: false, requiresMedicalScheduling: false, requiresIdTyping2Years: false, requiresIdTyping1Year: false, requiresIdTyping10Years: false, requiresIdBiometrics: false, requiresAttestation: false, isDependent: false },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof serviceTypeSchema>) => apiRequest("POST", "/api/service-types", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/service-types"] }); toast({ title: "Service type added successfully" }); setServiceDialogOpen(false); serviceForm.reset(); },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateServiceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof serviceTypeSchema> & { id: string }) => { const { id, ...rest } = data; return apiRequest("PUT", `/api/service-types/${id}`, rest); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/service-types"] }); toast({ title: "Service type updated successfully" }); setEditServiceDialogOpen(false); setEditingService(null); editServiceForm.reset(); },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/service-types/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/service-types"] }); toast({ title: "Service type deleted successfully" }); },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const bulkDeleteServicesMutation = useMutation({
    mutationFn: async (ids: string[]) => apiRequest("DELETE", "/api/service-types/bulk", { ids }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/service-types"] }); toast({ title: `${selectedServices.length} service types deleted successfully` }); setSelectedServices([]); },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const bulkCreateServicesMutation = useMutation({
    mutationFn: async (names: string[]) => apiRequest("POST", "/api/service-types/bulk", { names }),
    onSuccess: (_, names) => { queryClient.invalidateQueries({ queryKey: ["/api/service-types"] }); toast({ title: `${names.length} service types added successfully` }); setBulkServiceDialogOpen(false); setBulkServiceNames(""); },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

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
      requiresAttestation: service.requiresAttestation ?? false,
      isDependent: (service as any).isDependent ?? false,
    });
    setEditServiceDialogOpen(true);
  };

  function ServiceRequirementFields({ form }: { form: typeof serviceForm }) {
    return (
      <>
        <div className="space-y-3">
          <FormLabel className="text-sm font-medium">Requirements</FormLabel>
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
            {([
              ["requiresMedicalTyping", "Medical Typing"],
              ["requiresMedicalScheduling", "Medical Scheduling"],
              ["requiresIdTyping2Years", "ID Typing (2 Years)"],
              ["requiresIdTyping1Year", "ID Typing (1 Year)"],
              ["requiresIdTyping10Years", "ID Typing (10 Years)"],
              ["requiresIdBiometrics", "ID Biometrics"],
              ["requiresAttestation", "Attestation"],
            ] as const).map(([name, label]) => (
              <FormField key={name} control={form.control} name={name} render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="text-sm font-normal cursor-pointer">{label}</FormLabel>
                </FormItem>
              )} />
            ))}
          </div>
        </div>
        <div className="pt-1">
          <FormField control={form.control} name="isDependent" render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              <div>
                <FormLabel className="text-sm font-medium cursor-pointer">Dependent Visa</FormLabel>
                <p className="text-xs text-muted-foreground">Prompts a minor check when activating a Work Order</p>
              </div>
            </FormItem>
          )} />
        </div>
      </>
    );
  }

  function AutoJobsSummary({ form }: { form: typeof editServiceForm }) {
    const watched = form.watch();
    const autoJobs: string[] = [];
    if (watched.requiresMedicalTyping) autoJobs.push("Medical Typing");
    if (watched.requiresIdTyping2Years) autoJobs.push("EID Typing (2Y)");
    if (watched.requiresIdTyping1Year) autoJobs.push("EID Typing (1Y)");
    if (watched.requiresIdTyping10Years) autoJobs.push("EID Typing (10Y)");
    return (
      <div className={`p-3 rounded-xl border text-sm ${autoJobs.length > 0 ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" : "bg-muted/30 border-border/30"}`} data-testid="admin-service-auto-creation-summary">
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Typing jobs auto-created when a WO is created with this service type:</p>
        {autoJobs.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {autoJobs.map((label) => (
              <span key={label} className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800">{label}</span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/70">None — no typing jobs will be auto-created.</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-foreground">Service Types</h3>
          {selectedServices.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" className="gap-1.5 rounded-xl" data-testid="button-bulk-delete-services">
                  <Trash2 className="h-3.5 w-3.5" /> Delete ({selectedServices.length})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader><AlertDialogTitle>Delete Selected Services</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete {selectedServices.length} service types? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel><AlertDialogAction className="rounded-xl" onClick={() => bulkDeleteServicesMutation.mutate(selectedServices)}>Delete All</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={bulkServiceDialogOpen} onOpenChange={setBulkServiceDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2 rounded-xl" data-testid="button-bulk-add-service"><Plus className="h-4 w-4" /> Bulk Import</Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader><DialogTitle>Bulk Import Services</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Enter one service name per line</p>
                <Textarea value={bulkServiceNames} onChange={(e) => setBulkServiceNames(e.target.value)} placeholder={"New Visa\nVisa Renewal\nLabour Card\n..."} className="min-h-[200px] rounded-xl" data-testid="textarea-bulk-services" />
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => setBulkServiceDialogOpen(false)}>Cancel</Button>
                  <Button className="rounded-xl" disabled={bulkCreateServicesMutation.isPending || !bulkServiceNames.trim()} onClick={() => { const names = bulkServiceNames.split('\n').map(n => n.trim()).filter(n => n.length > 0); if (names.length > 0) bulkCreateServicesMutation.mutate(names); }} data-testid="button-submit-bulk-services">
                    {bulkCreateServicesMutation.isPending ? "Importing..." : `Import ${bulkServiceNames.split('\n').filter(n => n.trim()).length} Services`}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 rounded-xl" data-testid="button-add-service"><Plus className="h-4 w-4" /> Add Service</Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-lg">
              <DialogHeader><DialogTitle>Add Service Type</DialogTitle></DialogHeader>
              <Form {...serviceForm}>
                <form onSubmit={serviceForm.handleSubmit((data) => createServiceMutation.mutate(data))} className="space-y-4">
                  <FormField control={serviceForm.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Service Name</FormLabel><FormControl><Input {...field} placeholder="e.g., New Employment Visa - Inside" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) serviceForm.setValue("name", toProperCase(e.target.value)); }} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <ServiceRequirementFields form={serviceForm} />
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => setServiceDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" className="rounded-xl" disabled={createServiceMutation.isPending}>{createServiceMutation.isPending ? "Adding..." : "Add Service"}</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={editServiceDialogOpen} onOpenChange={setEditServiceDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle>Edit Service Type</DialogTitle></DialogHeader>
          <Form {...editServiceForm}>
            <form onSubmit={editServiceForm.handleSubmit((data) => editingService && updateServiceMutation.mutate({ ...data, id: editingService.id }))} className="space-y-4">
              <FormField control={editServiceForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Service Name</FormLabel><FormControl><Input {...field} placeholder="e.g., New Employment Visa - Inside" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) editServiceForm.setValue("name", toProperCase(e.target.value)); }} /></FormControl><FormMessage /></FormItem>
              )} />
              <ServiceRequirementFields form={editServiceForm} />
              <AutoJobsSummary form={editServiceForm} />
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditServiceDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="rounded-xl" disabled={updateServiceMutation.isPending}>{updateServiceMutation.isPending ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input type="search" placeholder="Search services..." value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} className="pl-9" data-testid="input-search-admin-services" />
      </div>

      <div className="space-y-3">
        {servicesLoading ? (
          <Skeleton className="h-16 rounded-xl" />
        ) : filteredAdminServices && filteredAdminServices.length > 0 ? (
          filteredAdminServices.map((service, index) => (
            <div key={service.id} className="flex items-center justify-between gap-2 p-4 rounded-xl bg-muted/30 border border-border/30 opacity-0 animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
              <div className="flex items-center gap-3">
                <Checkbox checked={selectedServices.includes(service.id)} onCheckedChange={(checked) => { if (checked) setSelectedServices([...selectedServices, service.id]); else setSelectedServices(selectedServices.filter(id => id !== service.id)); }} data-testid={`checkbox-service-${service.id}`} />
                <div className="icon-container"><FileText className="h-4 w-4" /></div>
                <div className="flex flex-col gap-1">
                  <p className="font-medium text-foreground">{service.name}</p>
                  {(() => {
                    const autoJobs: string[] = [];
                    if (service.requiresMedicalTyping) autoJobs.push("Medical Typing");
                    if (service.requiresIdTyping2Years) autoJobs.push("EID Typing (2Y)");
                    if (service.requiresIdTyping1Year) autoJobs.push("EID Typing (1Y)");
                    if (service.requiresIdTyping10Years) autoJobs.push("EID Typing (10Y)");
                    return autoJobs.length > 0 ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">Auto-creates:</span>
                        {autoJobs.map((label) => (
                          <Badge key={label} variant="secondary" className="text-[10px] rounded-full px-2 py-0 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">{label}</Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {service.requiresMedicalScheduling && <Badge variant="outline" className="text-xs rounded-full px-2 py-0">Med Sched</Badge>}
                        {service.requiresIdBiometrics && <Badge variant="outline" className="text-xs rounded-full px-2 py-0">Biometrics</Badge>}
                        {!service.requiresMedicalScheduling && !service.requiresIdBiometrics && <span className="text-xs text-muted-foreground/60">No auto-created jobs</span>}
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => handleEditService(service)} data-testid={`button-edit-service-${service.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="rounded-xl text-destructive" data-testid={`button-delete-service-${service.id}`}><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader><AlertDialogTitle>Delete Service Type</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete "{service.name}"? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel><AlertDialogAction className="rounded-xl" onClick={() => deleteServiceMutation.mutate(service.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        ) : (
          <EmptyState icon={<FileText className="h-6 w-6" />} title="No service types" description="Add service types to define what work orders can be created for." />
        )}
      </div>
    </div>
  );
}

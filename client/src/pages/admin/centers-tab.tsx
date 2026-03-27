import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  MapPin, Plus, Pencil, Search, Trash2, ChevronDown, Star, CreditCard, Stethoscope
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Center } from "@shared/schema";
import { toProperCase } from "@/lib/proper-case";

const centerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["Medical", "EID", "Both"]),
  authority: z.enum(["DHA", "EHS", "ICP"]).optional().nullable(),
  tier: z.enum(["Normal", "VIP"]).optional().nullable(),
  address: z.string().optional(),
  area: z.string().optional(),
  googleMapsUrl: z.string().url().optional().or(z.literal("")),
  timingText: z.string().optional(),
  notes: z.string().optional(),
});

export function AdminCentersTab() {
  const [centerDialogOpen, setCenterDialogOpen] = useState(false);
  const [editCenterDialogOpen, setEditCenterDialogOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);
  const [centerSearch, setCenterSearch] = useState("");
  const [selectedCenters, setSelectedCenters] = useState<string[]>([]);
  const [centerSectionsOpen, setCenterSectionsOpen] = useState({
    medicalVip: false,
    medicalNormal: false,
    eidVip: false,
    eidNormal: false
  });
  const { toast } = useToast();

  const { data: centers, isLoading: centersLoading } = useQuery<Center[]>({
    queryKey: ["/api/centers"],
  });

  const filteredAdminCenters = useMemo(() => {
    if (!centers) return [];
    if (!centerSearch.trim()) return centers;
    const q = centerSearch.toLowerCase();
    return centers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.area || "").toLowerCase().includes(q) ||
      (c.address || "").toLowerCase().includes(q)
    );
  }, [centers, centerSearch]);

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

  function CenterFormFields({ form, isEdit }: { form: typeof centerForm; isEdit?: boolean }) {
    return (
      <>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Center Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g., AMER Center Dubai" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) form.setValue("name", toProperCase(e.target.value)); }} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
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
            control={form.control}
            name="authority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Authority</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select authority" /></SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-xl">
                    {((form.watch("type") as string) === "EID") ? (
                      <SelectItem value="ICP">ICP</SelectItem>
                    ) : ((form.watch("type") as string) === "Medical") ? (
                      <>
                        <SelectItem value="DHA">DHA</SelectItem>
                        <SelectItem value="EHS">EHS</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="DHA">DHA</SelectItem>
                        <SelectItem value="EHS">EHS</SelectItem>
                        <SelectItem value="ICP">ICP</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="tier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tier</FormLabel>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className={`flex-1 rounded-lg ${field.value === "Normal" ? "bg-primary text-primary-foreground border-primary" : ""}`} onClick={() => field.onChange("Normal")} data-testid="button-tier-normal">Normal</Button>
                <Button type="button" variant="outline" size="sm" className={`flex-1 rounded-lg ${field.value === "VIP" ? "bg-amber-500 text-white border-amber-500" : ""}`} onClick={() => field.onChange("VIP")} data-testid="button-tier-vip">VIP</Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} placeholder="Full address" className="h-11 rounded-xl" /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="area" render={({ field }) => (<FormItem><FormLabel>Area</FormLabel><FormControl><Input {...field} placeholder="e.g., Downtown Dubai" className="h-11 rounded-xl" /></FormControl><FormMessage /></FormItem>)} />
        </div>
        <FormField control={form.control} name="googleMapsUrl" render={({ field }) => (<FormItem><FormLabel>Google Maps URL</FormLabel><FormControl><Input {...field} placeholder="https://maps.google.com/..." className="h-11 rounded-xl" /></FormControl><FormMessage /></FormItem>)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField control={form.control} name="timingText" render={({ field }) => (<FormItem><FormLabel>Timing Text</FormLabel><FormControl><Input {...field} placeholder="e.g., Sun-Thu 8AM-4PM" className="h-11 rounded-xl" /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} placeholder="Additional notes..." className="rounded-xl min-h-[38px] max-h-[80px]" /></FormControl><FormMessage /></FormItem>)} />
        </div>
      </>
    );
  }

  function CenterCard({ center, index, variant }: { center: Center; index: number; variant: "medical-vip" | "medical-normal" | "eid-vip" | "eid-normal" }) {
    const isVip = variant.includes("vip");
    const isEid = variant.startsWith("eid");

    const cardClass = variant === "medical-vip"
      ? "flex items-center justify-between gap-2 p-3 rounded-lg bg-gradient-to-r from-amber-500/5 to-amber-400/10 border-2 border-amber-400/40 opacity-0 animate-fade-in"
      : variant === "eid-vip"
      ? "flex items-center justify-between gap-2 p-3 rounded-lg bg-gradient-to-r from-amber-500/5 to-amber-400/10 border-2 border-amber-400/40 opacity-0 animate-fade-in"
      : variant === "eid-normal"
      ? "flex items-center justify-between gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-400/20 opacity-0 animate-fade-in"
      : "flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/30 border border-border/30 opacity-0 animate-fade-in";

    return (
      <div key={center.id} className={cardClass} style={{ animationDelay: `${index * 0.03}s` }}>
        <div className="flex items-center gap-2.5">
          <Checkbox
            checked={selectedCenters.includes(center.id)}
            onCheckedChange={(checked) => {
              if (checked) setSelectedCenters([...selectedCenters, center.id]);
              else setSelectedCenters(selectedCenters.filter(id => id !== center.id));
            }}
            data-testid={`checkbox-center-${center.id}`}
          />
          {isVip ? (
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center ring-2 ring-amber-300/50">
              <MapPin className="h-3.5 w-3.5 text-white" />
            </div>
          ) : isEid ? (
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <CreditCard className="h-3.5 w-3.5 text-white" />
            </div>
          ) : (
            <div className="icon-container icon-container-sm"><MapPin className="h-3.5 w-3.5" /></div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground text-sm">{center.name}</p>
              {isVip && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300 text-[10px] px-1.5 py-0" data-testid={`badge-${variant}-${center.id}`}>
                  {isEid ? "ID VIP" : "Medical VIP"}
                </Badge>
              )}
            </div>
            {center.area && <span className="text-xs text-muted-foreground">{center.area}</span>}
            {(center.authority || center.timingText) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {center.authority && <span>{center.authority}</span>}
                {center.authority && center.timingText && <span>·</span>}
                {center.timingText && <span>{center.timingText}</span>}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => handleEditCenter(center)} data-testid={`button-edit-center-${center.id}`}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-lg text-destructive" data-testid={`button-delete-center-${center.id}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Center</AlertDialogTitle>
                <AlertDialogDescription>Are you sure you want to delete "{center.name}"? This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction className="rounded-xl" onClick={() => deleteCenterMutation.mutate(center.id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  function CenterSection({ title, icon, centers: sectionCenters, sectionKey, variant, triggerClass }: {
    title: string;
    icon: React.ReactNode;
    centers: Center[];
    sectionKey: keyof typeof centerSectionsOpen;
    variant: "medical-vip" | "medical-normal" | "eid-vip" | "eid-normal";
    triggerClass?: string;
  }) {
    if (sectionCenters.length === 0) return null;
    return (
      <Collapsible open={centerSectionsOpen[sectionKey]} onOpenChange={(open) => setCenterSectionsOpen(prev => ({ ...prev, [sectionKey]: open }))}>
        <CollapsibleTrigger className={triggerClass || "flex items-center justify-between gap-2 w-full p-3 rounded-lg bg-muted/30 border border-border/30"} data-testid={`button-toggle-section-${variant}`}>
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium text-sm">{title}</span>
            <Badge variant="outline" className="text-xs" data-testid={`text-center-count-${variant}`}>{sectionCenters.length}</Badge>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${centerSectionsOpen[sectionKey] ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-2">
          {sectionCenters.map((center, index) => (
            <CenterCard key={center.id} center={center} index={index} variant={variant} />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
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
                  <AlertDialogDescription>Are you sure you want to delete {selectedCenters.length} centers? This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction className="rounded-xl" onClick={() => bulkDeleteCentersMutation.mutate(selectedCenters)}>Delete All</AlertDialogAction>
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
            <DialogHeader><DialogTitle>Add New Center</DialogTitle></DialogHeader>
            <Form {...centerForm}>
              <form onSubmit={centerForm.handleSubmit((data) => createCenterMutation.mutate(data))} className="space-y-3">
                <CenterFormFields form={centerForm} />
                <div className="flex justify-end gap-2 pt-3">
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => setCenterDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="rounded-xl" disabled={createCenterMutation.isPending}>{createCenterMutation.isPending ? "Adding..." : "Add Center"}</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editCenterDialogOpen} onOpenChange={setEditCenterDialogOpen}>
        <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Center</DialogTitle></DialogHeader>
          <Form {...editCenterForm}>
            <form onSubmit={editCenterForm.handleSubmit((data) => editingCenter && updateCenterMutation.mutate({ ...data, id: editingCenter.id }))} className="space-y-3">
              <CenterFormFields form={editCenterForm} isEdit />
              <div className="flex justify-end gap-2 pt-3">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditCenterDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="rounded-xl" disabled={updateCenterMutation.isPending}>{updateCenterMutation.isPending ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input type="search" placeholder="Search centers..." value={centerSearch} onChange={(e) => setCenterSearch(e.target.value)} className="pl-9" data-testid="input-search-admin-centers" />
      </div>

      {centersLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : filteredAdminCenters && filteredAdminCenters.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
              <Stethoscope className="h-3 w-3 text-white" />
            </div>
            <span className="font-semibold text-sm text-foreground">Medical Centers</span>
          </div>

          <CenterSection
            title="Medical Centers (VIP)"
            icon={<div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center"><Star className="h-3 w-3 text-white fill-white" /></div>}
            centers={filteredAdminCenters.filter((c: Center) => (c.type === "Medical" || c.type === "Both") && c.tier === "VIP")}
            sectionKey="medicalVip"
            variant="medical-vip"
            triggerClass="flex items-center justify-between gap-2 w-full p-3 rounded-lg bg-amber-500/5 border border-amber-400/30"
          />

          <CenterSection
            title="Medical Centers (Normal)"
            icon={<div className="icon-container icon-container-sm"><MapPin className="h-3.5 w-3.5" /></div>}
            centers={filteredAdminCenters.filter((c: Center) => (c.type === "Medical" || c.type === "Both") && c.tier !== "VIP")}
            sectionKey="medicalNormal"
            variant="medical-normal"
          />

          <div className="flex items-center gap-2 mb-2 mt-4">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <CreditCard className="h-3 w-3 text-white" />
            </div>
            <span className="font-semibold text-sm text-foreground">ID Centers</span>
          </div>

          <CenterSection
            title="ID Centers (VIP)"
            icon={<div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center"><Star className="h-3 w-3 text-white fill-white" /></div>}
            centers={filteredAdminCenters.filter((c: Center) => (c.type === "EID" || c.type === "Both") && c.tier === "VIP")}
            sectionKey="eidVip"
            variant="eid-vip"
            triggerClass="flex items-center justify-between gap-2 w-full p-3 rounded-lg bg-amber-500/5 border border-amber-400/30"
          />

          <CenterSection
            title="ID Centers (Normal)"
            icon={<div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center"><CreditCard className="h-3 w-3 text-white" /></div>}
            centers={filteredAdminCenters.filter((c: Center) => (c.type === "EID" || c.type === "Both") && c.tier !== "VIP")}
            sectionKey="eidNormal"
            variant="eid-normal"
            triggerClass="flex items-center justify-between gap-2 w-full p-3 rounded-lg bg-blue-500/5 border border-blue-400/30"
          />
        </div>
      ) : (
        <EmptyState
          icon={<MapPin className="h-6 w-6" />}
          title="No centers found"
          description={centerSearch ? "Try adjusting your search" : "Add your first center to get started."}
        />
      )}
    </div>
  );
}

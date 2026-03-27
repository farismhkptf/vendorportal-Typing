import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Building2, Mail, Plus, Pencil, Trash2, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Vendor } from "@shared/schema";
import { toProperCase } from "@/lib/proper-case";

const vendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required"),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  vendorType: z.enum(["Typing", "Attestation"]).default("Typing"),
});

export function AdminVendorsTab() {
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [editVendorDialogOpen, setEditVendorDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorLogoPreview, setVendorLogoPreview] = useState<string | null>(null);
  const [vendorLogoUploading, setVendorLogoUploading] = useState(false);
  const vendorLogoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: vendors, isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const vendorForm = useForm<z.infer<typeof vendorSchema>>({
    resolver: zodResolver(vendorSchema),
    defaultValues: { name: "", contactPerson: "", phone: "", email: "", vendorType: "Typing" },
  });

  const editVendorForm = useForm<z.infer<typeof vendorSchema>>({
    resolver: zodResolver(vendorSchema),
    defaultValues: { name: "", contactPerson: "", phone: "", email: "", vendorType: "Typing" },
  });

  const createVendorMutation = useMutation({
    mutationFn: async (data: z.infer<typeof vendorSchema>) => apiRequest("POST", "/api/vendors", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/vendors"] }); toast({ title: "Vendor added successfully" }); setVendorDialogOpen(false); vendorForm.reset(); },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateVendorMutation = useMutation({
    mutationFn: async (data: z.infer<typeof vendorSchema> & { id: string }) => { const { id, ...rest } = data; return apiRequest("PUT", `/api/vendors/${id}`, rest); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/vendors"] }); toast({ title: "Vendor updated successfully" }); setEditVendorDialogOpen(false); setEditingVendor(null); editVendorForm.reset(); },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteVendorMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/vendors/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/vendors"] }); toast({ title: "Vendor deleted successfully" }); },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  async function handleVendorLogoUpload(file: File) {
    if (!editingVendor) return;
    setVendorLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch(`/api/vendors/${editingVendor.id}/logo`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { logoUrl } = await res.json();
      setVendorLogoPreview(logoUrl + "?t=" + Date.now());
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({ title: "Logo updated", description: "Vendor logo has been saved." });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload logo.", variant: "destructive" });
    } finally {
      setVendorLogoUploading(false);
    }
  }

  function VendorFormFields({ form, isEdit }: { form: typeof vendorForm; isEdit?: boolean }) {
    return (
      <>
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem><FormLabel>Vendor Name</FormLabel><FormControl><Input {...field} onBlur={(e) => { field.onBlur(); field.onChange(toProperCase(e.target.value)); }} data-testid={isEdit ? "input-edit-vendor-name" : "input-vendor-name"} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="contactPerson" render={({ field }) => (
          <FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} onBlur={(e) => { field.onBlur(); field.onChange(toProperCase(e.target.value)); }} data-testid={isEdit ? "input-edit-vendor-contact" : "input-vendor-contact"} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="phone" render={({ field }) => (
          <FormItem><FormLabel>Phone</FormLabel><FormControl><MaskedInput mask="phone" {...field} data-testid={isEdit ? "input-edit-vendor-phone" : "input-vendor-phone"} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} data-testid={isEdit ? "input-edit-vendor-email" : "input-vendor-email"} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="vendorType" render={({ field }) => (
          <FormItem>
            <FormLabel>Vendor Type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger data-testid={isEdit ? "select-edit-vendor-type" : "select-vendor-type"}><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
              <SelectContent><SelectItem value="Typing">Typing</SelectItem><SelectItem value="Attestation">Attestation</SelectItem></SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
      </>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-base font-semibold text-foreground">Typing Vendors</h3>
        <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" data-testid="button-add-vendor"><Plus className="h-4 w-4" /> Add Vendor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Vendor</DialogTitle></DialogHeader>
            <Form {...vendorForm}>
              <form onSubmit={vendorForm.handleSubmit((data) => createVendorMutation.mutate(data))} className="space-y-4">
                <VendorFormFields form={vendorForm} />
                <div className="flex justify-end">
                  <Button type="submit" disabled={createVendorMutation.isPending} data-testid="button-save-vendor">{createVendorMutation.isPending ? "Adding..." : "Add Vendor"}</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editVendorDialogOpen} onOpenChange={setEditVendorDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Vendor</DialogTitle></DialogHeader>
          <Form {...editVendorForm}>
            <form onSubmit={editVendorForm.handleSubmit((data) => updateVendorMutation.mutate({ ...data, id: editingVendor?.id || "" }))} className="space-y-4">
              <VendorFormFields form={editVendorForm} isEdit />
              <div>
                <label className="text-sm font-medium">Vendor Logo</label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border/40">
                    {vendorLogoPreview ? <img src={vendorLogoPreview} alt="Logo" className="h-full w-full object-cover" /> : <Building2 className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <input ref={vendorLogoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleVendorLogoUpload(file); }} data-testid="input-vendor-logo" />
                  <Button type="button" variant="outline" size="sm" onClick={() => vendorLogoInputRef.current?.click()} disabled={vendorLogoUploading} data-testid="button-upload-vendor-logo">
                    {vendorLogoUploading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>) : (<><Camera className="h-4 w-4 mr-2" />{vendorLogoPreview ? "Change Logo" : "Upload Logo"}</>)}
                  </Button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={updateVendorMutation.isPending} data-testid="button-update-vendor">{updateVendorMutation.isPending ? "Updating..." : "Update Vendor"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {vendorsLoading ? (
          <><Skeleton className="h-20 rounded-lg" /><Skeleton className="h-20 rounded-lg" /></>
        ) : vendors && vendors.length > 0 ? (
          vendors.map((vendor) => (
            <div key={vendor.id} className="p-4 rounded-xl bg-muted/30 border border-border/30" data-testid={`vendor-card-${vendor.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="icon-container icon-container-sm shrink-0 overflow-hidden">
                    {vendor.logoUrl ? <img src={vendor.logoUrl} alt={vendor.name} className="h-full w-full object-cover" /> : <Building2 className="h-4 w-4" />}
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">{vendor.name}</h4>
                    {vendor.contactPerson && <p className="text-sm text-muted-foreground">{vendor.contactPerson}</p>}
                    <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                      {vendor.phone && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{vendor.phone}</span>}
                      {vendor.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{vendor.email}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => {
                    setEditingVendor(vendor);
                    setVendorLogoPreview(vendor.logoUrl || null);
                    editVendorForm.reset({ name: vendor.name, contactPerson: vendor.contactPerson || "", phone: vendor.phone || "", email: vendor.email || "", vendorType: (vendor.vendorType ?? "Typing") as "Typing" | "Attestation" });
                    setEditVendorDialogOpen(true);
                  }} data-testid={`button-edit-vendor-${vendor.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive" data-testid={`button-delete-vendor-${vendor.id}`}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Delete Vendor</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete &quot;{vendor.name}&quot;? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteVendorMutation.mutate(vendor.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))
        ) : (
          <EmptyState icon={<Building2 className="h-6 w-6" />} title="No vendors" description="Add a typing vendor to assign typing jobs." />
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, MapPin, Users, UserCheck, Save, Loader2, Mail, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Center, Staff, Company, CompanyEmail, ClientContact } from "@shared/schema";
import { Link } from "wouter";
import { toProperCase } from "@/lib/proper-case";

interface CompanyWithRelations extends Company {
  rmStaff?: Staff;
  assistStaff?: Staff;
  preferredMedicalCenter?: Center;
  preferredMedicalCenterVip?: Center;
  preferredBiometricsCenter?: Center;
  emails?: CompanyEmail[];
}

const clientContactSchema = z.object({
  name: z.string().optional().default(""),
  email: z.string().optional().default(""),
  mobile: z.string().optional().default(""),
});

const companyFormSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  tradeLicenseNumber: z.string().optional().nullable(),
  preferredMedicalCenterId: z.string().optional().nullable(),
  preferredMedicalCenterVipId: z.string().optional().nullable(),
  preferredBiometricsCenterId: z.string().optional().nullable(),
  preferredBiometricsCenterVipId: z.string().optional().nullable(),
  deliveryAddress: z.string().optional().nullable(),
  clientCoordinator: clientContactSchema.optional().nullable(),
  clientManager: clientContactSchema.optional().nullable(),
  rmStaffId: z.string().optional().nullable(),
  assistStaffId: z.string().optional().nullable(),
});

type CompanyFormData = z.infer<typeof companyFormSchema>;

export default function CompanyDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [isUnsavedDialogOpen, setIsUnsavedDialogOpen] = useState(false);
  const [newEmailLabel, setNewEmailLabel] = useState("");
  const [newEmailAddress, setNewEmailAddress] = useState("");
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const { data: company, isLoading } = useQuery<CompanyWithRelations>({
    queryKey: ["/api/companies", params.id],
  });

  const { data: companyEmails = [] } = useQuery<CompanyEmail[]>({
    queryKey: ["/api/companies", params.id, "emails"],
    enabled: !!params.id,
  });

  const { data: centers } = useQuery<Center[]>({ queryKey: ["/api/centers"] });
  const { data: staffList } = useQuery<Staff[]>({ queryKey: ["/api/staff"] });

  const medicalCenters = centers?.filter(c => c.type === "Medical" || c.type === "Both") || [];
  const normalMedicalCenters = medicalCenters.filter(c => c.tier === "Normal");
  const vipMedicalCenters = medicalCenters.filter(c => c.tier === "VIP");
  const eidCenters = centers?.filter(c => c.type === "EID" || c.type === "Both") || [];
  const normalEidCenters = eidCenters.filter(c => c.tier === "Normal");
  const vipEidCenters = eidCenters.filter(c => c.tier === "VIP");

  const crmStaff = staffList?.filter(s => {
    const role = s.roleTitle?.toLowerCase() || "";
    return role === "client relation manager" || role === "ceo";
  }) || [];
  
  const medicalAssistStaff = staffList?.filter(s => {
    const role = s.roleTitle?.toLowerCase() || "";
    return role === "medical assistant support";
  }) || [];

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    values: company ? {
      name: company.name,
      tradeLicenseNumber: company.tradeLicenseNumber || "",
      preferredMedicalCenterId: company.preferredMedicalCenterId || "",
      preferredMedicalCenterVipId: company.preferredMedicalCenterVipId || "",
      preferredBiometricsCenterId: company.preferredBiometricsCenterId || "",
      preferredBiometricsCenterVipId: company.preferredBiometricsCenterVipId || "",
      deliveryAddress: company.deliveryAddress || "",
      clientCoordinator: company.clientCoordinator || { name: "", email: "", mobile: "" },
      clientManager: company.clientManager || { name: "", email: "", mobile: "" },
      rmStaffId: company.rmStaffId || "",
      assistStaffId: company.assistStaffId || "",
    } : undefined,
  });

  const isDirty = form.formState.isDirty;

  const handleProperCaseBlur = (fieldName: keyof CompanyFormData | `clientCoordinator.name` | `clientManager.name`) => (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      form.setValue(fieldName as any, toProperCase(value), { shouldDirty: true });
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      const payload = {
        ...data,
        preferredMedicalCenterId: data.preferredMedicalCenterId || null,
        preferredMedicalCenterVipId: data.preferredMedicalCenterVipId || null,
        preferredBiometricsCenterId: data.preferredBiometricsCenterId || null,
        preferredBiometricsCenterVipId: data.preferredBiometricsCenterVipId || null,
        deliveryAddress: data.deliveryAddress || null,
        rmStaffId: data.rmStaffId || null,
        assistStaffId: data.assistStaffId || null,
        clientCoordinator: (data.clientCoordinator as ClientContact)?.name ? data.clientCoordinator : null,
        clientManager: (data.clientManager as ClientContact)?.name ? data.clientManager : null,
      };
      return apiRequest("PUT", `/api/companies/${params.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      toast({ title: "Company updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update company", variant: "destructive" });
    },
  });

  const addEmailMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/companies/${params.id}/emails`, { label: newEmailLabel, email: newEmailAddress }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id, "emails"] });
      setNewEmailLabel("");
      setNewEmailAddress("");
      toast({ title: "Email added" });
    },
    onError: (err: Error) => toast({ title: "Failed to add email", description: err.message, variant: "destructive" }),
  });

  const updateEmailMutation = useMutation({
    mutationFn: async ({ id, label, email }: { id: string; label: string; email: string }) =>
      apiRequest("PUT", `/api/companies/${params.id}/emails/${id}`, { label, email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id, "emails"] });
      setEditingEmailId(null);
      toast({ title: "Email updated" });
    },
    onError: (err: Error) => toast({ title: "Failed to update email", description: err.message, variant: "destructive" }),
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/companies/${params.id}/emails/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id, "emails"] });
      toast({ title: "Email removed" });
    },
    onError: (err: Error) => toast({ title: "Failed to remove email", description: err.message, variant: "destructive" }),
  });

  const onSubmit = useCallback((data: CompanyFormData) => {
    updateMutation.mutate(data);
  }, [updateMutation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        form.handleSubmit(onSubmit)();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [form, onSubmit]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleConfirmLeave = useCallback(() => {
    setIsUnsavedDialogOpen(false);
    navigate("/companies");
  }, [navigate]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-4 pb-8 space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  if (!company) {
    return (
      <AppLayout>
        <PageHeader
          title="Company Not Found"
          breadcrumbs={[{ label: "Companies", href: "/companies" }, { label: "Not Found" }]}
        />
        <div className="px-4 lg:px-6 pt-4 pb-8">
          <p className="text-muted-foreground">The company you're looking for doesn't exist or has been deleted.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title={toProperCase(company.name)}
        subtitle={company.tradeLicenseNumber ? `TL: ${company.tradeLicenseNumber}` : "Company details"}
        breadcrumbs={[{ label: "Companies", href: "/companies" }, { label: toProperCase(company.name) }]}
      />

      <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 lg:px-6 pb-8 space-y-6">
        {/* Section: Company Information */}
        <div className="premium-card p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Company Information</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">Company Name *</Label>
              <Input
                id="name"
                {...form.register("name")}
                className="h-9"
                data-testid="input-company-name"
                onBlur={handleProperCaseBlur("name")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tradeLicenseNumber" className="text-xs">Trade License Number</Label>
              <Input
                id="tradeLicenseNumber"
                {...form.register("tradeLicenseNumber")}
                className="h-9"
                data-testid="input-trade-license"
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs">Delivery Address (for Emirates ID)</Label>
            <Input
              {...form.register("deliveryAddress")}
              placeholder="Enter delivery address for EID cards"
              className="h-9"
              data-testid="input-delivery-address"
            />
          </div>
        </div>

        {/* Section: Center Preferences */}
        <div className="premium-card p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Center Preferences</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Favorite Medical Center (Normal)</Label>
              <Select
                value={form.watch("preferredMedicalCenterId") || "__none__"}
                onValueChange={(v) => form.setValue("preferredMedicalCenterId", v === "__none__" ? "" : v, { shouldDirty: true })}
              >
                <SelectTrigger className="h-9" data-testid="select-medical-normal">
                  <SelectValue placeholder="Select center" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {normalMedicalCenters.map((center) => (
                    <SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Favorite Medical Center (VIP)</Label>
              <Select
                value={form.watch("preferredMedicalCenterVipId") || "__none__"}
                onValueChange={(v) => form.setValue("preferredMedicalCenterVipId", v === "__none__" ? "" : v, { shouldDirty: true })}
              >
                <SelectTrigger className="h-9" data-testid="select-medical-vip">
                  <SelectValue placeholder="Select center" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {vipMedicalCenters.map((center) => (
                    <SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Favorite ID Center (Normal)</Label>
              <Select
                value={form.watch("preferredBiometricsCenterId") || "__none__"}
                onValueChange={(v) => form.setValue("preferredBiometricsCenterId", v === "__none__" ? "" : v, { shouldDirty: true })}
              >
                <SelectTrigger className="h-9" data-testid="select-biometrics">
                  <SelectValue placeholder="Select center" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {normalEidCenters.map((center) => (
                    <SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Favorite ID Center (VIP)</Label>
              <Select
                value={form.watch("preferredBiometricsCenterVipId") || "__none__"}
                onValueChange={(v) => form.setValue("preferredBiometricsCenterVipId", v === "__none__" ? "" : v, { shouldDirty: true })}
              >
                <SelectTrigger className="h-9" data-testid="select-biometrics-vip">
                  <SelectValue placeholder="Select center" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {vipEidCenters.map((center) => (
                    <SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Section: Client Contacts */}
        <div className="premium-card p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Client Contacts</h2>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client Coordinator</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <Input {...form.register("clientCoordinator.name")} placeholder="Name" className="h-9" onBlur={handleProperCaseBlur("clientCoordinator.name")} />
              <Input {...form.register("clientCoordinator.email")} type="email" placeholder="Email" className="h-9" />
              <Input {...form.register("clientCoordinator.mobile")} placeholder="Mobile" className="h-9" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client Manager</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <Input {...form.register("clientManager.name")} placeholder="Name" className="h-9" onBlur={handleProperCaseBlur("clientManager.name")} />
              <Input {...form.register("clientManager.email")} type="email" placeholder="Email" className="h-9" />
              <Input {...form.register("clientManager.mobile")} placeholder="Mobile" className="h-9" />
            </div>
          </div>

        </div>

        {/* Section: Our Team Contact */}
        <div className="premium-card p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <UserCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Our Team</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Client Relationship Manager</Label>
              <Select
                value={form.watch("rmStaffId") || "__none__"}
                onValueChange={(v) => form.setValue("rmStaffId", v === "__none__" ? "" : v, { shouldDirty: true })}
              >
                <SelectTrigger className="h-9" data-testid="select-rm-staff">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {crmStaff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.name} ({member.roleTitle})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Medical Support</Label>
              <Select
                value={form.watch("assistStaffId") || "__none__"}
                onValueChange={(v) => form.setValue("assistStaffId", v === "__none__" ? "" : v, { shouldDirty: true })}
              >
                <SelectTrigger className="h-9" data-testid="select-assist-staff">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {medicalAssistStaff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Section: Company Emails */}
        <div className="premium-card p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <Mail className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Company Emails</h2>
            <span className="text-xs text-muted-foreground ml-auto">{companyEmails.length} / 3</span>
          </div>

          {companyEmails.length > 0 && (
            <div className="space-y-2">
              {companyEmails.map((ce) => (
                <div key={ce.id} className="flex items-center gap-2 group" data-testid={`email-row-${ce.id}`}>
                  {editingEmailId === ce.id ? (
                    <>
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder="Label"
                        className="h-8 w-32"
                        data-testid="input-edit-email-label"
                      />
                      <Input
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        placeholder="Email"
                        type="email"
                        className="h-8 flex-1"
                        data-testid="input-edit-email-address"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => updateEmailMutation.mutate({ id: ce.id, label: editLabel, email: editAddress })}
                        disabled={updateEmailMutation.isPending || !editLabel || !editAddress}
                        data-testid="button-save-edit-email"
                      >
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditingEmailId(null)}
                        data-testid="button-cancel-edit-email"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-medium text-muted-foreground w-32 shrink-0 truncate">{ce.label}</span>
                      <span className="text-sm text-foreground flex-1 truncate">{ce.email}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => { setEditingEmailId(ce.id); setEditLabel(ce.label); setEditAddress(ce.email); }}
                        data-testid={`button-edit-email-${ce.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                        onClick={() => deleteEmailMutation.mutate(ce.id)}
                        disabled={deleteEmailMutation.isPending}
                        data-testid={`button-delete-email-${ce.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {companyEmails.length < 3 && (
            <div className="flex items-center gap-2">
              <Input
                value={newEmailLabel}
                onChange={(e) => setNewEmailLabel(e.target.value)}
                placeholder="Label (e.g. HR, Accounts)"
                className="h-8 w-32"
                data-testid="input-new-email-label"
              />
              <Input
                value={newEmailAddress}
                onChange={(e) => setNewEmailAddress(e.target.value)}
                placeholder="email@company.com"
                type="email"
                className="h-8 flex-1"
                data-testid="input-new-email-address"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                onClick={() => addEmailMutation.mutate()}
                disabled={addEmailMutation.isPending || !newEmailLabel || !newEmailAddress}
                data-testid="button-add-email"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {isDirty ? "You have unsaved changes" : ""}
          </p>
          <Button
            type="submit"
            size="sm"
            className="gap-1.5 rounded-lg"
            disabled={updateMutation.isPending || !isDirty}
            data-testid="button-save-company"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </form>

      <AlertDialog open={isUnsavedDialogOpen} onOpenChange={setIsUnsavedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-leave">Stay</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLeave} data-testid="button-confirm-leave">Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

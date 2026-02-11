import { useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Building2, MapPin, Users, UserCheck, Save, Loader2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
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
  clientAccountant: clientContactSchema.optional().nullable(),
  rmStaffId: z.string().optional().nullable(),
  assistStaffId: z.string().optional().nullable(),
});

type CompanyFormData = z.infer<typeof companyFormSchema>;

export default function CompanyDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: company, isLoading } = useQuery<CompanyWithRelations>({
    queryKey: ["/api/companies", params.id],
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
      clientAccountant: company.clientAccountant || { name: "", email: "", mobile: "" },
      rmStaffId: company.rmStaffId || "",
      assistStaffId: company.assistStaffId || "",
    } : undefined,
  });

  const isDirty = form.formState.isDirty;

  const handleProperCaseBlur = (fieldName: keyof CompanyFormData | `clientCoordinator.name` | `clientManager.name` | `clientAccountant.name`) => (e: React.FocusEvent<HTMLInputElement>) => {
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
        clientAccountant: (data.clientAccountant as ClientContact)?.name ? data.clientAccountant : null,
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

  const handleBack = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm("You have unsaved changes. Are you sure you want to leave?");
      if (!confirmed) return;
    }
    navigate("/companies");
  }, [isDirty, navigate]);

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
        <div className="px-4 lg:px-6 pt-4 pb-8">
          <p className="text-muted-foreground">Company not found</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="rounded-lg" data-testid="button-back" onClick={handleBack} type="button">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Link href="/">
                <Button variant="ghost" size="icon" className="rounded-lg" data-testid="button-home">
                  <Home className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{toProperCase(company.name)}</h1>
              <p className="text-sm text-muted-foreground">
                {company.tradeLicenseNumber ? `TL: ${company.tradeLicenseNumber}` : "Company details"}
              </p>
            </div>
          </div>
        </div>
      </div>

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

          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client Accountant</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <Input {...form.register("clientAccountant.name")} placeholder="Name" className="h-9" onBlur={handleProperCaseBlur("clientAccountant.name")} />
              <Input {...form.register("clientAccountant.email")} type="email" placeholder="Email" className="h-9" />
              <Input {...form.register("clientAccountant.mobile")} placeholder="Mobile" className="h-9" />
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
              <Label className="text-xs">Medical Assistance Support</Label>
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
    </AppLayout>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Building2, MapPin, Users, UserCheck, Save, Loader2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { useScrollToError } from "@/hooks/use-scroll-to-error";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Center, Staff } from "@shared/schema";
import { Link } from "wouter";
import { toProperCase } from "@/lib/proper-case";

const clientContactSchema = z.object({
  name: z.string().optional().default(""),
  email: z.string().optional().default(""),
  mobile: z.string().optional().default(""),
});

const companyFormSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  tradeLicenseNumber: z.string().optional(),
  preferredMedicalCenterId: z.string().optional(),
  preferredMedicalCenterVipId: z.string().optional(),
  preferredBiometricsCenterId: z.string().optional(),
  preferredBiometricsCenterVipId: z.string().optional(),
  clientCoordinator: clientContactSchema.optional(),
  clientManager: clientContactSchema.optional(),
  rmStaffId: z.string().optional(),
  assistStaffId: z.string().optional(),
});

type CompanyFormData = z.infer<typeof companyFormSchema>;

export default function NewCompany() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: centers } = useQuery<Center[]>({ queryKey: ["/api/centers"] });
  const { data: staffList } = useQuery<Staff[]>({ queryKey: ["/api/staff"] });

  const medicalCenters = centers?.filter(c => c.type === "Medical" || c.type === "Both") || [];
  const normalMedicalCenters = medicalCenters.filter(c => c.tier === "Normal");
  const vipMedicalCenters = medicalCenters.filter(c => c.tier === "VIP");
  const eidCenters = centers?.filter(c => c.type === "EID" || c.type === "Both") || [];
  const normalEidCenters = eidCenters.filter(c => c.tier === "Normal");
  const vipEidCenters = eidCenters.filter(c => c.tier === "VIP");

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: "",
      tradeLicenseNumber: "",
      preferredMedicalCenterId: "",
      preferredMedicalCenterVipId: "",
      preferredBiometricsCenterId: "",
      preferredBiometricsCenterVipId: "",
      clientCoordinator: { name: "", email: "", mobile: "" },
      clientManager: { name: "", email: "", mobile: "" },
      rmStaffId: "",
      assistStaffId: "",
    },
  });

  const handleProperCaseBlur = (fieldName: keyof CompanyFormData | `clientCoordinator.name` | `clientManager.name`) => (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      form.setValue(fieldName as any, toProperCase(value));
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      const payload = {
        ...data,
        preferredMedicalCenterId: data.preferredMedicalCenterId || null,
        preferredMedicalCenterVipId: data.preferredMedicalCenterVipId || null,
        preferredBiometricsCenterId: data.preferredBiometricsCenterId || null,
        preferredBiometricsCenterVipId: data.preferredBiometricsCenterVipId || null,
        rmStaffId: data.rmStaffId || null,
        assistStaffId: data.assistStaffId || null,
        clientCoordinator: data.clientCoordinator?.name ? data.clientCoordinator : null,
        clientManager: data.clientManager?.name ? data.clientManager : null,
      };
      return apiRequest("POST", "/api/companies", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Company created successfully" });
      navigate("/companies");
    },
    onError: () => {
      toast({ title: "Failed to create company", variant: "destructive" });
    },
  });

  const onSubmit = (data: CompanyFormData) => {
    createMutation.mutate(data);
  };

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Link href="/companies">
                <Button variant="ghost" size="icon" className="rounded-lg" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" size="icon" className="rounded-lg" data-testid="button-home">
                  <Home className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">Add Company</h1>
              <p className="text-sm text-muted-foreground">Create a new client company</p>
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
                placeholder="Enter company name"
                className="h-9"
                data-testid="input-company-name"
                onBlur={handleProperCaseBlur("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tradeLicenseNumber" className="text-xs">Trade License Number</Label>
              <Input
                id="tradeLicenseNumber"
                {...form.register("tradeLicenseNumber")}
                placeholder="Enter trade license number"
                className="h-9"
                data-testid="input-trade-license"
              />
            </div>
          </div>
        </div>

        {/* Section: Center Preferences */}
        <div className="premium-card p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Center Preferences</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Favorite Medical Center (Normal)</Label>
              <Select
                value={form.watch("preferredMedicalCenterId") || "__none__"}
                onValueChange={(v) => form.setValue("preferredMedicalCenterId", v === "__none__" ? "" : v)}
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
                onValueChange={(v) => form.setValue("preferredMedicalCenterVipId", v === "__none__" ? "" : v)}
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
                onValueChange={(v) => form.setValue("preferredBiometricsCenterId", v === "__none__" ? "" : v)}
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
                onValueChange={(v) => form.setValue("preferredBiometricsCenterVipId", v === "__none__" ? "" : v)}
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
          
          {/* Coordinator */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client Coordinator</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <Input
                {...form.register("clientCoordinator.name")}
                placeholder="Name"
                className="h-9"
                data-testid="input-coordinator-name"
                onBlur={handleProperCaseBlur("clientCoordinator.name")}
              />
              <Input
                {...form.register("clientCoordinator.email")}
                type="email"
                placeholder="Email"
                className="h-9"
                data-testid="input-coordinator-email"
              />
              <Input
                {...form.register("clientCoordinator.mobile")}
                placeholder="Mobile"
                className="h-9"
                data-testid="input-coordinator-mobile"
              />
            </div>
          </div>

          {/* Manager */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client Manager</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <Input
                {...form.register("clientManager.name")}
                placeholder="Name"
                className="h-9"
                data-testid="input-manager-name"
                onBlur={handleProperCaseBlur("clientManager.name")}
              />
              <Input
                {...form.register("clientManager.email")}
                type="email"
                placeholder="Email"
                className="h-9"
                data-testid="input-manager-email"
              />
              <Input
                {...form.register("clientManager.mobile")}
                placeholder="Mobile"
                className="h-9"
                data-testid="input-manager-mobile"
              />
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
              <Label className="text-xs">Client Relationship Manager (Ops Manager)</Label>
              <Select
                value={form.watch("rmStaffId") || "__none__"}
                onValueChange={(v) => form.setValue("rmStaffId", v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="h-9" data-testid="select-rm-staff">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {staffList?.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.name} - {member.roleTitle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">PRO Support</Label>
              <Select
                value={form.watch("assistStaffId") || "__none__"}
                onValueChange={(v) => form.setValue("assistStaffId", v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="h-9" data-testid="select-assist-staff">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {staffList?.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.name} - {member.roleTitle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <Link href="/companies">
            <Button type="button" variant="outline" size="sm" className="rounded-lg">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            size="sm"
            className="gap-1.5 rounded-lg"
            disabled={createMutation.isPending}
            data-testid="button-save-company"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Company
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}

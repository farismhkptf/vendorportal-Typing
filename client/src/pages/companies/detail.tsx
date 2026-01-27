import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Building2, MapPin, Users, UserCheck, Save, Loader2, Pencil } from "lucide-react";
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
  const [isEditing, setIsEditing] = useState(false);

  const { data: company, isLoading } = useQuery<CompanyWithRelations>({
    queryKey: ["/api/companies", params.id],
  });

  const { data: centers } = useQuery<Center[]>({ queryKey: ["/api/centers"] });
  const { data: staffList } = useQuery<Staff[]>({ queryKey: ["/api/staff"] });

  const medicalCenters = centers?.filter(c => c.type === "Medical" || c.type === "Both") || [];
  const eidCenters = centers?.filter(c => c.type === "EID" || c.type === "Both") || [];

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    values: company ? {
      name: company.name,
      tradeLicenseNumber: company.tradeLicenseNumber || "",
      preferredMedicalCenterId: company.preferredMedicalCenterId || "",
      preferredMedicalCenterVipId: company.preferredMedicalCenterVipId || "",
      preferredBiometricsCenterId: company.preferredBiometricsCenterId || "",
      clientCoordinator: company.clientCoordinator || { name: "", email: "", mobile: "" },
      clientManager: company.clientManager || { name: "", email: "", mobile: "" },
      clientAccountant: company.clientAccountant || { name: "", email: "", mobile: "" },
      rmStaffId: company.rmStaffId || "",
      assistStaffId: company.assistStaffId || "",
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      const payload = {
        ...data,
        preferredMedicalCenterId: data.preferredMedicalCenterId || null,
        preferredMedicalCenterVipId: data.preferredMedicalCenterVipId || null,
        preferredBiometricsCenterId: data.preferredBiometricsCenterId || null,
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
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Failed to update company", variant: "destructive" });
    },
  });

  const onSubmit = (data: CompanyFormData) => {
    updateMutation.mutate(data);
  };

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
            <Link href="/companies">
              <Button variant="ghost" size="icon" className="rounded-lg" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{company.name}</h1>
              <p className="text-sm text-muted-foreground">
                {company.tradeLicenseNumber ? `TL: ${company.tradeLicenseNumber}` : "Company details"}
              </p>
            </div>
          </div>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-lg"
              onClick={() => setIsEditing(true)}
              data-testid="button-edit-company"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
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
                disabled={!isEditing}
                className="h-9"
                data-testid="input-company-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tradeLicenseNumber" className="text-xs">Trade License Number</Label>
              <Input
                id="tradeLicenseNumber"
                {...form.register("tradeLicenseNumber")}
                disabled={!isEditing}
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
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Favorite Medical Center (Normal)</Label>
              <Select
                value={form.watch("preferredMedicalCenterId") || ""}
                onValueChange={(v) => form.setValue("preferredMedicalCenterId", v)}
                disabled={!isEditing}
              >
                <SelectTrigger className="h-9" data-testid="select-medical-normal">
                  <SelectValue placeholder="Select center" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {medicalCenters.map((center) => (
                    <SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Favorite Medical Center (VIP)</Label>
              <Select
                value={form.watch("preferredMedicalCenterVipId") || ""}
                onValueChange={(v) => form.setValue("preferredMedicalCenterVipId", v)}
                disabled={!isEditing}
              >
                <SelectTrigger className="h-9" data-testid="select-medical-vip">
                  <SelectValue placeholder="Select center" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {medicalCenters.map((center) => (
                    <SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Favorite ID Biometrics Center</Label>
              <Select
                value={form.watch("preferredBiometricsCenterId") || ""}
                onValueChange={(v) => form.setValue("preferredBiometricsCenterId", v)}
                disabled={!isEditing}
              >
                <SelectTrigger className="h-9" data-testid="select-biometrics">
                  <SelectValue placeholder="Select center" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {eidCenters.map((center) => (
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
              <Input {...form.register("clientCoordinator.name")} placeholder="Name" disabled={!isEditing} className="h-9" />
              <Input {...form.register("clientCoordinator.email")} type="email" placeholder="Email" disabled={!isEditing} className="h-9" />
              <Input {...form.register("clientCoordinator.mobile")} placeholder="Mobile" disabled={!isEditing} className="h-9" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client Manager</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <Input {...form.register("clientManager.name")} placeholder="Name" disabled={!isEditing} className="h-9" />
              <Input {...form.register("clientManager.email")} type="email" placeholder="Email" disabled={!isEditing} className="h-9" />
              <Input {...form.register("clientManager.mobile")} placeholder="Mobile" disabled={!isEditing} className="h-9" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client Accountant</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <Input {...form.register("clientAccountant.name")} placeholder="Name" disabled={!isEditing} className="h-9" />
              <Input {...form.register("clientAccountant.email")} type="email" placeholder="Email" disabled={!isEditing} className="h-9" />
              <Input {...form.register("clientAccountant.mobile")} placeholder="Mobile" disabled={!isEditing} className="h-9" />
            </div>
          </div>
        </div>

        {/* Section: Our Team Contact */}
        <div className="premium-card p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <UserCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Our Team Contact</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Client Relationship Manager (Ops Manager)</Label>
              <Select
                value={form.watch("rmStaffId") || ""}
                onValueChange={(v) => form.setValue("rmStaffId", v)}
                disabled={!isEditing}
              >
                <SelectTrigger className="h-9" data-testid="select-rm-staff">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {staffList?.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.name} - {member.roleTitle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Medical Assistance Support</Label>
              <Select
                value={form.watch("assistStaffId") || ""}
                onValueChange={(v) => form.setValue("assistStaffId", v)}
                disabled={!isEditing}
              >
                <SelectTrigger className="h-9" data-testid="select-assist-staff">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {staffList?.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.name} - {member.roleTitle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        {isEditing && (
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="gap-1.5 rounded-lg"
              disabled={updateMutation.isPending}
              data-testid="button-save-company"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        )}
      </form>
    </AppLayout>
  );
}

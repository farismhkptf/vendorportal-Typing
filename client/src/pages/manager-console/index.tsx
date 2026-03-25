import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Shield,
  Building2,
  MapPin,
  Users,
  FileText,
  User,
  Pencil,
  Search,
  Loader2,
  Lock,
  KeyRound,
  Link2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Settings,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/app-layout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toProperCase } from "@/lib/proper-case";
import type { Center, Staff, ServiceType, Company } from "@shared/schema";
import { CustodyDashboardWidget } from "@/components/custody/dashboard-widget";

const pinSchema = z.object({
  pin: z.string().length(4, "PIN must be 4 digits").regex(/^\d{4}$/, "PIN must be 4 digits"),
});

const changePinSchema = z.object({
  currentPin: z.string().length(4, "PIN must be 4 digits"),
  newPin: z.string().length(4, "PIN must be 4 digits").regex(/^\d{4}$/, "PIN must be 4 digits"),
  confirmPin: z.string().length(4, "PIN must be 4 digits"),
}).refine(data => data.newPin === data.confirmPin, {
  message: "PINs don't match",
  path: ["confirmPin"],
});

const changePasswordSchema = z.object({
  newPassword: z.string().min(4, "At least 4 characters"),
  confirmPassword: z.string().min(4, "At least 4 characters"),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

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

const staffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  roleTitle: z.string().min(1, "Role is required"),
  staffType: z.enum(["Permanent", "Temporary"]).default("Permanent"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  status: z.enum(["Active", "OnLeave", "Cancelled", "TempActive", "TempInactive"]).default("Active"),
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

export default function ManagerConsole() {
  const [verified, setVerified] = useState(false);
  const [activeTab, setActiveTab] = useState("companies");
  const { toast } = useToast();

  if (!verified) {
    return (
      <AppLayout>
        <PinGate onVerified={() => setVerified(true)} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight" data-testid="text-manager-title">Manager Console</h1>
          </div>
          <ChangePinButton />
        </div>

        <div className="max-w-xs">
          <CustodyDashboardWidget />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="companies" data-testid="tab-companies">
              <Building2 className="h-4 w-4 mr-1" /> Companies
            </TabsTrigger>
            <TabsTrigger value="centers" data-testid="tab-centers">
              <MapPin className="h-4 w-4 mr-1" /> Centers
            </TabsTrigger>
            <TabsTrigger value="staff" data-testid="tab-staff">
              <Users className="h-4 w-4 mr-1" /> Staff
            </TabsTrigger>
            <TabsTrigger value="services" data-testid="tab-services">
              <FileText className="h-4 w-4 mr-1" /> Services
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              <User className="h-4 w-4 mr-1" /> User Accounts
            </TabsTrigger>
            <TabsTrigger value="import" data-testid="tab-import">
              <Link2 className="h-4 w-4 mr-1" /> Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="companies">
            <CompaniesTab />
          </TabsContent>
          <TabsContent value="centers">
            <CentersTab />
          </TabsContent>
          <TabsContent value="staff">
            <StaffTab />
          </TabsContent>
          <TabsContent value="services">
            <ServicesTab />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
          <TabsContent value="import">
            <ImportTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function PinGate({ onVerified }: { onVerified: () => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof pinSchema>>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: "" },
  });

  const verifyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof pinSchema>) => {
      const res = await apiRequest("POST", "/api/manager/verify-pin", data);
      return res.json();
    },
    onSuccess: () => onVerified(),
    onError: (error: Error) => {
      toast({ title: "Incorrect PIN", description: error.message, variant: "destructive" });
      form.setValue("pin", "");
    },
  });

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="p-6 w-full max-w-sm space-y-4">
        <div className="text-center space-y-2">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold">Enter PIN</h2>
          <p className="text-sm text-muted-foreground">Enter your 4-digit Manager PIN to continue</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => verifyMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="0000"
                      maxLength={4}
                      className="text-center text-2xl tracking-widest"
                      autoFocus
                      data-testid="input-pin"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={verifyMutation.isPending} data-testid="button-verify-pin">
              {verifyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify PIN
            </Button>
          </form>
        </Form>
      </Card>
    </div>
  );
}

function ChangePinButton() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof changePinSchema>>({
    resolver: zodResolver(changePinSchema),
    defaultValues: { currentPin: "", newPin: "", confirmPin: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof changePinSchema>) => {
      const res = await apiRequest("PUT", "/api/manager/change-pin", {
        currentPin: data.currentPin,
        newPin: data.newPin,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "PIN changed successfully" });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to change PIN", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} data-testid="button-change-pin">
        <KeyRound className="h-4 w-4 mr-1" /> Change PIN
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Manager PIN</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
              <FormField control={form.control} name="currentPin" render={({ field }) => (
                <FormItem>
                  <FormLabel>Current PIN</FormLabel>
                  <FormControl><Input {...field} type="password" maxLength={4} data-testid="input-current-pin" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="newPin" render={({ field }) => (
                <FormItem>
                  <FormLabel>New PIN</FormLabel>
                  <FormControl><Input {...field} type="password" maxLength={4} data-testid="input-new-pin" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="confirmPin" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New PIN</FormLabel>
                  <FormControl><Input {...field} type="password" maxLength={4} data-testid="input-confirm-pin" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-pin">
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save New PIN
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

async function logChange(entityType: string, entityId: string, entityName: string, oldData: any, newData: any) {
  try {
    await apiRequest("POST", "/api/change-notifications", {
      entityType,
      entityId,
      entityName,
      oldData,
      newData,
    });
  } catch (err) {
    console.error("Failed to log change notification:", err);
  }
}

function CompaniesTab() {
  const [search, setSearch] = useState("");
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const { toast } = useToast();

  const { data: companies = [], isLoading } = useQuery<Company[]>({ queryKey: ["/api/companies"] });
  const { data: staffList = [] } = useQuery<Staff[]>({ queryKey: ["/api/staff"] });
  const { data: centersList = [] } = useQuery<Center[]>({ queryKey: ["/api/centers"] });

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.tradeLicenseNumber && c.tradeLicenseNumber.toLowerCase().includes(search.toLowerCase()))
  );

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, oldData }: { id: string; data: any; oldData: Company }) => {
      const res = await apiRequest("PUT", `/api/companies/${id}`, data);
      const updated = await res.json();
      await logChange("company", id, oldData.name, oldData, data);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Company updated" });
      setEditingCompany(null);
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search companies..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search-companies" />
      </div>
      <div className="space-y-2">
        {filtered.map(company => (
          <Card key={company.id} className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium truncate" data-testid={`text-company-name-${company.id}`}>{company.name}</p>
              <p className="text-xs text-muted-foreground">{company.tradeLicenseNumber || "No license"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setEditingCompany(company)} data-testid={`button-edit-company-${company.id}`}>
              <Pencil className="h-4 w-4" />
            </Button>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No companies found</p>}
      </div>

      {editingCompany && (
        <EditCompanyDialog
          company={editingCompany}
          staffList={staffList}
          centersList={centersList}
          onClose={() => setEditingCompany(null)}
          onSave={(data) => updateMutation.mutate({ id: editingCompany.id, data, oldData: editingCompany })}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function EditCompanyDialog({ company, staffList, centersList, onClose, onSave, isPending }: {
  company: Company;
  staffList: Staff[];
  centersList: Center[];
  onClose: () => void;
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const form = useForm({
    defaultValues: {
      name: company.name || "",
      tradeLicenseNumber: company.tradeLicenseNumber || "",
      rmStaffId: company.rmStaffId || "",
      assistStaffId: company.assistStaffId || "",
      preferredMedicalCenterId: company.preferredMedicalCenterId || "",
      preferredBiometricsCenterId: company.preferredBiometricsCenterId || "",
      deliveryAddress: company.deliveryAddress || "",
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Company</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSave)} className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input {...form.register("name")} data-testid="input-company-name" />
          </div>
          <div className="space-y-1">
            <Label>Trade License Number</Label>
            <Input {...form.register("tradeLicenseNumber")} data-testid="input-company-license" />
          </div>
          <div className="space-y-1">
            <Label>Relationship Manager</Label>
            <select {...form.register("rmStaffId")} className="w-full border rounded-md px-3 py-2 text-sm bg-background" data-testid="select-company-rm">
              <option value="">None</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Medical Assist Staff</Label>
            <select {...form.register("assistStaffId")} className="w-full border rounded-md px-3 py-2 text-sm bg-background" data-testid="select-company-assist">
              <option value="">None</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Preferred Medical Center</Label>
            <select {...form.register("preferredMedicalCenterId")} className="w-full border rounded-md px-3 py-2 text-sm bg-background" data-testid="select-company-med-center">
              <option value="">None</option>
              {centersList.filter(c => c.type === "Medical" || c.type === "Both").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Preferred Biometrics Center</Label>
            <select {...form.register("preferredBiometricsCenterId")} className="w-full border rounded-md px-3 py-2 text-sm bg-background" data-testid="select-company-bio-center">
              <option value="">None</option>
              {centersList.filter(c => c.type === "EID" || c.type === "Both").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Delivery Address</Label>
            <Textarea {...form.register("deliveryAddress")} data-testid="input-company-address" />
          </div>
          <Button type="submit" className="w-full" disabled={isPending} data-testid="button-save-company">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CentersTab() {
  const [search, setSearch] = useState("");
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);
  const { toast } = useToast();

  const { data: centersList = [], isLoading } = useQuery<Center[]>({ queryKey: ["/api/centers"] });

  const filtered = centersList.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) ||
      (c.area || "").toLowerCase().includes(q) ||
      (c.type || "").toLowerCase().includes(q) ||
      (c.authority || "").toLowerCase().includes(q);
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, oldData }: { id: string; data: any; oldData: Center }) => {
      const res = await apiRequest("PUT", `/api/centers/${id}`, data);
      const updated = await res.json();
      await logChange("center", id, oldData.name, oldData, data);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centers"] });
      toast({ title: "Center updated" });
      setEditingCenter(null);
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search centers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search-centers" />
      </div>
      <div className="space-y-2">
        {filtered.map(center => (
          <Card key={center.id} className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium truncate" data-testid={`text-center-name-${center.id}`}>{center.name}</p>
              <div className="flex items-center gap-1 flex-wrap">
                <Badge variant="secondary" className="text-xs">{center.type}</Badge>
                {center.authority && <Badge variant="outline" className="text-xs">{center.authority}</Badge>}
                {center.tier && <Badge variant="outline" className="text-xs">{center.tier}</Badge>}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setEditingCenter(center)} data-testid={`button-edit-center-${center.id}`}>
              <Pencil className="h-4 w-4" />
            </Button>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No centers found</p>}
      </div>

      {editingCenter && (
        <EditCenterDialog
          center={editingCenter}
          onClose={() => setEditingCenter(null)}
          onSave={(data) => updateMutation.mutate({ id: editingCenter.id, data, oldData: editingCenter })}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function EditCenterDialog({ center, onClose, onSave, isPending }: {
  center: Center;
  onClose: () => void;
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const form = useForm<z.infer<typeof centerSchema>>({
    resolver: zodResolver(centerSchema),
    defaultValues: {
      name: center.name || "",
      type: (center.type as "Medical" | "EID" | "Both") || "Medical",
      authority: (center.authority as "DHA" | "EHS" | "ICP" | null) || null,
      tier: (center.tier as "Normal" | "VIP" | null) || null,
      address: center.address || "",
      area: center.area || "",
      googleMapsUrl: center.googleMapsUrl || "",
      timingText: center.timingText || "",
      notes: center.notes || "",
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Center</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-3">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input {...field} data-testid="input-center-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger data-testid="select-center-type"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Medical">Medical</SelectItem>
                    <SelectItem value="EID">EID</SelectItem>
                    <SelectItem value="Both">Both</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="authority" render={({ field }) => (
              <FormItem>
                <FormLabel>Authority</FormLabel>
                <Select onValueChange={v => field.onChange(v === "none" ? null : v)} defaultValue={field.value || "none"}>
                  <FormControl><SelectTrigger data-testid="select-center-authority"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="DHA">DHA</SelectItem>
                    <SelectItem value="EHS">EHS</SelectItem>
                    <SelectItem value="ICP">ICP</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="tier" render={({ field }) => (
              <FormItem>
                <FormLabel>Tier</FormLabel>
                <Select onValueChange={v => field.onChange(v === "none" ? null : v)} defaultValue={field.value || "none"}>
                  <FormControl><SelectTrigger data-testid="select-center-tier"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="VIP">VIP</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl><Input {...field} data-testid="input-center-address" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="area" render={({ field }) => (
              <FormItem>
                <FormLabel>Area</FormLabel>
                <FormControl><Input {...field} data-testid="input-center-area" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="googleMapsUrl" render={({ field }) => (
              <FormItem>
                <FormLabel>Google Maps URL</FormLabel>
                <FormControl><Input {...field} data-testid="input-center-maps" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="timingText" render={({ field }) => (
              <FormItem>
                <FormLabel>Timing</FormLabel>
                <FormControl><Input {...field} data-testid="input-center-timing" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea {...field} data-testid="input-center-notes" /></FormControl>
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={isPending} data-testid="button-save-center">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function StaffTab() {
  const [search, setSearch] = useState("");
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const { toast } = useToast();

  const { data: staffList = [], isLoading } = useQuery<Staff[]>({ queryKey: ["/api/staff"] });

  const filtered = staffList.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) ||
      (s.roleTitle || "").toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q) ||
      (s.phone || "").toLowerCase().includes(q);
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, oldData }: { id: string; data: any; oldData: Staff }) => {
      const res = await apiRequest("PUT", `/api/staff/${id}`, data);
      const updated = await res.json();
      await logChange("staff", id, oldData.name, oldData, data);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff member updated" });
      setEditingStaff(null);
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search-staff" />
      </div>
      <div className="space-y-2">
        {filtered.map(member => (
          <Card key={member.id} className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium truncate" data-testid={`text-staff-name-${member.id}`}>{member.name}</p>
              <p className="text-xs text-muted-foreground">{member.roleTitle}</p>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant={member.status === "Active" ? "default" : "secondary"} className="text-xs">{member.status}</Badge>
              <Button variant="ghost" size="icon" onClick={() => setEditingStaff(member)} data-testid={`button-edit-staff-${member.id}`}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No staff found</p>}
      </div>

      {editingStaff && (
        <EditStaffDialog
          member={editingStaff}
          onClose={() => setEditingStaff(null)}
          onSave={(data) => updateMutation.mutate({ id: editingStaff.id, data, oldData: editingStaff })}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function EditStaffDialog({ member, onClose, onSave, isPending }: {
  member: Staff;
  onClose: () => void;
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const form = useForm<z.infer<typeof staffSchema>>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: member.name || "",
      roleTitle: member.roleTitle || "",
      staffType: (member.staffType as "Permanent" | "Temporary") || "Permanent",
      phone: member.phone || "",
      email: member.email || "",
      status: (member.status as any) || "Active",
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Staff Member</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-3">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input {...field} data-testid="input-staff-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="roleTitle" render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <FormControl><Input {...field} data-testid="input-staff-role" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="staffType" render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger data-testid="select-staff-type"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Permanent">Permanent</SelectItem>
                    <SelectItem value="Temporary">Temporary</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl><Input {...field} data-testid="input-staff-phone" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input {...field} data-testid="input-staff-email" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger data-testid="select-staff-status"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="OnLeave">On Leave</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                    <SelectItem value="TempActive">Temp Active</SelectItem>
                    <SelectItem value="TempInactive">Temp Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={isPending} data-testid="button-save-staff">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ServicesTab() {
  const [search, setSearch] = useState("");
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const { toast } = useToast();

  const { data: serviceTypes = [], isLoading } = useQuery<ServiceType[]>({ queryKey: ["/api/service-types"] });

  const filtered = serviceTypes.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, oldData }: { id: string; data: any; oldData: ServiceType }) => {
      const res = await apiRequest("PUT", `/api/service-types/${id}`, data);
      const updated = await res.json();
      await logChange("serviceType", id, oldData.name, oldData, data);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
      toast({ title: "Service type updated" });
      setEditingService(null);
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search-services" />
      </div>
      <div className="space-y-2">
        {filtered.map(svc => {
          const autoJobs: string[] = [];
          if (svc.requiresMedicalTyping) autoJobs.push("Medical Typing");
          if (svc.requiresIdTyping2Years) autoJobs.push("EID Typing (2Y)");
          if (svc.requiresIdTyping1Year) autoJobs.push("EID Typing (1Y)");
          if (svc.requiresIdTyping10Years) autoJobs.push("EID Typing (10Y)");
          return (
            <Card key={svc.id} className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium truncate" data-testid={`text-service-name-${svc.id}`}>{svc.name}</p>
                {autoJobs.length > 0 ? (
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    <span className="text-xs text-muted-foreground">Auto-creates:</span>
                    {autoJobs.map((label) => (
                      <Badge key={label} variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                        {label}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    {svc.requiresMedicalScheduling && <Badge variant="secondary" className="text-xs">Med Schedule</Badge>}
                    {svc.requiresIdBiometrics && <Badge variant="secondary" className="text-xs">EID Bio</Badge>}
                    {!svc.requiresMedicalScheduling && !svc.requiresIdBiometrics && (
                      <span className="text-xs text-muted-foreground/60">No auto-created jobs</span>
                    )}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditingService(svc)} data-testid={`button-edit-service-${svc.id}`}>
                <Pencil className="h-4 w-4" />
              </Button>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No services found</p>}
      </div>

      {editingService && (
        <EditServiceDialog
          service={editingService}
          onClose={() => setEditingService(null)}
          onSave={(data) => updateMutation.mutate({ id: editingService.id, data, oldData: editingService })}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function EditServiceDialog({ service, onClose, onSave, isPending }: {
  service: ServiceType;
  onClose: () => void;
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const form = useForm<z.infer<typeof serviceTypeSchema>>({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: {
      name: service.name || "",
      requiresMedicalTyping: service.requiresMedicalTyping || false,
      requiresMedicalScheduling: service.requiresMedicalScheduling || false,
      requiresIdTyping2Years: service.requiresIdTyping2Years || false,
      requiresIdTyping1Year: service.requiresIdTyping1Year || false,
      requiresIdTyping10Years: service.requiresIdTyping10Years || false,
      requiresIdBiometrics: service.requiresIdBiometrics || false,
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Service Type</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-3">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input {...field} data-testid="input-service-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {(["requiresMedicalTyping", "requiresMedicalScheduling", "requiresIdTyping2Years", "requiresIdTyping1Year", "requiresIdTyping10Years", "requiresIdBiometrics"] as const).map(key => (
              <FormField key={key} control={form.control} name={key} render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-2">
                  <FormLabel className="text-sm">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace('Requires ', '')}</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid={`switch-${key}`} /></FormControl>
                </FormItem>
              )} />
            ))}
            {(() => {
              const watched = form.watch();
              const autoJobs: string[] = [];
              if (watched.requiresMedicalTyping) autoJobs.push("Medical Typing");
              if (watched.requiresIdTyping2Years) autoJobs.push("EID Typing (2Y)");
              if (watched.requiresIdTyping1Year) autoJobs.push("EID Typing (1Y)");
              if (watched.requiresIdTyping10Years) autoJobs.push("EID Typing (10Y)");
              return (
                <div className={`p-3 rounded-lg border text-sm ${autoJobs.length > 0 ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" : "bg-muted/30 border-border/30"}`} data-testid="service-auto-creation-summary">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Typing jobs that will be auto-created on WO creation:</p>
                  {autoJobs.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {autoJobs.map((label) => (
                        <span key={label} className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800">
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/70">None — no typing jobs will be auto-created.</p>
                  )}
                </div>
              );
            })()}
            <Button type="submit" className="w-full" disabled={isPending} data-testid="button-save-service">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function UsersTab() {
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: usersData = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/manager/users"] });
  const { data: authUser } = useQuery<any>({ queryKey: ["/api/auth/me"] });

  const filtered = usersData.filter((u: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q);
  });

  const passwordForm = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof changePasswordSchema>) => {
      const res = await apiRequest("PUT", "/api/manager/change-password", { newPassword: data.newPassword });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password changed successfully" });
      setShowPasswordDialog(false);
      passwordForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search-users" />
      </div>
      <div className="space-y-2">
        {filtered.map((user: any) => {
          const isCurrentUser = authUser?.id === user.id;
          return (
            <Card key={user.id} className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate" data-testid={`text-user-name-${user.id}`}>{user.name}</p>
                  {isCurrentUser && <Badge variant="secondary" className="text-xs">You</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <Badge variant="outline" className="text-xs mt-1">{user.role}</Badge>
              </div>
              {isCurrentUser && (
                <Button variant="outline" size="sm" onClick={() => setShowPasswordDialog(true)} data-testid="button-change-password">
                  <KeyRound className="h-4 w-4 mr-1" /> Change Password
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Your Password</DialogTitle>
          </DialogHeader>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit((data) => passwordMutation.mutate(data))} className="space-y-4">
              <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl><Input {...field} type="password" data-testid="input-new-password" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl><Input {...field} type="password" data-testid="input-confirm-password" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={passwordMutation.isPending} data-testid="button-save-password">
                {passwordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Change Password
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImportTab() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [previewData, setPreviewData] = useState<any>(null);
  const { toast } = useToast();

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/preview-gsheet", { url: sheetUrl });
      return res.json();
    },
    onSuccess: (data) => setPreviewData(data),
    onError: (error: Error) => {
      toast({ title: "Preview failed", description: error.message, variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/import-gsheet", {
        url: sheetUrl,
        rows: previewData?.rows?.filter((r: any) => r.companyMatch && r.serviceTypeMatch),
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Imported ${data.imported || 0} work orders` });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setPreviewData(null);
      setSheetUrl("");
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-medium">Google Sheet Import</h3>
        <p className="text-sm text-muted-foreground">Paste a public Google Sheet URL to import work orders. Uploaded Excel files must first be converted: open in Google Sheets, then File &rarr; Save as Google Sheets.</p>
        <div className="flex gap-2">
          <Input
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={sheetUrl}
            onChange={e => setSheetUrl(e.target.value)}
            className="flex-1"
            data-testid="input-gsheet-url"
          />
          <Button
            onClick={() => previewMutation.mutate()}
            disabled={!sheetUrl || previewMutation.isPending}
            data-testid="button-preview-gsheet"
          >
            {previewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Preview
          </Button>
        </div>
      </Card>

      {previewData && (
        <Card className="p-4 space-y-3">
          <h3 className="font-medium">Preview ({previewData.rows?.length || 0} rows)</h3>
          <div className="max-h-[400px] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">WO Number</th>
                  <th className="text-left p-2">Company</th>
                  <th className="text-left p-2">Service</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {previewData.rows?.map((row: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{row.woNumber}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        {row.companyName}
                        {row.companyMatch ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        {row.serviceTypeName}
                        {row.serviceTypeMatch ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      {row.companyMatch && row.serviceTypeMatch ? (
                        <Badge variant="default" className="text-xs">Ready</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Skipped</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
            data-testid="button-import-gsheet"
          >
            {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import Matched Rows
          </Button>
        </Card>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <Card key={i} className="p-3">
          <Skeleton className="h-5 w-48 mb-2" />
          <Skeleton className="h-3 w-32" />
        </Card>
      ))}
    </div>
  );
}

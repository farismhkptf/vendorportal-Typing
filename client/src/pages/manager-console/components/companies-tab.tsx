import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import type { Center, Staff, Company } from "@shared/schema";
import { logChange } from "./shared";

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

export function CompaniesTab() {
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

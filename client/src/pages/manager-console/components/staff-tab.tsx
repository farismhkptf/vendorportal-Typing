import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Staff } from "@shared/schema";
import { logChange } from "./shared";

const staffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  roleTitle: z.string().min(1, "Role is required"),
  staffType: z.enum(["Permanent", "Temporary"]).default("Permanent"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  status: z.enum(["Active", "OnLeave", "Cancelled", "TempActive", "TempInactive"]).default("Active"),
});

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

export function StaffTab() {
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

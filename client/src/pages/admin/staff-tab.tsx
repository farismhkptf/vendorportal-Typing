import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Plus, Pencil, Search, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Staff } from "@shared/schema";
import { toProperCase } from "@/lib/proper-case";
import { formatDate } from "@/lib/format-date";

const staffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  roleTitle: z.string().min(1, "Role is required"),
  staffType: z.enum(["Permanent", "Temporary"]).default("Permanent"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  status: z.enum(["Active", "OnLeave", "Cancelled", "TempActive", "TempInactive"]).default("Active"),
  replacementId: z.string().optional().nullable(),
  leaveEndDate: z.string().optional().nullable(),
});

export function AdminStaffTab() {
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [editStaffDialogOpen, setEditStaffDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [adminStaffSearch, setAdminStaffSearch] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [statusPopoverId, setStatusPopoverId] = useState<string | null>(null);
  const [statusChangeData, setStatusChangeData] = useState<{
    status: string;
    leaveEndDate: string;
    replacementId: string;
  }>({ status: "", leaveEndDate: "", replacementId: "" });
  const { toast } = useToast();

  const { data: staffList, isLoading: staffLoading } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const filteredAdminStaff = useMemo(() => {
    if (!staffList) return [];
    if (!adminStaffSearch.trim()) return staffList;
    const q = adminStaffSearch.toLowerCase();
    return staffList.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.roleTitle || "").toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q) ||
      (s.phone || "").toLowerCase().includes(q)
    );
  }, [staffList, adminStaffSearch]);

  const staffForm = useForm<z.infer<typeof staffSchema>>({
    resolver: zodResolver(staffSchema),
    defaultValues: { name: "", roleTitle: "", staffType: "Permanent", phone: "", email: "", status: "Active", replacementId: null },
  });

  const editStaffForm = useForm<z.infer<typeof staffSchema>>({
    resolver: zodResolver(staffSchema),
    defaultValues: { name: "", roleTitle: "", staffType: "Permanent", phone: "", email: "", status: "Active", replacementId: null },
  });

  const createStaffMutation = useMutation({
    mutationFn: async (data: z.infer<typeof staffSchema>) => apiRequest("POST", "/api/staff", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff added successfully" });
      setStaffDialogOpen(false);
      staffForm.reset();
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateStaffMutation = useMutation({
    mutationFn: async (data: z.infer<typeof staffSchema> & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PUT", `/api/staff/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff updated successfully" });
      setEditStaffDialogOpen(false);
      setEditingStaff(null);
      editStaffForm.reset();
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateStaffStatusMutation = useMutation({
    mutationFn: async (data: { id: string; status: string; leaveEndDate?: string; replacementId?: string }) => {
      const { id, ...rest } = data;
      await apiRequest("PUT", `/api/staff/${id}`, rest);
      if (rest.status === "OnLeave" && rest.replacementId) {
        const replacement = staffList?.find((s: Staff) => s.id === rest.replacementId);
        if (replacement && replacement.staffType === "Temporary") {
          await apiRequest("PUT", `/api/staff/${rest.replacementId}`, { status: "TempActive" });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff status updated successfully" });
      setStatusPopoverId(null);
      setStatusChangeData({ status: "", leaveEndDate: "", replacementId: "" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/staff/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff member deleted successfully" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const bulkDeleteStaffMutation = useMutation({
    mutationFn: async (ids: string[]) => apiRequest("DELETE", "/api/staff/bulk", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: `${selectedStaff.length} staff members deleted successfully` });
      setSelectedStaff([]);
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const handleEditStaff = (member: Staff) => {
    setEditingStaff(member);
    editStaffForm.reset({
      name: member.name,
      roleTitle: member.roleTitle,
      staffType: member.staffType || "Permanent",
      phone: member.phone || "",
      email: member.email || "",
      status: member.status || "Active",
      replacementId: member.replacementId ?? null,
    });
    setEditStaffDialogOpen(true);
  };

  function StaffMemberCard({ member, index, isTemporary }: { member: Staff; index: number; isTemporary?: boolean }) {
    const prefix = isTemporary ? "temp-" : "";
    return (
      <div key={member.id} className="flex items-center justify-between gap-2 p-4 rounded-xl bg-muted/30 border border-border/30 opacity-0 animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
        <div className="flex items-center gap-3">
          <Checkbox
            checked={selectedStaff.includes(member.id)}
            onCheckedChange={(checked) => {
              if (checked) setSelectedStaff([...selectedStaff, member.id]);
              else setSelectedStaff(selectedStaff.filter(id => id !== member.id));
            }}
            data-testid={`checkbox-staff-${prefix}${member.id}`}
          />
          <div className={`h-10 w-10 rounded-full ${isTemporary ? "bg-amber-500/10" : "bg-primary/10"} flex items-center justify-center ring-1 ${isTemporary ? "ring-amber-500/10" : "ring-primary/10"}`}>
            <span className={`text-sm font-medium ${isTemporary ? "text-amber-600" : "text-primary"}`}>
              {member.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">{member.name}</p>
              {member.staffType === "Temporary" && (
                <Badge variant="outline" className="text-xs rounded-full bg-amber-500/10 text-amber-600 border-amber-200">Temp</Badge>
              )}
              <Popover
                open={statusPopoverId === member.id}
                onOpenChange={(open) => {
                  if (open) {
                    setStatusPopoverId(member.id);
                    setStatusChangeData({ status: member.status, leaveEndDate: (member as any).leaveEndDate || "", replacementId: member.replacementId || "" });
                  } else setStatusPopoverId(null);
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline" size="sm"
                    className={`h-auto py-0.5 px-2 text-xs rounded-full gap-1 ${
                      member.status === "Active" ? "bg-green-500/10 text-green-700 border-green-200" :
                      member.status === "OnLeave" ? "bg-amber-500/10 text-amber-700 border-amber-200" :
                      member.status === "Cancelled" ? "bg-red-500/10 text-red-700 border-red-200" :
                      member.status === "TempActive" ? "bg-cyan-500/10 text-cyan-700 border-cyan-200" :
                      "bg-gray-500/10 text-gray-700 border-gray-200"
                    }`}
                    data-testid={`button-status-${prefix}${member.id}`}
                  >
                    {member.status === "OnLeave" ? "On Leave" : member.status === "TempActive" ? "Temp Active" : member.status === "TempInactive" ? "Inactive" : member.status}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 rounded-xl p-4" align="start">
                  <div className="space-y-4">
                    <div className="font-medium text-sm">Change Status</div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Select value={statusChangeData.status} onValueChange={(value) => setStatusChangeData(prev => ({ ...prev, status: value }))}>
                        <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-lg">
                          {member.staffType === "Permanent" ? (
                            <>
                              <SelectItem value="Active">Active</SelectItem>
                              <SelectItem value="OnLeave">On Leave</SelectItem>
                              <SelectItem value="Cancelled">Cancelled</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="TempActive">Temp Active</SelectItem>
                              <SelectItem value="TempInactive">Inactive</SelectItem>
                              <SelectItem value="Cancelled">Cancelled</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    {statusChangeData.status === "OnLeave" && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Leave Ends On</Label>
                          <Input type="date" value={statusChangeData.leaveEndDate} onChange={(e) => setStatusChangeData(prev => ({ ...prev, leaveEndDate: e.target.value }))} className="h-9 rounded-lg" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Replacement</Label>
                          <Select value={statusChangeData.replacementId} onValueChange={(value) => setStatusChangeData(prev => ({ ...prev, replacementId: value }))}>
                            <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="Select replacement" /></SelectTrigger>
                            <SelectContent className="rounded-lg">
                              {staffList?.filter((s: Staff) => s.id !== member.id).map((s: Staff) => (
                                <SelectItem key={s.id} value={s.id}>{s.name} {s.staffType === "Temporary" ? "(Temp)" : ""}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" className="flex-1 rounded-lg" onClick={() => setStatusPopoverId(null)}>Cancel</Button>
                      <Button size="sm" className="flex-1 rounded-lg" disabled={updateStaffStatusMutation.isPending} onClick={() => {
                        updateStaffStatusMutation.mutate({
                          id: member.id,
                          status: statusChangeData.status,
                          leaveEndDate: statusChangeData.leaveEndDate || undefined,
                          replacementId: statusChangeData.replacementId || undefined,
                        });
                      }}>
                        {updateStaffStatusMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span>{member.roleTitle}</span>
              {member.phone && <span>{member.phone}</span>}
              {member.email && <span>{member.email}</span>}
            </div>
            {member.status === "OnLeave" && member.replacementId && (
              <div className="text-xs text-muted-foreground mt-1">
                Covered by: {staffList?.find((s: Staff) => s.id === member.replacementId)?.name || "Unknown"}
                {(member as any).leaveEndDate && ` (until ${formatDate((member as any).leaveEndDate)})`}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => handleEditStaff(member)} data-testid={`button-edit-staff-${prefix}${member.id}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl text-destructive" data-testid={`button-delete-staff-${prefix}${member.id}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Staff Member</AlertDialogTitle>
                <AlertDialogDescription>Are you sure you want to delete "{member.name}"? This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction className="rounded-xl" onClick={() => deleteStaffMutation.mutate(member.id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-foreground">Staff Members</h3>
          {selectedStaff.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" className="gap-1.5 rounded-xl" data-testid="button-bulk-delete-staff">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete ({selectedStaff.length})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Selected Staff</AlertDialogTitle>
                  <AlertDialogDescription>Are you sure you want to delete {selectedStaff.length} staff members? This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction className="rounded-xl" onClick={() => bulkDeleteStaffMutation.mutate(selectedStaff)}>Delete All</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <Dialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 rounded-xl" data-testid="button-add-staff">
              <Plus className="h-4 w-4" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
            <Form {...staffForm}>
              <form onSubmit={staffForm.handleSubmit((data) => createStaffMutation.mutate(data))} className="space-y-3">
                <FormField control={staffForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} placeholder="e.g., John Smith" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) staffForm.setValue("name", toProperCase(e.target.value)); }} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={staffForm.control} name="roleTitle" render={({ field }) => (
                  <FormItem><FormLabel>Role Title</FormLabel><FormControl><Input {...field} placeholder="e.g., P.R.O." className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) staffForm.setValue("roleTitle", toProperCase(e.target.value)); }} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={staffForm.control} name="staffType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Staff Type</FormLabel>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" className={`flex-1 rounded-lg ${field.value === "Permanent" ? "bg-primary text-primary-foreground border-primary" : ""}`} onClick={() => field.onChange("Permanent")} data-testid="button-staff-type-permanent">Permanent</Button>
                      <Button type="button" variant="outline" size="sm" className={`flex-1 rounded-lg ${field.value === "Temporary" ? "bg-amber-500 text-white border-amber-500" : ""}`} onClick={() => field.onChange("Temporary")} data-testid="button-staff-type-temporary">Temporary</Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField control={staffForm.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone</FormLabel><FormControl><MaskedInput mask="phone" value={field.value} onChange={field.onChange} placeholder="+971 50 000 0000" className="h-11 rounded-xl" aria-label="Staff phone number" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={staffForm.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} placeholder="name@company.com" className="h-11 rounded-xl" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={staffForm.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="OnLeave">On Leave</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                        <SelectItem value="TempActive">Temporarily Active</SelectItem>
                        <SelectItem value="TempInactive">Temporarily Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                {staffForm.watch("status") === "OnLeave" && (
                  <FormField control={staffForm.control} name="replacementId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Replacement Staff</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select replacement..." /></SelectTrigger></FormControl>
                        <SelectContent className="rounded-xl">
                          {staffList?.filter((s: Staff) => s.status === "Active").map((s: Staff) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
                <div className="flex justify-end gap-2 pt-3">
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => setStaffDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="rounded-xl" disabled={createStaffMutation.isPending}>{createStaffMutation.isPending ? "Adding..." : "Add Staff"}</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editStaffDialogOpen} onOpenChange={setEditStaffDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md p-0 gap-0 overflow-hidden">
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-4 border-b">
            <DialogHeader><DialogTitle className="text-base font-semibold">Edit Staff Member</DialogTitle></DialogHeader>
          </div>
          <Form {...editStaffForm}>
            <form onSubmit={editStaffForm.handleSubmit((data) => editingStaff && updateStaffMutation.mutate({ ...data, id: editingStaff.id }))} className="p-5 space-y-4">
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                <FormField control={editStaffForm.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel className="text-xs text-muted-foreground">Full Name</FormLabel><FormControl><Input {...field} placeholder="e.g., John Smith" className="h-9 rounded-lg" onBlur={(e) => { field.onBlur(); if (e.target.value) editStaffForm.setValue("name", toProperCase(e.target.value)); }} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={editStaffForm.control} name="roleTitle" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs text-muted-foreground">Role Title</FormLabel><FormControl><Input {...field} placeholder="e.g., P.R.O." className="h-9 rounded-lg" onBlur={(e) => { field.onBlur(); if (e.target.value) editStaffForm.setValue("roleTitle", toProperCase(e.target.value)); }} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={editStaffForm.control} name="staffType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Staff Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent className="rounded-lg">
                        <SelectItem value="Permanent">Permanent</SelectItem>
                        <SelectItem value="Temporary">Temporary</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editStaffForm.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs text-muted-foreground">Phone</FormLabel><FormControl><MaskedInput mask="phone" value={field.value} onChange={field.onChange} placeholder="050 000 0000" className="h-9 rounded-lg" aria-label="Staff phone number" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={editStaffForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs text-muted-foreground">Email</FormLabel><FormControl><Input {...field} placeholder="name@company.com" className="h-9 rounded-lg" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={() => setEditStaffDialogOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" className="rounded-lg" disabled={updateStaffMutation.isPending}>{updateStaffMutation.isPending ? "Saving..." : "Save"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input type="search" placeholder="Search staff..." value={adminStaffSearch} onChange={(e) => setAdminStaffSearch(e.target.value)} className="pl-9" data-testid="input-search-admin-staff" />
      </div>

      <div className="space-y-4">
        {staffLoading ? (
          <>
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </>
        ) : filteredAdminStaff && filteredAdminStaff.length > 0 ? (
          <>
            {(() => {
              const permanentStaff = filteredAdminStaff.filter((s: Staff) => s.staffType === "Permanent");
              return (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center">
                      <Users className="h-3 w-3 text-primary-foreground" />
                    </div>
                    <span className="font-semibold text-sm text-foreground">Permanent Staff</span>
                    <Badge variant="outline" className="text-xs">{permanentStaff.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {permanentStaff.length > 0 ? permanentStaff.map((member, index) => (
                      <StaffMemberCard key={member.id} member={member} index={index} />
                    )) : (
                      <p className="text-sm text-muted-foreground py-3">No permanent staff members.</p>
                    )}
                  </div>
                </div>
              );
            })()}
            {(() => {
              const temporaryStaff = filteredAdminStaff.filter((s: Staff) => s.staffType === "Temporary");
              return (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                      <Users className="h-3 w-3 text-white" />
                    </div>
                    <span className="font-semibold text-sm text-foreground">Temporary Staff</span>
                    <Badge variant="outline" className="text-xs">{temporaryStaff.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {temporaryStaff.length > 0 ? temporaryStaff.map((member, index) => (
                      <StaffMemberCard key={member.id} member={member} index={index} isTemporary />
                    )) : (
                      <p className="text-sm text-muted-foreground py-3">No temporary staff members.</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No staff members"
            description="Add your team members to assign them to work orders."
          />
        )}
      </div>
    </div>
  );
}

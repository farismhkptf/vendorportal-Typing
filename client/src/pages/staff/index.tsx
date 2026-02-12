import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Users, Mail, Phone, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Staff } from "@shared/schema";

const statusOptions = [
  { value: "Active", label: "Active Staff" },
  { value: "OnLeave", label: "Staff on Leave" },
  { value: "TempActive", label: "Temporary Staff - Active" },
  { value: "TempInactive", label: "Temporary Staff - Inactive" },
] as const;

const getStatusLabel = (status: string) => {
  return statusOptions.find(s => s.value === status)?.label || status;
};

const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "Active": return "default";
    case "OnLeave": return "secondary";
    case "TempActive": return "outline";
    case "TempInactive": return "destructive";
    default: return "secondary";
  }
};

interface StaffFormData {
  name: string;
  roleTitle: string;
  status: string;
  phone: string;
  email: string;
}

export default function StaffList() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState<StaffFormData>({
    name: "",
    roleTitle: "",
    status: "Active",
    phone: "",
    email: "",
  });

  const { data: staffList, isLoading } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const filteredStaff = staffList?.filter((member) =>
    !search || 
    member.name.toLowerCase().includes(search.toLowerCase()) ||
    member.roleTitle.toLowerCase().includes(search.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: async (data: StaffFormData) => {
      return apiRequest("POST", "/api/staff", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff member created successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Failed to create staff member", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: StaffFormData }) => {
      return apiRequest("PUT", `/api/staff/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff member updated successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Failed to update staff member", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/staff/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff member deleted successfully" });
      setIsDeleteDialogOpen(false);
      setDeletingStaff(null);
    },
    onError: () => {
      toast({ title: "Failed to delete staff member", variant: "destructive" });
    },
  });

  const handleOpenDialog = (staff?: Staff) => {
    if (staff) {
      setEditingStaff(staff);
      setFormData({
        name: staff.name,
        roleTitle: staff.roleTitle,
        status: staff.status || "Active",
        phone: staff.phone || "",
        email: staff.email || "",
      });
    } else {
      setEditingStaff(null);
      setFormData({
        name: "",
        roleTitle: "",
        status: "Active",
        phone: "",
        email: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingStaff(null);
    setFormData({ name: "", roleTitle: "", status: "Active", phone: "", email: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.roleTitle) {
      toast({ title: "Name and Role are required", variant: "destructive" });
      return;
    }
    if (editingStaff) {
      updateMutation.mutate({ id: editingStaff.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDeleteClick = (staff: Staff) => {
    setDeletingStaff(staff);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deletingStaff) {
      deleteMutation.mutate(deletingStaff.id);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AppLayout>
      {/* Header Section */}
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Staff</h1>
            <p className="text-sm text-muted-foreground">Manage your team members</p>
          </div>
          <Button 
            size="sm" 
            className="gap-1.5" 
            onClick={() => handleOpenDialog()}
            data-testid="button-add-staff"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Staff</span>
          </Button>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-8 space-y-4">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 rounded-lg"
            data-testid="input-search-staff"
          />
        </div>

        {/* Staff List */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <>
              <Skeleton className="h-36 rounded-xl" />
              <Skeleton className="h-36 rounded-xl" />
              <Skeleton className="h-36 rounded-xl" />
            </>
          ) : filteredStaff && filteredStaff.length > 0 ? (
            filteredStaff.map((member, index) => (
              <div
                key={member.id}
                className="premium-card p-4 opacity-0 animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
                data-testid={`staff-card-${member.id}`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{member.name}</h3>
                      <p className="text-sm text-muted-foreground">{member.roleTitle}</p>
                    </div>
                    <Badge variant={getStatusVariant(member.status || "Active")} className="text-xs rounded-full shrink-0">
                      {getStatusLabel(member.status || "Active")}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1.5">
                    {member.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{member.email}</span>
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{member.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-border/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 gap-1.5 rounded-lg h-8"
                      onClick={() => handleOpenDialog(member)}
                      data-testid={`button-edit-staff-${member.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 gap-1.5 rounded-lg h-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteClick(member)}
                      data-testid={`button-delete-staff-${member.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full">
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title="No staff members found"
                description={search ? "Try adjusting your search" : "Add your first staff member to get started."}
                action={
                  !search && (
                    <Button size="sm" className="gap-1.5 rounded-lg" onClick={() => handleOpenDialog()}>
                      <Plus className="h-4 w-4" />
                      Add Staff
                    </Button>
                  )
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>{editingStaff ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
            <DialogDescription>
              {editingStaff ? "Update the staff member's information." : "Enter the details for the new staff member."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter full name"
                className="h-9"
                data-testid="input-staff-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="roleTitle" className="text-xs">Role *</Label>
              <Input
                id="roleTitle"
                value={formData.roleTitle}
                onChange={(e) => setFormData({ ...formData, roleTitle: e.target.value })}
                placeholder="Enter role title"
                className="h-9"
                data-testid="input-staff-role"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger className="h-9" data-testid="select-staff-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email"
                  className="h-9"
                  data-testid="input-staff-email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs">Contact Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone"
                  className="h-9"
                  data-testid="input-staff-phone"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="rounded-lg gap-1.5" disabled={isPending} data-testid="button-save-staff">
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingStaff ? "Save Changes" : "Add Staff"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingStaff?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Users, Mail, Phone, Pencil, Trash2, Loader2, Download, LayoutGrid, Table2 } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { SortableHeader } from "@/components/ui/sortable-header";
import { ColumnVisibilityDropdown } from "@/components/ui/column-visibility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DataTableToolbar } from "@/components/ui/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import type { ColumnDef, SortState } from "@/hooks/use-data-table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Staff } from "@shared/schema";

type ViewMode = "cards" | "table";

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

  const [columnSort, setColumnSort] = useState<SortState>({ key: null, direction: null });
  const toggleColumnSort = useCallback((key: string) => {
    setColumnSort(prev => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key: null, direction: null };
    });
  }, []);

  const filteredStaff = useMemo(() => {
    let result = staffList?.filter((member) =>
      !search || 
      member.name.toLowerCase().includes(search.toLowerCase()) ||
      member.roleTitle.toLowerCase().includes(search.toLowerCase())
    );
    if (result && columnSort.key) {
      result = [...result].sort((a, b) => {
        const dir = columnSort.direction === "desc" ? -1 : 1;
        switch (columnSort.key) {
          case "name": return dir * a.name.localeCompare(b.name);
          case "role": return dir * a.roleTitle.localeCompare(b.roleTitle);
          case "status": return dir * (a.status || "").localeCompare(b.status || "");
          case "email": return dir * (a.email || "").localeCompare(b.email || "");
          default: return 0;
        }
      });
    }
    return result;
  }, [staffList, search, columnSort]);

  const getId = useCallback((member: Staff) => member.id, []);

  const columns: ColumnDef[] = [
    { id: "name", label: "Name", defaultVisible: true },
    { id: "role", label: "Role", defaultVisible: true },
    { id: "status", label: "Status", defaultVisible: true },
    { id: "email", label: "Email", defaultVisible: true },
    { id: "phone", label: "Phone", defaultVisible: true },
  ];

  const dt = useDataTable(filteredStaff, {
    storageKey: "staff_list",
    defaultPageSize: 25,
    defaultViewMode: "cards",
    getId,
    columns,
  });

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
  const isComfortable = dt.density === "comfortable";
  const viewMode = dt.viewMode as ViewMode;
  const cv = dt.isColumnVisible;

  const viewModeToggle = (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
      <Button
        size="icon"
        variant={viewMode === "cards" ? "secondary" : "ghost"}
        onClick={() => dt.setViewMode("cards")}
        data-testid="button-view-cards"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant={viewMode === "table" ? "secondary" : "ghost"}
        onClick={() => dt.setViewMode("table")}
        data-testid="button-view-table"
      >
        <Table2 className="h-4 w-4" />
      </Button>
    </div>
  );

  const renderCards = (items: Staff[]) => (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((member, index) => {
        const isSelected = dt.selectedIds.has(member.id);
        return (
          <div key={member.id} className="flex items-start gap-2">
            <div className="pt-4 shrink-0">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => dt.toggleSelected(member.id)}
                aria-label={`Select ${member.name}`}
                data-testid={`checkbox-staff-${member.id}`}
              />
            </div>
            <div
              className={`premium-card ${isComfortable ? "p-4" : "p-2.5"} flex-1 min-w-0 opacity-0 animate-fade-in`}
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
                    className="flex-1 gap-1.5 rounded-lg"
                    onClick={() => handleOpenDialog(member)}
                    data-testid={`button-edit-staff-${member.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-1.5 rounded-lg text-destructive"
                    onClick={() => handleDeleteClick(member)}
                    data-testid={`button-delete-staff-${member.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderTable = (items: Staff[]) => {
    const cellPadding = isComfortable ? "" : "py-1.5";
    return (
      <div className="premium-card overflow-hidden">
        <Table>
          <TableHeader className="sticky top-0 z-[9999] bg-background">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={dt.isAllSelected}
                  ref={(el) => {
                    if (el) (el as any).indeterminate = dt.isPartiallySelected;
                  }}
                  onCheckedChange={() => dt.toggleSelectAll()}
                  aria-label="Select all"
                  data-testid="checkbox-select-all"
                />
              </TableHead>
              {cv("name") && <SortableHeader sortKey="name" sort={columnSort} onToggle={toggleColumnSort}>Name</SortableHeader>}
              {cv("role") && <SortableHeader sortKey="role" sort={columnSort} onToggle={toggleColumnSort}>Role</SortableHeader>}
              {cv("status") && <SortableHeader sortKey="status" sort={columnSort} onToggle={toggleColumnSort}>Status</SortableHeader>}
              {cv("email") && <SortableHeader sortKey="email" sort={columnSort} onToggle={toggleColumnSort} className="hidden sm:table-cell">Email</SortableHeader>}
              {cv("phone") && <TableHead className="hidden md:table-cell">Phone</TableHead>}
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((member) => {
              const isSelected = dt.selectedIds.has(member.id);
              return (
                <TableRow
                  key={member.id}
                  className={`hover-elevate ${isSelected ? "bg-primary/5" : ""}`}
                  data-testid={`staff-table-${member.id}`}
                >
                  <TableCell className={cellPadding} onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => dt.toggleSelected(member.id)}
                      aria-label={`Select ${member.name}`}
                      data-testid={`checkbox-staff-${member.id}`}
                    />
                  </TableCell>
                  {cv("name") && <TableCell className={`font-medium ${cellPadding}`}>{member.name}</TableCell>}
                  {cv("role") && <TableCell className={`text-muted-foreground ${cellPadding}`}>{member.roleTitle}</TableCell>}
                  {cv("status") && <TableCell className={cellPadding}>
                    <Badge variant={getStatusVariant(member.status || "Active")} className="text-xs rounded-full">
                      {getStatusLabel(member.status || "Active")}
                    </Badge>
                  </TableCell>}
                  {cv("email") && <TableCell className={`hidden sm:table-cell text-muted-foreground ${cellPadding}`}>{member.email || "-"}</TableCell>}
                  {cv("phone") && <TableCell className={`hidden md:table-cell text-muted-foreground ${cellPadding}`}>{member.phone || "-"}</TableCell>}
                  <TableCell className={`text-right ${cellPadding}`}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(member)} data-testid={`button-edit-staff-${member.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteClick(member)} data-testid={`button-delete-staff-${member.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Staff</h1>
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
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search staff..."
          density={dt.density}
          onDensityChange={dt.setDensity}
          totalItems={dt.totalItems}
          selectedCount={dt.selectedCount}
          onClearSelection={dt.clearSelection}
          viewModeToggle={viewModeToggle}
          actions={
            <ColumnVisibilityDropdown
              columns={dt.columns}
              isColumnVisible={dt.isColumnVisible}
              toggleColumn={dt.toggleColumn}
              resetColumns={dt.resetColumns}
            />
          }
          selectionActions={
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              data-testid="button-export-csv"
              onClick={() => {
                const selected = (filteredStaff || []).filter(s => dt.selectedIds.has(s.id));
                exportToCsv(selected, [
                  { header: "Name", accessor: (s: Staff) => s.name },
                  { header: "Email", accessor: (s: Staff) => s.email || "" },
                  { header: "Phone", accessor: (s: Staff) => s.phone || "" },
                  { header: "Role/Department", accessor: (s: Staff) => s.roleTitle },
                  { header: "Status", accessor: (s: Staff) => s.status || "" },
                ], "staff-export");
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          }
        />

        <div>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : dt.paginatedData.length > 0 ? (
            <>
              {viewMode === "cards" && renderCards(dt.paginatedData)}
              {viewMode === "table" && renderTable(dt.paginatedData)}
            </>
          ) : (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title={search ? "No staff match your search" : "No staff members found"}
              description={search ? "Try adjusting your search terms" : "Add your first staff member to get started."}
              action={
                search ? (
                  <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                ) : (
                  <Button size="sm" className="gap-1.5 rounded-lg" onClick={() => handleOpenDialog()}>
                    <Plus className="h-4 w-4" />
                    Add Staff
                  </Button>
                )
              }
            />
          )}
        </div>

        <DataTablePagination
          page={dt.page}
          pageSize={dt.pageSize}
          totalPages={dt.totalPages}
          totalItems={dt.totalItems}
          onPageChange={dt.setPage}
          onPageSizeChange={dt.setPageSize}
          selectedCount={dt.selectedCount}
        />
      </div>

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
              className="rounded-lg bg-destructive text-destructive-foreground"
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

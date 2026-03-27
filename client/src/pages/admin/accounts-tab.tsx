import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { UserPlus, Pencil, Plus, Search, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Staff, Vendor } from "@shared/schema";

const userFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(4, "Min 4 characters").optional().or(z.literal("")),
  role: z.string().min(1, "Role is required"),
  staffId: z.string().optional().or(z.literal("")),
  vendorId: z.string().optional().or(z.literal("")),
});

export function AdminAccountsTab() {
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<any>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const { toast } = useToast();

  const { data: userAccounts, isLoading: usersLoading } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const { data: staffList } = useQuery<Staff[]>({ queryKey: ["/api/staff"] });
  const { data: vendors } = useQuery<Vendor[]>({ queryKey: ["/api/vendors"] });

  const filteredAdminAccounts = useMemo(() => {
    if (!userAccounts) return [];
    if (!accountSearch.trim()) return userAccounts;
    const q = accountSearch.toLowerCase();
    return userAccounts.filter((u: any) =>
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q)
    );
  }, [userAccounts, accountSearch]);

  const userForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: "", email: "", password: "", role: "", staffId: "", vendorId: "" },
  });

  const editUserForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: "", email: "", password: "", role: "", staffId: "", vendorId: "" },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof userFormSchema>) => {
      const payload: any = { ...data };
      if (payload.staffId === "") delete payload.staffId;
      if (payload.vendorId === "") delete payload.vendorId;
      if (payload.password === "") delete payload.password;
      return apiRequest("POST", "/api/users", payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "User created successfully" }); setUserDialogOpen(false); userForm.reset(); },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof userFormSchema> & { id: string }) => {
      const { id, ...rest } = data;
      const payload: any = { ...rest };
      if (payload.staffId === "") delete payload.staffId;
      if (payload.vendorId === "") delete payload.vendorId;
      if (payload.password === "") delete payload.password;
      return apiRequest("PATCH", `/api/users/${id}`, payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "User updated successfully" }); setEditingUser(null); editUserForm.reset(); },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { userId: string; newPassword: string }) => {
      const res = await apiRequest("PUT", "/api/admin/reset-user-password", data);
      return res.json();
    },
    onSuccess: () => { toast({ title: "Password reset successfully" }); setResetPasswordUser(null); setResetPasswordValue(""); },
    onError: (error: Error) => toast({ title: "Failed to reset password", description: error.message, variant: "destructive" }),
  });

  const toggleUserActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => apiRequest("PATCH", `/api/users/${id}`, { active }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "User status updated" }); },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  function UserFormFields({ form, isEdit }: { form: typeof userForm; isEdit?: boolean }) {
    return (
      <>
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} placeholder="Full name" data-testid={isEdit ? "input-edit-user-name" : "input-user-name"} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" placeholder="email@example.com" data-testid={isEdit ? "input-edit-user-email" : "input-user-email"} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem><FormLabel>{isEdit ? "Password (leave blank to keep current)" : "Password"}</FormLabel><FormControl><Input {...field} type="password" placeholder={isEdit ? "New password" : "Min 4 characters"} data-testid={isEdit ? "input-edit-user-password" : "input-user-password"} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="role" render={({ field }) => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger data-testid={isEdit ? "select-edit-user-role" : "select-user-role"}><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Client Relationship Manager">Client Relationship Manager</SelectItem>
                <SelectItem value="PRO">PRO</SelectItem>
                <SelectItem value="PRO - Temporary">PRO - Temporary</SelectItem>
                <SelectItem value="Vendor">Vendor</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        {["Vendor"].includes(form.watch("role")) && (
          <FormField control={form.control} name="vendorId" render={({ field }) => (
            <FormItem>
              <FormLabel>Linked Vendor</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl><SelectTrigger data-testid={isEdit ? "select-edit-user-vendor" : "select-user-vendor"}><SelectValue placeholder="Select vendor" /></SelectTrigger></FormControl>
                <SelectContent>{vendors?.map((v: Vendor) => (<SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>))}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        )}
        {["Admin", "Client Relationship Manager", "PRO", "PRO - Temporary"].includes(form.watch("role")) && (
          <FormField control={form.control} name="staffId" render={({ field }) => (
            <FormItem>
              <FormLabel>Linked Staff Member</FormLabel>
              <Select onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)} value={field.value || "__none__"}>
                <FormControl><SelectTrigger data-testid={isEdit ? "select-edit-user-staff" : "select-user-staff"}><SelectValue placeholder="Link to staff member" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {staffList?.map((s: Staff) => (<SelectItem key={s.id} value={s.id}>{s.name} — {s.roleTitle}</SelectItem>))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        )}
      </>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-base font-semibold text-foreground" data-testid="text-user-accounts-title">User Accounts</h3>
        <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" data-testid="button-create-user"><Plus className="h-4 w-4" /> Create User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
            <Form {...userForm}>
              <form onSubmit={userForm.handleSubmit((data) => createUserMutation.mutate(data))} className="space-y-4">
                <UserFormFields form={userForm} />
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-save-user">{createUserMutation.isPending ? "Creating..." : "Create User"}</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input type="search" placeholder="Search accounts..." value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} className="pl-9" data-testid="input-search-admin-accounts" />
      </div>

      {usersLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => (<Skeleton key={i} className="h-16 w-full rounded-xl" />))}</div>
      ) : filteredAdminAccounts && filteredAdminAccounts.length > 0 ? (
        <div className="space-y-3">
          {filteredAdminAccounts.map((user: any) => (
            <div key={user.id} className="p-4 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-between gap-4 flex-wrap" data-testid={`row-user-${user.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground" data-testid={`text-user-name-${user.id}`}>{user.name}</span>
                  <Badge variant="secondary" data-testid={`badge-user-role-${user.id}`}>{user.role}</Badge>
                  {!user.active && (<Badge variant="outline" className="text-muted-foreground" data-testid={`badge-user-inactive-${user.id}`}>Inactive</Badge>)}
                </div>
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  <span data-testid={`text-user-email-${user.id}`}>{user.email}</span>
                  {user.staffName && (<span data-testid={`text-user-staff-${user.id}`}>Staff: {user.staffName}</span>)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`user-active-${user.id}`} className="text-sm text-muted-foreground">Active</Label>
                  <Switch id={`user-active-${user.id}`} checked={user.active !== false} onCheckedChange={(checked) => toggleUserActiveMutation.mutate({ id: user.id, active: checked })} data-testid={`switch-user-active-${user.id}`} />
                </div>
                <Button variant="ghost" size="icon" onClick={() => setResetPasswordUser(user)} data-testid={`button-reset-password-${user.id}`}><KeyRound className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { setEditingUser(user); editUserForm.reset({ name: user.name || "", email: user.email || "", password: "", role: user.role || "", staffId: user.staffId || "", vendorId: user.vendorId || "" }); }} data-testid={`button-edit-user-${user.id}`}><Pencil className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<UserPlus className="h-6 w-6" />} title="No user accounts" description="Create a user account to get started." />
      )}

      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <Form {...editUserForm}>
            <form onSubmit={editUserForm.handleSubmit((data) => updateUserMutation.mutate({ ...data, id: editingUser?.id }))} className="space-y-4">
              <UserFormFields form={editUserForm} isEdit />
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                <Button type="submit" disabled={updateUserMutation.isPending} data-testid="button-update-user">{updateUserMutation.isPending ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => { if (!open) { setResetPasswordUser(null); setResetPasswordValue(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Set a new password for {resetPasswordUser?.name} ({resetPasswordUser?.email})</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Password</Label>
              <Input type="password" value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} placeholder="Enter new password (min 4 characters)" data-testid="input-reset-password" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setResetPasswordUser(null); setResetPasswordValue(""); }}>Cancel</Button>
              <Button onClick={() => resetPasswordMutation.mutate({ userId: resetPasswordUser?.id, newPassword: resetPasswordValue })} disabled={resetPasswordValue.length < 4 || resetPasswordMutation.isPending} data-testid="button-confirm-reset-password">
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

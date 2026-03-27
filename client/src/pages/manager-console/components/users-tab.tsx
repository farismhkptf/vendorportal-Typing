import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const changePasswordSchema = z.object({
  newPassword: z.string().min(4, "At least 4 characters"),
  confirmPassword: z.string().min(4, "At least 4 characters"),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
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

export function UsersTab() {
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

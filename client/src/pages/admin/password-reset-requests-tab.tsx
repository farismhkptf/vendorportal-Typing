import { useQuery, useMutation } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function PasswordResetRequestsTab() {
  const { data: requests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/password-reset-requests"],
  });
  const { toast } = useToast();

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PUT", `/api/admin/password-reset-requests/${id}/resolve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/password-reset-requests"] });
      toast({ title: "Request resolved" });
    },
  });

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-foreground" data-testid="text-reset-requests-title">Password Reset Requests</h3>
      {requests && requests.length > 0 ? (
        <div className="space-y-2">
          {requests.map((req: any) => (
            <div key={req.id} className="p-3 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-between gap-3 flex-wrap" data-testid={`row-reset-request-${req.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-foreground">{req.userName || "Unknown User"}</span>
                  <span className="text-sm text-muted-foreground">{req.userEmail || ""}</span>
                  <Badge variant={req.status === "pending" ? "default" : "secondary"}>
                    {req.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Requested: {new Date(req.createdAt).toLocaleString()}
                  {req.resolvedAt && ` | Resolved: ${new Date(req.resolvedAt).toLocaleString()}`}
                </div>
              </div>
              {req.status === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resolveMutation.mutate(req.id)}
                  disabled={resolveMutation.isPending}
                  data-testid={`button-resolve-request-${req.id}`}
                >
                  Mark Resolved
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<KeyRound className="h-6 w-6" />}
          title="No reset requests"
          description="Password reset requests from users will appear here."
        />
      )}
    </div>
  );
}

import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ChangeNotification {
  id: string;
  entityType: string;
  entityName: string;
  changedByName: string;
  createdAt: string;
  status: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
}

export function ChangeLogTab() {
  const { toast } = useToast();
  const { data: notifications = [], isLoading } = useQuery<ChangeNotification[]>({ queryKey: ["/api/change-notifications"] });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const res = await apiRequest("PUT", `/api/change-notifications/${id}/review`, { action });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/change-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/centers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
      toast({ title: variables.action === "keep" ? "Change accepted" : "Change reverted" });
    },
    onError: (error: Error) => {
      toast({ title: "Review failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) return (
    <div className="py-6 space-y-4">
      <Skeleton className="h-6 w-48" />
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    </div>
  );

  const pending = notifications.filter((n) => n.status === "pending");
  const reviewed = notifications.filter((n) => n.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3">Pending Changes ({pending.length})</h3>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No pending changes to review</p>
        ) : (
          <div className="space-y-2">
            {pending.map((n) => (
              <div key={n.id} className="p-4 rounded-xl bg-muted/30 border border-border/30 space-y-2" data-testid={`notification-${n.id}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <Badge variant="secondary" className="text-xs mr-2">{n.entityType}</Badge>
                    <span className="font-medium text-sm">{n.entityName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{n.changedByName} &middot; {new Date(n.createdAt).toLocaleDateString()}</span>
                </div>
                {n.oldData && n.newData && (
                  <div className="text-xs space-y-1 bg-background/50 p-2 rounded-lg">
                    {Object.keys(n.newData).map((key: string) => {
                      const oldVal = n.oldData?.[key];
                      const newVal = n.newData?.[key];
                      if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return null;
                      return (
                        <div key={key} className="flex gap-2">
                          <span className="text-muted-foreground w-32 shrink-0">{key}:</span>
                          <span className="line-through text-red-500/70">{String(oldVal ?? "")}</span>
                          <span className="text-green-600">{String(newVal ?? "")}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reviewMutation.mutate({ id: n.id, action: "revert" })}
                    disabled={reviewMutation.isPending}
                    data-testid={`button-revert-${n.id}`}
                  >
                    <XCircle className="h-3 w-3 mr-1" /> Revert
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => reviewMutation.mutate({ id: n.id, action: "keep" })}
                    disabled={reviewMutation.isPending}
                    data-testid={`button-keep-${n.id}`}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Keep
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {reviewed.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-foreground mb-3">Reviewed ({reviewed.length})</h3>
          <div className="space-y-2">
            {reviewed.slice(0, 20).map((n) => (
              <div key={n.id} className="p-3 rounded-xl bg-muted/20 border border-border/20 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="secondary" className="text-xs">{n.entityType}</Badge>
                  <span className="text-sm truncate">{n.entityName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={n.status === "kept" ? "default" : "secondary"} className="text-xs">
                    {n.status === "kept" ? "Kept" : "Reverted"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{n.changedByName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

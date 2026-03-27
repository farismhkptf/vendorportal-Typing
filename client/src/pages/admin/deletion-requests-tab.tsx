import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  BanIcon,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function DeletionRequestsBadge() {
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/deletion-requests/pending-count"],
    staleTime: 30000,
  });
  if (!data?.count) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold" data-testid="badge-deletion-requests-count">
      {data.count}
    </span>
  );
}

export function DeletionRequestsTab() {
  const { toast } = useToast();
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const { data: requests = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/deletion-requests"],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, reviewNote }: { id: string; reviewNote?: string }) => {
      const res = await apiRequest("PATCH", `/api/deletion-requests/${id}/approve`, { reviewNote });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deletion-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deletion-requests/pending-count"] });
      toast({ title: "Deletion request approved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to approve", description: err.message, variant: "destructive" });
    },
  });

  const denyMutation = useMutation({
    mutationFn: async ({ id, reviewNote }: { id: string; reviewNote?: string }) => {
      const res = await apiRequest("PATCH", `/api/deletion-requests/${id}/deny`, { reviewNote });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deletion-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deletion-requests/pending-count"] });
      toast({ title: "Deletion request denied" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to deny", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  const pending = requests.filter((r: any) => r.status === "pending");
  const reviewed = requests.filter((r: any) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3" data-testid="text-deletion-requests-title">
          Deletion Requests — Pending ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6" />}
            title="No pending deletion requests"
            description="Deletion requests from CRM will appear here for your review."
          />
        ) : (
          <div className="space-y-3">
            {pending.map((req: any) => (
              <div
                key={req.id}
                className="p-4 rounded-xl bg-muted/30 border border-border/30 space-y-3"
                data-testid={`row-deletion-request-${req.id}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="secondary" className="text-xs">{req.entityType}</Badge>
                      <span className="font-medium text-sm text-foreground" data-testid={`text-deletion-label-${req.id}`}>
                        {req.entityLabel}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      <span className="font-medium">Reason:</span> {req.reason}
                    </p>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span>Requested by: <span className="font-medium">{req.requestedByName}</span></span>
                      <span>{new Date(req.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">Pending</Badge>
                </div>
                <div className="space-y-2">
                  <Input
                    placeholder="Optional review note (shown to requester)..."
                    value={reviewNotes[req.id] || ""}
                    onChange={(e) => setReviewNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                    className="h-8 text-sm"
                    data-testid={`input-review-note-${req.id}`}
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                      onClick={() => denyMutation.mutate({ id: req.id, reviewNote: reviewNotes[req.id] || undefined })}
                      disabled={denyMutation.isPending || approveMutation.isPending}
                      data-testid={`button-deny-deletion-${req.id}`}
                    >
                      <BanIcon className="h-3.5 w-3.5" />
                      Deny
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => approveMutation.mutate({ id: req.id, reviewNote: reviewNotes[req.id] || undefined })}
                      disabled={approveMutation.isPending || denyMutation.isPending}
                      data-testid={`button-approve-deletion-${req.id}`}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Approve & Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {reviewed.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-foreground mb-3">
            Reviewed ({reviewed.length})
          </h3>
          <div className="space-y-2">
            {reviewed.slice(0, 20).map((r: any) => (
              <div key={r.id} className="p-3 rounded-xl bg-muted/20 border border-border/20 flex items-center justify-between gap-3 flex-wrap" data-testid={`row-deletion-reviewed-${r.id}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="secondary" className="text-xs">{r.entityType}</Badge>
                  <span className="text-sm truncate">{r.entityLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.status === "approved" ? "default" : "secondary"} className="text-xs">
                    {r.status === "approved" ? "Approved" : "Denied"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{r.reviewedByName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

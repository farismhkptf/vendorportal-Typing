import { useQuery } from "@tanstack/react-query";
import { Trash2, Clock, CheckCircle2, BanIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { queryKeys } from "@/lib/query-keys";
import type { DeletionRequest } from "./types";

export function MyDeletionRequestsPanel() {
  const { data: requests = [], isLoading } = useQuery<DeletionRequest[]>({
    queryKey: queryKeys.deletionRequests,
  });

  if (isLoading) {
    return (
      <div className="premium-card p-4 mt-2">
        <div className="flex items-center gap-2 mb-3">
          <Trash2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">My Deletion Requests</h3>
        </div>
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (requests.length === 0) return null;

  const pending = requests.filter(r => r.status === "pending");
  const reviewed = requests.filter(r => r.status !== "pending").slice(0, 5);

  return (
    <div className="premium-card p-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <Trash2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">My Deletion Requests</h3>
        {pending.length > 0 && (
          <Badge variant="secondary" className="text-xs">{pending.length} pending</Badge>
        )}
      </div>
      <div className="space-y-2">
        {[...pending, ...reviewed].map((req) => (
          <div
            key={req.id}
            className="p-3 rounded-lg bg-muted/30 border border-border/20 flex items-start justify-between gap-3"
            data-testid={`row-my-deletion-request-${req.id}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <Badge variant="outline" className="text-xs">{req.entityType}</Badge>
                <span className="text-xs text-muted-foreground truncate">{req.entityLabel}</span>
              </div>
              <p className="text-xs text-muted-foreground">Reason: {req.reason}</p>
              {req.reviewNote && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-medium">Admin note:</span> {req.reviewNote}
                </p>
              )}
            </div>
            <div className="shrink-0">
              {req.status === "pending" && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                  <Clock className="h-2.5 w-2.5 mr-1" />
                  Pending
                </Badge>
              )}
              {req.status === "approved" && (
                <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50 dark:bg-green-950/20">
                  <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                  Approved
                </Badge>
              )}
              {req.status === "denied" && (
                <Badge variant="outline" className="text-xs text-destructive border-destructive/20 bg-destructive/5">
                  <BanIcon className="h-2.5 w-2.5 mr-1" />
                  Denied
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

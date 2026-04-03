import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface IntegrationStatus {
  lastInboundWo: { woNumber: string; applicantName: string; createdAt: string } | null;
  lastSuccessfulPush: { eventType: string; processedAt: string } | null;
  failedPushCount: number;
  recentEvents: {
    id: string;
    eventType: string;
    status: string;
    workOrderId: string | null;
    attemptCount: number;
    errorMessage: string | null;
    createdAt: string;
    processedAt: string | null;
  }[];
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function statusBadge(status: string) {
  if (status === "sent") return <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">Sent</Badge>;
  if (status === "failed") return <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">Failed</Badge>;
  if (status === "pending") return <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">Pending</Badge>;
  return <Badge className="text-xs" variant="outline">{status}</Badge>;
}

export function IntegrationTab() {
  const { toast } = useToast();

  const { data: status, isLoading, refetch } = useQuery<IntegrationStatus>({
    queryKey: ["/api/admin/integration/status"],
    refetchInterval: 30000,
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/integration/retry-failed");
      return res.json();
    },
    onSuccess: (data: { retriedCount: number }) => {
      toast({ title: `Retry triggered`, description: `${data.retriedCount} event(s) queued for retry` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/integration/status"] });
    },
    onError: (err: Error) => toast({ title: "Retry failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Client Portal Integration</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor inbound work orders and outbound status push events</p>
        </div>
        <div className="flex items-center gap-2">
          {(status?.failedPushCount ?? 0) > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              data-testid="button-retry-failed-pushes"
            >
              {retryMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Retry {status?.failedPushCount} Failed
            </Button>
          )}
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => refetch()} data-testid="button-refresh-integration">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownToLine className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Inbound WO</span>
          </div>
          {status?.lastInboundWo ? (
            <div>
              <p className="font-semibold text-foreground">{status.lastInboundWo.woNumber}</p>
              <p className="text-sm text-muted-foreground">{status.lastInboundWo.applicantName}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(status.lastInboundWo.createdAt)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">None yet</p>
          )}
        </div>

        <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpFromLine className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Push Sent</span>
          </div>
          {status?.lastSuccessfulPush ? (
            <div>
              <p className="font-semibold text-foreground text-sm">{status.lastSuccessfulPush.eventType.replace(/_/g, " ")}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(status.lastSuccessfulPush.processedAt)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">None yet</p>
          )}
        </div>

        <div className={`p-4 rounded-xl border ${(status?.failedPushCount ?? 0) > 0 ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" : "bg-muted/30 border-border/30"}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`h-4 w-4 ${(status?.failedPushCount ?? 0) > 0 ? "text-red-500" : "text-muted-foreground"}`} />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Failed Pushes</span>
          </div>
          <p className={`text-2xl font-bold ${(status?.failedPushCount ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
            {status?.failedPushCount ?? 0}
          </p>
          {(status?.failedPushCount ?? 0) > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Will retry automatically every 10 min</p>
          )}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">Recent Push Events</h4>
        {(!status?.recentEvents || status.recentEvents.length === 0) ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No push events yet. They will appear here when work order statuses are updated.
          </div>
        ) : (
          <div className="space-y-1.5">
            {status.recentEvents.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/20 hover:bg-muted/30 transition-colors" data-testid={`row-integration-event-${ev.id}`}>
                <div className="mt-0.5">
                  {ev.status === "delivered" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : ev.status === "failed" ? (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{ev.eventType.replace(/_/g, " ")}</span>
                    {statusBadge(ev.status)}
                    {ev.attemptCount > 1 && (
                      <span className="text-xs text-muted-foreground">{ev.attemptCount} attempts</span>
                    )}
                  </div>
                  {ev.errorMessage && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 truncate">{ev.errorMessage}</p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {formatRelativeTime(ev.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

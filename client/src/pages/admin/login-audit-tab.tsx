import { useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export function LoginAuditTab() {
  const { data: logs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/login-audit"],
  });

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-foreground" data-testid="text-login-audit-title">Login Audit Log</h3>
      {logs && logs.length > 0 ? (
        <div className="space-y-2">
          {logs.map((log: any) => (
            <div key={log.id} className="p-3 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-between gap-3 flex-wrap" data-testid={`row-login-audit-${log.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-foreground">{log.email}</span>
                  <Badge variant={log.success ? "default" : "destructive"} data-testid={`badge-login-status-${log.id}`}>
                    {log.success ? "Success" : "Failed"}
                  </Badge>
                  <Badge variant="outline" data-testid={`badge-login-portal-${log.id}`}>{log.portal}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  <span>{new Date(log.createdAt).toLocaleString()}</span>
                  <span>IP: {log.ipAddress || "unknown"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Shield className="h-6 w-6" />}
          title="No login activity"
          description="Login attempts will appear here."
        />
      )}
    </div>
  );
}

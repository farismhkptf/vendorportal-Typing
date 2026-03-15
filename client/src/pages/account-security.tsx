import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  Monitor,
  Smartphone,
  Tablet,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatRelativeTime } from "@/lib/format-date";
import { useAuth } from "@/hooks/use-auth";

type LoginHistoryEntry = {
  id: string;
  success: boolean;
  ipAddress: string | null;
  createdAt: string;
  portal: string;
  device: {
    type: string;
    browser: string;
    browserVersion: string;
    os: string;
    osVersion: string;
  };
  isCurrentSession: boolean;
};

function DeviceIcon({ type }: { type: string }) {
  if (type === "mobile") return <Smartphone className="h-5 w-5" />;
  if (type === "tablet") return <Tablet className="h-5 w-5" />;
  return <Monitor className="h-5 w-5" />;
}

export default function AccountSecurity() {
  const { user } = useAuth();
  const { data: loginHistory, isLoading } = useQuery<LoginHistoryEntry[]>({
    queryKey: ["/api/auth/login-history"],
    enabled: !!user,
    staleTime: 0,
  });

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-xl" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground" data-testid="text-page-title">Account Security</h1>
              <p className="text-sm text-muted-foreground">Review your recent login activity</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/30">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-foreground" data-testid="text-section-title">Recent Login Activity</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Your last 10 login attempts</p>
          </div>

          {isLoading ? (
            <div className="p-5 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : !loginHistory || loginHistory.length === 0 ? (
            <div className="p-10 text-center">
              <Shield className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground" data-testid="text-empty-state">No login activity recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {loginHistory.map((entry) => (
                <div
                  key={entry.id}
                  className={`px-5 py-4 flex items-start gap-4 transition-colors ${
                    !entry.success ? "bg-red-500/5" : entry.isCurrentSession ? "bg-primary/5" : ""
                  }`}
                  data-testid={`row-login-${entry.id}`}
                >
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${
                      !entry.success
                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                        : entry.isCurrentSession
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {!entry.success ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <DeviceIcon type={entry.device.type} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground" data-testid={`text-browser-${entry.id}`}>
                        {entry.device.browser}
                        {entry.device.browserVersion ? ` ${entry.device.browserVersion.split('.')[0]}` : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">on</span>
                      <span className="text-sm text-foreground" data-testid={`text-os-${entry.id}`}>
                        {entry.device.os}
                        {entry.device.osVersion ? ` ${entry.device.osVersion}` : ""}
                      </span>

                      {entry.isCurrentSession && (
                        <Badge variant="secondary" className="text-[10px] px-2 py-0 gap-1 bg-primary/10 text-primary border-primary/20" data-testid={`badge-current-${entry.id}`}>
                          <CheckCircle2 className="h-3 w-3" />
                          This device
                        </Badge>
                      )}

                      {!entry.success && (
                        <Badge variant="destructive" className="text-[10px] px-2 py-0 gap-1" data-testid={`badge-failed-${entry.id}`}>
                          <AlertTriangle className="h-3 w-3" />
                          Failed
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      {entry.ipAddress && (
                        <span className="flex items-center gap-1" data-testid={`text-ip-${entry.id}`}>
                          <Globe className="h-3 w-3" />
                          {entry.ipAddress}
                        </span>
                      )}
                      <span className="flex items-center gap-1" data-testid={`text-time-${entry.id}`}>
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(entry.createdAt)}
                      </span>
                      <span className="text-muted-foreground/60" data-testid={`text-datetime-${entry.id}`}>
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

import { useQuery } from "@tanstack/react-query";
import { RefreshCw, CheckCircle2, XCircle, Wallet, AlertTriangle, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface WalletHealthStatus {
  active: boolean;
  passTypeIdentifier?: string;
  teamId?: string;
  passphraseConfigured?: boolean;
  missing?: string[];
  certError?: string;
}

export function SystemHealthTab() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery<WalletHealthStatus>({
    queryKey: ["/api/admin/health/wallet"],
    refetchInterval: 60000,
    retry: 1,
  });

  const isActive = data?.active === true;
  const hasCertError = !isActive && !!data?.certError;

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">System Health</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Live status of platform integrations and features</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-xl"
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          data-testid="button-refresh-health"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div
        className={`rounded-xl border p-5 ${
          isLoading
            ? "bg-muted/20 border-border/30"
            : isError
            ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
            : isActive
            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
            : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
        }`}
        data-testid="card-wallet-health"
      >
        <div className="flex items-start gap-4">
          <div
            className={`rounded-xl p-3 ${
              isLoading
                ? "bg-muted/40"
                : isError
                ? "bg-amber-100 dark:bg-amber-900/40"
                : isActive
                ? "bg-emerald-100 dark:bg-emerald-900/40"
                : "bg-red-100 dark:bg-red-900/40"
            }`}
          >
            {isError ? (
              <WifiOff className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <Wallet
                className={`h-5 w-5 ${
                  isLoading
                    ? "text-muted-foreground"
                    : isActive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-foreground">Apple Wallet</span>
              {isLoading ? (
                <Badge variant="outline" className="text-xs" data-testid="badge-wallet-status">
                  Checking…
                </Badge>
              ) : isError ? (
                <Badge
                  className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 flex items-center gap-1"
                  data-testid="badge-wallet-status"
                >
                  <WifiOff className="h-3 w-3" /> Could not check
                </Badge>
              ) : isActive ? (
                <Badge
                  className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 flex items-center gap-1"
                  data-testid="badge-wallet-status"
                >
                  <CheckCircle2 className="h-3 w-3" /> Active
                </Badge>
              ) : (
                <Badge
                  className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 flex items-center gap-1"
                  data-testid="badge-wallet-status"
                >
                  <XCircle className="h-3 w-3" /> Unavailable
                </Badge>
              )}
            </div>

            {isLoading && (
              <p className="text-sm text-muted-foreground mt-1">Verifying certificate configuration…</p>
            )}

            {isError && (
              <div className="mt-2" data-testid="wallet-fetch-error">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Unable to reach the health endpoint. You may not have permission, or the server is temporarily unavailable.
                </p>
                {error instanceof Error && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 font-mono">
                    {error.message}
                  </p>
                )}
              </div>
            )}

            {!isLoading && !isError && isActive && (
              <div className="mt-2 space-y-1" data-testid="wallet-details-active">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-40 shrink-0">Pass Type Identifier</span>
                  <code className="font-mono text-xs bg-emerald-100/60 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-300">
                    {data?.passTypeIdentifier}
                  </code>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-40 shrink-0">Team ID</span>
                  <code className="font-mono text-xs bg-emerald-100/60 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-300">
                    {data?.teamId}
                  </code>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-40 shrink-0">Private Key Passphrase</span>
                  <span className="text-sm text-foreground">
                    {data?.passphraseConfigured ? "Configured" : "Not set (unencrypted key)"}
                  </span>
                </div>
              </div>
            )}

            {!isLoading && !isError && !isActive && (
              <div className="mt-2 space-y-2" data-testid="wallet-details-inactive">
                {(data?.missing ?? []).length > 0 && (
                  <div>
                    <p className="text-sm text-red-700 dark:text-red-400 font-medium mb-1 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" /> Missing environment variables
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {data!.missing!.map((v) => (
                        <code
                          key={v}
                          className="font-mono text-xs bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded text-red-700 dark:text-red-400"
                          data-testid={`badge-missing-var-${v}`}
                        >
                          {v}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
                {hasCertError && (
                  <div>
                    <p className="text-sm text-red-700 dark:text-red-400 font-medium mb-1 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" /> Certificate error
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400 font-mono bg-red-100/60 dark:bg-red-900/20 rounded p-2">
                      {data?.certError}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

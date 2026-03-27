import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  Loader2,
  Cloud,
  CloudOff,
  ExternalLink,
  RefreshCw,
  Download,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function WorkDriveBackupSection() {
  const { toast } = useToast();

  const { data: status, isLoading: statusLoading } = useQuery<{ configured: boolean; connected: boolean; error?: string }>({
    queryKey: ["/api/workdrive/status"],
  });

  const { data: docStats, isLoading: statsLoading, refetch: refetchStats } = useQuery<{ total: number; synced: number; unsynced: number }>({
    queryKey: ["/api/workdrive/document-stats"],
  });

  const [syncResult, setSyncResult] = useState<{ total: number; synced: number; failed: number; errors: string[] } | null>(null);
  const [exportResult, setExportResult] = useState<{ fileName: string; permalink: string } | null>(null);

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/sync-all-documents"),
    onSuccess: async (res: any) => {
      const data = await res.json();
      refetchStats();
      toast({
        title: "Document Sync Complete",
        description: `${data.synced} synced, ${data.failed} failed out of ${data.total} documents.`,
      });
      setSyncResult(data);
    },
    onError: (err: any) => {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/export-data-to-workdrive"),
    onSuccess: async (res: any) => {
      const data = await res.json();
      setExportResult(data);
      toast({
        title: "Data Export Complete",
        description: `${data.fileName} uploaded to WorkDrive.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Export Failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6" data-testid="workdrive-backup-section">
      <div>
        <h3 className="text-lg font-semibold tracking-tight mb-1">Zoho WorkDrive Backup</h3>
        <p className="text-sm text-muted-foreground">
          Sync documents and export business data to Zoho WorkDrive for backup.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            {statusLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : status?.connected ? (
              <Cloud className="h-5 w-5 text-green-500" />
            ) : (
              <CloudOff className="h-5 w-5 text-red-500" />
            )}
            <span className="font-medium text-sm">Connection Status</span>
          </div>
          <p className="text-xs text-muted-foreground" data-testid="text-workdrive-status">
            {statusLoading ? "Checking..." : status?.connected ? "Connected to WorkDrive" : status?.error || "Not connected"}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-5 w-5 text-blue-500" />
            <span className="font-medium text-sm">Total Documents</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-total-documents">
            {statsLoading ? "..." : docStats?.total ?? 0}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="font-medium text-sm">Synced to WorkDrive</span>
          </div>
          <p className="text-sm" data-testid="text-synced-documents">
            <span className="text-2xl font-bold text-green-600">{statsLoading ? "..." : docStats?.synced ?? 0}</span>
            {!statsLoading && docStats && docStats.unsynced > 0 && (
              <span className="text-muted-foreground ml-2">/ {docStats.unsynced} pending</span>
            )}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <RefreshCw className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-medium text-sm">Sync All Documents</h4>
              <p className="text-xs text-muted-foreground">
                Upload all unsynced documents to WorkDrive with the Company → Applicant folder structure.
              </p>
            </div>
          </div>
          <Button
            onClick={() => { setSyncResult(null); syncMutation.mutate(); }}
            disabled={syncMutation.isPending || !status?.connected || (docStats?.unsynced === 0)}
            className="w-full"
            data-testid="button-sync-all-documents"
          >
            {syncMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing Documents...</>
            ) : docStats?.unsynced === 0 ? (
              <><CheckCircle2 className="h-4 w-4 mr-2" />All Documents Synced</>
            ) : (
              <><RefreshCw className="h-4 w-4 mr-2" />Sync {docStats?.unsynced ?? 0} Documents</>
            )}
          </Button>

          {syncResult && (
            <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm space-y-1" data-testid="sync-result">
              <p className="font-medium">
                {syncResult.synced} synced, {syncResult.failed} failed
              </p>
              {syncResult.errors.length > 0 && (
                <div className="text-xs text-destructive space-y-0.5 max-h-32 overflow-y-auto">
                  {syncResult.errors.map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <Download className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-medium text-sm">Export Business Data</h4>
              <p className="text-xs text-muted-foreground">
                Generate an Excel file with all work orders, companies, typing jobs, appointments, and vendors.
              </p>
            </div>
          </div>
          <Button
            onClick={() => { setExportResult(null); exportMutation.mutate(); }}
            disabled={exportMutation.isPending || !status?.connected}
            className="w-full"
            data-testid="button-export-data"
          >
            {exportMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exporting Data...</>
            ) : (
              <><Download className="h-4 w-4 mr-2" />Export to WorkDrive</>
            )}
          </Button>

          {exportResult && (
            <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm" data-testid="export-result">
              <p className="font-medium mb-1">{exportResult.fileName}</p>
              <a
                href={exportResult.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                data-testid="link-export-workdrive"
              >
                <ExternalLink className="h-3 w-3" />
                Open in WorkDrive
              </a>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

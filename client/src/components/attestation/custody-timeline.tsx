import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, ArrowRightLeft,
  User, Calendar, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentCustodyLog } from "@shared/schema";

const DIRECTION_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  ClientToUs: {
    label: "Client → Your Team",
    icon: ArrowDownToLine,
    color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20",
  },
  UsToVendor: {
    label: "Your Team → Vendor",
    icon: ArrowUpFromLine,
    color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20",
  },
  VendorToUs: {
    label: "Vendor → Your Team",
    icon: ArrowRightLeft,
    color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20",
  },
  UsToClient: {
    label: "Your Team → Client",
    icon: ArrowLeftRight,
    color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20",
  },
};

function formatTimestamp(ts: string | Date) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function ImageModal({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-2">
        <img src={url} alt={alt} className="w-full rounded-lg object-contain max-h-[80vh]" />
      </DialogContent>
    </Dialog>
  );
}

interface CustodyTimelineProps {
  srId: string;
  queryEndpoint?: string;
  className?: string;
}

export function CustodyTimeline({ srId, queryEndpoint, className }: CustodyTimelineProps) {
  const endpoint = queryEndpoint || `/api/attestation/sr/${srId}/custody`;
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");

  const { data: logs, isLoading } = useQuery<DocumentCustodyLog[]>({
    queryKey: [endpoint, srId],
  });

  const openLightbox = (url: string, alt: string) => {
    setLightboxUrl(url);
    setLightboxAlt(alt);
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        {[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground text-sm", className)} data-testid="custody-timeline-empty">
        No custody events recorded yet.
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)} data-testid="custody-timeline">
      {lightboxUrl && (
        <ImageModal url={lightboxUrl} alt={lightboxAlt} onClose={() => setLightboxUrl(null)} />
      )}
      {logs.map((log, idx) => {
        const config = DIRECTION_CONFIG[log.handoverDirection] || DIRECTION_CONFIG.ClientToUs;
        const Icon = config.icon;
        return (
          <div
            key={log.id}
            className="relative flex gap-3"
            data-testid={`custody-log-${log.id}`}
          >
            {idx < logs.length - 1 && (
              <div className="absolute left-5 top-10 bottom-0 w-px bg-border" />
            )}
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5", config.color)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground" data-testid={`log-direction-${log.id}`}>{config.label}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="h-3 w-3" />
                    {formatTimestamp(log.acknowledgedAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3 w-3 shrink-0" />
                <span data-testid={`log-cp-name-${log.id}`}>{log.counterpartyName}</span>
                <span>·</span>
                <span>{log.counterpartyContact}</span>
              </div>

              {log.approverName && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Approved by:</span>{" "}
                  {log.approverName} {log.approverDesignation ? `(${log.approverDesignation})` : ""} · {log.approverContact}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {log.counterpartyIdPhotoUrl && (
                  <button
                    onClick={() => openLightbox(log.counterpartyIdPhotoUrl!, "ID Photo")}
                    className="relative h-14 w-14 rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity group"
                    data-testid={`thumb-id-photo-${log.id}`}
                    title="View ID Photo"
                  >
                    <img
                      src={log.counterpartyIdPhotoUrl}
                      alt="ID"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100" />
                    </div>
                  </button>
                )}
                {log.counterpartySignatureUrl && (
                  <button
                    onClick={() => openLightbox(log.counterpartySignatureUrl!, "Counterparty Signature")}
                    className="relative h-14 w-20 rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity bg-white dark:bg-slate-900 group"
                    data-testid={`thumb-cp-sig-${log.id}`}
                    title="View Signature"
                  >
                    <img
                      src={log.counterpartySignatureUrl}
                      alt="Signature"
                      className="h-full w-full object-contain p-1"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <ExternalLink className="h-4 w-4 text-slate-700 opacity-0 group-hover:opacity-100" />
                    </div>
                  </button>
                )}
                {log.receivingStaffSignatureUrl && (
                  <button
                    onClick={() => openLightbox(log.receivingStaffSignatureUrl!, "PRO Signature")}
                    className="relative h-14 w-20 rounded-lg overflow-hidden border border-primary/40 hover:opacity-80 transition-opacity bg-white dark:bg-slate-900 group"
                    data-testid={`thumb-staff-sig-${log.id}`}
                    title="View PRO Signature"
                  >
                    <img
                      src={log.receivingStaffSignatureUrl}
                      alt="PRO Signature"
                      className="h-full w-full object-contain p-1"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <ExternalLink className="h-4 w-4 text-slate-700 opacity-0 group-hover:opacity-100" />
                    </div>
                  </button>
                )}
              </div>

              {log.receivingStaffName && (
                <div className="text-xs text-muted-foreground border-t border-border pt-1.5">
                  <span className="font-medium text-primary">Received by:</span>{" "}
                  {log.receivingStaffName}
                </div>
              )}

              {log.notes && (
                <p className="text-xs text-muted-foreground italic border-t border-border pt-1.5">{log.notes}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

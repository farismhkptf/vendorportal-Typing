import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, FileText, Building2, Stethoscope, ClipboardList, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toProperCase } from "@/lib/proper-case";

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  userId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

function getIcon(entityType: string) {
  switch (entityType) {
    case "WorkOrder": return FileText;
    case "Company": return Building2;
    case "Appointment": return Stethoscope;
    case "TypingJob": return ClipboardList;
    case "VendorWallet": return Wallet;
    default: return FileText;
  }
}

function getTimeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatAction(log: AuditLogEntry): string {
  const details = log.details as Record<string, string> | null;
  const woNumber = details?.woNumber || details?.wo_number || "";
  const name = details?.applicantName || details?.name || details?.companyName || "";
  
  switch (log.action) {
    case "created":
      return `${log.entityType} created${woNumber ? ` (${woNumber})` : name ? ` — ${toProperCase(name)}` : ""}`;
    case "updated":
      return `${log.entityType} updated${woNumber ? ` (${woNumber})` : ""}`;
    case "status_changed":
      return `Status changed to ${details?.newStatus || "unknown"}${woNumber ? ` — ${woNumber}` : ""}`;
    case "appointment_scheduled":
      return `Appointment scheduled${woNumber ? ` for ${woNumber}` : ""}`;
    case "appointment_completed":
      return `Appointment completed${woNumber ? ` — ${woNumber}` : ""}`;
    case "appointment_cancelled":
      return `Appointment cancelled${woNumber ? ` — ${woNumber}` : ""}`;
    case "typing_job_sent":
      return `Typing job sent to vendor${woNumber ? ` — ${woNumber}` : ""}`;
    case "wallet_topup":
      return `Wallet topped up${details?.amount ? ` — AED ${details.amount}` : ""}`;
    default:
      return `${log.action.replace(/_/g, " ")}${woNumber ? ` — ${woNumber}` : ""}`;
  }
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: activity } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/activity"],
    refetchInterval: 30000,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const hasItems = activity && activity.length > 0;

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className="relative"
        aria-label="Notifications"
        aria-expanded={open}
        aria-controls="notifications-panel"
        data-testid="button-notifications"
      >
        <Bell className="h-4 w-4" />
        {hasItems && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
        )}
      </Button>

      {open && (
        <div 
          id="notifications-panel"
          role="region"
          aria-label="Recent activity notifications"
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border/60 rounded-xl shadow-xl z-50 opacity-0 animate-fade-in overflow-hidden"
          data-testid="panel-notifications"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
            <h3 className="text-sm font-semibold text-foreground" data-testid="text-notifications-title">Recent Activity</h3>
            {hasItems && (
              <span className="text-xs text-muted-foreground" data-testid="text-notifications-count">{activity.length} items</span>
            )}
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {hasItems ? (
              <div className="divide-y divide-border/30">
                {activity.map((log) => {
                  const Icon = getIcon(log.entityType);
                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 px-4 py-3 hover-elevate"
                      data-testid={`notification-${log.id}`}
                    >
                      <div className="h-7 w-7 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-snug">{formatAction(log)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{getTimeAgo(log.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

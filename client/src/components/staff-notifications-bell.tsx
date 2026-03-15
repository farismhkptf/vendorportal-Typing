import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, FileText, ClipboardList, Calendar, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface StaffNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  createdAt: string;
}

function getIcon(type: string) {
  switch (type) {
    case "wo_created": return FileText;
    case "job_returned_from_vendor": return ClipboardList;
    case "appointment_tomorrow": return Calendar;
    case "wo_delayed": return AlertTriangle;
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

export function StaffNotificationsBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: notifications } = useQuery<StaffNotification[]>({
    queryKey: ["/api/staff-notifications"],
    refetchInterval: 30000,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/staff-notifications/unread-count"],
    refetchInterval: 15000,
  });

  const unreadCount = unreadData?.count || 0;

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

  async function markAllRead() {
    try {
      await apiRequest("PUT", "/api/staff-notifications/read-all");
      queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications/unread-count"] });
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  }

  async function markOneRead(id: string) {
    try {
      await apiRequest("PUT", `/api/staff-notifications/${id}/read`);
      queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications/unread-count"] });
    } catch (err) {
      console.error("Failed to mark read:", err);
    }
  }

  function handleOpen() {
    setOpen(!open);
    if (!open && unreadCount > 0) {
      markAllRead();
    }
  }

  const hasItems = notifications && notifications.length > 0;

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleOpen}
        className="relative"
        aria-label="Staff Notifications"
        aria-expanded={open}
        aria-controls="staff-notifications-panel"
        data-testid="button-staff-notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center" data-testid="badge-staff-unread-count">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          id="staff-notifications-panel"
          role="region"
          aria-label="Staff notifications"
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border/60 rounded-xl shadow-xl z-50 opacity-0 animate-fade-in overflow-hidden"
          data-testid="panel-staff-notifications"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/40">
            <h3 className="text-sm font-semibold text-foreground" data-testid="text-staff-notifications-title">Notifications</h3>
            {hasItems && (
              <span className="text-xs text-muted-foreground" data-testid="text-staff-notifications-count">{notifications.length} items</span>
            )}
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {hasItems ? (
              <div className="divide-y divide-border/30">
                {notifications.map((n) => {
                  const Icon = getIcon(n.type);
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 hover-elevate transition-colors ${!n.isRead ? "bg-primary/5" : ""}`}
                      data-testid={`staff-notification-${n.id}`}
                    >
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${n.type === "wo_delayed" ? "bg-destructive/10" : "bg-muted/60"}`}>
                        <Icon className={`h-3.5 w-3.5 ${n.type === "wo_delayed" ? "text-destructive" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-primary/80">{n.title}</p>
                        <p className="text-sm text-foreground leading-snug">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{getTimeAgo(n.createdAt)}</p>
                      </div>
                      {!n.isRead && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markOneRead(n.id); }}
                          className="shrink-0 mt-1 p-1 rounded-md hover:bg-muted/60 text-muted-foreground"
                          aria-label="Mark as read"
                          data-testid={`button-mark-read-${n.id}`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No notifications</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

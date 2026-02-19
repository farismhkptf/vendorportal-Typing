import { Link, useLocation } from "wouter";
import { LayoutDashboard, FileText, Wallet, LogOut, Bell, WifiOff, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVendorAuth } from "@/hooks/use-vendor-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useOnlineStatus } from "@/hooks/use-online-status";
import type { VendorNotification } from "@shared/schema";
import { CompanyName } from "@/components/ui/company-name";

const navItems = [
  { href: "/vendor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vendor/jobs", label: "Jobs", icon: FileText },
  { href: "/vendor/wallet", label: "Wallet", icon: Wallet },
];

export function VendorHeader() {
  const { user, logout } = useVendorAuth();
  const [location] = useLocation();
  const { isOnline, showReconnected } = useOnlineStatus();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/vendor/notifications/unread-count"],
    refetchInterval: 30000,
  });

  const { data: notifications } = useQuery<VendorNotification[]>({
    queryKey: ["/api/vendor/notifications"],
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", "/api/vendor/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/notifications/unread-count"] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PUT", `/api/vendor/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/notifications/unread-count"] });
    },
  });

  const unreadCount = unreadData?.count || 0;

  return (
    <header className="sticky top-0 z-30">
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-500/90 text-white text-xs font-medium" data-testid="banner-offline">
          <WifiOff className="h-3.5 w-3.5" />
          You're offline - showing cached data
        </div>
      )}
      {showReconnected && isOnline && (
        <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-emerald-500/90 text-white text-xs font-medium animate-in fade-in duration-300" data-testid="banner-reconnected">
          <Wifi className="h-3.5 w-3.5" />
          Back online
        </div>
      )}
      <div className="glass border-b border-border/50">
      <div className="flex h-16 items-center justify-between gap-2 px-4 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <span className="text-sm font-semibold text-white">V</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold text-foreground">Vendor Portal</h1>
              <p className="text-xs text-muted-foreground"><CompanyName /></p>
            </div>
          </div>
          
          <nav className="flex items-center gap-1 ml-4" data-testid="vendor-nav">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/vendor/dashboard" && location.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`gap-2 toggle-elevate ${isActive ? "toggle-elevated" : ""}`}
                    data-testid={`nav-${item.label.toLowerCase()}`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="flex items-center gap-2">
          <ThemeSwitcher compact />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium" data-testid="text-unread-count">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between gap-2 p-3 border-b">
                <p className="text-sm font-medium">Notifications</p>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => markAllReadMutation.mutate()} data-testid="button-mark-all-read">
                    Mark all read
                  </Button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications && notifications.length > 0 ? (
                  notifications.slice(0, 20).map((n) => (
                    <Link key={n.id} href={n.relatedJobId ? `/vendor/jobs/${n.relatedJobId}` : "#"}>
                      <div
                        className={`p-3 border-b border-border/50 hover-elevate cursor-pointer ${!n.isRead ? "bg-primary/5" : ""}`}
                        onClick={() => { if (!n.isRead) markReadMutation.mutate(n.id); }}
                        data-testid={`notification-${n.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${!n.isRead ? "font-medium" : ""}`}>{n.title}</p>
                          {!n.isRead && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ""}
                        </p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No notifications
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          {user && (
            <span className="text-sm text-muted-foreground hidden md:inline">{user.name}</span>
          )}
          <Button variant="ghost" size="icon" className="gap-2" data-testid="button-vendor-logout" onClick={() => logout()}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      </div>
    </header>
  );
}

import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LayoutDashboard, CreditCard, LogOut, Bell, Shield, Stethoscope,
  WifiOff, Wifi, ChevronRight, ArrowLeft, KeyRound, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar";
import { useVendorAuth } from "@/hooks/use-vendor-auth";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { VendorNotification, TypingJob, JobType } from "@shared/schema";
import vendorLogo from "@assets/Vendor_Logo_1771503175243.jpg";
import proLogo from "@assets/Our_Logo_transparent.png";
import { CompanyName } from "@/components/ui/company-name";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, match: "/" },
  { href: "/eid", label: "Emirates ID", icon: Shield, match: "/eid" },
  { href: "/medical", label: "Medical", icon: Stethoscope, match: "/medical" },
  { href: "/wallet", label: "Wallet", icon: CreditCard, match: "/wallet" },
];

export function VendorSidebar() {
  const { user, logout } = useVendorAuth();
  const [location] = useLocation();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const { data: jobs } = useQuery<Array<{ status: string; jobType?: { category?: string } }>>({
    queryKey: ["/api/vendor/jobs"],
  });

  const activeStatuses = ["SubmittedToVendor", "InProcess"];
  const eidActionCount = jobs?.filter(j => activeStatuses.includes(j.status) && j.jobType?.category === "EID").length || 0;
  const medActionCount = jobs?.filter(j => activeStatuses.includes(j.status) && j.jobType?.category === "Medical").length || 0;

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <img src={vendorLogo} alt={user?.vendorName || "Vendor"} className="h-10 w-10 rounded-md object-cover shrink-0" data-testid="img-vendor-logo" />
          <div className="group-data-[collapsible=icon]:hidden overflow-hidden">
            <p className="text-sm font-semibold text-sidebar-foreground truncate" data-testid="text-vendor-company-name">{user?.vendorName || "Vendor Portal"}</p>
            <p className="text-[11px] text-muted-foreground truncate">Vendor Portal</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.match === "/"
                    ? location === "/" || location === ""
                    : location.startsWith(item.match);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className="h-10 gap-3"
                    >
                      <Link href={item.href}>
                        <item.icon className="h-[18px] w-[18px]" />
                        <span className="font-medium">{item.label}</span>
                        {item.match === "/eid" && eidActionCount > 0 && (
                          <Badge variant="secondary" className="text-[10px] ml-auto px-1.5 min-w-[18px]">{eidActionCount}</Badge>
                        )}
                        {item.match === "/medical" && medActionCount > 0 && (
                          <Badge variant="secondary" className="text-[10px] ml-auto px-1.5 min-w-[18px]">{medActionCount}</Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="group-data-[collapsible=icon]:hidden">
          {user && (
            <div className="flex items-center gap-3 px-2 py-2 rounded-md bg-sidebar-accent/50 mb-2">
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-primary">
                  {user.name?.charAt(0)?.toUpperCase() || "V"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          )}
        </div>
        <div className="group-data-[collapsible=icon]:hidden flex items-center gap-2 px-3 py-2 mb-2" data-testid="section-powered-by">
          <img src={proLogo} alt="The P.R.O. Company" className="h-4 w-4 object-contain shrink-0 opacity-60" data-testid="img-powered-by-logo" />
          <p className="text-[10px] text-muted-foreground/70 truncate" data-testid="text-powered-by">Powered by <CompanyName /></p>
        </div>
        <SidebarMenu>
          {user?.isAdminViewing && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Back to Admin"
                className="h-9 gap-3 text-primary"
              >
                <a
                  href="/"
                  onClick={async (e) => {
                    e.preventDefault();
                    try {
                      await apiRequest("POST", "/api/vendor/auth/exit-to-admin");
                      queryClient.clear();
                      window.location.href = "/";
                    } catch {
                      window.location.href = "/";
                    }
                  }}
                  data-testid="button-back-to-admin"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Admin</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Try New Portal"
              className="h-9 gap-3 text-primary font-medium"
              onClick={() => { window.location.href = "/vendor-v2"; }}
              data-testid="button-try-new-portal"
            >
              <Sparkles className="h-4 w-4" />
              <span>Try New Portal</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Change Password"
              className="h-9 gap-3 text-muted-foreground"
              onClick={() => setChangePasswordOpen(true)}
            >
              <KeyRound className="h-4 w-4" />
              <span>Change Password</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign Out"
              className="h-9 gap-3 text-muted-foreground"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
        apiEndpoint="/api/vendor/auth/change-password"
      />
    </Sidebar>
  );
}

export function VendorTopBar() {
  const { isOnline, showReconnected } = useOnlineStatus();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleWindowScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleWindowScroll, { passive: true });

    const mainEl = document.querySelector("main.flex-1.overflow-y-auto");
    const handleMainScroll = () => {
      if (mainEl) setScrolled(mainEl.scrollTop > 8);
    };
    if (mainEl) {
      mainEl.addEventListener("scroll", handleMainScroll, { passive: true });
    }

    return () => {
      window.removeEventListener("scroll", handleWindowScroll);
      if (mainEl) mainEl.removeEventListener("scroll", handleMainScroll);
    };
  }, []);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/vendor/notifications/unread-count"],
    refetchInterval: 30000,
  });

  const { data: notifications } = useQuery<VendorNotification[]>({
    queryKey: ["/api/vendor/notifications"],
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => apiRequest("PUT", "/api/vendor/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/notifications/unread-count"] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PUT", `/api/vendor/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/notifications/unread-count"] });
    },
  });

  const unreadCount = unreadData?.count || 0;

  return (
    <>
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
      <header className={`sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 transition-shadow duration-300 ${scrolled ? "header-scrolled" : ""}`}>
        <div className="flex items-center gap-3">
          <SidebarTrigger data-testid="button-vendor-sidebar-toggle" />
          <div className="flex items-center gap-1.5 opacity-50" data-testid="section-topbar-branding">
            <img src={proLogo} alt="The P.R.O. Company" className="h-4 w-4 object-contain" data-testid="img-topbar-pro-logo" />
            <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline" data-testid="text-topbar-company-name"><CompanyName /></span>
          </div>
        </div>
        <div className="flex items-center gap-1">
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
                    <Link key={n.id} href={n.relatedJobId ? ((n as any).jobCategory === "Medical" ? `/medical/${n.relatedJobId}` : `/eid/${n.relatedJobId}`) : "#"}>
                      <div
                        className={`p-3 border-b border-border/50 hover-elevate cursor-pointer ${!n.readAt ? "bg-primary/5" : ""}`}
                        onClick={() => { if (!n.readAt) markReadMutation.mutate(n.id); }}
                        data-testid={`notification-${n.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${!n.readAt ? "font-medium" : ""}`}>{n.title}</p>
                          {(n as any).jobCategory && (
                            <Badge variant="secondary" className={`text-[10px] shrink-0 no-default-hover-elevate no-default-active-elevate ${(n as any).jobCategory === "EID" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"}`}>
                              {(n as any).jobCategory}
                            </Badge>
                          )}
                          {!n.readAt && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
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
        </div>
      </header>
    </>
  );
}

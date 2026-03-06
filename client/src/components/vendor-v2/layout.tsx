import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LayoutDashboard, Shield, Stethoscope, Wallet,
  Bell, Sun, Moon, LogOut, ArrowLeft, Lock, X, Check
} from "lucide-react";
import { useVendorAuth } from "@/hooks/use-vendor-auth";
import { useTheme } from "@/hooks/use-theme";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import type { VendorNotification } from "@shared/schema";
import { formatRelativeTime } from "@/lib/format-date";

interface V2LayoutProps {
  children: ReactNode;
}

function NotificationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: notifications } = useQuery<VendorNotification[]>({
    queryKey: ["/api/vendor/notifications"],
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PUT", `/api/vendor/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/notifications/unread-count"] });
    },
  });

  const unread = notifications?.filter(n => !n.isRead) || [];
  const read = notifications?.filter(n => n.isRead).slice(0, 10) || [];

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 flex flex-col" data-testid="notification-sheet">
        <div className="flex-1 overflow-y-auto glass-panel m-3 rounded-3xl p-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors" data-testid="button-close-notifications">
              <X className="h-5 w-5 text-white/70" />
            </button>
          </div>

          {unread.length > 0 && (
            <div className="space-y-2 mb-6">
              <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">New</p>
              {unread.map(n => (
                <button
                  key={n.id}
                  onClick={() => markReadMutation.mutate(n.id)}
                  className="w-full text-left p-3 rounded-2xl bg-white/10 hover:bg-white/15 transition-all group"
                  data-testid={`notification-unread-${n.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-2 w-2 rounded-full bg-blue-400 mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{n.title}</p>
                      <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[11px] text-white/40 mt-1">{formatRelativeTime(n.createdAt)}</p>
                    </div>
                    <Check className="h-4 w-4 text-white/30 group-hover:text-white/60 shrink-0 mt-1" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {read.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">Earlier</p>
              {read.map(n => (
                <div key={n.id} className="p-3 rounded-2xl bg-white/5" data-testid={`notification-read-${n.id}`}>
                  <p className="text-sm text-white/70">{n.title}</p>
                  <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{n.message}</p>
                  <p className="text-[11px] text-white/30 mt-1">{formatRelativeTime(n.createdAt)}</p>
                </div>
              ))}
            </div>
          )}

          {(!notifications || notifications.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-white/40">
              <Bell className="h-10 w-10 mb-3" />
              <p className="text-sm">No notifications yet</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function V2Layout({ children }: V2LayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useVendorAuth();
  const { theme, setTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/vendor/notifications/unread-count"],
  });

  const { data: dashData } = useQuery<any>({
    queryKey: ["/api/vendor/dashboard"],
  });

  const unreadCount = unreadData?.count || 0;
  const activeEid = dashData?.stats?.activeEid || 0;
  const activeMedical = dashData?.stats?.activeMedical || 0;

  const tabs = [
    { path: "/", icon: LayoutDashboard, label: "Home", badge: 0 },
    { path: "/eid", icon: Shield, label: "EID", badge: activeEid },
    { path: "/medical", icon: Stethoscope, label: "Medical", badge: activeMedical },
    { path: "/wallet", icon: Wallet, label: "Wallet", badge: 0 },
  ];

  const currentPath = location === "/dashboard" ? "/" : location;

  return (
    <div className="v2-portal-root" data-testid="vendor-v2-layout">
      <div className="v2-bg-layer" />

      <div className="relative z-10 flex flex-col h-screen">
        <header className="flex items-center justify-between px-5 pt-4 pb-2 lg:px-8 lg:pt-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <span className="text-white/90 font-medium text-sm hidden sm:block">
                {user?.vendorName || "Vendor Portal"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2.5 rounded-full hover:bg-white/10 transition-colors"
              data-testid="button-v2-theme-toggle"
            >
              {theme === "dark" ? (
                <Sun className="h-4.5 w-4.5 text-white/70" />
              ) : (
                <Moon className="h-4.5 w-4.5 text-white/70" />
              )}
            </button>

            <button
              onClick={() => setShowNotifications(true)}
              className="p-2.5 rounded-full hover:bg-white/10 transition-colors relative"
              data-testid="button-v2-notifications"
            >
              <Bell className="h-4.5 w-4.5 text-white/70" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 min-w-[16px] rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center px-1">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowProfile(!showProfile)}
              className="p-2.5 rounded-full hover:bg-white/10 transition-colors"
              data-testid="button-v2-profile"
            >
              <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-[11px] font-bold text-white">{user?.name?.charAt(0) || "V"}</span>
              </div>
            </button>
          </div>
        </header>

        {showProfile && (
          <div className="absolute right-4 top-16 z-50 glass-panel rounded-2xl p-4 w-64" data-testid="profile-dropdown">
            <div className="mb-3 pb-3 border-b border-white/10">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-white/50">{user?.email}</p>
            </div>
            {user?.isAdminViewing && (
              <Link href="/vendor">
                <button className="w-full flex items-center gap-2 p-2 rounded-xl text-sm text-white/70 hover:bg-white/10 transition-colors" data-testid="button-back-to-admin">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Admin
                </button>
              </Link>
            )}
            <Link href="/vendor">
              <button className="w-full flex items-center gap-2 p-2 rounded-xl text-sm text-white/70 hover:bg-white/10 transition-colors" data-testid="button-classic-portal">
                <ArrowLeft className="h-4 w-4" />
                Classic Portal
              </button>
            </Link>
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-2 p-2 rounded-xl text-sm text-red-400 hover:bg-white/10 transition-colors"
              data-testid="button-v2-logout"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 pb-24 lg:px-8 lg:pb-8">
          {children}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-30 lg:bottom-6 lg:left-1/2 lg:-translate-x-1/2 lg:w-auto lg:right-auto" data-testid="v2-bottom-nav">
          <div className="glass-nav flex items-center justify-around lg:justify-center lg:gap-1 px-2 py-2 lg:px-3 lg:rounded-2xl mx-0 lg:mx-auto">
            {tabs.map(tab => {
              const isActive = currentPath === tab.path ||
                (tab.path !== "/" && currentPath.startsWith(tab.path));
              return (
                <Link key={tab.path} href={tab.path}>
                  <button
                    className={`relative flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-xl transition-all ${
                      isActive
                        ? "text-white"
                        : "text-white/45 hover:text-white/70"
                    }`}
                    data-testid={`nav-tab-${tab.label.toLowerCase()}`}
                  >
                    {isActive && (
                      <div className="absolute inset-0 bg-white/15 rounded-xl" />
                    )}
                    <div className="relative">
                      <tab.icon className="h-5 w-5" />
                      {tab.badge > 0 && (
                        <span className="absolute -top-1.5 -right-2.5 h-4 min-w-[16px] rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center px-1">
                          {tab.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-medium relative">{tab.label}</span>
                  </button>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      <NotificationSheet open={showNotifications} onClose={() => setShowNotifications(false)} />
    </div>
  );
}

export function GlassCard({
  children,
  className = "",
  accent,
  onClick,
  ...props
}: {
  children: ReactNode;
  className?: string;
  accent?: "amber" | "red" | "blue" | "green" | "teal" | "purple";
  onClick?: () => void;
  [key: string]: any;
}) {
  const accentBorder = accent
    ? {
        amber: "border-l-amber-400/60",
        red: "border-l-red-400/60",
        blue: "border-l-blue-400/60",
        green: "border-l-emerald-400/60",
        teal: "border-l-teal-400/60",
        purple: "border-l-purple-400/60",
      }[accent]
    : "";

  return (
    <div
      className={`glass-card ${accent ? "border-l-[3px] " + accentBorder : ""} ${onClick ? "cursor-pointer hover:bg-white/[0.12] active:scale-[0.98]" : ""} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassSection({
  title,
  children,
  action,
  className = "",
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mb-6 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function GlassSkeleton({ className = "" }: { className?: string }) {
  return <div className={`glass-skeleton rounded-2xl ${className}`} />;
}

export function GlassEmpty({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center mb-4 text-white/30">
        {icon}
      </div>
      <p className="text-white/60 font-medium mb-1">{title}</p>
      <p className="text-white/40 text-sm max-w-xs">{description}</p>
    </div>
  );
}

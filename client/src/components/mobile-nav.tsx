import { useLocation } from "wouter";
import { 
  LayoutDashboard, 
  FileText, 
  Stethoscope, 
  MoreHorizontal,
  ClipboardList,
  Building2,
  Wallet,
  Settings,
  X,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";

function getDashboardHref(role?: string): string {
  if (role === "Client Relationship Manager") return "/crm";
  if (role === "PRO" || role === "PRO - Temporary") return "/medical";
  return "/";
}

function getTabsForRole(role: string | undefined, dashboardHref: string) {
  const home = { name: "Home", href: dashboardHref, icon: LayoutDashboard };
  const wos = { name: "WOs", href: "/work-orders", icon: FileText };
  const appts = { name: "Appts", href: "/appointments", icon: Stethoscope };
  const today = { name: "Today", href: "/pro/today", icon: CalendarCheck };
  const jobs = { name: "Jobs", href: "/typing-jobs", icon: ClipboardList };
  const companies = { name: "Companies", href: "/companies", icon: Building2 };
  const wallet = { name: "Wallet", href: "/vendor-wallet", icon: Wallet };
  const admin = { name: "Admin", href: "/admin", icon: Settings };

  if (role === "Admin") {
    return {
      main: [home, wos, companies, wallet, admin],
      more: [appts, jobs],
    };
  }
  if (role === "Client Relationship Manager") {
    return {
      main: [home, wos, companies, wallet, appts],
      more: [jobs],
    };
  }
  if (role === "PRO" || role === "PRO - Temporary") {
    return {
      main: [home, today, appts],
      more: [],
    };
  }
  return {
    main: [home, appts],
    more: [],
  };
}

export function MobileBottomNav() {
  const [location, navigate] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { user } = useAuth();

  if (!user) return null;
  if (location === "/vendor-v2" || location.startsWith("/vendor-v2/")) return null;

  const dashboardHref = getDashboardHref(user?.role);
  const { main: mainTabs, more: moreItems } = getTabsForRole(user?.role, dashboardHref);

  const isActive = (href: string) => {
    if (href === "/" || href === "/crm" || href === "/medical") return location === href;
    return location.startsWith(href);
  };

  const isMoreActive = moreItems.some(item => isActive(item.href));
  const hasMore = moreItems.length > 0;

  return (
    <>
      {moreOpen && (
        <div 
          className="fixed inset-0 z-[99] bg-black/20 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {moreOpen && hasMore && (
        <div className="fixed bottom-[72px] right-3 z-[100] lg:hidden opacity-0 animate-fade-in">
          <div className="bg-card border border-border/60 rounded-xl shadow-xl p-2 space-y-0.5 min-w-[180px]">
            {moreItems.map((item) => (
              <button
                key={item.href}
                onClick={() => {
                  setMoreOpen(false);
                  navigate(item.href);
                }}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover-elevate"
                )}
                data-testid={`mobile-more-${item.name.toLowerCase()}`}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <nav 
        className="fixed bottom-0 left-0 right-0 z-[98] lg:hidden bg-card/95 backdrop-blur-xl border-t border-border/40 safe-area-bottom"
        data-testid="mobile-bottom-nav"
      >
        <div className="flex items-center justify-around h-[64px] px-2">
          {mainTabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <button
                key={tab.href}
                onClick={() => {
                  setMoreOpen(false);
                  navigate(tab.href);
                }}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors min-w-[56px]",
                  active 
                    ? "text-primary" 
                    : "text-muted-foreground"
                )}
                data-testid={`mobile-tab-${tab.name.toLowerCase()}`}
              >
                <tab.icon className={cn("h-5 w-5", active && "text-primary")} />
                <span className={cn("text-[10px] font-medium", active && "text-primary")}>{tab.name}</span>
              </button>
            );
          })}
          {hasMore && (
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors min-w-[56px]",
                (moreOpen || isMoreActive) ? "text-primary" : "text-muted-foreground"
              )}
              data-testid="mobile-tab-more"
            >
              {moreOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <MoreHorizontal className="h-5 w-5" />
              )}
              <span className="text-[10px] font-medium">More</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}

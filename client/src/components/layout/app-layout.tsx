import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  FileText, 
  ClipboardList, 
  Settings, 
  Wallet,
  LogOut,
  Menu,
  X,
  Stethoscope,
  Bot,
  Building2,
  Search,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/notifications-bell";
import { useSwipeBack } from "@/hooks/use-swipe-back";
import { useAuth } from "@/hooks/use-auth";

interface AppLayoutProps {
  children: ReactNode;
}

function getDashboardHref(role?: string): string {
  if (role === "Client Relationship Manager") return "/crm";
  if (role === "Medical Assistance Support" || role === "Medical Assistance Support - Temporary Staff") return "/medical";
  return "/";
}

const allNavigation = [
  { name: "Dashboard", href: "__dashboard__", icon: LayoutDashboard, roles: null },
  { name: "Work Orders", href: "/work-orders", icon: FileText, roles: null },
  { name: "Appointments", href: "/appointments", icon: Stethoscope, roles: null },
  { name: "Typing Jobs", href: "/typing-jobs", icon: ClipboardList, roles: ["Admin", "Client Relationship Manager"] as string[] },
  { name: "Companies", href: "/companies", icon: Building2, roles: ["Admin", "Client Relationship Manager"] as string[] },
  { name: "Vendor Wallet", href: "/vendor-wallet", icon: Wallet, roles: ["Admin"] as string[] },
  { name: "Bots", href: "/bots", icon: Bot, roles: null },
  { name: "Manager Console", href: "/manager-console", icon: Shield, roles: ["Client Relationship Manager"] as string[] },
  { name: "Admin Console", href: "/admin", icon: Settings, roles: ["Admin"] as string[] },
];


export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();

  useSwipeBack();

  const dashboardHref = getDashboardHref(user?.role);
  const navigation = allNavigation
    .filter((item) => item.roles === null || (user && item.roles.includes(user.role)))
    .map((item) => item.href === "__dashboard__" ? { ...item, href: dashboardHref } : item);

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-background" data-testid="app-layout">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px] lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] transform transition-all duration-300 ease-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        data-testid="sidebar"
      >
        <div className="flex h-full flex-col bg-card/95 backdrop-blur-xl border-r border-border/40">
          <div className="flex h-[72px] items-center justify-between gap-2 px-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary via-primary to-primary/80 flex items-center justify-center shadow-sm">
                <span className="text-base font-semibold text-white">P</span>
              </div>
              <div>
                <h1 className="text-[15px] font-semibold text-foreground tracking-tight">The P.R.O. Company</h1>
                <p className="text-xs text-muted-foreground">Portal</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden rounded-xl"
              onClick={() => setSidebarOpen(false)}
              data-testid="button-close-sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location === item.href || 
                (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-medium transition-all duration-200 cursor-pointer",
                      isActive
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted-foreground hover-elevate"
                    )}
                    data-testid={`nav-${item.name.toLowerCase().replace(" ", "-")}`}
                  >
                    <item.icon className={cn("h-[18px] w-[18px]", isActive && "text-white")} />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="p-4">
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-muted/30">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                <span className="text-sm font-semibold text-primary" data-testid="text-user-initial">{userInitial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate" data-testid="text-user-name">{user?.name || "User"}</p>
                <p className="text-xs text-muted-foreground" data-testid="text-user-role">{user?.role || "Unknown"}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl text-muted-foreground"
                onClick={logout}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[280px]">
        <header className="sticky top-0 z-30 h-[72px] bg-background/80 backdrop-blur-xl border-b border-border/40">
          <div className="flex h-full items-center gap-4 px-6 lg:px-10">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden rounded-xl"
              onClick={() => setSidebarOpen(true)}
              data-testid="button-open-sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
                }}
                className="hidden sm:flex items-center gap-2 px-3 h-9 rounded-lg border border-border/50 bg-muted/30 text-muted-foreground text-sm hover-elevate transition-colors"
                data-testid="button-search-trigger"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Search...</span>
                <kbd className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted border border-border/50">
                  {navigator.platform?.includes("Mac") ? "\u2318" : "Ctrl"}K
                </kbd>
              </button>
              <NotificationsBell />
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-72px)] pb-20 lg:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}

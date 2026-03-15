import { ReactNode, useState, useEffect, useRef } from "react";
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
  Building2,
  Search,
  BarChart3,
  KeyRound,
  Clock,
  Shield,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { NotificationsBell } from "@/components/notifications-bell";
import { StaffNotificationsBell } from "@/components/staff-notifications-bell";
import { ThemeSwitcher, getBackgroundSrc } from "@/components/theme-switcher";
import { useSwipeBack } from "@/hooks/use-swipe-back";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import proLogo from "@assets/Our_Logo_transparent.png";
import { CompanyName } from "@/components/ui/company-name";
import { InstallPromptBanner } from "@/components/install-prompt-banner";
import { useOpenShortcutsModal } from "@/components/keyboard-shortcuts-modal";

interface AppLayoutProps {
  children: ReactNode;
}

function getDashboardHref(role?: string): string {
  if (role === "Client Relationship Manager") return "/crm";
  if (role === "Medical Support" || role === "Medical Support - Temporary") return "/medical";
  return "/";
}

const allNavigation = [
  { name: "Dashboard", href: "__dashboard__", icon: LayoutDashboard, roles: null },
  { name: "Work Orders", href: "/work-orders", icon: FileText, roles: ["Admin", "Client Relationship Manager"] as string[] },
  { name: "Appointments", href: "/appointments", icon: Stethoscope, roles: null },
  { name: "Typing Jobs", href: "/typing-jobs", icon: ClipboardList, roles: ["Admin", "Client Relationship Manager"] as string[] },
  { name: "Companies", href: "/companies", icon: Building2, roles: ["Admin", "Client Relationship Manager"] as string[] },
  { name: "Vendor Wallet", href: "/vendor-wallet", icon: Wallet, roles: ["Admin", "Client Relationship Manager"] as string[] },
  { name: "Reports", href: "/reports", icon: BarChart3, roles: ["Admin", "Client Relationship Manager"] as string[] },
  { name: "Expiring Docs", href: "/expiring-documents", icon: Clock, roles: ["Admin", "Client Relationship Manager"] as string[] },
  { name: "Admin Console", href: "/admin", icon: Settings, roles: ["Admin"] as string[] },
];


export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  useSwipeBack();
  const openShortcuts = useOpenShortcutsModal();

  const mainRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const main = mainRef.current?.parentElement;
    if (!main) return;
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const dashboardHref = getDashboardHref(user?.role);
  const navigation = allNavigation
    .filter((item) => item.roles === null || (user && item.roles.includes(user.role)))
    .map((item) => item.href === "__dashboard__" ? { ...item, href: dashboardHref } : item);

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "U";
  const { background } = useTheme();
  const bgSrc = getBackgroundSrc(background);
  const hasBg = background !== "none" && !!bgSrc;

  return (
    <div className={cn("min-h-screen", hasBg ? "bg-background/80" : "bg-background")} data-testid="app-layout">
      {hasBg && (
        <div className="fixed inset-0 z-0" data-testid="app-background">
          <img
            src={bgSrc!}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-background/70 dark:bg-background/80 backdrop-blur-sm" />
        </div>
      )}
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
              <img src={proLogo} alt="The P.R.O. Company" className="h-9 w-9 rounded-xl object-contain shrink-0" data-testid="img-pro-logo" />
              <div>
                <h1 className="text-[15px] font-semibold text-foreground tracking-tight"><CompanyName /></h1>
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
                        ? "bg-primary text-primary-foreground shadow-sm nav-item-active-pill"
                        : "text-muted-foreground hover-elevate"
                    )}
                    data-testid={`nav-${item.name.toLowerCase().replace(" ", "-")}`}
                  >
                    <item.icon className={cn("h-[18px] w-[18px]", isActive && "text-primary-foreground")} />
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
              <div className="flex items-center gap-1">
                <Link href="/account/security">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl text-muted-foreground"
                    data-testid="button-account-security"
                  >
                    <Shield className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl text-muted-foreground"
                  onClick={() => setChangePasswordOpen(true)}
                  data-testid="button-change-password"
                >
                  <KeyRound className="h-4 w-4" />
                </Button>
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
        </div>
      </aside>

      <div className="lg:pl-[280px] relative z-[1]">
        <header ref={mainRef} className={cn("sticky top-0 z-30 h-[72px] bg-background/80 backdrop-blur-xl border-b border-border/40 transition-shadow duration-300", scrolled && "header-scrolled")}>
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
                  document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", ctrlKey: true }));
                }}
                className="hidden sm:flex items-center gap-2 px-3.5 h-9 rounded-xl border border-border/40 bg-muted/20 text-muted-foreground text-sm transition-all duration-200 hover:bg-muted/40 hover:border-border/60 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring/30"
                data-testid="button-search-trigger"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Search...</span>
                <kbd className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-muted/60 border border-border/40">
                  Ctrl Space
                </kbd>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl text-muted-foreground"
                onClick={openShortcuts}
                data-testid="button-keyboard-shortcuts"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
              <ThemeSwitcher compact />
              <StaffNotificationsBell />
              <NotificationsBell />
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-72px)] pb-20 lg:pb-0">
          {children}
        </main>
      </div>
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
        apiEndpoint="/api/auth/change-password"
      />
      <InstallPromptBanner />
    </div>
  );
}

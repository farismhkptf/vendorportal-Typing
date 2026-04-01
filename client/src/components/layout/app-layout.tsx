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
  HelpCircle,
  FileCheck,
  Stamp,
  PackageCheck,
  ChevronDown,
  MessageSquare,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { StaffNotificationsBell } from "@/components/staff-notifications-bell";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useSwipeBack } from "@/hooks/use-swipe-back";
import { useAuth } from "@/hooks/use-auth";
import proLogo from "@assets/Our_Logo_transparent.png";
import { CompanyName } from "@/components/ui/company-name";
import { InstallPromptBanner } from "@/components/install-prompt-banner";
import { useOpenShortcutsModal } from "@/components/keyboard-shortcuts-modal";

interface AppLayoutProps {
  children: ReactNode;
}

function getDashboardHref(role?: string): string {
  if (role === "Client Relationship Manager") return "/crm";
  if (role === "PRO" || role === "PRO - Temporary") return "/medical";
  return "/";
}

const allNavigation = [
  { name: "Dashboard", href: "__dashboard__", icon: LayoutDashboard, roles: null, group: null },
  { name: "Work Orders", href: "/work-orders", icon: FileText, roles: ["Admin", "Client Relationship Manager"] as string[], group: "Operations" },
  { name: "Appointments", href: "/appointments", icon: Stethoscope, roles: null, group: "Operations" },
  { name: "Typing Jobs", href: "/typing-jobs", icon: ClipboardList, roles: ["Admin", "Client Relationship Manager"] as string[], group: "Operations" },
  { name: "Attestation", href: "/attestation/inquiries", icon: Stamp, roles: ["Admin", "Client Relationship Manager"] as string[], group: "Operations" },
  { name: "Attestation SRs", href: "/attestation-sr", icon: FileCheck, roles: ["Admin", "Client Relationship Manager"] as string[], group: "Operations" },
  { name: "Companies", href: "/companies", icon: Building2, roles: ["Admin", "Client Relationship Manager"] as string[], group: "Management" },
  { name: "Vendor Wallet", href: "/vendor-wallet", icon: Wallet, roles: ["Admin", "Client Relationship Manager"] as string[], group: "Management" },
  { name: "Reports", href: "/reports", icon: BarChart3, roles: ["Admin", "Client Relationship Manager"] as string[], group: "Management" },
  { name: "Expiring Docs", href: "/expiring-documents", icon: Clock, roles: ["Admin", "Client Relationship Manager"] as string[], group: "Management" },
  { name: "Doc Custody", href: "/custody-queue", icon: PackageCheck, roles: ["Admin", "Client Relationship Manager", "PRO", "PRO - Temporary"] as string[], group: "Management" },
  { name: "Messages", href: "/messages", icon: MessageSquare, roles: ["Admin", "Client Relationship Manager"] as string[], group: "Management" },
  { name: "Admin Console", href: "/admin", icon: Settings, roles: ["Admin"] as string[], group: "Admin" },
];


type NavItem = typeof allNavigation[number];
type NavGroup = { label: string | null; items: NavItem[] };

function buildNavGroups(items: NavItem[]): NavGroup[] {
  const groups: NavGroup[] = [];
  for (const item of items) {
    const label = item.group ?? null;
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }
  return groups;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 60000,
    enabled: !!user && ["Admin", "Client Relationship Manager"].includes(user.role ?? ""),
  });
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

          <nav className="flex-1 px-3 py-3 overflow-y-auto">
            {buildNavGroups(navigation).map((group, gi) => (
              <div key={gi} className={gi > 0 ? "mt-4" : ""}>
                {group.label && (
                  <p className="px-3 mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 select-none">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = location === item.href ||
                      (item.href !== "/" && location.startsWith(item.href));
                    const msgCount = item.href === "/messages" ? (unreadData?.count ?? 0) : 0;
                    return (
                      <Link key={item.name} href={item.href}>
                        <div
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 cursor-pointer",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-sm nav-item-active-pill"
                              : "text-muted-foreground hover-elevate"
                          )}
                          data-testid={`nav-${item.name.toLowerCase().replace(" ", "-")}`}
                        >
                          <item.icon className={cn("h-[16px] w-[16px] shrink-0", isActive && "text-primary-foreground")} />
                          <span className="flex-1">{item.name}</span>
                          {msgCount > 0 && (
                            <span className={cn(
                              "text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                              isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-amber-500 text-white"
                            )}>
                              {msgCount > 99 ? "99+" : msgCount}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="px-3 pb-3">
            <div className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center ring-1 ring-primary/10 shrink-0">
                <span className="text-xs font-semibold text-primary" data-testid="text-user-initial">{userInitial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground truncate leading-tight" data-testid="text-user-name">{user?.name || "User"}</p>
                <p className="text-[11px] text-muted-foreground leading-tight" data-testid="text-user-role">{user?.role || "Unknown"}</p>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href="/account/security">
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground" data-testid="button-account-security">
                    <Shield className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground" onClick={() => setChangePasswordOpen(true)} data-testid="button-change-password">
                  <KeyRound className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground" onClick={logout} data-testid="button-logout">
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[280px] relative z-[1]">
        <header ref={mainRef} data-sticky-header className={cn("sticky top-0 z-30 h-[72px] bg-background/80 backdrop-blur-xl border-b border-border/40 transition-shadow duration-300", scrolled && "header-scrolled")}>
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
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden rounded-xl text-muted-foreground"
                onClick={() => {
                  document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", ctrlKey: true }));
                }}
                data-testid="button-search-mobile"
              >
                <Search className="h-4 w-4" />
              </Button>
              <button
                onClick={() => {
                  document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", ctrlKey: true }));
                }}
                className="hidden sm:flex items-center gap-2 px-3.5 h-9 rounded-xl border border-border/40 bg-muted/20 text-muted-foreground text-sm transition-all duration-200 hover:bg-muted/40 hover:border-border/60 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring/30"
                data-testid="button-search-trigger"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Search or jump to...</span>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-muted/60 transition-colors focus-visible:ring-2 focus-visible:ring-ring/30"
                    data-testid="button-user-menu"
                  >
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                      <span className="text-xs font-semibold text-primary">{userInitial}</span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-xl" data-testid="menu-user-dropdown">
                  <div className="px-3 py-2 border-b border-border/40">
                    <p className="text-sm font-medium text-foreground truncate">{user?.name || "User"}</p>
                    <p className="text-xs text-muted-foreground">{user?.role || ""}</p>
                  </div>
                  <Link href="/account/security">
                    <DropdownMenuItem className="gap-2 cursor-pointer" data-testid="menu-item-account-security">
                      <Shield className="h-4 w-4" />
                      Account Security
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer"
                    onClick={() => setChangePasswordOpen(true)}
                    data-testid="menu-item-change-password"
                  >
                    <KeyRound className="h-4 w-4" />
                    Change Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                    onClick={logout}
                    data-testid="menu-item-logout"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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

import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  FileText, 
  Calendar, 
  Settings, 
  Wallet,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Work Orders", href: "/work-orders", icon: FileText },
  { name: "Typing Jobs", href: "/typing-jobs", icon: Calendar },
  { name: "Vendor Wallet", href: "/vendor-wallet", icon: Wallet },
  { name: "Admin Console", href: "/admin", icon: Settings },
];


export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background" data-testid="app-layout">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px] lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] transform transition-all duration-300 ease-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        data-testid="sidebar"
      >
        <div className="flex h-full flex-col bg-card/95 backdrop-blur-xl border-r border-border/40">
          {/* Logo */}
          <div className="flex h-[72px] items-center justify-between px-6">
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

          {/* Navigation */}
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
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
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

          {/* User section */}
          <div className="p-4">
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-muted/30">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                <span className="text-sm font-semibold text-primary">A</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">Admin User</p>
                <p className="text-xs text-muted-foreground">Admin</p>
              </div>
              <Link href="/login">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground" data-testid="button-logout">
                  <LogOut className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-[280px]">
        {/* Top header */}
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
            {/* Help widget */}
            <Button 
              variant="outline" 
              className="rounded-full px-4 h-10 text-sm font-medium gap-2 border-border/60 shadow-sm"
              data-testid="button-help"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Ask Ainoo
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-[calc(100vh-72px)]">
          {children}
        </main>
      </div>
    </div>
  );
}

import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  FileText, 
  Building2, 
  Users, 
  Calendar, 
  Settings, 
  Wallet,
  LogOut,
  Menu,
  X,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Work Orders", href: "/work-orders", icon: FileText },
  { name: "Companies", href: "/companies", icon: Building2 },
  { name: "Typing Jobs", href: "/typing-jobs", icon: Calendar },
  { name: "Vendor Wallet", href: "/vendor-wallet", icon: Wallet },
  { name: "Admin", href: "/admin", icon: Settings },
];

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background" data-testid="app-layout">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        data-testid="sidebar"
      >
        <div className="flex h-full flex-col glass-strong">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                <span className="text-sm font-semibold text-white">P</span>
              </div>
              <div>
                <h1 className="text-sm font-semibold text-foreground">The P.R.O. Company</h1>
                <p className="text-xs text-muted-foreground">Portal</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
              data-testid="button-close-sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location === item.href || 
                (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover-elevate"
                    )}
                    data-testid={`nav-${item.name.toLowerCase().replace(" ", "-")}`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                    {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-border/50">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/50">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">A</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">Admin User</p>
                <p className="text-xs text-muted-foreground">Admin</p>
              </div>
              <Link href="/login">
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-logout">
                  <LogOut className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top header */}
        <header className="sticky top-0 z-30 h-16 glass border-b border-border/50">
          <div className="flex h-full items-center gap-4 px-4 lg:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              data-testid="button-open-sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1" />
            {/* Floating help widget placeholder */}
            <Button 
              variant="outline" 
              className="glass rounded-full px-4 py-2 text-sm font-medium gap-2"
              data-testid="button-help"
            >
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Ask Ainoo
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}

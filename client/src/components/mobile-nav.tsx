import { useLocation } from "wouter";
import { 
  LayoutDashboard, 
  FileText, 
  Stethoscope, 
  MoreHorizontal,
  ClipboardList,
  Building2,
  Wallet,
  Bot,
  Settings,
  Users,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const MAIN_TABS = [
  { name: "Home", href: "/", icon: LayoutDashboard },
  { name: "WOs", href: "/work-orders", icon: FileText },
  { name: "Appts", href: "/appointments", icon: Stethoscope },
  { name: "Jobs", href: "/typing-jobs", icon: ClipboardList },
];

const MORE_ITEMS = [
  { name: "Companies", href: "/companies", icon: Building2 },
  { name: "Staff", href: "/staff", icon: Users },
  { name: "Wallet", href: "/vendor-wallet", icon: Wallet },
  { name: "Bots", href: "/bots", icon: Bot },
  { name: "Admin", href: "/admin", icon: Settings },
];

export function MobileBottomNav() {
  const [location, navigate] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  const isMoreActive = MORE_ITEMS.some(item => isActive(item.href));

  return (
    <>
      {moreOpen && (
        <div 
          className="fixed inset-0 z-[99] bg-black/20 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {moreOpen && (
        <div className="fixed bottom-[72px] right-3 z-[100] lg:hidden opacity-0 animate-fade-in">
          <div className="bg-card border border-border/60 rounded-xl shadow-xl p-2 space-y-0.5 min-w-[180px]">
            {MORE_ITEMS.map((item) => (
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
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
          {MAIN_TABS.map((tab) => {
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
        </div>
      </nav>
    </>
  );
}

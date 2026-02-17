import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Briefcase, Stethoscope, Store } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const views = [
  { key: "admin", label: "Admin", icon: LayoutDashboard, href: "/" },
  { key: "crm", label: "CRM", icon: Briefcase, href: "/crm" },
  { key: "medical", label: "Medical", icon: Stethoscope, href: "/medical" },
  { key: "vendor", label: "Vendor", icon: Store, href: "/vendor/dashboard" },
] as const;

type ViewKey = (typeof views)[number]["key"];

export function DashboardSwitcher({ active }: { active: ViewKey }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [entering, setEntering] = useState(false);

  if (user?.role !== "Admin") return null;

  async function handleVendorSwitch() {
    setEntering(true);
    try {
      await apiRequest("POST", "/api/auth/enter-vendor-portal");
      navigate("/vendor/dashboard");
    } catch {
      toast({
        title: "No vendor accounts",
        description: "Create a vendor account first to access the vendor portal.",
        variant: "destructive",
      });
    } finally {
      setEntering(false);
    }
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/60 dark:bg-muted/30"
      data-testid="dashboard-switcher"
    >
      {views.map((view) => {
        const isActive = view.key === active;
        const isVendor = view.key === "vendor";
        return (
          <Button
            key={view.key}
            variant="ghost"
            size="sm"
            disabled={isVendor && entering}
            onClick={() => {
              if (isActive) return;
              if (isVendor) {
                handleVendorSwitch();
              } else {
                navigate(view.href);
              }
            }}
            className={`gap-1.5 toggle-elevate ${isActive ? "toggle-elevated bg-background shadow-sm" : ""}`}
            data-testid={`button-switch-${view.key}`}
          >
            <view.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{view.label}</span>
          </Button>
        );
      })}
    </div>
  );
}

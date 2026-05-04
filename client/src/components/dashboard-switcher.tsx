import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Briefcase, Stethoscope, Store, Stamp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const views = [
  { key: "admin", label: "Admin", icon: LayoutDashboard, href: "/" },
  { key: "crm", label: "CRM", icon: Briefcase, href: "/crm" },
  { key: "medical", label: "Medical", icon: Stethoscope, href: "/medical" },
  { key: "vendor", label: "Vendor", icon: Store, href: "/vendor" },
  { key: "attestation", label: "Attestation", icon: Stamp, href: "/vendor-attestation" },
] as const;

type ViewKey = (typeof views)[number]["key"];

export function DashboardSwitcher({ active }: { active: ViewKey }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [entering, setEntering] = useState(false);

  if (user?.role !== "Admin" && user?.role !== "Client Relationship Manager") return null;

  async function handleVendorSwitch() {
    setEntering(true);
    try {
      await apiRequest("POST", "/api/auth/enter-vendor-portal");
      window.location.href = "/vendor";
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

  async function handleAttestationSwitch() {
    setEntering(true);
    try {
      await apiRequest("POST", "/api/auth/enter-attestation-portal");
      window.location.href = "/vendor-attestation";
    } catch {
      toast({
        title: "No attestation vendors",
        description: "Create an attestation vendor account first to access the portal.",
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
        const isPortalSwitch = view.key === "vendor" || view.key === "attestation";
        return (
          <Button
            key={view.key}
            variant="ghost"
            size="sm"
            disabled={isPortalSwitch && entering}
            onClick={() => {
              if (isActive) return;
              if (view.key === "vendor") {
                handleVendorSwitch();
              } else if (view.key === "attestation") {
                handleAttestationSwitch();
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

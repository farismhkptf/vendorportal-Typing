import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Briefcase, Stethoscope } from "lucide-react";

const views = [
  { key: "admin", label: "Admin", icon: LayoutDashboard, href: "/" },
  { key: "crm", label: "CRM", icon: Briefcase, href: "/crm" },
  { key: "medical", label: "Medical", icon: Stethoscope, href: "/medical" },
] as const;

type ViewKey = (typeof views)[number]["key"];

export function DashboardSwitcher({ active }: { active: ViewKey }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  if (user?.role !== "Admin") return null;

  return (
    <div
      className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/60 dark:bg-muted/30"
      data-testid="dashboard-switcher"
    >
      {views.map((view) => {
        const isActive = view.key === active;
        return (
          <Button
            key={view.key}
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!isActive) navigate(view.href);
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

import { useTheme, type ThemeName } from "@/hooks/use-theme";
import { Sun, Moon, Monitor, Zap, Mountain, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const themes: { id: ThemeName; label: string; icon: typeof Zap; description: string; previewColors: [string, string, string] }[] = [
  {
    id: "default",
    label: "Classic",
    icon: Monitor,
    description: "Indigo & cool grays",
    previewColors: ["#4f46e5", "#f0f2f5", "#ffffff"],
  },
  {
    id: "cyber",
    label: "Neon Cyber",
    icon: Zap,
    description: "Electric cyan & midnight",
    previewColors: ["#00b8d4", "#f0f4f8", "#0d1520"],
  },
  {
    id: "desert",
    label: "Desert Sand",
    icon: Mountain,
    description: "Terracotta & warm earth",
    previewColors: ["#d2691e", "#f5f0eb", "#1a1410"],
  },
  {
    id: "ocean",
    label: "Ocean Breeze",
    icon: Waves,
    description: "Teal & seafoam",
    previewColors: ["#2e8b82", "#f0f5f4", "#0e1a18"],
  },
];

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, mode, setTheme, toggleMode } = useTheme();

  const currentTheme = themes.find((t) => t.id === theme) || themes[0];
  const CurrentIcon = currentTheme.icon;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "default"}
          data-testid="button-theme-switcher"
        >
          <CurrentIcon className="h-4 w-4" />
          {!compact && <span className="ml-1.5 text-sm">Theme</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3" data-testid="popover-theme-switcher">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Appearance</p>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMode}
              data-testid="button-toggle-dark-mode"
              className="gap-1.5"
            >
              {mode === "light" ? (
                <>
                  <Sun className="h-3.5 w-3.5" />
                  <span className="text-xs">Light</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5" />
                  <span className="text-xs">Dark</span>
                </>
              )}
            </Button>
          </div>

          <div className="space-y-1">
            {themes.map((t) => {
              const Icon = t.icon;
              const isActive = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  data-testid={`button-theme-${t.id}`}
                  className={`w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "hover-elevate"
                  }`}
                >
                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.previewColors.map((c, i) => (
                      <div
                        key={i}
                        className="h-4 w-4 rounded-full border border-border/50"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-sm font-medium truncate">{t.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

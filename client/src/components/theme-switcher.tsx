import { useTheme, type ThemeName } from "@/hooks/use-theme";
import { Sun, Moon, Zap, Mountain, Waves, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const themes: { id: ThemeName; label: string; icon: typeof Zap; colors: [string, string] }[] = [
  { id: "default", label: "Classic", icon: Palette, colors: ["#4f46e5", "#818cf8"] },
  { id: "cyber", label: "Neon Cyber", icon: Zap, colors: ["#00b8d4", "#06d6a0"] },
  { id: "desert", label: "Desert Sand", icon: Mountain, colors: ["#d2691e", "#e8a54b"] },
  { id: "ocean", label: "Ocean Breeze", icon: Waves, colors: ["#2e8b82", "#5ec4b6"] },
];

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, mode, setTheme, toggleMode } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-theme-switcher"
          aria-label="Change theme"
        >
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" data-testid="menu-theme-switcher">
        {themes.map((t) => {
          const Icon = t.icon;
          const isActive = theme === t.id;
          return (
            <DropdownMenuItem
              key={t.id}
              onClick={() => setTheme(t.id)}
              data-testid={`button-theme-${t.id}`}
              className="gap-2.5 cursor-pointer"
            >
              <div className="flex items-center gap-1 shrink-0">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: t.colors[0] }} />
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: t.colors[1] }} />
              </div>
              <span className="flex-1 text-sm">{t.label}</span>
              {isActive && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={toggleMode}
          data-testid="button-toggle-dark-mode"
          className="gap-2.5 cursor-pointer"
        >
          {mode === "light" ? (
            <>
              <Moon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-sm">Dark Mode</span>
            </>
          ) : (
            <>
              <Sun className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-sm">Light Mode</span>
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

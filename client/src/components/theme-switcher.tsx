import { useTheme, type ThemeName, type BackgroundName } from "@/hooks/use-theme";
import { Sun, Moon, Zap, Mountain, Waves, Palette, Image, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import auroraBg from "@/assets/backgrounds/aurora.png";
import silkBg from "@/assets/backgrounds/silk.png";
import emberBg from "@/assets/backgrounds/ember.png";
import midnightBg from "@/assets/backgrounds/midnight.png";
import prismBg from "@/assets/backgrounds/prism.png";
import duskBg from "@/assets/backgrounds/dusk.png";
import mossBg from "@/assets/backgrounds/moss.png";
import arcticBg from "@/assets/backgrounds/arctic.png";

const themes: { id: ThemeName; label: string; icon: typeof Zap; colors: [string, string] }[] = [
  { id: "default", label: "Classic", icon: Palette, colors: ["#4f46e5", "#818cf8"] },
  { id: "cyber", label: "Neon Cyber", icon: Zap, colors: ["#00b8d4", "#06d6a0"] },
  { id: "desert", label: "Desert Sand", icon: Mountain, colors: ["#d2691e", "#e8a54b"] },
  { id: "ocean", label: "Ocean Breeze", icon: Waves, colors: ["#2e8b82", "#5ec4b6"] },
];

export const backgrounds: { id: BackgroundName; label: string; src: string | null }[] = [
  { id: "aurora", label: "Aurora", src: auroraBg },
  { id: "silk", label: "Silk", src: silkBg },
  { id: "ember", label: "Ember", src: emberBg },
  { id: "midnight", label: "Midnight", src: midnightBg },
  { id: "prism", label: "Prism", src: prismBg },
  { id: "dusk", label: "Dusk", src: duskBg },
  { id: "moss", label: "Moss", src: mossBg },
  { id: "arctic", label: "Arctic", src: arcticBg },
];

export function getBackgroundSrc(bg: BackgroundName): string | null {
  if (bg === "none") return null;
  return backgrounds.find(b => b.id === bg)?.src || null;
}

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, mode, background, setTheme, toggleMode, setBackground } = useTheme();

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
      <DropdownMenuContent align="end" className="w-56" data-testid="menu-theme-switcher">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">Color Theme</DropdownMenuLabel>
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
        <DropdownMenuLabel className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
          <Image className="h-3 w-3" />
          Background
        </DropdownMenuLabel>
        <div className="px-2 pb-1.5">
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => setBackground("none")}
              className={cn(
                "relative h-10 rounded-md border-2 transition-all flex items-center justify-center bg-muted/50",
                background === "none"
                  ? "border-primary ring-1 ring-primary/30"
                  : "border-transparent hover:border-muted-foreground/20"
              )}
              data-testid="button-bg-none"
              title="No background"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {backgrounds.map((bg) => (
              <button
                key={bg.id}
                onClick={() => setBackground(bg.id)}
                className={cn(
                  "relative h-10 rounded-md border-2 transition-all overflow-hidden group",
                  background === bg.id
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-transparent hover:border-muted-foreground/20"
                )}
                data-testid={`button-bg-${bg.id}`}
                title={bg.label}
              >
                {bg.src && (
                  <img
                    src={bg.src}
                    alt={bg.label}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </button>
            ))}
          </div>
        </div>

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

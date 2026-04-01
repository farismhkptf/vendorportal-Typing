import { useTheme } from "@/hooks/use-theme";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DarkModeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, toggleMode } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleMode}
      data-testid="button-toggle-dark-mode"
      aria-label={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
      {mode === "light" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </Button>
  );
}

export { DarkModeToggle as ThemeSwitcher };

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

export type ThemeName = "default" | "cyber" | "desert" | "ocean" | "apple";
export type ThemeMode = "light" | "dark";
export type BackgroundName = "none" | "aurora" | "silk" | "ember" | "midnight" | "prism" | "dusk" | "moss" | "arctic";

interface ThemeContextValue {
  theme: ThemeName;
  mode: ThemeMode;
  background: BackgroundName;
  setTheme: (theme: ThemeName) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setBackground: (bg: BackgroundName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = "pro-app-theme";
const MODE_KEY = "pro-app-mode";
const BG_KEY = "pro-app-background";
const PRE_APPLE_MODE_KEY = "pro-app-pre-apple-mode";

function applyThemeToDOM(theme: ThemeName, mode: ThemeMode) {
  const root = document.documentElement;

  root.classList.remove("theme-cyber", "theme-desert", "theme-ocean", "theme-apple");
  if (theme !== "default") {
    root.classList.add(`theme-${theme}`);
  }

  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return (saved as ThemeName) || "default";
  });

  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const [background, setBackgroundState] = useState<BackgroundName>(() => {
    const saved = localStorage.getItem(BG_KEY);
    return (saved as BackgroundName) || "none";
  });

  const prevThemeRef = useRef<ThemeName>(theme);

  useEffect(() => {
    const effectiveMode = theme === "apple" ? "dark" : mode;
    applyThemeToDOM(theme, effectiveMode);
  }, [theme, mode]);

  useEffect(() => {
    const root = document.documentElement;
    if (background !== "none") {
      root.setAttribute("data-background", background);
    } else {
      root.removeAttribute("data-background");
    }
  }, [background]);

  const setTheme = useCallback((t: ThemeName) => {
    const prev = prevThemeRef.current;
    prevThemeRef.current = t;

    if (t === "apple") {
      const currentMode = localStorage.getItem(MODE_KEY) || "light";
      localStorage.setItem(PRE_APPLE_MODE_KEY, currentMode);
    } else if (prev === "apple") {
      const savedPreApple = localStorage.getItem(PRE_APPLE_MODE_KEY);
      if (savedPreApple === "dark" || savedPreApple === "light") {
        setModeState(savedPreApple);
        localStorage.setItem(MODE_KEY, savedPreApple);
      }
    }

    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    if (theme === "apple") return;
    setModeState(m);
    localStorage.setItem(MODE_KEY, m);
  }, [theme]);

  const toggleMode = useCallback(() => {
    if (theme === "apple") return;
    setModeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem(MODE_KEY, next);
      return next;
    });
  }, [theme]);

  const setBackground = useCallback((bg: BackgroundName) => {
    setBackgroundState(bg);
    localStorage.setItem(BG_KEY, bg);
  }, []);

  const effectiveMode: ThemeMode = theme === "apple" ? "dark" : mode;

  return (
    <ThemeContext.Provider value={{ theme, mode: effectiveMode, background, setTheme, setMode, toggleMode, setBackground }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

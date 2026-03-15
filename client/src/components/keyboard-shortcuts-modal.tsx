import { useEffect, useState, useCallback, createContext, useContext } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { KEYBOARD_SHORTCUTS } from "@/lib/keyboard-shortcuts";

type ShortcutsModalContextType = { open: () => void };
const ShortcutsModalContext = createContext<ShortcutsModalContextType>({ open: () => {} });

export function useOpenShortcutsModal() {
  const ctx = useContext(ShortcutsModalContext);
  return ctx.open;
}

export function KeyboardShortcutsModal({ children }: { children?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = useCallback(() => setIsOpen(true), []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.repeat) return;
    const target = e.target as HTMLElement;
    const tag = target.tagName;
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      target.isContentEditable
    ) {
      return;
    }
    if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setIsOpen(true);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <ShortcutsModalContext.Provider value={{ open: openModal }}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="sm:max-w-[560px] max-h-[80vh] overflow-y-auto"
          data-testid="dialog-keyboard-shortcuts"
        >
          <DialogHeader>
            <DialogTitle data-testid="text-shortcuts-title">Keyboard Shortcuts</DialogTitle>
            <DialogDescription>
              Quick reference for all available keyboard shortcuts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            {KEYBOARD_SHORTCUTS.map((category) => (
              <div key={category.name}>
                <h3
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3"
                  data-testid={`text-shortcut-category-${category.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {category.name}
                </h3>
                <div className="space-y-2">
                  {category.shortcuts.map((shortcut, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-1.5"
                      data-testid={`row-shortcut-${category.name.toLowerCase().replace(/\s+/g, "-")}-${idx}`}
                    >
                      <span className="text-sm text-foreground">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 ml-4">
                        {shortcut.keys.map((key, kidx) => (
                          <span key={kidx}>
                            {kidx > 0 && (
                              <span className="text-muted-foreground text-xs mx-0.5">+</span>
                            )}
                            <kbd
                              className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md text-xs font-mono font-medium bg-muted/60 border border-border/60 text-foreground"
                              data-testid={`kbd-${key.toLowerCase()}`}
                            >
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </ShortcutsModalContext.Provider>
  );
}

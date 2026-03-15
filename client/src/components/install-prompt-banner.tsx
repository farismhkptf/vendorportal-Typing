import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

export function InstallPromptBanner() {
  const { isInstallable, promptInstall, dismiss } = useInstallPrompt();

  if (!isInstallable) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 lg:left-[296px] z-40 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 backdrop-blur-xl px-4 py-3 shadow-lg"
      data-testid="install-prompt-banner"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Download className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Install P.R.O. Portal</p>
        <p className="text-xs text-muted-foreground">Add to your home screen for quick access</p>
      </div>
      <Button
        size="sm"
        className="shrink-0 rounded-xl"
        onClick={promptInstall}
        data-testid="button-install-app"
      >
        Install
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 rounded-xl h-8 w-8"
        onClick={dismiss}
        data-testid="button-dismiss-install"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

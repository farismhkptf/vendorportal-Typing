import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

interface ToastWithUndoOptions {
  title: string;
  description?: string;
  undoLabel?: string;
  duration?: number;
  onUndo: () => void | Promise<void>;
}

export function toastWithUndo({
  title,
  description,
  undoLabel = "Undo",
  duration = 5000,
  onUndo,
}: ToastWithUndoOptions) {
  const { dismiss } = toast({
    title,
    description,
    duration,
    action: (
      <ToastAction 
        altText={undoLabel} 
        onClick={async () => {
          dismiss();
          await onUndo();
        }}
        data-testid="button-toast-undo"
      >
        {undoLabel}
      </ToastAction>
    ),
  });

  return { dismiss };
}

export function toastSuccess(title: string, description?: string) {
  return toast({
    title,
    description,
    duration: 3000,
  });
}

export function toastError(title: string, description?: string) {
  return toast({
    title,
    description,
    variant: "destructive",
    duration: 5000,
  });
}

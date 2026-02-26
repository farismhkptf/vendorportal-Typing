import { useToast } from "@/hooks/use-toast"
import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

function ToastIcon({ variant }: { variant?: string }) {
  if (variant === "destructive") {
    return <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
  }
  if (variant === "success") {
    return <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
  }
  return <Info className="h-5 w-5 shrink-0 text-primary" />
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-start gap-3">
              <ToastIcon variant={variant} />
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

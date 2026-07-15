import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

const VARIANT_ICON = {
  destructive: AlertCircle,
  success: CheckCircle2,
  default: Info,
} as const

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const Icon = VARIANT_ICON[(variant as keyof typeof VARIANT_ICON) ?? "default"]
        return (
          <Toast key={id} variant={variant} {...props}>
            <Icon
              size={18}
              className={cn(
                "shrink-0 mt-0.5",
                variant === "destructive" && "text-destructive",
                variant === "success" && "text-emerald-500",
                (!variant || variant === "default") && "text-muted-foreground",
              )}
              aria-hidden
            />
            <div className="grid gap-0.5 flex-1 min-w-0">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
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

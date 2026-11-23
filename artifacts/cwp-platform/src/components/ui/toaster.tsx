import { MaterialSymbol } from "@/lib/design-system/MaterialSymbol"
import { cn } from "@/lib/utils"
import { useToast, DEFAULT_TOAST_DURATION } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

const VARIANT_ICON_NAMES = {
  destructive: "error",
  success: "check_circle",
  default: "info",
} as const

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider duration={DEFAULT_TOAST_DURATION}>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const iconName = VARIANT_ICON_NAMES[(variant as keyof typeof VARIANT_ICON_NAMES) ?? "default"]
        return (
          <Toast key={id} variant={variant} {...props}>
            <MaterialSymbol
              name={iconName}
              size={18}
              weight={500}
              className={cn(
                "shrink-0 mt-0.5",
                variant === "destructive" && "text-destructive",
                variant === "success" && "text-emerald-500",
                (!variant || variant === "default") && "text-muted-foreground",
              )}
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

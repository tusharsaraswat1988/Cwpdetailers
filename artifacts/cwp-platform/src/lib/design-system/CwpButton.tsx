import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { MaterialSymbol } from "./MaterialSymbol";

export type CwpButtonRole = "admin" | "staff" | "customer";
export type CwpButtonVariant = "primary" | "secondary" | "outline" | "destructive" | "ghost";
export type CwpButtonSize = "sm" | "md" | "lg" | "icon";

export interface CwpButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  roleVariant?: CwpButtonRole;
  variant?: CwpButtonVariant;
  size?: CwpButtonSize;
  asChild?: boolean;
  isLoading?: boolean;
  startIcon?: string;
  endIcon?: string;
}

/**
 * CWP Universal Design System — Canonical Role-Adapted Button Primitive
 * Standardizes button tokens, WCAG 2.2 visible focus rings, and role-specific ergonomics.
 */
export const CwpButton = React.forwardRef<HTMLButtonElement, CwpButtonProps>(
  (
    {
      roleVariant = "customer",
      variant = "primary",
      size = "md",
      asChild = false,
      isLoading = false,
      startIcon,
      endIcon,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    // Base styling with standard WCAG 2.2 AA visible focus ring
    const baseClasses =
      "inline-flex items-center justify-center font-medium transition-all cursor-pointer select-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

    // Variant classes
    const variantClasses: Record<CwpButtonVariant, string> = {
      primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs active:scale-[0.99]",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-xs",
      outline: "border border-border bg-card hover:bg-muted text-foreground shadow-2xs active:bg-muted/80",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs active:scale-[0.99]",
      ghost: "text-foreground hover:bg-muted/60 active:bg-muted",
    };

    // Role-specific size and touch target scaling
    const roleSizeClasses: Record<CwpButtonRole, Record<CwpButtonSize, string>> = {
      admin: {
        sm: "h-7 px-2.5 text-xs rounded-md gap-1.5",
        md: "h-8.5 px-3.5 text-xs rounded-lg gap-2",
        lg: "h-10 px-4 text-sm rounded-lg gap-2",
        icon: "h-8.5 w-8.5 rounded-lg p-0",
      },
      staff: {
        sm: "min-h-[44px] px-3.5 text-xs font-semibold rounded-xl gap-2",
        md: "min-h-[48px] px-4 text-sm font-bold rounded-xl gap-2.5 active:scale-[0.98]",
        lg: "min-h-[52px] px-6 text-base font-bold rounded-2xl gap-3 active:scale-[0.98]",
        icon: "min-h-[48px] min-w-[48px] rounded-xl p-0",
      },
      customer: {
        sm: "min-h-[38px] px-3 text-xs rounded-xl gap-1.5",
        md: "min-h-[44px] px-4 text-sm font-semibold rounded-xl gap-2 active:scale-[0.98]",
        lg: "min-h-[48px] px-6 text-base font-semibold rounded-2xl gap-2.5 active:scale-[0.98]",
        icon: "min-h-[44px] min-w-[44px] rounded-xl p-0",
      },
    };

    const iconSizeMap: Record<CwpButtonSize, number> = {
      sm: 16,
      md: 18,
      lg: 20,
      icon: 20,
    };

    return (
      <Comp
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseClasses,
          variantClasses[variant],
          roleSizeClasses[roleVariant][size],
          className
        )}
        data-testid="cwp-button"
        data-role-variant={roleVariant}
        {...props}
      >
        {isLoading ? (
          <MaterialSymbol
            name="sync"
            size={iconSizeMap[size]}
            className="animate-spin shrink-0"
            aria-hidden
          />
        ) : startIcon ? (
          <MaterialSymbol
            name={startIcon}
            size={iconSizeMap[size]}
            className="shrink-0"
            aria-hidden
          />
        ) : null}

        {children}

        {!isLoading && endIcon && (
          <MaterialSymbol
            name={endIcon}
            size={iconSizeMap[size]}
            className="shrink-0"
            aria-hidden
          />
        )}
      </Comp>
    );
  }
);

CwpButton.displayName = "CwpButton";

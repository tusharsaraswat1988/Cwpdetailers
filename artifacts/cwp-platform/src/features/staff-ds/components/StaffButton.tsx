import { forwardRef, type ReactNode, type ComponentProps } from "react";
import { Link } from "wouter";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type StaffButtonProps = Omit<ButtonProps, "asChild"> & {
  href?: string;
  children: ReactNode;
};

/**
 * Canonical staff CTA — oversized taps; ThemeRoot owns the palette.
 */
export const StaffButton = forwardRef<HTMLButtonElement, StaffButtonProps>(
  function StaffButton({ href, className, children, variant = "default", size, ...props }, ref) {
    const sizeClass =
      size === "sm" || size === "icon"
        ? undefined
        : "h-[3.25rem] min-h-[3.25rem] rounded-[var(--staff-radius-sm,0.75rem)] text-base font-semibold";

    if (href) {
      return (
        <Button
          variant={variant}
          size={size}
          className={cn(sizeClass, "staff-transition", className)}
          asChild
          {...props}
        >
          <Link href={href}>{children}</Link>
        </Button>
      );
    }
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(sizeClass, "staff-transition", className)}
        {...props}
      >
        {children}
      </Button>
    );
  },
);

export type StaffInputProps = ComponentProps<typeof Input>;

export const StaffInput = forwardRef<HTMLInputElement, StaffInputProps>(
  function StaffInput({ className, ...props }, ref) {
    return (
      <Input
        ref={ref}
        className={cn(
          "h-[3.25rem] min-h-[3.25rem] rounded-[var(--staff-radius-sm,0.75rem)] text-base",
          className,
        )}
        {...props}
      />
    );
  },
);

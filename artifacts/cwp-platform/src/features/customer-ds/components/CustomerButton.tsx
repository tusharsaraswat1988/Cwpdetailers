import { forwardRef, type ReactNode, type ComponentProps } from "react";
import { Link } from "wouter";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CUSTOMER_SPACE, CUSTOMER_MOTION } from "../tokens";

export type CustomerButtonProps = Omit<ButtonProps, "asChild"> & {
  href?: string;
  children: ReactNode;
};

/**
 * Canonical customer CTA — large tap targets; ThemeRoot owns the palette.
 */
export const CustomerButton = forwardRef<HTMLButtonElement, CustomerButtonProps>(
  function CustomerButton({ href, className, children, variant = "default", size, ...props }, ref) {
    const sizeClass =
      size === "sm" || size === "icon"
        ? undefined
        : "h-12 min-h-12 rounded-[var(--customer-radius-sm,0.75rem)] text-base font-semibold";

    if (href) {
      return (
        <Button
          variant={variant}
          size={size}
          className={cn(sizeClass, "customer-transition", className)}
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
        className={cn(sizeClass, "customer-transition", className)}
        {...props}
      >
        {children}
      </Button>
    );
  },
);

export type CustomerInputProps = ComponentProps<typeof Input>;

export const CustomerInput = forwardRef<HTMLInputElement, CustomerInputProps>(
  function CustomerInput({ className, ...props }, ref) {
    return (
      <Input
        ref={ref}
        className={cn(
          "h-12 min-h-12 rounded-[var(--customer-radius-sm,0.75rem)] text-base",
          className,
        )}
        {...props}
      />
    );
  },
);

export function CustomerSearch({
  value,
  onChange,
  placeholder = "Search…",
  className,
  ...props
}: CustomerInputProps & { value?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <CustomerInput
      type="search"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={cn("bg-card", className)}
      aria-label={placeholder}
      data-testid="customer-search"
      {...props}
    />
  );
}

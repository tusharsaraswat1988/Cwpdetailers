import { forwardRef, type ReactNode, type ComponentProps } from "react";
import { Link } from "wouter";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type CustomerButtonProps = Omit<ButtonProps, "asChild"> & {
  href?: string;
  children: ReactNode;
  loading?: boolean;
};

/**
 * Canonical customer CTA — large tap targets, high contrast, smooth active feedback.
 */
export const CustomerButton = forwardRef<HTMLButtonElement, CustomerButtonProps>(
  function CustomerButton({ href, className, children, variant = "default", size, loading = false, disabled, ...props }, ref) {
    const sizeClass =
      size === "icon"
        ? "h-11 w-11 min-h-11 min-w-11 rounded-xl p-0 flex items-center justify-center"
        : size === "sm"
          ? "h-10 min-h-10 px-3.5 text-xs font-semibold rounded-xl"
          : "h-12 min-h-12 px-5 text-sm sm:text-base font-semibold rounded-xl";

    const variantClass =
      variant === "default"
        ? "bg-[#1677FF] hover:bg-[#1264db] text-white shadow-xs"
        : variant === "secondary"
          ? "bg-white hover:bg-slate-50 text-foreground border border-slate-200 shadow-xs"
          : variant === "outline"
            ? "bg-white hover:bg-slate-50 text-foreground border border-slate-200 shadow-xs"
            : variant === "ghost"
              ? "text-primary hover:bg-blue-50/60 hover:text-primary font-semibold"
              : variant === "destructive"
                ? "bg-[#DC2626] hover:bg-red-700 text-white shadow-xs"
                : undefined;

    if (href && !disabled && !loading) {
      return (
        <Button
          variant={variant}
          size={size}
          className={cn(
            sizeClass,
            variantClass,
            "customer-transition cursor-pointer active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            className,
          )}
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
        disabled={disabled || loading}
        className={cn(
          sizeClass,
          variantClass,
          "customer-transition cursor-pointer active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" aria-hidden />}
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

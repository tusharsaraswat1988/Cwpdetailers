import { forwardRef, type ReactNode } from "react";
import { Link } from "wouter";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AdminButtonProps = Omit<ButtonProps, "asChild"> & {
  href?: string;
  children: ReactNode;
};

/**
 * Canonical admin CTA. Do not pass bg-primary / text-* color overrides —
 * AdminThemeRoot owns the palette.
 */
export const AdminButton = forwardRef<HTMLButtonElement, AdminButtonProps>(
  function AdminButton({ href, className, children, variant = "default", ...props }, ref) {
    if (href) {
      return (
        <Button variant={variant} className={cn(className)} asChild {...props}>
          <Link href={href}>{children}</Link>
        </Button>
      );
    }
    return (
      <Button ref={ref} variant={variant} className={cn(className)} {...props}>
        {children}
      </Button>
    );
  },
);

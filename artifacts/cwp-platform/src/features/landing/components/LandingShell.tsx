import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "../styles/landing.css";

type LandingShellProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Scopes landing motion utilities and --landing-* tokens.
 * Does not replace App providers, branding, or routing.
 */
export function LandingShell({ children, className }: LandingShellProps) {
  return (
    <div className={cn("landing-root min-h-screen bg-background text-foreground antialiased", className)}>
      {children}
    </div>
  );
}

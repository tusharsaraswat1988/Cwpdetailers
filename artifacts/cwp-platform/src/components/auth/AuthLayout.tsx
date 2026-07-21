import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CustomerThemeRoot } from "@/features/customer-ds";

type AuthLayoutProps = {
  children: ReactNode;
  testId?: string;
  className?: string;
  /** Apply Customer DS theme (default true for consumer auth). */
  customerTheme?: boolean;
};

export function AuthLayout({
  children,
  testId,
  className,
  customerTheme = true,
}: AuthLayoutProps) {
  const shell = (
    <div
      className={cn(
        "customer-auth-shell min-h-[100dvh] bg-secondary flex items-center justify-center px-4 py-5 sm:px-6 sm:py-6",
        className,
      )}
      data-testid={testId}
    >
      <div className="w-full max-w-[22rem] sm:max-w-md">{children}</div>
    </div>
  );

  if (!customerTheme) return shell;
  return <CustomerThemeRoot className="min-h-[100dvh]">{shell}</CustomerThemeRoot>;
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StaffThemeRoot } from "@/features/staff-ds";
import { AdminThemeRoot } from "@/features/admin-ds";
import { MarketingPageShell } from "@/features/landing/components/marketing/MarketingPageShell";
import { MarketingCard } from "@/features/landing/components/marketing/MarketingCard";
import { MARKETING_SITE_LINKS } from "@/features/landing/components/marketing/siteLinks";

export type AuthPortalChrome = "customer" | "staff" | "admin";

type AuthLayoutProps = {
  children: ReactNode;
  testId?: string;
  className?: string;
  portal?: AuthPortalChrome;
};

const PORTAL_SHELL: Record<"staff" | "admin", string> = {
  staff: "staff-auth-shell",
  admin: "admin-auth-shell",
};

const PORTAL_PANEL: Record<AuthPortalChrome, string> = {
  customer: "",
  staff: "staff-auth-panel",
  admin: "admin-auth-panel",
};

export function AuthLayout({
  children,
  testId,
  className,
  portal = "customer",
}: AuthLayoutProps) {
  if (portal === "customer") {
    const path =
      testId === "register-page"
        ? "/register"
        : testId === "forgot-password-page"
          ? "/forgot-password"
          : "/login";
    return (
      <MarketingPageShell
        navLinks={MARKETING_SITE_LINKS}
        activeHref={path}
        homeHref="/"
        showFooter={false}
      >
        <main
          className={cn(
            "flex min-h-[calc(100dvh-4rem)] items-center justify-center px-5 py-10 sm:px-8",
            className,
          )}
          data-testid={testId}
        >
          <div className="w-full max-w-[22rem] sm:max-w-md">{children}</div>
        </main>
      </MarketingPageShell>
    );
  }

  const shell = (
    <div
      className={cn(
        PORTAL_SHELL[portal],
        "min-h-[100dvh] bg-secondary flex items-center justify-center px-4 py-5 sm:px-6 sm:py-6",
        className,
      )}
      data-testid={testId}
    >
      <div className="w-full max-w-[22rem] sm:max-w-md">{children}</div>
    </div>
  );

  if (portal === "staff") {
    return <StaffThemeRoot className="min-h-[100dvh]">{shell}</StaffThemeRoot>;
  }
  return <AdminThemeRoot className="min-h-[100dvh]">{shell}</AdminThemeRoot>;
}

type AuthPanelProps = {
  children: ReactNode;
  portal?: AuthPortalChrome;
  className?: string;
  testId?: string;
};

export function AuthPanel({
  children,
  portal = "customer",
  className,
  testId,
}: AuthPanelProps) {
  if (portal === "customer") {
    return (
      <MarketingCard className={cn("p-5 sm:p-6", className)} padded={false}>
        <div data-testid={testId}>{children}</div>
      </MarketingCard>
    );
  }

  return (
    <div className={cn(PORTAL_PANEL[portal], "p-5 sm:p-6", className)} data-testid={testId}>
      {children}
    </div>
  );
}

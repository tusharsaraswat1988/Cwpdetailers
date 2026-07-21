import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppBar } from "./AppBar";
import { BottomNav, type BottomNavItem } from "./BottomNav";

interface AppShellProps {
  children: ReactNode;
  testId?: string;
  /** Max content width — preserves app metaphor on desktop */
  maxWidth?: "sm" | "md" | "hub" | "full";
  appBar?: {
    title?: string;
    subtitle?: string;
    showBack?: boolean;
    onBack?: () => void;
    leading?: ReactNode;
    trailing?: ReactNode;
  };
  bottomNav?: BottomNavItem[];
  /** Hide bottom nav (e.g. full-screen flows) */
  hideBottomNav?: boolean;
  className?: string;
}

const maxWidthClass = {
  sm: "max-w-[480px]",
  md: "max-w-[640px]",
  /** Account / profile hubs — room for two-column desktop layouts */
  hub: "max-w-[880px]",
  full: "max-w-5xl",
};

export function AppShell({
  children,
  testId = "app-shell",
  maxWidth = "sm",
  appBar,
  bottomNav,
  hideBottomNav,
  className,
}: AppShellProps) {
  const hasBottomNav = bottomNav && bottomNav.length > 0 && !hideBottomNav;

  return (
    <div
      className={cn(
        "h-[100dvh] overflow-hidden bg-background flex flex-col mx-auto w-full",
        maxWidthClass[maxWidth],
        className,
      )}
      data-testid={testId}
    >
      {appBar && <AppBar {...appBar} />}

      <main
        className={cn(
          "flex-1 min-h-0 w-full min-w-0 overflow-y-auto overflow-x-hidden",
          hasBottomNav ? "pb-[var(--bottom-nav-height)]" : "pb-safe",
          appBar ? "px-4 py-4" : "px-4 py-4 sm:py-6",
        )}
      >
        {children}
      </main>

      {hasBottomNav && <BottomNav items={bottomNav} />}
    </div>
  );
}

export default AppShell;

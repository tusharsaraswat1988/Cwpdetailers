import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppBar } from "./AppBar";
import { BottomNav, type BottomNavItem } from "./BottomNav";

interface AppShellProps {
  children: ReactNode;
  testId?: string;
  /** Max content width — preserves app metaphor on desktop */
  maxWidth?: "sm" | "md" | "hub" | "full" | "responsive";
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
  hub: "max-w-[880px] lg:max-w-[1024px]",
  full: "max-w-5xl",
  responsive: "max-w-xl md:max-w-4xl lg:max-w-6xl",
};

export function AppShell({
  children,
  testId = "app-shell",
  maxWidth = "responsive",
  appBar,
  bottomNav,
  hideBottomNav,
  className,
}: AppShellProps) {
  const hasBottomNav = bottomNav && bottomNav.length > 0 && !hideBottomNav;

  return (
    <div
      className={cn(
        "h-full min-h-0 flex-1 overflow-hidden bg-background flex flex-col mx-auto w-full",
        maxWidthClass[maxWidth],
        className,
      )}
      data-testid={testId}
    >
      {appBar && <AppBar {...appBar} />}

      <main
        className={cn(
          "flex-1 min-h-0 w-full min-w-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 lg:px-8",
          appBar ? "pt-3 sm:pt-4" : "pt-4 sm:pt-6",
          hasBottomNav
            ? "pb-[calc(var(--bottom-nav-height)+1.5rem)] md:pb-10"
            : "pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] md:pb-10",
        )}
      >
        {children}
      </main>

      {hasBottomNav && <BottomNav items={bottomNav} />}
    </div>
  );
}

export default AppShell;

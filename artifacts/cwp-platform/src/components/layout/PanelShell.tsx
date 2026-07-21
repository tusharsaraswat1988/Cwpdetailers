import { ReactNode, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SyncStatusIndicator } from "@/components/connectivity/SyncStatusIndicator";

export type SidebarRenderProps = {
  onNavigate?: () => void;
  embedded?: boolean;
};

interface PanelShellProps {
  testId: string;
  mobileTitle: string;
  sidebar: ReactNode | ((props: SidebarRenderProps) => ReactNode);
  children: ReactNode;
}

export default function PanelShell({ testId, mobileTitle, sidebar, children }: PanelShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  const renderSidebar = (props: SidebarRenderProps) =>
    typeof sidebar === "function" ? sidebar(props) : sidebar;

  return (
    <div
      className="flex h-[100dvh] overflow-hidden flex-col lg:flex-row bg-background"
      data-testid={testId}
    >
      <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card/95 backdrop-blur shrink-0 z-20 safe-area-top">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          data-testid="mobile-nav-toggle"
        >
          <Menu size={20} />
        </Button>
        <p className="font-display font-bold text-sm truncate min-w-0 flex-1">{mobileTitle}</p>
        <SyncStatusIndicator compact />
      </header>

      <div className="hidden lg:flex shrink-0 h-full">
        {renderSidebar({ embedded: false })}
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[min(100vw-2rem,16rem)] max-w-[16rem] p-0 border-white/5 bg-secondary [&>button]:text-white"
        >
          {renderSidebar({ onNavigate: closeMobile, embedded: true })}
        </SheetContent>
      </Sheet>

      <main className={cn("flex-1 overflow-y-auto overflow-x-hidden min-w-0 p-4 sm:p-6 pb-safe lg:pb-6 [padding-inline:max(1rem,env(safe-area-inset-left))]")}>
        {children}
      </main>
    </div>
  );
}

import { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";

export type EntityDrawerTab = {
  id: string;
  label: string;
  content: ReactNode;
};

export type EntityDrawerSize = "default" | "md" | "lg" | "xl";

interface EntityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  status?: string;
  /** Overview / Timeline / History / Notes tabs — pass 1+ to render a Tabs shell. */
  tabs?: EntityDrawerTab[];
  /** Used when there's a single section instead of tabs. */
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  size?: EntityDrawerSize;
}

export const sizeClasses: Record<EntityDrawerSize, string> = {
  default: "sm:max-w-lg",
  md: "sm:max-w-lg",
  lg: "sm:max-w-xl md:max-w-2xl",
  xl: "sm:max-w-2xl md:max-w-3xl",
};

/**
 * The one right-side quick-view drawer for the admin panel — used for
 * booking/customer/job/invoice/staff/asset "quick view" (overview, timeline,
 * history, notes, actions) without navigating away from the list. Do not
 * build a page-specific Sheet for this pattern; configure this instead.
 * See docs/UI_CONSTITUTION.md.
 */
export function EntityDrawer({
  open,
  onOpenChange,
  title,
  description,
  status,
  tabs,
  children,
  actions,
  className,
  size = "default",
}: EntityDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-full flex flex-col gap-4 overflow-hidden p-6",
          sizeClasses[size],
          className,
        )}
        data-testid="entity-drawer"
      >
        <SheetHeader className="shrink-0">
          <div className="flex items-start justify-between gap-2 pr-6">
            <SheetTitle className="truncate">{title}</SheetTitle>
            {status && <StatusBadge status={status} />}
          </div>
          {description && <SheetDescription className="truncate">{description}</SheetDescription>}
        </SheetHeader>

        {tabs && tabs.length > 0 ? (
          <Tabs defaultValue={tabs[0]!.id} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div
              className="shrink-0 w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-border/40 pb-1"
              role="tablist"
              aria-label={`${title} tabs`}
            >
              <TabsList className="inline-flex h-9 w-max items-center justify-start gap-1 p-1 bg-muted/60">
                {tabs.map(t => (
                  <TabsTrigger
                    key={t.id}
                    value={t.id}
                    data-testid={`entity-drawer-tab-${t.id}`}
                    className="shrink-0 text-xs sm:text-sm px-3"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {tabs.map(t => (
              <TabsContent
                key={t.id}
                value={t.id}
                className="mt-3 flex-1 overflow-y-auto overflow-x-hidden min-h-0 pr-1 focus-visible:outline-none"
              >
                {t.content}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">{children}</div>
        )}

        {actions && (
          <div className="shrink-0 flex flex-wrap items-center gap-2 pt-3 border-t border-border mt-auto bg-background">
            {actions}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default EntityDrawer;

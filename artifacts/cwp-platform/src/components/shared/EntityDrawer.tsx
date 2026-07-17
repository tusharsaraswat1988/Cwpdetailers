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
}

/**
 * The one right-side quick-view drawer for the admin panel — used for
 * booking/customer/job/invoice/staff/asset "quick view" (overview, timeline,
 * history, notes, actions) without navigating away from the list. Do not
 * build a page-specific Sheet for this pattern; configure this instead.
 * See docs/UI_CONSTITUTION.md.
 */
export function EntityDrawer({
  open, onOpenChange, title, description, status, tabs, children, actions, className,
}: EntityDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn("w-full sm:max-w-lg overflow-y-auto flex flex-col gap-4", className)}
        data-testid="entity-drawer"
      >
        <SheetHeader>
          <div className="flex items-start justify-between gap-2 pr-6">
            <SheetTitle>{title}</SheetTitle>
            {status && <StatusBadge status={status} />}
          </div>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        {tabs && tabs.length > 0 ? (
          <Tabs defaultValue={tabs[0]!.id} className="flex-1">
            <TabsList className="w-full justify-start">
              {tabs.map(t => (
                <TabsTrigger key={t.id} value={t.id} data-testid={`entity-drawer-tab-${t.id}`}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map(t => (
              <TabsContent key={t.id} value={t.id} className="mt-4">
                {t.content}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="flex-1">{children}</div>
        )}

        {actions && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
            {actions}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default EntityDrawer;

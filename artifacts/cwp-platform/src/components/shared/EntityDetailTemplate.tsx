import { ReactNode } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { StatusBadge } from "./StatusBadge";
import { PageBreadcrumbs, type BreadcrumbEntry } from "./PageBreadcrumbs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type EntityDetailSection = {
  id: string;
  label: string;
  content: ReactNode;
};

interface EntityDetailTemplateProps {
  title: string;
  subtitle?: string;
  status?: string;
  breadcrumbs?: BreadcrumbEntry[];
  actions?: ReactNode;
  /** Typically Overview / Timeline / Notes / Attachments / History / Related Records. */
  sections: EntityDetailSection[];
  defaultSectionId?: string;
  className?: string;
}

/**
 * The one detail-page layout for the admin panel (Bookings, Customers, Jobs,
 * Invoices, Staff, Assets…). Pure layout — header with status + actions,
 * then a tabbed body — no business logic. Feed it your module's sections
 * (Overview, Timeline, Notes, Attachments, History, Related Records) instead
 * of building a bespoke detail page shell. See docs/UI_CONSTITUTION.md.
 */
export function EntityDetailTemplate({
  title, subtitle, status, breadcrumbs, actions, sections, defaultSectionId, className,
}: EntityDetailTemplateProps) {
  return (
    <AdminLayout>
      <div className={cn("space-y-6", className)}>
        <div>
          {breadcrumbs && breadcrumbs.length > 1 && <PageBreadcrumbs items={breadcrumbs} />}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display font-bold text-xl sm:text-2xl text-foreground break-words" data-testid="entity-detail-title">
                  {title}
                </h1>
                {status && <StatusBadge status={status} />}
              </div>
              {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
            </div>
            {actions && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {actions}
              </div>
            )}
          </div>
        </div>

        <Tabs defaultValue={defaultSectionId ?? sections[0]?.id}>
          <TabsList className="w-full sm:w-auto justify-start overflow-x-auto">
            {sections.map(s => (
              <TabsTrigger key={s.id} value={s.id} data-testid={`entity-detail-tab-${s.id}`}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {sections.map(s => (
            <TabsContent key={s.id} value={s.id} className="mt-4">
              {s.content}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AdminLayout>
  );
}

export default EntityDetailTemplate;

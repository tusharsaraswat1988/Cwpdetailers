import { ReactNode } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { PageActionHeader } from "@/components/layout/PageActionHeader";
import { PageBreadcrumbs, type BreadcrumbEntry } from "./PageBreadcrumbs";
import { cn } from "@/lib/utils";
import { ADMIN_SPACE } from "@/features/admin-ds/tokens";

type PrimaryAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  testId?: string;
};

interface PageTemplateProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbEntry[];
  primaryAction?: PrimaryAction;
  secondaryActions?: ReactNode;
  /** Rendered under the header, above filters — typically a KpiRow. */
  stats?: ReactNode;
  /** Rendered directly under stats — typically a FilterBar. */
  filters?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * The one page shell for admin module pages: breadcrumbs → header (with a
 * single primary CTA) → filters → content, inside the standard AdminLayout
 * and a single canonical spacing rhythm.
 */
export function PageTemplate({
  title,
  description,
  breadcrumbs,
  primaryAction,
  secondaryActions,
  stats,
  filters,
  children,
  className,
}: PageTemplateProps) {
  return (
    <AdminLayout>
      <div className={cn(ADMIN_SPACE.page, className)}>
        <div>
          {breadcrumbs && breadcrumbs.length > 1 && <PageBreadcrumbs items={breadcrumbs} />}
          <PageActionHeader
            title={title}
            description={description}
            primaryAction={primaryAction}
            secondaryActions={secondaryActions}
          />
        </div>
        {stats}
        {filters}
        {children}
      </div>
    </AdminLayout>
  );
}

export default PageTemplate;

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PageTemplate } from "@/components/shared/PageTemplate";
import { PageActionHeader } from "@/components/layout/PageActionHeader";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { FilterBar } from "@/components/shared/FilterBar";
import { ActionBar } from "@/components/shared/ActionBar";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { OfflineState } from "@/components/shared/OfflineState";
import { PermissionDeniedState } from "@/components/shared/PermissionDeniedState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EntityDrawer } from "@/components/shared/EntityDrawer";
import { ResourceForm } from "@/components/shared/ResourceForm";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { KpiRow } from "@/components/shared/KpiRow";
import { BulkActionBar } from "@/components/shared/BulkActionBar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox, Loader2 } from "lucide-react";
import { ADMIN_SPACE } from "../tokens";
import { AdminButton } from "./AdminButton";

export const AdminPage = PageTemplate;
export const AdminHeader = PageActionHeader;
export const AdminPageHeader = PageHeader;
export const AdminStatCard = StatCard;
export const AdminMetric = StatCard;
export const AdminFilterBar = FilterBar;
export const AdminActionBar = ActionBar;
export const AdminDataTable = DataTable;
export const AdminDialog = ConfirmDialog;
export const AdminDrawer = EntityDrawer;
export const AdminForm = ResourceForm;
export const AdminStatusBadge = StatusBadge;
export const AdminKpiRow = KpiRow;
export const AdminBulkActionBar = BulkActionBar;
export { AdminButton } from "./AdminButton";
export { AdminField } from "./AdminField";
export {
  ADMIN_CHART,
  ADMIN_CHART_COLORS,
  adminChartColor,
  adminChartTooltipStyle,
  adminChartAxisProps,
} from "./AdminChart";

export function AdminToolbar({
  filters,
  actions,
  className,
}: {
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between",
        ADMIN_SPACE.toolbar,
        className,
      )}
      data-testid="admin-toolbar"
    >
      <div className="min-w-0 flex-1">{filters}</div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(ADMIN_SPACE.section, className)} data-testid="admin-section">
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function AdminCard({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <Card className={cn("admin-elevated border-border bg-card", className)} data-testid="admin-card">
      {padded ? <CardContent className={ADMIN_SPACE.cardPad}>{children}</CardContent> : children}
    </Card>
  );
}

export {
  CardHeader as AdminCardHeader,
  CardTitle as AdminCardTitle,
  CardDescription as AdminCardDescription,
  CardContent as AdminCardContent,
  CardFooter as AdminCardFooter,
};

export function AdminTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("admin-table-wrap", className)} data-testid="admin-table">
      {children}
    </div>
  );
}

export function AdminTabs(props: React.ComponentProps<typeof Tabs>) {
  return <Tabs {...props} />;
}
export const AdminTabsList = TabsList;
export const AdminTabsTrigger = TabsTrigger;
export const AdminTabsContent = TabsContent;

export function AdminEmptyState({
  icon,
  title,
  description,
  action,
  hint,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  hint?: string;
}) {
  return (
    <EmptyState
      icon={icon ?? <Inbox size={18} aria-hidden />}
      title={title}
      description={description}
      action={action}
      hint={hint}
    />
  );
}

export function AdminErrorState({
  title,
  description,
  onRetry,
  action,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  action?: ReactNode;
}) {
  return (
    <ErrorState
      title={title}
      description={description ?? "Try again. If it persists, check connectivity or contact support."}
      onRetry={onRetry}
      action={action}
    />
  );
}

export const AdminOfflineState = OfflineState;
export const AdminPermissionDeniedState = PermissionDeniedState;

export function AdminLoading({
  label = "Loading…",
  hint = "This usually takes a few seconds.",
}: {
  label?: string;
  hint?: string;
}) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-2"
      data-testid="admin-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function AdminSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("admin-skeleton rounded-md", className)} aria-hidden />;
}

export function AdminWizard({
  step,
  totalSteps,
  title,
  children,
  className,
}: {
  step: number;
  totalSteps: number;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(ADMIN_SPACE.section, className)} data-testid="admin-wizard">
      <div className="flex items-center justify-between gap-3">
        {title ? <p className="font-display text-sm font-semibold">{title}</p> : <span />}
        <p className="text-xs tabular-nums text-muted-foreground">
          Step {step} of {totalSteps}
        </p>
      </div>
      <div className="flex gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={totalSteps}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={cn("admin-transition h-1 flex-1 rounded-full", i < step ? "bg-primary" : "bg-muted")}
          />
        ))}
      </div>
      {children}
    </div>
  );
}

/** Re-export EmptyState for gradual migration. */
export { EmptyState as AdminEmptyStateLegacy };

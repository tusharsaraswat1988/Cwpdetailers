/**
 * Admin Design System public API.
 *
 * Build every new admin screen exclusively from these exports.
 * Do not invent colors, shadows, radius, or CTA classNames on pages.
 *
 * @example
 * import {
 *   AdminPage, AdminFilterBar, AdminDataTable, AdminEmptyState,
 *   AdminButton, ADMIN_CHART,
 * } from "@/features/admin-ds";
 */
export { AdminThemeRoot } from "./AdminThemeRoot";
export {
  ADMIN_DS,
  ADMIN_THEME_CSS_VARS,
  ADMIN_CHART,
  ADMIN_CHART_COLORS,
  ADMIN_SPACE,
} from "./tokens";
export {
  AdminPage,
  AdminHeader,
  AdminPageHeader,
  AdminStatCard,
  AdminMetric,
  AdminFilterBar,
  AdminActionBar,
  AdminToolbar,
  AdminSection,
  AdminCard,
  AdminCardHeader,
  AdminCardTitle,
  AdminCardDescription,
  AdminCardContent,
  AdminCardFooter,
  AdminTable,
  AdminDataTable,
  AdminEmptyState,
  AdminErrorState,
  AdminOfflineState,
  AdminPermissionDeniedState,
  AdminLoading,
  AdminSkeleton,
  AdminDialog,
  AdminDrawer,
  AdminWizard,
  AdminForm,
  AdminStatusBadge,
  AdminKpiRow,
  AdminBulkActionBar,
  AdminTabs,
  AdminTabsList,
  AdminTabsTrigger,
  AdminTabsContent,
  AdminButton,
  AdminField,
  adminChartColor,
  adminChartTooltipStyle,
  adminChartAxisProps,
} from "./components/primitives";

export { default as AdminSidebar } from "@/components/layout/AdminSidebar";
export { default as AdminLayout } from "@/components/layout/AdminLayout";
export { AdminNavMenu } from "@/components/layout/AdminNavMenu";

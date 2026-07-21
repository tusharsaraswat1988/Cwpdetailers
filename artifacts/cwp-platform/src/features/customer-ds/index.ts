/**
 * Customer Design System public API.
 *
 * Build every customer-facing screen exclusively from these exports.
 * Do not invent colors, shadows, radius, or CTA classNames on pages.
 * Reuse Platform shared components via these aliases.
 *
 * @example
 * import {
 *   CustomerPage, CustomerHero, CustomerEmptyState,
 *   CustomerButton, CUSTOMER_SPACE,
 * } from "@/features/customer-ds";
 */
export { CustomerThemeRoot } from "./CustomerThemeRoot";
export {
  CUSTOMER_DS,
  CUSTOMER_COLORS,
  CUSTOMER_SURFACE,
  CUSTOMER_STATUS,
  CUSTOMER_PROGRESS,
  CUSTOMER_SPACE,
  CUSTOMER_SPACE_RAW,
  CUSTOMER_RADIUS,
  CUSTOMER_CHART,
  CUSTOMER_MOTION,
  CUSTOMER_THEME_CSS_VARS,
} from "./tokens";

export {
  CustomerPage,
  CustomerHeader,
  CustomerHero,
  CustomerCard,
  CustomerCardHeader,
  CustomerCardTitle,
  CustomerCardDescription,
  CustomerCardContent,
  CustomerCardFooter,
  CustomerActionCard,
  CustomerMetric,
  CustomerStatusBadge,
  CustomerTimeline,
  CustomerEmptyState,
  CustomerErrorState,
  CustomerOfflineState,
  CustomerPermissionState,
  CustomerLoading,
  CustomerSkeleton,
  CustomerDialog,
  CustomerBottomAction,
  CustomerStepper,
  CustomerTabs,
  CustomerTabsList,
  CustomerTabsTrigger,
  CustomerTabsContent,
  CustomerButton,
} from "./components/primitives";

export type { CustomerTimelineEvent } from "./components/primitives";

export { CustomerInput, CustomerSearch } from "./components/CustomerButton";
export type { CustomerButtonProps, CustomerInputProps } from "./components/CustomerButton";

export {
  CustomerBookingCard,
  CustomerServiceCard,
  CustomerSubscriptionCard,
  CustomerPhotoReport,
  CustomerInvoiceCard,
  CustomerPaymentCard,
  CustomerNotificationCard,
  CustomerNotificationGroup,
  CustomerProfileCard,
  CustomerSupportCard,
} from "./components/domain";

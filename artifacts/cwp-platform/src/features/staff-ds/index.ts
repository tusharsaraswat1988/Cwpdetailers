/**
 * Staff Design System public API.
 *
 * Field workforce experience — build every staff-facing screen from these exports.
 * Do not invent colors, shadows, radius, or CTA classNames on pages.
 * Reuse Platform shared components via these aliases.
 *
 * @example
 * import {
 *   StaffPage, StaffHeader, StaffJobCard, StaffActionBar,
 *   StaffButton, STAFF_SPACE,
 * } from "@/features/staff-ds";
 */
export { StaffThemeRoot } from "./StaffThemeRoot";
export {
  STAFF_DS,
  STAFF_COLORS,
  STAFF_SURFACE,
  STAFF_STATUS,
  STAFF_PROGRESS,
  STAFF_SPACE,
  STAFF_SPACE_RAW,
  STAFF_RADIUS,
  STAFF_MOTION,
  STAFF_THEME_CSS_VARS,
} from "./tokens";

export {
  StaffPage,
  StaffHeader,
  StaffDashboard,
  StaffCard,
  StaffCardHeader,
  StaffCardTitle,
  StaffCardDescription,
  StaffCardContent,
  StaffCardFooter,
  StaffMetric,
  StaffProgressCard,
  StaffStatusBadge,
  StaffTimeline,
  StaffActionBar,
  StaffBottomActions,
  StaffChecklist,
  StaffSyncChip,
  StaffEmptyState,
  StaffErrorState,
  StaffOfflineState,
  StaffPermissionState,
  StaffLoading,
  StaffSkeleton,
  StaffDialog,
  StaffDrawer,
  StaffTabs,
  StaffTabsList,
  StaffTabsTrigger,
  StaffTabsContent,
  StaffButton,
} from "./components/primitives";

export type { StaffTimelineEvent } from "./components/primitives";

export { StaffInput } from "./components/StaffButton";
export type { StaffButtonProps, StaffInputProps } from "./components/StaffButton";

export {
  StaffJobCard,
  StaffMapCard,
  StaffPhotoCapture,
  StaffPhotoPair,
  StaffAttendanceCard,
  StaffProfileCard,
  StaffNotificationCard,
  StaffSuccessBanner,
} from "./components/domain";

export type { StaffPhotoSlotState } from "./components/domain";

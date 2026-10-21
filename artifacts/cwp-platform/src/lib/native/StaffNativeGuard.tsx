import { AppNativeGuard } from "./AppNativeGuard";

/**
 * Multi-portal native guard (backwards compatible alias).
 * Isolates navigation and manages Android hardware back button
 * for both CWP Staff and CWP Customer apps.
 */
export const StaffNativeGuard = AppNativeGuard;
export { AppNativeGuard };
export default AppNativeGuard;

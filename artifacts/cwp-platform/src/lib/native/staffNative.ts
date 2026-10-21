export {
  isStaffNativeApp,
  isCustomerNativeApp,
  isAnyNativeApp,
  getSyncNativePortal,
  getNativePortal,
  isPortalAllowedPath,
  portalHomePath,
  isRootScreenForPortal,
} from "./portalNative";

import { isPortalAllowedPath, portalHomePath } from "./portalNative";

const STAFF_NATIVE_PATHS = ["/staff"];

export function isStaffNativeAllowedPath(pathname: string): boolean {
  return isPortalAllowedPath("staff", pathname);
}

export function staffNativeHomePath(): string {
  return portalHomePath("staff");
}

export { STAFF_NATIVE_PATHS };

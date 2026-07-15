import type { UserRole } from "./auth";

export type AuthPortal = "admin" | "staff" | "customer" | "franchisee";

export const AUTH_PORTAL_HEADER = "X-Auth-Portal";

const LEGACY_TOKEN_KEY = "cwp_token";
const LEGACY_USER_KEY = "cwp_user";

const ADMIN_ROLES = new Set<UserRole>(["admin", "superadmin", "manager"]);
const STAFF_ROLES = new Set<UserRole>(["staff"]);
const CUSTOMER_ROLES = new Set<UserRole>(["customer"]);
const FRANCHISEE_ROLES = new Set<UserRole>(["franchisee"]);

export function resolveAuthPortal(pathname?: string): AuthPortal {
  const path = pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/staff")) return "staff";
  if (path.startsWith("/franchisee")) return "franchisee";
  return "customer";
}

export function tokenStorageKey(portal: AuthPortal): string {
  return `cwp_token_${portal}`;
}

export function userStorageKey(portal: AuthPortal): string {
  return `cwp_user_${portal}`;
}

export function roleMatchesPortal(role: UserRole, portal: AuthPortal): boolean {
  switch (portal) {
    case "admin":
      return ADMIN_ROLES.has(role);
    case "staff":
      return STAFF_ROLES.has(role);
    case "customer":
      return CUSTOMER_ROLES.has(role);
    case "franchisee":
      return FRANCHISEE_ROLES.has(role);
  }
}

/** One-time migration from shared legacy keys into the portal that matches the cached role. */
export function migrateLegacySession(portal: AuthPortal): void {
  if (localStorage.getItem(userStorageKey(portal))) return;

  const legacyUser = localStorage.getItem(LEGACY_USER_KEY);
  if (!legacyUser) return;

  try {
    const parsed = JSON.parse(legacyUser) as { role?: UserRole };
    if (!parsed.role || !roleMatchesPortal(parsed.role, portal)) return;

    const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
    localStorage.setItem(userStorageKey(portal), legacyUser);
    if (legacyToken) localStorage.setItem(tokenStorageKey(portal), legacyToken);
  } catch {
    // ignore corrupt legacy cache
  }
}

export function authPortalHeaders(portal: AuthPortal): Record<string, string> {
  return { [AUTH_PORTAL_HEADER]: portal };
}

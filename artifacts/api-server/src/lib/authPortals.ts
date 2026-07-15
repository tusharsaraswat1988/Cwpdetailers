export type AuthPortal = "admin" | "staff" | "customer" | "franchisee";

export const AUTH_PORTALS: AuthPortal[] = ["admin", "staff", "customer", "franchisee"];

export const AUTH_PORTAL_HEADER = "x-auth-portal";

const ADMIN_ROLES = new Set(["admin", "superadmin", "manager"]);
const STAFF_ROLES = new Set(["staff"]);
const CUSTOMER_ROLES = new Set(["customer"]);
const FRANCHISEE_ROLES = new Set(["franchisee"]);

export function isAuthPortal(value: unknown): value is AuthPortal {
  return typeof value === "string" && (AUTH_PORTALS as string[]).includes(value);
}

export function isRoleAllowedForPortal(role: string, portal: AuthPortal): boolean {
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

export function portalMismatchMessage(portal: AuthPortal): string {
  switch (portal) {
    case "admin":
      return "This account cannot sign in to the admin portal.";
    case "staff":
      return "This portal is for field staff only.";
    case "franchisee":
      return "This portal is for franchisee partners only.";
    default:
      return "This account cannot sign in here. Use the correct portal.";
  }
}

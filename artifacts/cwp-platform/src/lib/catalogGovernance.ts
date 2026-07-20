import { useAuth, type UserRole } from "@/lib/auth";

/** HQ / ops owns catalog prices and product definitions. */
export function isHqCatalogEditor(role?: UserRole | null): boolean {
  return role === "superadmin" || role === "admin";
}

export function useCatalogGovernance() {
  const { user } = useAuth();
  const hqEditor = isHqCatalogEditor(user?.role);
  return {
    hqEditor,
    /** Branch owners may only toggle availability on existing products. */
    availabilityOnly: !hqEditor,
  };
}

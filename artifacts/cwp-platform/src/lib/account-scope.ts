import { useAuth } from "@/lib/auth";

/**
 * Account scope for portal API calls.
 *
 * Asset-first alignment: the authenticated account owns assets (vehicles, solar
 * sites). Portals must scope reads/writes to the logged-in account — never a
 * hardcoded demo ID. Asset CRUD and booking flows attach assetId in Phase 2+.
 */
export function useAccountScope() {
  const { user, isLoading } = useAuth();

  const customerId =
    user?.role === "customer" ? (user.customerId ?? null) : null;
  const staffId = user?.role === "staff" ? (user.staffId ?? null) : null;

  return {
    user,
    isLoading,
    customerId,
    staffId,
    isCustomer: user?.role === "customer",
    isStaff: user?.role === "staff",
    missingCustomerLink: user?.role === "customer" && customerId == null,
    missingStaffLink: user?.role === "staff" && staffId == null,
  };
}

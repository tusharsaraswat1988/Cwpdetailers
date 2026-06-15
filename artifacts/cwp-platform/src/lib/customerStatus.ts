/** Founder-facing customer lifecycle — maps to API enum active | inactive | suspended */

export type ApiCustomerStatus = "active" | "inactive" | "suspended";

export type FounderCustomerStatus = "active" | "inactive" | "archived";

export const FOUNDER_STATUS_LABELS: Record<FounderCustomerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

export function apiToFounderStatus(status: ApiCustomerStatus): FounderCustomerStatus {
  if (status === "suspended") return "archived";
  return status;
}

export function founderToApiStatus(status: FounderCustomerStatus): ApiCustomerStatus {
  if (status === "archived") return "suspended";
  return status;
}

export function founderStatusBadgeClass(status: FounderCustomerStatus): string {
  switch (status) {
    case "active":
      return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
    case "inactive":
      return "bg-muted text-muted-foreground border-border";
    case "archived":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
  }
}

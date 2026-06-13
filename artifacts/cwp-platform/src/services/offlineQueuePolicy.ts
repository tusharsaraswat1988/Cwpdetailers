/** Operations that may be queued offline and synced later. */
export const OFFLINE_QUEUE_ALLOWED_TYPES = [
  "booking",
  "customer",
  "note",
  "expense",
  "follow_up",
] as const;

export type QueueOperationType = (typeof OFFLINE_QUEUE_ALLOWED_TYPES)[number];

/**
 * Financial and inventory mutations must never be queued — server confirmation required.
 * Expenses are explicitly allowed and are not matched here.
 */
const FINANCIAL_OR_INVENTORY_URL_PATTERNS: RegExp[] = [
  /\/api\/payments(?:\/|$)/i,
  /\/api\/invoices(?:\/|$)/i,
  /\/api\/wallet(?:\/|$)/i,
  /\/api\/billing(?:\/|$)/i,
  /\/api\/quotations(?:\/|$)/i,
  /\/inventory(?:\/|$)/i,
  /\/stock(?:\/|$)/i,
];

export function isOfflineQueueAllowedType(type: string | undefined): type is QueueOperationType {
  return OFFLINE_QUEUE_ALLOWED_TYPES.includes(type as QueueOperationType);
}

export function isFinancialOrInventoryUrl(url: string): boolean {
  try {
    const path = new URL(url, "http://local").pathname;
    return FINANCIAL_OR_INVENTORY_URL_PATTERNS.some((pattern) => pattern.test(path));
  } catch {
    return FINANCIAL_OR_INVENTORY_URL_PATTERNS.some((pattern) => pattern.test(url));
  }
}

export function canQueueOfflineOperation(
  type: string | undefined,
  url: string,
): type is QueueOperationType {
  if (!isOfflineQueueAllowedType(type)) return false;
  if (type === "expense") return true;
  return !isFinancialOrInventoryUrl(url);
}

export const SERVER_CONFIRMATION_REQUIRED_MESSAGE =
  "This action requires confirmed server connection. Complete it when you're back online.";

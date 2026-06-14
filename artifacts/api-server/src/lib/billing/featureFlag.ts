/** Sprint 4C feature flag — default enabled when unset. */
export function isBookServicesBillingEnabled(): boolean {
  return process.env.ENABLE_BOOK_SERVICES_BILLING !== "false";
}

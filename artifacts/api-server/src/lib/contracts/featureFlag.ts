/** Sprint 4B feature flag — default enabled when unset. */
export function isBookServicesContractsEnabled(): boolean {
  return process.env.ENABLE_BOOK_SERVICES_CONTRACTS !== "false";
}

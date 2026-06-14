/** Sprint 6 feature flag — default enabled when unset. */
export function isServiceAssignmentsEnabled(): boolean {
  return process.env.ENABLE_SERVICE_ASSIGNMENTS !== "false";
}

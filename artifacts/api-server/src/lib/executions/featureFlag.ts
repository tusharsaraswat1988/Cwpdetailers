/** Sprint 7 feature flag — default enabled when unset. */
export function isServiceExecutionsEnabled(): boolean {
  return process.env.ENABLE_SERVICE_EXECUTIONS !== "false";
}

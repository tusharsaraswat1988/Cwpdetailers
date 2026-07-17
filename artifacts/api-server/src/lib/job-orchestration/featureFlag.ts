/** Phase 5.5 — Job Orchestration feature flag (default enabled). */
export function isJobOrchestrationEnabled(): boolean {
  return process.env.ENABLE_JOB_ORCHESTRATION !== "false";
}

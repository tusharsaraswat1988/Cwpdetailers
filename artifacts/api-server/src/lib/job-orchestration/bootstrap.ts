/**
 * Phase 5.5 — wire Job Orchestration to Field Execution events (subscribe only).
 * Does not modify Field Execution services.
 */

import { logger } from "../logger";
import { executionDomainEventPublisher } from "../executions/domainEvents";
import {
  enterQualityReviewFromFieldComplete,
  syncOpsCancelledFromField,
} from "./jobOrchestrationService";
import { isJobOrchestrationEnabled } from "./featureFlag";

let wired = false;

export function bootstrapJobOrchestration(): void {
  if (wired) return;
  if (!isJobOrchestrationEnabled()) {
    logger.info("Job orchestration disabled via ENABLE_JOB_ORCHESTRATION=false");
    return;
  }

  executionDomainEventPublisher.subscribe(async (event) => {
    try {
      if (event.type === "ExecutionCompleted") {
        await enterQualityReviewFromFieldComplete(event.executionId);
      } else if (event.type === "ExecutionCancelled") {
        const source = event.metadata?.source;
        // Orchestration cancel already set ops_status; skip duplicate sync.
        if (source === "orchestration") return;
        await syncOpsCancelledFromField(
          event.executionId,
          typeof event.metadata?.reason === "string" ? event.metadata.reason : undefined,
        );
      }
    } catch (err) {
      logger.error({ err, eventType: event.type, executionId: event.executionId }, "job orchestration event handler failed");
    }
  });

  wired = true;
  logger.info("Job orchestration bootstrapped (subscribed to ExecutionCompleted / ExecutionCancelled)");
}

/**
 * Phase 5.5 — Job Orchestration domain events (publish only; no delivery).
 * Job ID = service_executions.id (Architecture A).
 */

import type { Logger } from "pino";

export type JobDomainEventType =
  | "JobCompleted"
  | "JobReopened"
  | "JobEscalated"
  | "JobApproved"
  | "JobCancelled"
  | "JobReadyForBilling"
  | "JobPriorityChanged";

export type JobDomainEvent = {
  type: JobDomainEventType;
  timestamp: string;
  jobId: number;
  executionId: number;
  contractId: number;
  customerId: number;
  staffId: number;
  actorId?: number | null;
  metadata?: Record<string, unknown>;
};

type Handler = (event: JobDomainEvent) => void | Promise<void>;

export class JobDomainEventPublisher {
  private subscribers: Handler[] = [];

  subscribe(handler: Handler): () => void {
    this.subscribers.push(handler);
    return () => {
      this.subscribers = this.subscribers.filter((h) => h !== handler);
    };
  }

  publish(event: JobDomainEvent, logger?: Logger): void {
    logger?.debug(
      { eventType: event.type, jobId: event.jobId },
      `job domain event: ${event.type}`,
    );
    for (const handler of this.subscribers) {
      try {
        void handler(event);
      } catch (err) {
        logger?.error({ err, eventType: event.type }, "job event handler failed");
      }
    }
  }

  clearSubscribers(): void {
    this.subscribers = [];
  }
}

export const jobDomainEventPublisher = new JobDomainEventPublisher();

export function baseJobEventFields(
  partial: Omit<JobDomainEvent, "type" | "timestamp">,
): Omit<JobDomainEvent, "type"> {
  return {
    timestamp: new Date().toISOString(),
    ...partial,
  };
}

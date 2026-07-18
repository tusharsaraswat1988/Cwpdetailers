/**
 * Phase 5.4 — Field Execution domain events (publish only; no delivery).
 */

import type { Logger } from "pino";

export type ExecutionDomainEventType =
  | "ExecutionStarted"
  | "ExecutionPaused"
  | "ExecutionResumed"
  | "ExecutionCompleted"
  | "ExecutionCancelled"
  | "ChecklistCompleted"
  | "BeforePhotosUploaded"
  | "AfterPhotosUploaded";

export type ExecutionDomainEvent = {
  type: ExecutionDomainEventType;
  timestamp: string;
  executionId: number;
  serviceAssignmentId?: number | null;
  contractId: number;
  customerId: number;
  staffId: number;
  actorId?: number | null;
  metadata?: Record<string, unknown>;
};

type Handler = (event: ExecutionDomainEvent) => void | Promise<void>;

export class ExecutionDomainEventPublisher {
  private subscribers: Handler[] = [];

  subscribe(handler: Handler): () => void {
    this.subscribers.push(handler);
    return () => {
      this.subscribers = this.subscribers.filter((h) => h !== handler);
    };
  }

  publish(event: ExecutionDomainEvent, logger?: Logger): void {
    logger?.debug(
      { eventType: event.type, executionId: event.executionId },
      `execution domain event: ${event.type}`,
    );
    for (const handler of this.subscribers) {
      try {
        void handler(event);
      } catch (err) {
        logger?.error({ err, eventType: event.type }, "execution event handler failed");
      }
    }
  }

  clearSubscribers(): void {
    this.subscribers = [];
  }
}

export const executionDomainEventPublisher = new ExecutionDomainEventPublisher();

export function baseExecutionEventFields(
  partial: Omit<ExecutionDomainEvent, "type" | "timestamp">,
): Omit<ExecutionDomainEvent, "type"> {
  return {
    timestamp: new Date().toISOString(),
    ...partial,
  };
}

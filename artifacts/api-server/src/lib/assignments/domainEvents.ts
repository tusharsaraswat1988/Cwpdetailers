/**
 * Phase 5.3 — Assignment domain events (publish only; no delivery).
 * Infrastructure-independent for future Notification / Execution modules.
 */

import type { Logger } from "pino";

export type AssignmentDomainEventType =
  | "AssignmentCreated"
  | "AssignmentChanged"
  | "AssignmentRemoved"
  | "AssignmentReadyForExecution";

export type AssignmentDomainEventBase = {
  type: AssignmentDomainEventType;
  timestamp: string;
  assignmentId: number;
  pendingAssignmentId: number;
  contractId: number;
  customerId: number;
  staffId?: number | null;
  previousStaffId?: number | null;
  taskType?: string;
  bookingId?: number | null;
  actorId?: number | null;
};

export type AssignmentCreatedEvent = AssignmentDomainEventBase & {
  type: "AssignmentCreated";
  staffId: number;
};

export type AssignmentChangedEvent = AssignmentDomainEventBase & {
  type: "AssignmentChanged";
  staffId: number;
  previousStaffId: number;
};

export type AssignmentRemovedEvent = AssignmentDomainEventBase & {
  type: "AssignmentRemoved";
  previousStaffId: number;
};

export type AssignmentReadyForExecutionEvent = AssignmentDomainEventBase & {
  type: "AssignmentReadyForExecution";
  staffId: number;
};

export type AssignmentDomainEvent =
  | AssignmentCreatedEvent
  | AssignmentChangedEvent
  | AssignmentRemovedEvent
  | AssignmentReadyForExecutionEvent;

type Handler = (event: AssignmentDomainEvent) => void | Promise<void>;

export class AssignmentDomainEventPublisher {
  private subscribers: Handler[] = [];

  subscribe(handler: Handler): () => void {
    this.subscribers.push(handler);
    return () => {
      this.subscribers = this.subscribers.filter((h) => h !== handler);
    };
  }

  publish(event: AssignmentDomainEvent, logger?: Logger): void {
    logger?.debug(
      { eventType: event.type, assignmentId: event.assignmentId },
      `assignment domain event: ${event.type}`,
    );
    for (const handler of this.subscribers) {
      try {
        void handler(event);
      } catch (err) {
        logger?.error({ err, eventType: event.type }, "assignment event handler failed");
      }
    }
  }

  clearSubscribers(): void {
    this.subscribers = [];
  }
}

export const assignmentDomainEventPublisher = new AssignmentDomainEventPublisher();

export function baseAssignmentEventFields(partial: Omit<AssignmentDomainEventBase, "type" | "timestamp">) {
  return {
    timestamp: new Date().toISOString(),
    ...partial,
  };
}

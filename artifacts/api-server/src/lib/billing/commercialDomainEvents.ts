/**
 * Phase 5.6 — Billing domain events (publish only; no notification delivery).
 */

import type { Logger } from "pino";

export type BillingDomainEventType =
  | "InvoiceCreated"
  | "InvoiceIssued"
  | "InvoicePaid"
  | "InvoiceVoided"
  | "InvoiceCancelled"
  | "InvoiceReady"
  | "CreditNoteCreated"
  | "CommercialClosed";

export type BillingDomainEvent = {
  type: BillingDomainEventType;
  timestamp: string;
  invoiceId: number;
  invoiceNumber?: string;
  executionId?: number | null;
  contractId?: number | null;
  customerId: number;
  actorId?: number | null;
  metadata?: Record<string, unknown>;
};

type Handler = (event: BillingDomainEvent) => void | Promise<void>;

export class BillingDomainEventPublisher {
  private subscribers: Handler[] = [];

  subscribe(handler: Handler): () => void {
    this.subscribers.push(handler);
    return () => {
      this.subscribers = this.subscribers.filter((h) => h !== handler);
    };
  }

  publish(event: BillingDomainEvent, logger?: Logger): void {
    logger?.debug(
      { eventType: event.type, invoiceId: event.invoiceId },
      `billing domain event: ${event.type}`,
    );
    for (const handler of this.subscribers) {
      try {
        void handler(event);
      } catch (err) {
        logger?.error({ err, eventType: event.type }, "billing event handler failed");
      }
    }
  }

  clearSubscribers(): void {
    this.subscribers = [];
  }
}

export const billingDomainEventPublisher = new BillingDomainEventPublisher();

export function baseBillingEventFields(
  partial: Omit<BillingDomainEvent, "type" | "timestamp">,
): Omit<BillingDomainEvent, "type"> {
  return {
    timestamp: new Date().toISOString(),
    ...partial,
  };
}

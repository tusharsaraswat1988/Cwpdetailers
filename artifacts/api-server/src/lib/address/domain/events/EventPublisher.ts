import type { Logger } from "pino";
import type { AddressDomainEvent } from "./types";

type EventListener = (event: AddressDomainEvent) => void;

/** Publish-only — no consumers in freeze pass. */
export class AddressDomainEventPublisher {
  private listeners: EventListener[] = [];

  subscribe(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  publish(event: AddressDomainEvent, logger?: Logger): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow subscriber errors
      }
    }

    logger?.info(
      {
        domainEvent: event.type,
        traceId: event.traceId,
        requestId: event.requestId,
        addressOperationId: event.addressOperationId,
        identityId: event.identityId,
        addressId: event.addressId,
        customerId: event.customerId,
        version: event.version,
      },
      `address domain event: ${event.type}`,
    );
  }

  clearSubscribers(): void {
    this.listeners = [];
  }
}

export const addressDomainEventPublisher = new AddressDomainEventPublisher();

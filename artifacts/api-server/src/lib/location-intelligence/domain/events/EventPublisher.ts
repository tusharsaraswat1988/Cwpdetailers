import type { Logger } from "pino";
import type { LocationDomainEvent } from "./types";

type EventListener = (event: LocationDomainEvent) => void;

/**
 * Publish-only domain event bus.
 * No consumers registered in Phase 1 freeze — future Analytics, Pricing, AI modules subscribe here.
 */
export class LocationDomainEventPublisher {
  private listeners: EventListener[] = [];

  subscribe(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  publish(event: LocationDomainEvent, logger?: Logger): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow subscriber errors — publisher must not break validation path
      }
    }

    logger?.info(
      {
        domainEvent: event.type,
        traceId: event.traceId,
        requestId: event.requestId,
        coverageValidationId: event.coverageValidationId,
        bookingId: event.bookingId,
        version: event.version,
      },
      `location domain event: ${event.type}`,
    );
  }

  clearSubscribers(): void {
    this.listeners = [];
  }
}

export const locationDomainEventPublisher = new LocationDomainEventPublisher();

import type { Logger } from "pino";
import type { BookingDomainEvent } from "./types";

type BookingEventHandler = (event: BookingDomainEvent) => void | Promise<void>;

/** Publish-only event bus — no consumers wired in Phase 3. */
export class BookingDomainEventPublisher {
  private subscribers: BookingEventHandler[] = [];

  subscribe(handler: BookingEventHandler): () => void {
    this.subscribers.push(handler);
    return () => {
      this.subscribers = this.subscribers.filter((h) => h !== handler);
    };
  }

  publish(event: BookingDomainEvent, logger?: Logger): void {
    logger?.debug(
      {
        eventType: event.type,
        traceId: event.traceId,
        bookingId: event.bookingId,
        bookingOperationId: event.bookingOperationId,
      },
      `booking domain event: ${event.type}`,
    );
    for (const handler of this.subscribers) {
      try {
        void handler(event);
      } catch (err) {
        logger?.error({ err, eventType: event.type }, "booking event handler failed");
      }
    }
  }

  clearSubscribers(): void {
    this.subscribers = [];
  }
}

export const bookingDomainEventPublisher = new BookingDomainEventPublisher();

import {
  pgTable,
  serial,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const paymentWebhookEventsTable = pgTable(
  "payment_webhook_events",
  {
    id: serial("id").primaryKey(),
    eventId: text("event_id").notNull().unique(),
    gatewayProvider: text("gateway_provider").notNull().default("razorpay"),
    eventType: text("event_type").notNull(),
    orderId: text("order_id"),
    paymentId: text("payment_id"),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    status: text("status").notNull().default("processed"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("payment_webhook_events_event_id_idx").on(t.eventId),
    index("payment_webhook_events_order_id_idx").on(t.orderId),
    index("payment_webhook_events_payment_id_idx").on(t.paymentId),
    index("payment_webhook_events_created_at_idx").on(t.createdAt),
  ],
);

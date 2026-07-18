import { pgTable, serial, integer, text, timestamp, pgEnum, json, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Phase 5.6 — commercial audit history (Billing-owned; not ops/field timeline). */
export const billingCommercialTimelineEventTypeEnum = pgEnum("billing_commercial_timeline_event_type", [
  "COMMERCIAL_PREVIEWED",
  "INVOICE_DRAFT_CREATED",
  "INVOICE_ISSUED",
  "INVOICE_PAYMENT_PENDING",
  "INVOICE_PAID",
  "INVOICE_VOIDED",
  "INVOICE_CANCELLED",
  "CREDIT_NOTE_CREATED",
  "ENTITLEMENT_CONSUMED",
  "COMMERCIAL_CLOSED",
]);

export const billingCommercialTimelineTable = pgTable("billing_commercial_timeline", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id"),
  executionId: integer("execution_id"),
  eventType: billingCommercialTimelineEventTypeEnum("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  actorId: integer("actor_id"),
  actorName: text("actor_name"),
  metadata: json("metadata").$type<Record<string, unknown>>().default({}),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_billing_commercial_timeline_invoice").on(t.invoiceId),
  index("idx_billing_commercial_timeline_execution").on(t.executionId),
  index("idx_billing_commercial_timeline_event").on(t.eventType),
]);

export const insertBillingCommercialTimelineSchema = createInsertSchema(billingCommercialTimelineTable).omit({
  id: true,
  createdAt: true,
});

export type BillingCommercialTimeline = typeof billingCommercialTimelineTable.$inferSelect;
export type InsertBillingCommercialTimeline = z.infer<typeof insertBillingCommercialTimelineSchema>;
export type BillingCommercialTimelineEventType =
  typeof billingCommercialTimelineEventTypeEnum.enumValues[number];

import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { invoicesTable } from "./invoices";

export type PaymentAttemptStatus =
  | "initiated"
  | "active"
  | "paid"
  | "failed"
  | "user_dropped"
  | "expired";

export const paymentAttemptsTable = pgTable(
  "payment_attempts",
  {
    id: serial("id").primaryKey(),
    attemptId: text("attempt_id").notNull().unique(),
    cfOrderId: text("cf_order_id").notNull().unique(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customersTable.id),
    invoiceId: integer("invoice_id").references(() => invoicesTable.id),
    cityId: integer("city_id"),
    branchId: integer("branch_id"),
    subscriptionId: integer("subscription_id"),
    legalEntityId: integer("legal_entity_id"),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    cfPaymentSessionId: text("cf_payment_session_id"),
    status: text("status").notNull().default("initiated").$type<PaymentAttemptStatus>(),
    cfPaymentId: text("cf_payment_id"),
    paymentMethod: text("payment_method"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    rawWebhookPayload: jsonb("raw_webhook_payload").$type<Record<string, unknown> | null>(),
    rawVerificationPayload: jsonb("raw_verification_payload").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("payment_attempts_customer_id_idx").on(t.customerId),
    index("payment_attempts_invoice_id_idx").on(t.invoiceId),
    index("payment_attempts_subscription_id_idx").on(t.subscriptionId),
    index("payment_attempts_city_id_idx").on(t.cityId),
    index("payment_attempts_branch_id_idx").on(t.branchId),
    index("payment_attempts_status_idx").on(t.status),
    index("payment_attempts_attempt_id_idx").on(t.attemptId),
    index("payment_attempts_cf_order_id_idx").on(t.cfOrderId),
    index("payment_attempts_idempotency_key_idx").on(t.idempotencyKey),
  ],
);

export const paymentAttemptsRelations = relations(paymentAttemptsTable, ({ one }) => ({
  customer: one(customersTable, {
    fields: [paymentAttemptsTable.customerId],
    references: [customersTable.id],
  }),
  invoice: one(invoicesTable, {
    fields: [paymentAttemptsTable.invoiceId],
    references: [invoicesTable.id],
  }),
}));

export const insertPaymentAttemptSchema = createInsertSchema(paymentAttemptsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPaymentAttempt = z.infer<typeof insertPaymentAttemptSchema>;
export type PaymentAttempt = typeof paymentAttemptsTable.$inferSelect;
export type NewPaymentAttempt = typeof paymentAttemptsTable.$inferInsert;

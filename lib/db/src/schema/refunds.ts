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
import { invoicesTable, paymentsTable } from "./invoices";
import { paymentAttemptsTable } from "./payment-attempts";
import { bookingsTable } from "./bookings";
import { usersTable } from "./users";
import { citiesTable } from "./city-masters";
import { branchesTable } from "./branches";

export type RefundStatus = "initiated" | "pending" | "succeeded" | "failed" | "cancelled";

export const paymentRefundsTable = pgTable(
  "payment_refunds",
  {
    id: serial("id").primaryKey(),
    refundId: text("refund_id").notNull().unique(),
    paymentId: integer("payment_id").references(() => paymentsTable.id),
    attemptId: integer("attempt_id").references(() => paymentAttemptsTable.id),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customersTable.id),
    bookingId: integer("booking_id").references(() => bookingsTable.id),
    invoiceId: integer("invoice_id").references(() => invoicesTable.id),
    cityId: integer("city_id").references(() => citiesTable.id),
    branchId: integer("branch_id").references(() => branchesTable.id),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("initiated").$type<RefundStatus>(),
    gatewayProvider: text("gateway_provider").notNull().default("cashfree"),
    cfRefundId: text("cf_refund_id"),
    rzpRefundId: text("rzp_refund_id"),
    gatewayRefundId: text("gateway_refund_id"),
    rawGatewayPayload: jsonb("raw_gateway_payload").$type<Record<string, unknown> | null>(),
    initiatedByUserId: integer("initiated_by_user_id").references(() => usersTable.id),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("payment_refunds_refund_id_idx").on(t.refundId),
    index("payment_refunds_payment_id_idx").on(t.paymentId),
    index("payment_refunds_attempt_id_idx").on(t.attemptId),
    index("payment_refunds_customer_id_idx").on(t.customerId),
    index("payment_refunds_booking_id_idx").on(t.bookingId),
    index("payment_refunds_invoice_id_idx").on(t.invoiceId),
    index("payment_refunds_status_idx").on(t.status),
    index("payment_refunds_created_at_idx").on(t.createdAt),
    index("payment_refunds_gateway_provider_idx").on(t.gatewayProvider),
  ],
);

export const paymentRefundsRelations = relations(paymentRefundsTable, ({ one }) => ({
  customer: one(customersTable, {
    fields: [paymentRefundsTable.customerId],
    references: [customersTable.id],
  }),
  payment: one(paymentsTable, {
    fields: [paymentRefundsTable.paymentId],
    references: [paymentsTable.id],
  }),
  attempt: one(paymentAttemptsTable, {
    fields: [paymentRefundsTable.attemptId],
    references: [paymentAttemptsTable.id],
  }),
  booking: one(bookingsTable, {
    fields: [paymentRefundsTable.bookingId],
    references: [bookingsTable.id],
  }),
  invoice: one(invoicesTable, {
    fields: [paymentRefundsTable.invoiceId],
    references: [invoicesTable.id],
  }),
  initiatedBy: one(usersTable, {
    fields: [paymentRefundsTable.initiatedByUserId],
    references: [usersTable.id],
  }),
}));

export const insertPaymentRefundSchema = createInsertSchema(paymentRefundsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPaymentRefund = z.infer<typeof insertPaymentRefundSchema>;
export type PaymentRefund = typeof paymentRefundsTable.$inferSelect;
export type NewPaymentRefund = typeof paymentRefundsTable.$inferInsert;

import { pgTable, serial, integer, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serviceExceptionsTable = pgTable(
  "service_exceptions",
  {
    id: serial("id").primaryKey(),
    exceptionCode: text("exception_code").notNull(),
    category: text("category").notNull(), // 'unassigned_booking' | 'service_delayed' | 'customer_cancellation' | 'staff_reported_issue' | 'failed_photo_upload' | 'incomplete_service' | 'failed_notification' | 'payment_failure' | 'customer_complaint' | 'repeated_issue' | 'other'
    severity: text("severity").notNull().default("medium"), // 'low' | 'medium' | 'high' | 'critical'
    status: text("status").notNull().default("open"), // 'open' | 'investigating' | 'acknowledged' | 'resolved' | 'dismissed'
    title: text("title").notNull(),
    reason: text("reason").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    bookingId: integer("booking_id"),
    customerId: integer("customer_id"),
    staffId: integer("staff_id"),
    executionId: integer("execution_id"),
    subscriptionId: integer("subscription_id"),
    complaintId: integer("complaint_id"),
    cityId: integer("city_id"),
    branchId: integer("branch_id"),
    companyId: integer("company_id"),
    dedupeKey: text("dedupe_key"),
    evidenceUrl: text("evidence_url"),
    acknowledgedAt: timestamp("acknowledged_at"),
    acknowledgedBy: integer("acknowledged_by"),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: integer("resolved_by"),
    resolutionNotes: text("resolution_notes"),
    resolutionAction: text("resolution_action"), // 'reassigned' | 'rescheduled' | 'cancelled_with_refund' | 'refund_processed' | 'ticket_created' | 'manual_override' | 'dismissed_valid' | 'none'
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: uniqueIndex("idx_service_exceptions_code").on(t.exceptionCode),
    dedupeIdx: uniqueIndex("idx_service_exceptions_dedupe").on(t.dedupeKey),
    statusIdx: index("idx_service_exceptions_status").on(t.status),
    categoryIdx: index("idx_service_exceptions_category").on(t.category),
    cityBranchIdx: index("idx_service_exceptions_city_branch").on(t.cityId, t.branchId),
    bookingIdx: index("idx_service_exceptions_booking").on(t.bookingId),
    customerIdx: index("idx_service_exceptions_customer").on(t.customerId),
    staffIdx: index("idx_service_exceptions_staff").on(t.staffId),
    createdIdx: index("idx_service_exceptions_created").on(t.createdAt),
  }),
);

export const insertServiceExceptionSchema = createInsertSchema(serviceExceptionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ServiceException = typeof serviceExceptionsTable.$inferSelect;
export type InsertServiceException = z.infer<typeof insertServiceExceptionSchema>;

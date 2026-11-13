import { pgTable, serial, integer, text, boolean, timestamp, pgEnum, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationTypeEnum = pgEnum("notification_type", [
  "booking_confirmation",
  "payment_reminder",
  "subscription_expiry",
  "service_complete",
  "complaint_update",
  "broadcast",
  "payment_initiated",
  "payment_success",
  "payment_failed",
  "subscription_activated",
  "subscription_paused",
  "subscription_resumed",
  "subscription_cancelled",
  "subscription_renewal_due",
  "cleaning_completed",
  "cleaning_cna",
  "cleaning_missed",
  "exception_resolved",
  "ticket_created",
  "ticket_updated",
  "ticket_resolved",
  "staff_assigned",
  "technician_en_route",
  "service_started",
  "staff_reassigned",
  "schedule_changed",
  "assignment_cancelled",
  "makeup_booking_confirmed",
  "assignment_failure",
  "repeated_execution_failure",
  "reschedule_approval_required",
  "general",
]);
export const notificationChannelEnum = pgEnum("notification_channel", ["in_app", "whatsapp", "email", "sms"]);
export const notificationDeliveryStatusEnum = pgEnum("notification_delivery_status", [
  "pending", "sent", "failed", "skipped",
]);

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  customerId: integer("customer_id"),
  cityId: integer("city_id"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: notificationTypeEnum("type").notNull(),
  channel: notificationChannelEnum("channel").notNull().default("in_app"),
  deliveryStatus: notificationDeliveryStatusEnum("delivery_status").notNull().default("pending"),
  actionUrl: text("action_url"),
  metadata: jsonb("metadata").default({}),
  retryCount: integer("retry_count").default(0),
  errorMessage: text("error_message"),
  externalId: text("external_id"),
  dedupeKey: text("dedupe_key"),
  isRead: boolean("is_read").notNull().default(false),
  isMarketing: boolean("is_marketing").default(false),
  sensitiveMasked: boolean("sensitive_masked").default(false),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, t => ({
  userReadIdx: index("idx_notifications_user_read").on(t.userId, t.isRead),
  customerReadIdx: index("idx_notifications_customer_read").on(t.customerId, t.isRead),
  cityIdx: index("idx_notifications_city").on(t.cityId),
  dedupeIdx: index("idx_notifications_dedupe").on(t.dedupeKey),
}));

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;

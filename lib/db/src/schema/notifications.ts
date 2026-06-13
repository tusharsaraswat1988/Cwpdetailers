import { pgTable, serial, integer, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationTypeEnum = pgEnum("notification_type", [
  "booking_confirmation", "payment_reminder", "subscription_expiry", "service_complete", "complaint_update", "broadcast"
]);
export const notificationChannelEnum = pgEnum("notification_channel", ["in_app", "whatsapp", "email", "sms"]);
export const notificationDeliveryStatusEnum = pgEnum("notification_delivery_status", [
  "pending", "sent", "failed", "skipped",
]);

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: notificationTypeEnum("type").notNull(),
  channel: notificationChannelEnum("channel").notNull().default("in_app"),
  deliveryStatus: notificationDeliveryStatusEnum("delivery_status").notNull().default("pending"),
  externalId: text("external_id"),
  dedupeKey: text("dedupe_key"),
  isRead: boolean("is_read").notNull().default(false),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;

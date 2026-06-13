import {
  pgTable, serial, integer, text, timestamp, json, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { notificationEventsTable } from "./dcms";

export type PushSubscriptionKeys = {
  p256dh: string;
  auth: string;
};

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  keys: json("keys").$type<PushSubscriptionKeys>().notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, t => ({
  userIdx: index("idx_push_subscriptions_user").on(t.userId),
  roleIdx: index("idx_push_subscriptions_role").on(t.role),
}));

export const pushNotificationsTable = pgTable("push_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  notificationEventId: integer("notification_event_id").references(() => notificationEventsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull().default({}),
  channel: text("channel").notNull().default("web_push"),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  eventType: text("event_type"),
  reason: text("reason"),
  recipientRole: text("recipient_role"),
  recipientName: text("recipient_name"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, t => ({
  userIdx: index("idx_push_notifications_user").on(t.userId, t.createdAt),
  eventIdx: index("idx_push_notifications_event").on(t.notificationEventId),
  eventTypeIdx: index("idx_push_notifications_event_type").on(t.eventType),
}));

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptionsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertPushNotificationSchema = createInsertSchema(pushNotificationsTable).omit({
  id: true, createdAt: true,
});

export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushNotification = typeof pushNotificationsTable.$inferSelect;

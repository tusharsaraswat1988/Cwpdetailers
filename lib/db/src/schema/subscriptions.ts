import { pgTable, serial, integer, numeric, date, timestamp, pgEnum, text, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subscriptionTypeEnum = pgEnum("subscription_type", ["monthly_wash", "solar_amc", "detailing_plan"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active", "paused", "expiring", "expired", "cancelled", "pending", "missed",
]);

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  vehicleId: integer("vehicle_id"),
  solarSiteId: integer("solar_site_id"),
  serviceId: integer("service_id"),
  type: subscriptionTypeEnum("type").notNull(),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  nextServiceDate: date("next_service_date"),
  nextDueDate: date("next_due_date"),
  frequencyDays: integer("frequency_days"),
  recurrenceRule: text("recurrence_rule"),
  totalServices: integer("total_services"),
  servicesUsed: integer("services_used").notNull().default(0),
  servicesRemaining: integer("services_remaining"),
  graceMinutes: integer("grace_minutes").notNull().default(60),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  dueAmount: numeric("due_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  notes: text("notes"),
  cancelledAt: timestamp("cancelled_at"),
  cancellationRemark: text("cancellation_remark"),
  renewalReminderSentAt: timestamp("renewal_reminder_sent_at"),
  messageSentAt: timestamp("message_sent_at"),
  pausedAt: timestamp("paused_at"),
  resumedAt: timestamp("resumed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  check("services_remaining_check", sql`${t.totalServices} IS NULL OR ${t.servicesRemaining} = ${t.totalServices} - ${t.servicesUsed}`),
]);

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;
